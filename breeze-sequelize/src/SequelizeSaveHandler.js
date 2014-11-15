var Sequelize = require('sequelize');
var Promise = require("bluebird");
var toposort = require("toposort");

var _ = Sequelize.Utils._;
module.exports = SequelizeSaveHandler;

function SequelizeSaveHandler(sequelizeManager, req) {
  var reqBody = req.body;
  this.sequelizeManager = sequelizeManager;
  this.metadataStore = sequelizeManager.metadataStore;
  this.entities = reqBody.entities;
  this.saveOptions = reqBody.saveOptions;

  // this.saveMap - created later

  this._keyMappings = [];
  this._fkFixupMap = {};
  this._savedEntities = [];
  this._entitiesCreatedOnServer = [];
};

var ctor = SequelizeSaveHandler;

ctor.save = function(db, req ) {
  var saveHandler = new SequelizeSaveHandler(db, req);
  return saveHandler.save();
};

// virtual method - returns boolean
//ctor.prototype.beforeSaveEntity = function(entity)


// virtual method - returns nothing
//ctor.prototype.beforeSaveEntities = function(saveMap)

ctor.prototype.save = function() {
  var beforeSaveEntity = (this.beforeSaveEntity || noopBeforeSaveEntity).bind(this);

  // create the saveMap (entities to be saved) grouped by entityType
  var saveMap = _.groupBy(this.entities, function(entity) {
    if (beforeSaveEntity(entity)) {
      return entity.entityAspect.entityTypeName;
    }
  });
  // saveMap.addEntity = addEntity;

  var beforeSaveEntities = (this.beforeSaveEntities || noopBeforeSaveEntities).bind(this);
  beforeSaveEntities(saveMap);

  var that = this;
  return this._saveCore(saveMap).then(function(savedEntities) {
    return { entities: savedEntities, keyMappings: that._keyMappings };
  }).catch(function(e) {
    throw e;
  });
};

function addEntity(entity, entityTypeName, entityState) {
  var entityTypeName = this.qualifyTypeName(entityTypeName);
  entity.entityAspect = {
    entityTypeName: entityTypeName,
    entityState: entityState || "Added",
    wasCreatedOnServer: true
  };

  var entityList = this[entityTypeName];
  if (entityList) {
    entityList.push(entity);
  } else {
    this[entityTypeName] = [ entity ];
  }

  return entity;
};

function noopBeforeSaveEntities(fn) {
  fn();
}

function noopBeforeSaveEntity(entity) {
  return true;
}

// will be bound to SequelizeSaveHandler instance at runtime.
ctor.prototype._saveCore = function(saveMap) {
  var that = this;

  var entityTypes = _.keys(saveMap).map(function(entityTypeName) {
    var entityType = this.metadataStore.getEntityType(entityTypeName);
    if (!entityType) {
      this._raiseError(new Error("Unable to locate server side metadata for an EntityType named: " + entityTypeName));
    }
    return entityType;
  }, this);

  var sortedEntityTypes = toposortEntityTypes(entityTypes);
  var entityGroups = sortedEntityTypes.map(function(entityType) {
    return { entityType: entityType, entities: saveMap[entityType.name] };
  });

  return Promise.reduce(entityGroups, function(savedEntities, entityGroup) {
    return that._processEntityGroup(entityGroup).then(function(entities) {
      Array.prototype.push.apply(savedEntities, entities);
      return savedEntities;
    });
  }, []);

};

// Need to handle
// entityKey._id may be null/undefined for entities created only on the server side - so no need for keyMapping

// returns a promise containing resultEntities array when all entities within the group have been saved.
ctor.prototype._processEntityGroup = function(entityGroup) {

  var entityType = entityGroup.entityType;
  var entities = entityGroup.entities;

  var sqModel = this.sequelizeManager.entityTypeSqModelMap[entityType.name];

//  Promise.reduce(["file1.txt", "file2.txt", "file3.txt"], function(total, fileName) {
//    return fs.readFileAsync(fileName, "utf8").then(function(contents) {
//      return total + parseInt(contents, 10);
//    });
//  }, 0).then(function(total) {
//    //Total is 30
//  });

  var that = this;
  return Promise.reduce(entities, function(savedEntities, entity) {
    // function returns a promise for this entity
    // and updates the results array.
    return that._saveEntityAsync(entity, entityType, sqModel).then(function(savedEntity) {
      savedEntities.push(savedEntity);
      return savedEntities;
    });
  }, []);

};

// returns a promise with the saved entity
ctor.prototype._saveEntityAsync = function(entity, entityType, sqModel) {
  // function returns a promise for this entity
  // and updates the results array.
  var that = this;
  // not a "real" entityAspect - just the salient pieces sent from the client.
  var entityAspect = entity.entityAspect;
  var entityTypeName = entityType.name;

  // just to be sure that we don't try to send it to the server or return it to the client.
  delete entity.entityAspect;
  // TODO: determine if this is needed because we need to strip the entityAspect off the entity for inserts.
  entityAspect.entity = entity;

  // TODO: we really only need to coerce every field on an insert
  // only selected fields are needed for update and delete.
  this._coerceData(entity, entityType);
  var keyProperties = entityType.keyProperties;
  var firstKeyPropName = keyProperties[0].nameOnServer;

  var entityState = entityAspect.entityState;
  if (entityState === "Added") {
    var autoGeneratedKeyType = entityType.autoGeneratedKeyType;
    var keyMapping = null;
    if (autoGeneratedKeyType && autoGeneratedKeyType.name !== "None") {
      var tempKeyValue = entity[firstKeyPropName];
      var keyDataTypeName = keyProperties[0].dataType.name;
      if (keyDataTypeName === "Guid") {
        // handled here instead of one the db server.
        var realKeyValue = createGuid();
        entity[firstKeyPropName] = realKeyValue;
        keyMapping = { entityTypeName: entityTypeName, tempValue: tempKeyValue, realValue: realKeyValue };
      } else {
        // realValue will be set during 'create' promise resolution below
        keyMapping = { entityTypeName: entityTypeName, tempValue: tempKeyValue, realValue: null };
        // value will be set by server's autoincrement logic
        delete entity[firstKeyPropName];
      }
    }
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
    if (entityAspect.forceUpdate) {
      setHash = _.clone(entity);
      // remove fields that we don't want to 'set'
      delete setHash.entityAspect;
      // TODO: should we also remove keyProps here...
    } else {
      setHash = {};
      Object.keys(entityAspect.originalValuesMap).forEach(function (k) {
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
    return sqModel.update(setHash, { where: whereHash }).then(function(savedEntity) {
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