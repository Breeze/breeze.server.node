var Sequelize = require('sequelize');
var Promise = require("bluebird");
var toposort = require("toposort");

// TODO: transactions
//       server side validations
//       check SaveMap api for consistency with the rest of breeze.

var _ = Sequelize.Utils._;
module.exports = SequelizeSaveHandler;

function SequelizeSaveHandler(sequelizeManager, req) {
  var reqBody = req.body;
  this.sequelizeManager = sequelizeManager;
  this.metadataStore = sequelizeManager.metadataStore;
  this.entitiesFromClient = reqBody.entities;
  this.saveOptions = reqBody.saveOptions;

  this._keyMappings = [];
  this._fkFixupMap = {};
  this._savedEntities = [];
  this.keyGenerator = sequelizeManager.keyGenerator;
  // this._entitiesCreatedOnServer = [];
};

var ctor = SequelizeSaveHandler;

ctor.save = function(sequelizeManager, req ) {
  var saveHandler = new SequelizeSaveHandler(sequelizeManager, req);
  return saveHandler.save();
};

// virtual method - returns boolean
//ctor.prototype.beforeSaveEntity = function(entityInfo)


// virtual method - returns nothing
//ctor.prototype.beforeSaveEntities = function(saveMap)

ctor.prototype.save = function() {
  var beforeSaveEntity = (this.beforeSaveEntity || noopBeforeSaveEntity).bind(this);
  var entityTypeMap = {};

  var entityInfos = this.entitiesFromClient.map(function(entity) {
    // transform entities from how they are sent from the client
    // into entityInfo objects which is how they are exposed
    // to interception on the server.
    var entityAspect = entity.entityAspect;
    var entityTypeName = entityAspect.entityTypeName;
    var entityType = entityTypeMap[entityTypeName];
    if (!entityType) {
      entityType = this.metadataStore.getEntityType(entityTypeName);
      if (entityType) {
        entityTypeMap[entityTypeName] = entityType;
      } else {
        throw new Error("Unable to locate server side metadata for an EntityType named: " + entityTypeName);
      }
    }
    var unmapped = entity.__unmapped;
    var ei = { entity: entity, entityType: entityType, entityAspect: entityAspect, unmapped: unmapped };
    // just to be sure that we don't try to send it to the db server or return it to the client.
    delete entity.entityAspect;
    return ei;
  }, this);

  // create the saveMap (entities to be saved) grouped by entityType
  var saveMapData = _.groupBy(entityInfos, function(entityInfo) {
    // _.groupBy will bundle all undefined returns together.
    if (beforeSaveEntity(entityInfo)) {
      return entityInfo.entityType.name;
    }
  });
  // remove the entries where beforeSaveEntity returned false ( they are all grouped under 'undefined'
  delete saveMapData["undefined"];

  // want to have SaveMap functions available
  var saveMap = _.extend(new SaveMap(this), saveMapData);

  return this._saveWithTransaction(saveMap);

};


ctor.prototype._saveWithTransaction = function(saveMap) {
  var that = this;
  var sequelize = this.sequelizeManager.sequelize;
  return sequelize.transaction().then(function(trx)   {

    var nextPromise;
    var beforeSaveEntities = (that.beforeSaveEntities || noopBeforeSaveEntities).bind(that);
    // beforeSaveEntities will either return nothing or a promise.
    nextPromise = Promise.resolve(beforeSaveEntities(saveMap, trx));

    // saveCore returns either a list of entities or an object with an errors property.
    return nextPromise.then(function () {
      return that._saveCore(saveMap, trx);
    }).then(function (r) {
      if (r.errors) {
        trx.rollback();
        return r;
      } else {
        trx.commit();
        return { entities: r, keyMappings: that._keyMappings };
      }
    }).catch(function (e) {
      trx.rollback();
      throw e;
    });
  });
};


// will be bound to SequelizeSaveHandler instance at runtime.
ctor.prototype._saveCore = function(saveMap, transaction) {
  var that = this;
  if (saveMap.entityErrors || saveMap.errorMessage) {
    return Promise.resolve({ errors: saveMap.entityErrors || [], message: saveMap.errorMessage });
  }

  var entityTypes = _.keys(saveMap).map(function (entityTypeName) {
    // guaranteed to succeed because these have all been looked up earlier.
    return this.metadataStore.getEntityType(entityTypeName);
  }, this);

  var sortedEntityTypes = toposortEntityTypes(entityTypes);
  var entityGroups = sortedEntityTypes.map(function (entityType) {
    return { entityType: entityType, entityInfos: saveMap[entityType.name] };
  });

  // do adds/updates first followed by deletes in reverse order.
  // add/updates come first because we might move children off of a parent before deleting the parent
  // and we don't want to cause a constraint exception by deleting the parent before all of its
  // children have been moved somewhere else.
  return Promise.reduce(entityGroups, function (savedEntities, entityGroup) {
    return that._processEntityGroup(entityGroup, transaction, false).then(function (entities) {
      Array.prototype.push.apply(savedEntities, entities);
      return savedEntities;
    });
  }, []).then(function (entitiesHandledSoFar) {
    return Promise.reduce(entityGroups.reverse(), function (savedEntities, entityGroup) {
      return that._processEntityGroup(entityGroup, transaction, true).then(function (entities) {
        Array.prototype.push.apply(savedEntities, entities);
        return savedEntities;
      });
    }, entitiesHandledSoFar);
  });
}

// Need to handle
// entityKey._id may be null/undefined for entities created only on the server side - so no need for keyMapping

// returns a promise containing resultEntities array when all entities within the group have been saved.
ctor.prototype._processEntityGroup = function(entityGroup, transaction, processDeleted) {

  var entityType = entityGroup.entityType;

  var entityInfos = entityGroup.entityInfos.filter(function(entityInfo) {
    var isDeleted = entityInfo.entityAspect.entityState == "Deleted"
    return processDeleted ? isDeleted : !isDeleted;
  });

  var sqModel = this.sequelizeManager.entityTypeSqModelMap[entityType.name];

//  Promise.reduce(["file1.txt", "file2.txt", "file3.txt"], function(total, fileName) {
//    return fs.readFileAsync(fileName, "utf8").then(function(contents) {
//      return total + parseInt(contents, 10);
//    });
//  }, 0).then(function(total) {
//    //Total is 30
//  });

  var that = this;
  return Promise.reduce(entityInfos, function(savedEntities, entityInfo) {
    // function returns a promise for this entity
    // and updates the results array.
    return that._saveEntityAsync(entityInfo, sqModel, transaction).then(function(savedEntity) {
      savedEntities.push(savedEntity);
      return savedEntities;
    });
  }, []);

};

// returns a promise with the saved entity
ctor.prototype._saveEntityAsync = function(entityInfo, sqModel, transaction) {
  // function returns a promise for this entity
  // and updates the results array.
  var that = this;
  // not a "real" entityAspect - just the salient pieces sent from the client.
  var entity = entityInfo.entity;
  var entityAspect = entityInfo.entityAspect;
  var entityType = entityInfo.entityType;
  var entityTypeName = entityType.name;

  // TODO: determine if this is needed because we need to strip the entityAspect off the entity for inserts.
  entityAspect.entity = entity;

  // TODO: we really only need to coerce every field on an insert
  // only selected fields are needed for update and delete.
  this._coerceData(entity, entityType);
  var keyProperties = entityType.keyProperties;
  var firstKeyPropName = keyProperties[0].nameOnServer;

  var entityState = entityAspect.entityState;
  var trxOptions = { transaction: transaction };
  var promise;
  if (entityState === "Added") {
    var keyMapping = null;
    // NOTE: there are two instances of autoGeneratedKeyType available
    // one on entityType which is part of the metadata and a second
    // on the entityAspect that was sent as part of the save.
    // The one on the entityAspect "overrides" the one on the entityType.

    var autoGeneratedKey = entityAspect.autoGeneratedKey;
    var autoGeneratedKeyType = autoGeneratedKey && autoGeneratedKey.autoGeneratedKeyType;
    if (autoGeneratedKeyType && autoGeneratedKeyType !== "None") {
      var realKeyValue;
      var tempKeyValue = entity[firstKeyPropName];
      if (autoGeneratedKeyType == "KeyGenerator") {
        if (this.keyGenerator == null) {
          throw new Error("No KeyGenerator was provided for property:" + keyProperties[0].name + " on entityType: " + entityType.name);
        }
        promise = this.keyGenerator.getNextId(keyProperties[0]).then(function(nextId) {
          realKeyValue = nextId;
          entity[firstKeyPropName] = realKeyValue;
        });
      } else if (autoGeneratedKeyType == "Identity") {
        var keyDataTypeName = keyProperties[0].dataType.name;
        if (keyDataTypeName === "Guid") {
          // handled here instead of one the db server.
          realKeyValue = createGuid();
          entity[firstKeyPropName] = realKeyValue;
        } else {
          // realValue will be set during 'create' promise resolution below
          realKeyValue = null;
          // value will be set by server's autoincrement logic
          delete entity[firstKeyPropName];
        }
      }
      promise = promise || Promise.resolve(null);
      promise = promise.then(function() {
        // tempKeyValue will be undefined in entity was created on the server
        if (tempKeyValue != undefined) {
          keyMapping = { entityTypeName: entityTypeName, tempValue: tempKeyValue, realValue: realKeyValue };
        }
      })
    }
    promise = promise || Promise.resolve(null);
    return promise.then(function() {
      // return sqModel.create(entity, trxOptions).then(function(savedEntity) {
      return sqModel.create(entity).then(function(savedEntity) {
        if (keyMapping) {
          if (keyMapping.realValue === null) {
            keyMapping.realValue = savedEntity[firstKeyPropName];
          }
          var tempKeyString = buildKeyString(entityType, tempKeyValue);
          that._fkFixupMap[tempKeyString] = keyMapping.realValue;
          that._keyMappings.push(keyMapping);
        }
        return that._addToResults(savedEntity.values, entityTypeName);
      }).catch(handleItemSaveError(entity, entityState));
    });
  } else if (entityState === "Modified") {
    var whereHash = {};
    keyProperties.forEach(function (kp) {
      whereHash[kp.nameOnServer] = entity[kp.nameOnServer];
    });

    if (entityType.concurrencyProperties && entityType.concurrencyProperties.length > 0) {
      entityType.concurrencyProperties.forEach(function (cp) {
        whereHash[cp.nameOnServer] = entityAspect.originalValuesMap[cp.nameOnServer];
      });
    }
    var setHash;
    if (entityInfo.forceUpdate) {
      setHash = _.clone(entity);
      // remove fields that we don't want to 'set'
      delete setHash.entityAspect;
      // TODO: should we also remove keyProps here...
    } else {
      setHash = {};
      var ovm = entityAspect.originalValuesMap;
      if (ovm == null) {
        throw new Error("Unable to locate an originalValuesMap for one of the 'Modified' entities to be saved");
      }
      Object.keys(ovm).forEach(function (k) {
        // if k is one of the entityKeys do no allow this
        var isKeyPropName = keyProperties.some(function(kp) {
          return kp.nameOnServer == k;
        });
        if (isKeyPropName) {
          throw new Error("Breeze does not support updating any part of the entity's key insofar as this changes the identity of the entity");
        }
        setHash[k] = entity[k];
      });
    }
    var that = this;
    // don't bother executing update statement if nothing to update
    // this can happen if setModified is called without any properties being changed.
    if (_.isEmpty(setHash)) {
      return Promise.resolve(that._addToResults(entity, entityTypeName));
    }
    // return sqModel.update(setHash, { where: whereHash }, trxOptions).then(function(infoArray) {
    return sqModel.update(setHash, { where: whereHash }).then(function(infoArray) {
      var itemsSaved = infoArray[0];
      if (itemsSaved != 1) {
        var err = new Error("unable to update entity - concurrency violation");
        err.entity = entity;
        err.entityState = entityState;
        throw err;
      }
      // HACK: Sequelize 'update' does not return the entity; so
      // we are just returning the original entity here.
      return that._addToResults(entity, entityTypeName);
    }).catch(handleItemSaveError(entity, entityState));
  } else if (entityState = "Deleted") {
    var whereHash = {};
    keyProperties.forEach(function (kp) {
      whereHash[kp.nameOnServer] = entity[kp.nameOnServer];
    });
    // we don't bother with concurrency check on deletes
    // TODO: we may want to add a 'switch' for this later.
    // return sqModel.destroy({ where: whereHash, limit: 1, transaction: transaction}).then(function() {
    return sqModel.destroy({ where: whereHash, limit: 1}).then(function() {
      // Sequelize 'destroy' does not return the entity; so
      // we are just returning the original entity here.
      return that._addToResults(entity, entityTypeName);
    }).catch(handleItemSaveError(entity, entityState))
  }
};


ctor.prototype._addToResults = function(entity, entityTypeName) {
  entity.$type = entityTypeName;
  this._savedEntities.push(entity);
  return entity;
};

ctor.prototype._coerceData = function(entity, entityType) {
  var that = this;
  entityType.dataProperties.forEach(function(dp) {

    var val = entity[dp.nameOnServer];
    if (val != null) {
      if (dp.relatedNavigationProperty != null) {
        // if this is an fk column and it has a value
        // check if there is a fixed up value.
        var key = buildKeyString(dp.relatedNavigationProperty.entityType, val);
        var newVal = that._fkFixupMap[key];
        if (newVal) {
          entity[dp.nameOnServer] = newVal;
        }
      }

      var dtName = dp.dataType.name;
      if (dtName === "DateTime" || dtName === "DateTimeOffset") {
        entity[dp.nameOnServer] = new Date(Date.parse(val));
      }
    } else {
      //      // this allows us to avoid inserting a null.
      //      // TODO: think about an option to allow this if someone really wants to.
      //      delete entity[dp.name];
      //    }
    }
  })
}

function SaveMap(sequelizeSaveHandler) {
  // want to make sequelizeSaveHandler non enumerable.
  Object.defineProperty(this,  "sequelizeSaveHandler", { value: sequelizeSaveHandler });
}

SaveMap.prototype.getEntityType = function(entityTypeName) {
  return this.sequelizeSaveHandler.metadataStore.getEntityType(entityTypeName);
}

SaveMap.prototype.getEntityInfosOfType = function(entityTypeName) {
  var entityType = this.getEntityType(entityTypeName);
  // entityType.name is fully qualified.
  return this[entityType.name] || [];
}

SaveMap.prototype.addEntity = function(entityTypeName, entity, entityState) {
  var entityType = this.getEntityType(entityTypeName);
  entityTypeName = entityType.name; // fully qualified now.
  var entityInfo = {
    entity: entity, entityType: entityType, wasAddedOnServer: true
  };
  entityInfo.entityAspect = {
    entityTypeName: entityTypeName,
    entityState: entityState || "Added"
  }

  var entityInfoList = this[entityTypeName];
  if (entityInfoList) {
    entityInfoList.push(entityInfo);
  } else {
    this[entityTypeName] = [ entityInfo ];
  }
  return entityInfo;
}

SaveMap.prototype.addEntityError = function(entityInfo, errorName, errorMessage, propertyName) {
  if (!this.entityErrors) {
    this.entityErrors = [];
  }

  var entityType = entityInfo.entityType;
  var keyValues = entityType.keyProperties.map(function (kp) {
    return entityInfo.entity[kp.nameOnServer];
  });
  this.entityErrors.push({
    entityTypeName: entityType.name,
    errorName: errorName,
    errorMessage: errorMessage,
    propertyName: propertyName,
    keyValues: keyValues
  });
}

SaveMap.prototype.setErrorMessage = function(errorMessage) {
  this.errorMessage = errorMessage;
}

// will either return nothing or a promise.
function noopBeforeSaveEntities(saveMap) {
  return
}

function noopBeforeSaveEntity(entityInfo) {
  return true;
}


function toposortEntityTypes(entityTypes) {
  var edges = [];
  entityTypes.forEach(function(et) {
    et.foreignKeyProperties.forEach(function(fkp) {
      if (fkp.relatedNavigationProperty) {
        var dependsOnType = fkp.relatedNavigationProperty.entityType;
        if (et != dependsOnType) {
          edges.push( [et, dependsOnType]);
        }
      }
    });
  });
  // this should work but toposort.array seems to have a bug ...
  // var sortedEntityTypes = toposort.array(entityTypes, edges).reverse();
  // so use this instead.
  var allSortedTypes = toposort(edges).reverse();
  allSortedTypes.forEach(function(st, ix) {
    st.index = ix;
  });
  var sortedEntityTypes = entityTypes.sort(function(a, b) {
    return a.index - b.index;
  });
  return sortedEntityTypes;
}

function buildKeyString(entityType, val) {
  return entityType.name + "::" + val.toString();
}

function handleItemSaveError(entity, entityState) {
  return function(err) {
    err = typeof(err) == 'string' ? new Error(err) : err;
    var detailedMsg = (err.name ? "error name: " + err.name : "") + ( err.sql ? " sql: " + err.sql : "");
    err.message = err.message ? err.message + ". " + detailedMsg : detailedMsg;
    err.entity = entity;
    err.entityState = entityState;
    throw err;
  }
}

function createGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Not needed.
//// task is a function that returns a promise.
//function sequencePromises(tasks) {
//  var current = Promise.resolve(), results = [];
//  for (var k = 0; k < tasks.length; ++k) {
//    results.push(current = current.then(tasks[k]));
//  }
//  return Promise.all(results);
//}