var Sequelize = require('sequelize');
var Promise = require("bluebird");
var urlUtils = require("url");
var breeze = require('breeze-client');

var _ = Sequelize.Utils._;
var EntityQuery = breeze.EntityQuery;

EntityQuery.fromUrl = function(url, resourceName ) {
  var parsedUrl = urlUtils.parse(url, true);
  var resourceName =  resourceName || parsedUrl.pathname;

  // this is because everything after the '?' is turned into a query object with a single key
  // where the key is the value of the string after the '?" and with a 'value' that is an empty string.
  // So we want the key and not the value.
  var jsonQueryString = Object.keys(parsedUrl.query)[0];
  var jsonQuery = JSON.parse(jsonQueryString);

  entityQuery = new EntityQuery(jsonQuery);
  entityQuery = entityQuery.from(resourceName).useNameOnServer(true);

  // for debugging
  entityQuery.jsonQuery = jsonQuery;
  return entityQuery;
}

module.exports = SequelizeQuery;

// TODO: still need to add support for fns like toUpper, length etc.
// TODO: still need to add support for any/all

// config.url:
// config.pathName: if null - url
// config.entityQuery:
// config.entityQueryFn: a fn(entityQuery) -> entityQuery
function SequelizeQuery(sequelizeManager, serverSideEntityQuery) {

  this.sequelizeManager = sequelizeManager;
  this.metadataStore = sequelizeManager.metadataStore;

  this.entityType = serverSideEntityQuery._getFromEntityType(this.metadataStore, true);
  this.entityQuery = serverSideEntityQuery;
  this.sqQuery = this._processQuery();

}

SequelizeQuery.prototype.execute = function() {
  var that = this;
  return this.executeRaw().then(function(r) {
    var result = that._reshapeResults(r);
    return Promise.resolve(result);
  })
}

SequelizeQuery.prototype.executeRaw = function() {
  var model = this.sequelizeManager.resourceNameSqModelMap[this.entityQuery.resourceName];
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
  if (section != null) {
    // HACK: sequelize limit ignores limit(0) so we need to turn it into a limit(1)
    // and then 'ignore' the result later.
    sqQuery.limit = entityQuery.takeCount || 1;
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
  var sqQuery = wherePredicate.visit({
    entityType: this.entityType,
    usesNameOnServer: this.entityQuery.usesNameOnServer,
    sequelizeQuery: this,
    metadataStore: this.metadataStore
  }, toSQVisitor);


  this.sqQuery.where = sqQuery.where;
  // this.sqQuery.include = sqQuery.includes;
  this.sqQuery.include = cvtIncludes(sqQuery.includes);

  processAndOr(this.sqQuery);
}

function cvtIncludes(includes) {
  if (includes) {
    includes.forEach(function(include) {
      if (include.includes) {
        include.include = cvtIncludes(include.includes);
        delete include.includes;
      }
    });
  }
  return includes;
}

SequelizeQuery.prototype._processSelect = function() {
  var selectClause = this.entityQuery.selectClause;
  var usesNameOnServer = this.entityQuery.usesNameOnServer;
  if (selectClause == null) return;
  // extract any nest paths and move them onto the include
  var navPropertyPaths = [];
  this.sqQuery.attributes = selectClause.propertyPaths.map(function(pp) {
    var props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
    var isNavPropertyPath = props[0].isNavigationProperty;
    if (isNavPropertyPath) {
      this._addInclude(this.sqQuery, props);
    }
    if (isNavPropertyPath) return null;
    return usesNameOnServer ?  pp : _.pluck(props, "nameOnServer").join(".");
  }, this).filter(function(pp) {
    return pp != null;
  });
}

SequelizeQuery.prototype._processOrderBy = function() {
  var orderByClause = this.entityQuery.orderByClause;
  var usesNameOnServer = this.entityQuery.usesNameOnServer;
  if (orderByClause == null) return;
  var orders = this.sqQuery.order = [];
  orderByClause.items.forEach(function(item) {
    var pp = item.propertyPath;
    var props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
    var isNavPropertyPath = props[0].isNavigationProperty;
    if (isNavPropertyPath) {
      this._addInclude(this.sqQuery, props);
    }

    var r = [];
    orders.push(r);

    props.forEach(function(prop) {
      if (prop.isNavigationProperty) {
        var modelAs = this._getModelAs(prop)
        r.push(modelAs);
      } else {
        r.push(prop.nameOnServer);
        if (item.isDesc) {
          r.push("DESC");
        }
      }
    }, this);
  }, this);

};

SequelizeQuery.prototype._processExpand = function() {
  var expandClause = this.entityQuery.expandClause;
  var usesNameOnServer = this.entityQuery.usesNameOnServer;
  if (expandClause == null) return;
  expandClause.propertyPaths.forEach(function(pp) {
    var props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
    this._addInclude(this.sqQuery, props);
  }, this);
};

SequelizeQuery.prototype._reshapeResults = function(sqResults) {
  // -) nested projections need to be promoted up to the top level
  //    because sequelize will have them appearing on nested objects.
  // -) Sequelize nested projections need to be removed from final results if not part of select
  // -) need to support nested select aliasing
  // -) inlineCount handling

  this._nextId = 1;
  this._keyMap = {};
  this._refMap = {};
  if (this.entityQuery.selectClause) {
    return this._reshapeSelectResults(sqResults);
  }
  var inlineCount;
  if (this.entityQuery.inlineCountEnabled) {
    inlineCount = sqResults.count;
    sqResults = sqResults.rows;
  }
  var expandClause = this.entityQuery.expandClause;
  var usesNameOnServer = this.entityQuery.usesNameOnServer;
  var expandPaths = [];
  if (expandClause) {
    // each expand path consist of an array of expand props.
    expandPaths = expandClause.propertyPaths.map(function (pp) {
      return this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
    }, this);
  }

  // needed because we had to turn take(0) into limit(1)
  if (this.entityQuery.takeCount == 0) {
    sqResults = [];
  }
  var results = sqResults.map(function (sqResult) {
    var result = this._createResult(sqResult, this.entityType, expandClause != null);
    // each expandPath is a collection of expandProps

    // if (!result.$ref) {
      expandPaths.forEach(function (expandProps) {
        this._populateExpand(result, sqResult, expandProps);
      }, this);
    // }
    return result;
  }, this);

  if (inlineCount != undefined) {
    return { results: results, inlineCount: inlineCount };
  } else {
    return results;
  }
}

SequelizeQuery.prototype._reshapeSelectResults = function(sqResults) {
  var inlineCount;
  if (this.entityQuery.inlineCountEnabled) {
    inlineCount = sqResults.count;
    sqResults = sqResults.rows;
  }
  var propertyPaths = this.entityQuery.selectClause.propertyPaths;
  var usesNameOnServer = this.entityQuery.usesNameOnServer;
  var results = sqResults.map(function(sqResult) {
    // start with the sqResult and then promote nested properties up to the top level
    // while removing nested path.
    var result = sqResult.dataValues;
    var parent = sqResult;
    propertyPaths.forEach(function (pp) {
      var props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
      var nextProp = props[0];
      remainingProps = props.slice(0);
      while (remainingProps.length > 1 && nextProp.isNavigationProperty) {
        // remove node from parent
        var oldParent = parent;

        parent = parent[nextProp.nameOnServer];
        oldParent[nextProp.nameOnServer] = undefined;
        remainingProps = remainingProps.slice(1);
        nextProp = remainingProps[0];
      }
      var val = parent[nextProp.nameOnServer];
      // if last property in path is a nav prop then we need to wrap the results
      // as either an entity or entities.
      if (nextProp.isNavigationProperty) {
        if (nextProp.isScalar) {
          val = this._createResult(val, nextProp.entityType, true);
        } else {
          val = val.map(function(v) {
            return this._createResult(v, nextProp.entityType, true);
          }, this);
        }
      } else {
        val = val && (val.dataValues || val);
      }
      pp = usesNameOnServer ? pp : _.pluck(props, "nameOnServer").join(".");
      result[pp] = val;
    }, this);
    return result;
  }, this);

  if (inlineCount != undefined) {
    return { results: results, inlineCount: inlineCount };
  } else {
    return results;
  }
  return results;
}

SequelizeQuery.prototype._createResult = function(sqResult, entityType, checkCache) {
  if (!sqResult) return null;
  var result = sqResult.dataValues;
  if (checkCache) {
    var key = getKey(sqResult, entityType);
    var cachedItem = this._keyMap[key];
    if (cachedItem) {
      return { $ref: cachedItem.$id };
    } else {
      result.$id = this._nextId;
      this._nextId += 1;
      this._keyMap[key] = result;
      this._refMap[result.$id] = result;
    }
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
  if (result.$ref) {
    result = this._refMap[result.$ref];
  }
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
      }, this).filter(function(r) {
        return r != null;
      });
    } else {
      nextResult = this._createResult(nextSqResult, nextEntityType, true);
    }
    result[npName] = nextResult;
  }

  if (_.isArray(nextSqResult)) {
    nextSqResult.forEach(function(nextSqr, ix) {
      this._populateExpand(nextResult[ix], nextSqr, expandProps.slice(1));
    }, this)
  } else {
    if (nextResult) {
      this._populateExpand(nextResult, nextSqResult, expandProps.slice(1));
    }
  }
}


SequelizeQuery.prototype._addInclude = function(parent, props) {
  // returns 'last' include in props chain
  var prop = props[0];
  // if (!parent) parent = this.sqQuery;
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
  var findInclude = {model: sqModel, as: prop.nameOnServer };
  var include = _.find(includes, findInclude);
  if (!include) {
    includes.push(findInclude);
    include = findInclude;
  }
  return include;
}

SequelizeQuery.prototype._getModelAs = function(prop) {
  var sqModel = this.sequelizeManager.entityTypeSqModelMap[prop.entityType.name];
  return {model: sqModel, as: prop.nameOnServer }
}


var toSQVisitor = (function () {
  var visitor = {

    passthruPredicate: function () {
      return this.value;
    },

    unaryPredicate: function (context ) {
      var predSq = this.pred.visit(context);
      if (this.op.key !== "not") {
        throw new Error("Not yet implemented: Unary operation: " + this.op.key + " pred: " + JSON.stringify(this.pred));
      }
      if (!_.isEmpty(predSq.includes)) {
        throw new Error("Unable to negate an expression that requires a Sequelize 'include'");
      }
      predSq.where =  applyNot(predSq.where);
      return predSq;
    },

    binaryPredicate: function (context) {
      var result = {}; // { includes: [], where: null }
      var op = this.op.key;
      // TODO: right now only handling case where e1 : PropExpr and e2 : LitExpr | PropExpr
      // not yet handled: e1: FnExpr | e2: FnExpr

      var where, p1Value, p2Value, q;
      if (this.expr1.visitorMethodName === "propExpr") {
        p1Value = processPropExpr(this.expr1, context, result);
      } else if (this.expr1.visitorMethodName == "fnExpr") {
        p1Value = processFnExpr(this.expr1, context, result);
      } else {
        // also note that literal exprs are not allowed for expr1 ( i.e. only allowed on expr2)
        throw new Error("Not yet implemented: binary predicate with a expr1 type of: " + this.expr1.visitorMethodName + " - " + this.expr1.toString());
      }



      var crit;
      if (this.expr2.visitorMethodName === "litExpr") {
        p2Value = this.expr2.value;
        if (op === "eq") {
          crit = p2Value;
          // where[p1Value] = p2Value;

        } else if (op == "startswith") {
          crit = { like: p2Value + "%" };
        } else if (op === "endswith") {
          crit = { like: "%" + p2Value };
        } else if (op === "contains") {
          crit =  { like: "%" + p2Value + "%" };
        } else {
          crit = {};
          var mop = _boolOpMap[op].sequelizeOp;
          crit[mop] = p2Value;
        }

      } else if (this.expr2.visitorMethodName == "propExpr") {
        var p2Value = this.expr2.propertyPath;
        var props = context.entityType.getPropertiesOnPath(p2Value, context.usesNameOnServer, true);
        p2Value = props.map(function(p) {
          return p.nameOnServer;
        }).join(".");
        var colVal = Sequelize.col(p2Value);
        if (op === "eq") {
          crit =  colVal;
        } else if (op === "startswith") {
          crit =  { like: Sequelize.literal("concat(" + p2Value + ",'%')") };
        } else if (op === "endswith") {
          crit =  { like: Sequelize.literal("concat('%'," + p2Value + ")") };
        } else if (op === "contains") {
          crit = { like: Sequelize.literal("concat('%'," + p2Value + ",'%')") };
        } else {
          var crit = {};
          var mop = _boolOpMap[op].sequelizeOp;
          crit[mop] = colVal;
        }
      } else {
        throw new Error("Not yet implemented: binary predicate with a expr2 type of: " + this.expr2.visitorMethodName + " - " + this.expr2.toString());
      }
      where = makeWhere(p1Value, crit);
      // the 'where' clause may be on a nested include
      if (result.includes && result.includes.length > 0) {
        result.includes[0].where = where;
      } else {
        result.where = where;
      }
      return result;
    },

    andOrPredicate: function (context) {
      var result = {}; // { includes: [], where: {} }
      var predSqs = this.preds.map(function(pred) {
        return pred.visit(context);
      });

      if (predSqs.length == 0) {
        return null;
      } else if (predSqs.length == 1) {
        return predSqs[0];
      } else {
        var wheres = [];
        var includes = [];
        var that = this;
        predSqs.forEach(function(predSq) {
          if (!_.isEmpty(predSq.where)) {
            wheres.push(predSq.where);
          }
          if (!_.isEmpty(predSq.includes)) {
            predSq.includes.forEach(function(inc) {
              var include = _.find(includes, { model: inc.model });
              if (!include) {
                includes.push(inc);
              } else {
                if (include.where == null) {
                  include.where = inc.where;
                } else if (inc.where != null) {
                  var where = {};
                  where[that.op.key] = [ include.where, inc.where ] ;
                  include.where = where;
                }
                if ( include.attributes == null || include.attributes.length == 0) {
                  include.attributes = inc.attributes;
                } else if (inc.attributes != null) {
                  include.attributes = _.uniq(include.attributes.concat(inc.attributes));
                }
              }
            });
          }
        });
      }
      if (this.op.key === "and") {
        if (wheres.length > 0) {
          result.where = wheres.length == 1 ? wheres[0] : { and: wheres };
        }
        // q = Sequelize.and(q1, q2);
      } else {
        if (includes.length > 1 || (includes.length == 1 && wheres.length != 0)) {
          throw new Error("Cannot translate a query with nested property paths and 'OR' conditions to Sequelize. (Sorry).")
        }
        if (wheres.length > 0) {
          result.where = wheres.length == 1 ? wheres[0] : { or: wheres };
        }
        // q = Sequelize.or(q1, q2);
      }
      result.includes = includes;
      return result;
    },



    anyAllPredicate: function (context) {
      if (this.op.key === "all") {
        throw new Error("The 'all' predicate is not currently supported for Sequelize");
      }

      var props = context.entityType.getPropertiesOnPath(this.expr.propertyPath, context.usesNameOnServer, true);
      var include = context.sequelizeQuery._addInclude( {}, props);
      var newContext = _.clone(context);
      newContext.entityType = this.expr.dataType;

      // after this line the logic below will apply to the include instead of the top level where.
      // predicate is applied to inner context

      var r = this.pred.visit(newContext);
      include.where = r.where;
      include.includes = r.includes;
      return { includes: [ include] }

    },

    litExpr: function () {

    },

    propExpr: function (context) {

    },

    fnExpr: function (context) {
    }


  };

  function makeWhere(p1Value, crit) {
    if (typeof(p1Value) == 'string') {
      where = {};
      where[p1Value] = crit;
    } else {
      where = Sequelize.where(p1Value, crit);
    }
    return where;
  }


  function processPropExpr(expr, context, result) {
    var exprVal;
    var pp = expr.propertyPath;
    var props = context.entityType.getPropertiesOnPath(pp, context.usesNameOnServer, true);
    if (props.length > 1) {
      // handle a nested property path on the LHS - query gets moved into the include
      // context.include starts out null at top level
      var include = context.sequelizeQuery._addInclude({}, props);
      include.where = {}
      result.includes = [ include ];
      exprVal = props[props.length - 1].nameOnServer;
    } else {
      result.where = {};
      exprVal = props[0].nameOnServer;
    }
    return exprVal;
  }

  function processFnExpr(expr, context, result) {
    var fnName = expr.fnName;
    var methodInfo = translateMap[fnName];
    if (methodInfo == null) {
      throw new Error('Unable to locate fn: ' + fnName);
    }
    methodInfo.validate && methodInfo.validate(expr.exprs);

    var exprs = expr.exprs.map(function (ex) {
      return processNestedExpr(ex, context, result);
    })
    var exprVal = methodInfo.fn(exprs);
    return exprVal;
  }

  function processNestedExpr(expr, context, result) {
    var exprVal;
    if (expr.visitorMethodName === 'propExpr') {
      exprVal = processPropExpr(expr, context, result);
      return Sequelize.col(exprVal);
    } else if (expr.visitorMethodName == 'fnExpr') {
      var exprVal = processFnExpr(expr, context, result);
      return exprVal;
    } else if (expr.visitorMethodName = 'litExpr') {
      return expr.value;
    } else {
      throw new Error("Unable to understand expr for: " + this.expr.visitorMethodName + " - " + this.expr.toString());
    }
  }

  var translateMap = {
    toupper: {
      fn: function(sqArgs) {
        return Sequelize.fn("UPPER", sqArgs[0] );
      },
      validate: function(exprs) {
        validateMonadicFn("toUpper", exprs);
      }
    },
    tolower: {
      fn: function(sqArgs) {
        return Sequelize.fn("LOWER", sqArgs[0] );
      },
      validate: function(exprs) {
        validateMonadicFn("toLower", exprs);
      }
    },
    substring: {
      fn: function (sqArgs) {
        // MySQL's substring is 1 origin - javascript ( and breeze's ) is O origin.
        return Sequelize.fn("SUBSTRING", sqArgs[0], 1+parseInt(sqArgs[1],10), parseInt(sqArgs[2], 10));
      }
    }
  }

  var simpleFnNames = ['length', 'trim', 'ceiling', 'floor', 'round', 'second', 'minute', 'hour', 'day', 'month', 'year'];
  simpleFnNames.forEach(function(fnName) {
    translateMap[fnName] = {
      fn: function (sqArgs) {
        return Sequelize.fn(fnName.toUpperCase(), sqArgs[0]);
      },
      validate: function(exprs) {
        validateMonadicFn(fnName, exprs);
      }
    }
  });

  function validateMonadicFn(fnName, exprs) {
    var errTmpl = "Error with call to the '%1' function.";
    var errMsg;
    if (exprs.length != 1) {
      errMsg = formatString(errTmpl + " This function only takes a single parameter", fnName);
    } else if (exprs[0].visitorMethodName == 'litExpr') {
      errMsg = formatString(errTmpl + " The single parameter may not be a literal expression. Param: %2", fnName, exprs[0].toString());
    }
    if (errMsg) {
      throw new Error(errMsg);
    }
  }

  // Based on fragment from Dean Edwards' Base 2 library
  // format("a %1 and a %2", "cat", "dog") -> "a cat and a dog"
  function formatString(string) {
    var args = arguments;
    var pattern = RegExp("%([1-" + (arguments.length - 1) + "])", "g");
    return string.replace(pattern, function (match, index) {
      return args[index];
    });
  }

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
function processAndOr( parent) {
  if (parent == null) return;
  if (parent.where) {
    parent.where = processAndOrClause(parent.where);
  }
  parent.include && parent.include.forEach(function(inc) {
    processAndOr(inc);
  });
}

function processAndOrClause(where) {
  if (where.and) {
    clauses = where.and.map(function (clause) {
      return processAndOrClause(clause);
    })
    return Sequelize.and.apply(null, clauses)
    // return Sequelize.and(clauses[0], clauses[1]);
  } else if (where.or) {
    clauses = where.or.map(function (clause) {
      return processAndOrClause(clause);
    })
    return Sequelize.or.apply(null, clauses);
  } else {
    return where;
  }
}

var _boolOpMap = {
  eq: { not: "ne"},
  gt: { sequelizeOp: "gt",  not: "le" },
  ge: { sequelizeOp: "gte", not: "lt"  },
  lt: { sequelizeOp: "lt",  not: "ge"},
  le: { sequelizeOp: "lte", not: "gt" },
  ne: { sequelizeOp: "ne",  not: "eq" },
  in: { sequelizeOp: "in" },
  like: { sequelizeOp: "like"}
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



