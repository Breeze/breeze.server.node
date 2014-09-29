var Sequelize = require('sequelize');
var breeze = require('breeze-client');
var url = require("url");

var _ = Sequelize.Utils._;

var DataService = breeze.DataService;
var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;

module.exports = SequelizeQuery;

// TODO: still need to add support for OData fns like toUpper, length etc.
// TODO: still need to add support for OData any/all

function SequelizeQuery(jsonUrl, metadataStore) {

  var ds = new DataService( { serviceName: "Foo", uriBuilderName: "json"})
  this.entityManager = new EntityManager( {dataService: ds});

  var parsedUrl = url.parse(jsonUrl, true);
  this.pathname = parsedUrl.pathname;

  // this is because everything after the '?' is turned into a query object with a single key that
  // is the value of the string after the '?" and has a 'value' that is an empty strings e value of the string
  var jsonQueryString = Object.keys(parsedUrl.query)[0];
  this.jsonQuery = JSON.parse(jsonQueryString);
  var entityQuery = new EntityQuery(this.jsonQuery);
  this.entityQuery = entityQuery.from(this.pathname);
  this.queryObj = toSequelizeQuery(this.entityQuery, metadataStore);

}

SequelizeQuery.prototype.execute = function(sequelizeManager) {
  var model = sequelizeManager.models[this.pathname];
  return model.findAll(this.queryObj);
}

// pass in either a query string or a urlQuery object
//    a urlQuery object is what is returned by node's url.parse(aUrl, true).query;
function toSequelizeQuery(entityQuery ) {
  var section;
  var result = {};
  if (entityQuery.wherePredicate) {
    var where = entityQuery.wherePredicate.toSQ();
    var where2 = processAndOr(where);
    result.where = where2;
  }

  var section = entityQuery.takeCount;
  // not ok to ignore top: 0
  if (section !== undefined) {
    result.limit = entityQuery.takeCount;
  }

  section = entityQuery.skipCount
  // ok to ignore skip: 0
  if (section) {
    result.offset = entityQuery.skipCount;
  }

  section = entityQuery.$inlinecount;
  if (section) {
    result.inlineCount = section !== "none";
  }

  return result;

}

breeze.Predicate.attachVisitor(function () {
  var visitor = {
    config: { fnName: "toSQ"   },

    passthruPredicate: function () {
      return this.value;
    },

    unaryPredicate: function (context) {
      if (this.op.key !== "not") {
        throw new Error("Not yet implemented: Unary operation: " + this.op.key + " pred: " + JSON.stringify(this.pred));
      }
      var predSQ = this.pred.toSQ(context);
      return applyNot(predSQ);
    },

    binaryPredicate: function (context) {
      var q = {};
      var op = this.op.key;
      // TODO: right now only handling case where e1 : PropExpr and e2 : LitExpr | PropExpr
      // not yet handled: e1: FnExpr | e2: FnExpr

      var p1Value, p2Value;
      if (this.expr1.typeName === "PropExpr") {
        p1Value = this.expr1.propertyPath;
        if (this.expr2.typeName === "LitExpr") {
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
        }
        else if (this.expr2.typeName == "PropExpr") {
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
      } else {
        throw new Error("Not yet implemented: binary predicate with a expr1 type of: " + this.expr1.typeName + " - " + this.expr1.toString());
      }
      return q;
    },

    andOrPredicate: function (context) {
      var predSQs = this.preds.map(function (pred) {
        return  pred.toSQ(context)
      });

      if (this.op.key === "and") {
        q = { and: predSQs };
        // q = Sequelize.and(q1, q2);
      } else {
        q = { or: predSQs };
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

function toOrderbyExpr(orderbyItems) {
  // "sort": [['field1','asc'], ['field2','desc']]

  var sortItems = orderbyItems.map(function(s) {
    var sPath = s.path.replace("/",".");
    return [sPath,  s.isAsc ? "asc" : "desc"];
  }) ;
  return { sort: sortItems };
}

function toSelectExpr(selectItems) {
  var result = selectItems.map(function(s) {
    var sPath = s.replace("/",".");
    return sPath;
  });
  return result;
}

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



