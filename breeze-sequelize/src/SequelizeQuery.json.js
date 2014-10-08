var Sequelize = require('sequelize');
var Promise = require("bluebird");
var url = require("url");
var breeze = require('breeze-client');

var _ = Sequelize.Utils._;

var DataService = breeze.DataService;
var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;

module.exports = SequelizeQuery;

// TODO: still need to add support for OData fns like toUpper, length etc.
// TODO: still need to add support for OData any/all

function SequelizeQuery(sequelizeManager, config) {

  this.sequelizeManager = sequelizeManager;
  this.metadataStore = sequelizeManager.metadataStore;

  if (config.url) {
    var parsedUrl = url.parse(config.url, true);
    this.pathname = parsedUrl.pathname;

    // this is because everything after the '?' is turned into a query object with a single key
    // where the key is the value of the string after the '?" and with a 'value' that is an empty string.
    // So we want the key and not the value.
    var jsonQueryString = Object.keys(parsedUrl.query)[0];
    this.jsonQuery = JSON.parse(jsonQueryString);
    this.metadataStore.onServer = config.isUsingServerNames;
    var entityQuery = new EntityQuery(this.jsonQuery);
    this.entityQuery = entityQuery.from(this.pathname);
    this.metadataStore.onServer = true;
  } else if (config.entityQuery) {
    this.entityQuery = config.entityQuery;
  }

  this.entityType = this.entityQuery._getFromEntityType(this.metadataStore, true);
  this.sqQuery = this._processQuery();

}

SequelizeQuery.prototype.execute = function() {
  var that = this;
  this.metadataStore.onServer = true;
  return this.executeRaw().then(function(r) {
    var result = that._reshapeResults(r);
    return Promise.resolve(result);
  })
}

SequelizeQuery.prototype.executeRaw = function() {
  var model = this.sequelizeManager.resourceNameSqModelMap[this.pathname];
  var methodName = this.entityQuery.inlineCountEnabled ? "findAndCountAll" : "findAll";
  var r = model[methodName].call(model, this.sqQuery);
  return r;
}



// pass in either a query string or a urlQuery object
//    a urlQuery object is what is returned by node's url.parse(aUrl, true).query;
SequelizeQuery.prototype._processQuery = function() {
  var section;
  var entityQuery = this.entityQuery;
  var sqQuery = this.sqQuery = {};
  sqQuery.include = [];

  this._processWhere();

  this._processSelect();

  this._processOrderBy();

  this._processExpand();

  var section = entityQuery.takeCount;
  // not ok to ignore top: 0
  if (section !== undefined) {
    sqQuery.limit = entityQuery.takeCount;
  }

  section = entityQuery.skipCount
  // ok to ignore skip: 0
  if (section) {
    sqQuery.offset = entityQuery.skipCount;
  }

//  // Empty include is ok with Sequelize.
//  if (_.isEmpty(this.sqQuery.include)) {
//    delete this.sqQuery.include;
//  }
  return this.sqQuery;

}

SequelizeQuery.prototype._processWhere = function() {
  var wherePredicate = this.entityQuery.wherePredicate;
  if (wherePredicate == null) return;
  var where = wherePredicate.visit(toSQVisitor, {
    entityType: this.entityType,
    sequelizeQuery: this,
    metadataStore: this.metadataStore
  });
  // this can happen if all predicates are nested
  // in which case the top level where becomes null, and includes hold
  // the where clauses.
  if ( where != null) {
    var where2 = processAndOr(where);
    this.sqQuery.where = where2;
  }
}

SequelizeQuery.prototype._processSelect = function() {
  var selectClause = this.entityQuery.selectClause;
  if (selectClause == null) return;
  // extract any nest paths and move them onto the include
  var navPropertyPaths = [];
  this.sqQuery.attributes = selectClause.propertyPaths.filter(function(pp) {
    var props = this.entityType.getPropertiesOnPath(pp, true);
    var isNavPropertyPath = props[0].isNavigationProperty;
    if (isNavPropertyPath) {
      this._addInclude(null, props);
    }
    return !isNavPropertyPath;
  }, this);
}

SequelizeQuery.prototype._processOrderBy = function() {
  var orderByClause = this.entityQuery.orderByClause;
  if (orderByClause == null) return;
  var orders = this.sqQuery.order = [];
  orderByClause.items.forEach(function(item) {
    var pp = item.propertyPath;
    var props = this.entityType.getPropertiesOnPath(pp, true);
    var isNavPropertyPath = props[0].isNavigationProperty;
    if (isNavPropertyPath) {
      this._addInclude(this.sqQuery, props);
    }
    var nextParent = this.sqQuery;
    var r = [];
    orders.push(r);

    props.forEach(function(prop) {
      if (prop.isNavigationProperty) {
        nextParent = this._getIncludeFor(nextParent, prop)
        r.push(nextParent);
      } else {
        if (item.isDesc) {
          r.push([ prop.nameOnServer, "DESC"]);
        } else {
          r.push(prop.nameOnServer);
        }
      }
    }, this);
  }, this);

};

SequelizeQuery.prototype._processExpand = function() {
  var expandClause = this.entityQuery.expandClause;
  if (expandClause == null) return;
  expandClause.propertyPaths.forEach(function(pp) {
    var props = this.entityType.getPropertiesOnPath(pp, true);
    this._addInclude(null, props);
  }, this);
};

SequelizeQuery.prototype._reshapeResults = function(sqResults) {
  // -) nested projections need to be promoted up to the top level
  //    because sequelize will have them appearing on nested objects.
  // -) Sequelize nested projections need to be removed from final results if not part of select
  // -) need to support nested select aliasing
  // -) inlineCount handling
  this.metadataStore.onServer = true;
  this._nextId = 1;
  this._map = {};
  if (this.entityQuery.selectClause) {
    return this._reshapeSelectResults(sqResults);
  }
  var inlineCount;
  if (this.entityQuery.inlineCountEnabled) {
    inlineCount = sqResults.count;
    sqResults = sqResults.rows;
  }
  var expandClause = this.entityQuery.expandClause;
  var expandPaths = [];
  if (expandClause) {
    // each expand path consist of an array of expand props.
    expandPaths = expandClause.propertyPaths.map(function (pp) {
      return this.entityType.getPropertiesOnPath(pp, true);
    }, this);
  }

  var results = sqResults.map(function (sqResult) {
    var result = this._createResult(sqResult, this.entityType, expandClause != null);
    // each expandPath is a collection of expandProps
    if (!result.$ref) {
      expandPaths.forEach(function (expandProps) {
        this._populateExpand(result, sqResult, expandProps);
      }, this);
    }
    return result;
  }, this);
  if (inlineCount != undefined) {
    return { results: results, inlineCount: inlineCount };
  } else {
    return results;
  }
}

SequelizeQuery.prototype._reshapeSelectResults = function(sqResults) {
  var results = sqResults.map(function(sqResult) {
    // start with the sqResult and then promote nested properties up to the top level
    // while removing nested path.
    var result = sqResult.dataValues;
    var parent = sqResult;
    selectClause.propertyPaths.forEach(function (pp) {
      var props = this.entityType.getPropertiesOnPath(pp, true);
      var lastProp = props[0];

      while (props.length > 0 && props[0].isNavigationProperty) {
        lastProp = props[0];
        var oldParent = parent;
        parent = parent[prop[0].nameOnServer];
        // remove node from parent
        oldParent[prop[0].nameOnServer] = undefined;
        props = props.slice(0);
      }
      var val = parent[lastProp.nameOnServer];
      val = val.dataValues || val;
      result[pp] = val;
    }, this);
    return result;
  });
  return results;
}

SequelizeQuery.prototype._createResult = function(sqResult, entityType, checkCache) {
  if (checkCache) {
    var key = getKey(sqResult, entityType);
    var cachedItem = this._map[key];
    if (cachedItem) {
      return { $ref: cachedItem.$id };
    } else {
      sqResult.$id = this._nextId;
      this._nextId += 1;
      this._map[key] = sqResult;
    }
  }
  var result = sqResult.dataValues;
  if (checkCache) {
    result.$id = sqResult.$id;
  }
  result.$type = entityType.name;
  var nps = entityType.navigationProperties;
  // first remove all nav props
  nps.forEach(function (np) {
    var navValue = sqResult[np.nameOnServer];
    if (navValue) {
      result[np.nameOnServer] = undefined;
    }
  });
  return result;
}

function getKey(sqResult, entityType) {
  var key = entityType.keyProperties.map(function(kp) {
    return sqResult[kp.nameOnServer];
  }).join("::") + "^" + entityType.name;
  return key;
}

SequelizeQuery.prototype._populateExpand = function(result, sqResult, expandProps) {

  if (expandProps == null || expandProps.length == 0) return;
  // now blow out all of the expands
  // each expand path consist of an array of expand props.
  var npName = expandProps[0].nameOnServer;
  var nextResult = result[npName];

  var nextEntityType = expandProps[0].entityType;
  var nextSqResult = sqResult[npName];

  // if it doesn't already exist then create it
  if (nextResult == null) {
    if (_.isArray(nextSqResult)) {
      nextResult = nextSqResult.map(function(nextSqr) {
        return this._createResult(nextSqr, nextEntityType, true);
      }, this);
    } else {
      nextResult = this._createResult(nextSqResult, nextEntityType, true);
    }
    result[npName] = nextResult;
  }

  if (_.isArray(nextSqResult)) {
    nextSqResult.forEach(function(nextSqr, ix) {
      if (!nextResult[ix].$ref) {
        this._populateExpand(nextResult[ix], nextSqr, expandProps.slice(1));
      }
    }, this)
  } else {
    if (!nextResult.$ref) {
      this._populateExpand(nextResult, nextSqResult, expandProps.slice(1));
    }
  }

}




SequelizeQuery.prototype._addInclude = function(parent, props) {
  // returns 'last' include in props chain
  var prop = props[0];
  if (!parent) parent = this.sqQuery;
  var include = this._getIncludeFor(parent, props[0]);
  // $disallowAttributes code is used to insure two things
  // 1) if a navigation property is declared as the last prop of a select or expand expression
  //    that it is not 'trimmed' i.e. has further 'attributes' added that would narrow the projection.
  // 2) that we support restricted projections on expanded nodes as long as we don't
  //    violate #1 above.
  props = props.slice(1);
  if (props.length > 0) {
    if (props[0].isNavigationProperty) {
      return this._addInclude(include, props);
    } else {
      // dataProperty
      if (!include.$disallowAttributes) {
        include.attributes = include.attributes || [];
        include.attributes.push(props[0].nameOnServer);
      }
    }
  } else {
    // do not allow attributes set on any final navNodes nodes
    include.$disallowAttributes = true
    // and remove any that might have been added.
    delete include.attributes;
  }
  return include;
}

SequelizeQuery.prototype._getIncludeFor = function(parent, prop) {
  var sqModel = this.sequelizeManager.entityTypeSqModelMap[prop.entityType.name];
  var includes = parent.include = parent.include || [];
  var include = _.find(includes, { model: sqModel });
  if (!include) {
    var include = {model: sqModel, as: prop.nameOnServer }
    includes.push(include);
  }
  return include;
}


var toSQVisitor = (function () {
  var visitor = {

    passthruPredicate: function () {
      return this.value;
    },

    unaryPredicate: function (context, predSQ) {
      if (this.op.key !== "not") {
        throw new Error("Not yet implemented: Unary operation: " + this.op.key + " pred: " + JSON.stringify(this.pred));
      }
      return applyNot(predSQ);
    },

    binaryPredicate: function (context) {
      var q = {};
      var op = this.op.key;
      // TODO: right now only handling case where e1 : PropExpr and e2 : LitExpr | PropExpr
      // not yet handled: e1: FnExpr | e2: FnExpr

      var p1Value, p2Value;
      if (this.expr1.visitorMethodName === "propExpr") {
        p1Value = this.expr1.propertyPath;
        var props = context.entityType.getPropertiesOnPath(p1Value, true);
        if (props.length > 1) {
          // handle a nested property path on the LHS - query gets moved into the include
          var include = context.sequelizeQuery._addInclude(null, props);
          // after this line the logic below will apply to the include instead of the top level where.
          var q = include.where = include.where || {};
        }
        if (this.expr2.visitorMethodName === "litExpr") {
          p2Value = this.expr2.value;
          if (op === "eq") {
            q[p1Value] = p2Value;
          } else if (op == "startswith") {
            q[p1Value] = { like: p2Value + "%" };
          } else if (op === "endswith") {
            q[p1Value] = { like: "%" + p2Value };
          } else if (op === "contains") {
            q[p1Value] = { like: "%" + p2Value + "%" };
          } else {
            var mop = _boolOpMap[op].sequelizeOp;
            var crit = {};
            crit[mop] = p2Value;
            q[p1Value] = crit;
          }
        } else if (this.expr2.visitorMethodName == "propExpr") {
          var p2Value = this.expr2.propertyPath;
          var colVal = Sequelize.col(p2Value);
          if (op === "eq") {
            q[p1Value] = colVal;
          } else if (op === "startswith") {
            q[p1Value] = { like: Sequelize.literal("concat(" + p2Value + ",'%')") };
          } else if (op === "endswith") {
            q[p1Value] = { like: Sequelize.literal("concat('%'," + p2Value + ")") };
          } else if (op === "contains") {
            q[p1Value] = { like: Sequelize.literal("concat('%'," + p2Value + ",'%')") };
          } else {
            var mop = _boolOpMap[op].sequelizeOp;
            var crit = {};
            crit[mop] = colVal;
            q[p1Value] = crit;
          }
        }
        // check if query got moved into the include.
        if (include != null) {
          return null;
        }
      } else {
        throw new Error("Not yet implemented: binary predicate with a expr1 type of: " + this.expr1.visitorMethodName + " - " + this.expr1.toString());
      }
      return q;
    },

    andOrPredicate: function (context, predSQs) {
      // compacting is needed because preds involving nested property paths
      // will have been removed ( moved onto an include).
      var preds = _.compact(predSQs);

      if (this.op.key === "and") {
        if (preds.length == 0) {
          q = null;
        } else if (preds.length == 1) {
          q = preds[0];
        } else {
          q = { and: preds };
          // q = Sequelize.and(q1, q2);
        }
      } else {
        if (preds.length != predSQs.length) {
          throw new Error("Cannot translate a query with nested property paths and 'OR' conditions to Sequelize. (Sorry).")
        }
        q = { or: preds };
        // q = Sequelize.or(q1, q2);
      }
      return q;
    },

    anyAllPredicate: function (context) {
      throw new Error("any/all processing not yet implemented");
    },

    litExpr: function () {

    },

    propExpr: function (context) {

    },

    fnExpr: function (context) {
    }
  };




  return visitor;
}());


function applyNot(q1) {

  // rules are:
  // not { a: 1}             -> { a: { ne: 1 }}
  // not { a: { gt: 1 }}    -> { a: { le: 1}}}
  // not { and: { a: 1, b: 2 } -> { or:  { a: { $ne: 1 }, b: { $ne 2 }}}
  // not { or  { a: 1, b: 2 } -> { and: [ a: { $ne: 1 }, b: { $ne 2 }]}

  var results = [], result;
  for (var k in q1) {
    var v = q1[k];
    if (k === "or") {
      result = { and: [ applyNot(v[0]), applyNot(v[1]) ] };
    } else if (k === "and") {
      result = { or: [ applyNot(v[0]), applyNot(v[1]) ] };
    } else if ( _notOps[k] ) {
      result = {};
      result[_notOps[k]] = v;
    } else {
      result = {};
      if ( v!=null && typeof(v) === "object") {
        result[k] = applyNot(v);
      } else {
        result[k] = { "ne": v };
      }
    }

    results.push(result);
  }
  if (results.length === 1) {
    return results[0];
  } else {
    // Don't think we should ever get here with the current logic because all
    // queries should only have a single node
    return { "or": results };
  }
}

// needed to convert 'or:' and 'and:' clauses into Sequelize.and/or clauses
function processAndOr( where) {
  var clauses;
  if ( where.and) {
    clauses = where.and.map(function(clause) {
      return processAndOr(clause);
    })
    return Sequelize.and.apply(null, clauses)
    // return Sequelize.and(clauses[0], clauses[1]);
  } else if (where.or) {
    clauses = where.or.map(function(clause) {
      return processAndOr(clause);
    })
    return Sequelize.or.apply(null, clauses);
  } else {
    return where;
  }
}

var _boolOpMap = {
  eq: { jsOp: "===", not: "ne"},
  gt: { sequelizeOp: "gt",  jsOp: ">", not: "le" },
  ge: { sequelizeOp: "gte", jsOp: ">=", not: "lt"  },
  lt: { sequelizeOp: "lt",  jsOp: "<" , not: "ge"},
  le: { sequelizeOp: "lte", jsOp: "<=", not: "gt" },
  ne: { sequelizeOp: "ne",  jsOp: "!=", not: "eq" }
};

var _notOps = {
  gt: "lte",
  lte: "gt",
  gte: "lt",
  lt: "gte",
  ne: "eq",
  eq: "ne",
  like: "nlike",
  nlike: "like"
};

// Used to determine if a clause is the result of a Sequelize.and/or method call.
// Not currently need because of processAndOr method below
//var isSequelizeAnd = function(o) {
//  return Object.getPrototypeOf(o).constructor == Sequelize.Utils.and;
//}
//
//var isSequelizeOr = function(o) {
//  return Object.getPrototypeOf(o).constructor == Sequelize.Utils.or;
//}
// --------------------------------



