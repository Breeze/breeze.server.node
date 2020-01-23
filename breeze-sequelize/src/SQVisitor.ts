import { NavigationProperty, Predicate, VisitContext } from "breeze-client";
import { FnExpr, LitExpr, PredicateExpression, PropExpr } from "breeze-client/src/predicate";
import * as _ from 'lodash';
import { FindOptions, IncludeOptions, LogicType, Op, Sequelize, WhereOptions } from "sequelize";
import { Where } from "sequelize/types/lib/utils";
import { SqVisitContext } from "./SequelizeQuery";

export interface ExprResult {
  include: IncludeOptions[],
  lastInclude: IncludeOptions,
  where: WhereOptions
}

/** Visit the nodes in a Breeze query, converting it to a Sequelize query */
const toSQVisitor = (function () {
  let visitor = {

    passthruPredicate: function () {
      return this.value;
    },

    unaryPredicate: function (context: VisitContext) {
      let predSq = this.pred.visit(context);
      if (this.op.key !== "not") {
        throw new Error("Not yet implemented: Unary operation: " + this.op.key + " pred: " + JSON.stringify(this.pred));
      }
      if (!_.isEmpty(predSq.include)) {
        throw new Error("Unable to negate an expression that requires a Sequelize 'include'");
      }
      predSq.where = applyNot(predSq.where);
      return predSq;
    },

    binaryPredicate: function (context: SqVisitContext) {
      let result = {} as ExprResult;
      let op = this.op.key;
      // TODO: right now only handling case where e1 : PropExpr and e2 : LitExpr | PropExpr
      // not yet handled: e1: FnExpr | e2: FnExpr

      let where, p1Value, p2Value;
      if (this.expr1.visitorMethodName === "propExpr") {
        p1Value = processPropExpr(this.expr1, context, result);
      } else if (this.expr1.visitorMethodName == "fnExpr") {
        p1Value = processFnExpr(this.expr1, context, result);
      } else {
        // also note that literal exprs are not allowed for expr1 ( i.e. only allowed on expr2)
        throw new Error("Not yet implemented: binary predicate with a expr1 type of: " + this.expr1.visitorMethodName + " - " + this.expr1.toString());
      }

      let crit;
      let like = _boolOpMap.like.sequelizeOp;
      if (this.expr2.visitorMethodName === "litExpr") {
        p2Value = this.expr2.value;
        if (op === "eq") {
          crit = p2Value;
          // where[p1Value] = p2Value;

        } else if (op == "startswith") {
          crit = { [like]: p2Value + "%" };
        } else if (op === "endswith") {
          crit = { [like]: "%" + p2Value };
        } else if (op === "contains") {
          crit = { [like]: "%" + p2Value + "%" };
        } else {
          crit = {};
          let mop = _boolOpMap[op].sequelizeOp;
          crit[mop] = p2Value;
        }

      } else if (this.expr2.visitorMethodName == "propExpr") {
        let p2Value = this.expr2.propertyPath;
        let props = context.entityType.getPropertiesOnPath(p2Value, context.toNameOnServer, true);
        p2Value = props.map(function (p) {
          return p.nameOnServer;
        }).join(".");
        let colVal = Sequelize.col(p2Value);
        if (op === "eq") {
          crit = colVal;
        } else if (op === "startswith") {
          crit = { [like]: Sequelize.literal("concat(" + p2Value + ",'%')") };
        } else if (op === "endswith") {
          crit = { [like]: Sequelize.literal("concat('%'," + p2Value + ")") };
        } else if (op === "contains") {
          crit = { [like]: Sequelize.literal("concat('%'," + p2Value + ",'%')") };
        } else {
          crit = {};
          let mop = _boolOpMap[op].sequelizeOp;
          crit[mop] = colVal;
        }
      } else {
        throw new Error("Not yet implemented: binary predicate with a expr2 type of: " + this.expr2.visitorMethodName + " - " + this.expr2.toString());
      }
      where = makeWhere(p1Value, crit);
      // the 'where' clause may be on a nested include
      if (result.lastInclude) {
        result.lastInclude.where = where;
      } else if (result.include && result.include.length > 0) {
        result.include[0].where = where;
      } else {
        result.where = where;
      }
      return result;
    },

    andOrPredicate: function (context: VisitContext) {
      let result = {} as ExprResult;
      let predSqs = this.preds.map(function (pred: Predicate) {
        return pred.visit(context);
      });

      let wheres = [] as WhereOptions[];
      let includes = [] as IncludeOptions[];
      if (predSqs.length == 0) {
        return null;
      } else if (predSqs.length == 1) {
        return predSqs[0];
      } else {
        let that = this;
        predSqs.forEach(function (predSq: FindOptions) {
          if (!_.isEmpty(predSq.where)) {
            wheres.push(predSq.where);
          }
          if (!_.isEmpty(predSq.include)) {
            let processIncludes = function (sourceIncludes: IncludeOptions[], targetIncludes: IncludeOptions[]) {
              sourceIncludes.forEach(function (sourceInclude: IncludeOptions) {
                if (!targetIncludes)
                  targetIncludes = [];
                let include = _.find(targetIncludes, { model: sourceInclude.model });
                if (!include) {
                  targetIncludes.push(sourceInclude);
                } else {
                  if (include.where == null) {
                    include.where = sourceInclude.where;
                  } else if (sourceInclude.where != null) {
                    let where = {} as Where;
                    where[that.op.key] = [include.where, sourceInclude.where];
                    include.where = where;
                  }
                  if (include.attributes == null || (include.attributes as any[]).length == 0) {
                    include.attributes = sourceInclude.attributes;
                  } else if (sourceInclude.attributes != null) {
                    include.attributes = _.uniq((include.attributes as any[]).concat(sourceInclude.attributes));
                  }
                  if (!_.isEmpty(sourceInclude.include))
                    processIncludes(sourceInclude.include as IncludeOptions[], include.include as IncludeOptions[]);
                }
              });
            };
            processIncludes(predSq.include as IncludeOptions[], includes);
          }
        });
      }
      if (this.op.key === "and") {
        if (wheres.length > 0) {
          result.where = wheres.length == 1 ? wheres[0] : { [Op.and]: wheres };
        }
        // q = Sequelize.and(q1, q2);
      } else {
        if (includes.length > 1 || (includes.length == 1 && wheres.length != 0)) {
          throw new Error("Cannot translate a query with nested property paths and 'OR' conditions to Sequelize. (Sorry).")
        }
        if (wheres.length > 0) {
          result.where = wheres.length == 1 ? wheres[0] : { [Op.or]: wheres };
        }
        // q = Sequelize.or(q1, q2);
      }
      result.include = includes;
      return result;
    },



    anyAllPredicate: function (context: SqVisitContext) {
      if (this.op.key === "all") {
        throw new Error("The 'all' predicate is not currently supported for Sequelize");
      }

      let props = context.entityType.getPropertiesOnPath(this.expr.propertyPath, context.toNameOnServer, true) as NavigationProperty[];
      let parent = {} as ExprResult;
      let include = context.sequelizeQuery._addInclude(parent, props);
      let newContext = _.clone(context);
      newContext.entityType = this.expr.dataType;

      // after this line the logic below will apply to the include instead of the top level where.
      // predicate is applied to inner context

      let r = this.pred.visit(newContext);
      include.where = r.where || {};
      include.required = true;
      if (r.include) include.include = r.include;
      return { include: parent.include };

    },

    litExpr: function () {

    },

    propExpr: function (context: any) {

    },

    fnExpr: function (context: any) {
    }


  };

  function makeWhere(p1Value: any, crit: LogicType) {
    let where: Where;
    if (typeof (p1Value) == 'string') {
      where = {} as Where;
      where[p1Value] = crit;
    } else {
      where = Sequelize.where(p1Value, crit);
    }
    return where;
  }


  function processPropExpr(expr: PropExpr, context: SqVisitContext, result: ExprResult) {
    let exprVal;
    let pp = expr.propertyPath;
    let props = context.entityType.getPropertiesOnPath(pp, context.toNameOnServer, true) as NavigationProperty[];
    if (props.length > 1) {
      // handle a nested property path on the LHS - query gets moved into the include
      // context.include starts out null at top level
      let parent = {} as { include: any[] };
      let include = context.sequelizeQuery._addInclude(parent, props);
      include.where = {};
      result.include = parent.include;
      result.lastInclude = include;
      exprVal = props[props.length - 1].nameOnServer;
    } else {
      result.where = {} as Where;
      exprVal = props[0].nameOnServer;
    }
    return exprVal;
  }

  function processFnExpr(expr: FnExpr, context: SqVisitContext, result: ExprResult) {
    let fnName = expr.fnName;
    let methodInfo = translateMap[fnName];
    if (methodInfo == null) {
      throw new Error('Unable to locate fn: ' + fnName);
    }
    methodInfo.validate && methodInfo.validate(expr.exprs);

    let exprs = expr.exprs.map(function (ex) {
      return processNestedExpr(ex, context, result);
    })
    let exprVal = methodInfo.fn(exprs);
    return exprVal;
  }

  function processNestedExpr(expr: PredicateExpression, context: SqVisitContext, result: ExprResult): any {
    let exprVal;
    if (expr.visitorMethodName === 'propExpr') {
      exprVal = processPropExpr(expr as PropExpr, context, result);
      return Sequelize.col(exprVal);
    } else if (expr.visitorMethodName == 'fnExpr') {
      let exprVal = processFnExpr(expr as FnExpr, context, result);
      return exprVal;
    } else if (expr.visitorMethodName = 'litExpr') {
      return (expr as LitExpr).value;
    } else {
      throw new Error("Unable to understand expr for: " + this.expr.visitorMethodName + " - " + this.expr.toString());
    }
  }

  let translateMap = {
    toupper: {
      fn: function (sqArgs: any) {
        return Sequelize.fn("UPPER", sqArgs[0]);
      },
      validate: function (exprs: PredicateExpression[]) {
        validateMonadicFn("toUpper", exprs);
      }
    },
    tolower: {
      fn: function (sqArgs: any) {
        return Sequelize.fn("LOWER", sqArgs[0]);
      },
      validate: function (exprs: PredicateExpression[]) {
        validateMonadicFn("toLower", exprs);
      }
    },
    substring: {
      fn: function (sqArgs: string[]) {
        // MySQL's substring is 1 origin - javascript ( and breeze's ) is O origin.
        return Sequelize.fn("SUBSTRING", sqArgs[0], 1 + parseInt(sqArgs[1], 10), parseInt(sqArgs[2], 10));
      }
    }
  }

  let simpleFnNames = ['length', 'trim', 'ceiling', 'floor', 'round', 'second', 'minute', 'hour', 'day', 'month', 'year'];
  simpleFnNames.forEach(function (fnName) {
    translateMap[fnName] = {
      fn: function (sqArgs: any[]) {
        return Sequelize.fn(fnName.toUpperCase(), sqArgs[0]);
      },
      validate: function (exprs: PredicateExpression[]) {
        validateMonadicFn(fnName, exprs);
      }
    }
  });

  function validateMonadicFn(fnName: string, exprs: PredicateExpression[]) {
    let errTmpl = "Error with call to the '%1' function.";
    let errMsg;
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
  function formatString(string: string, ...rest: any) {
    let args = arguments;
    let pattern = RegExp("%([1-" + (arguments.length - 1) + "])", "g");
    return string.replace(pattern, function (match, index) {
      return args[index];
    });
  }

  return visitor;
}());

export { toSQVisitor };

function applyNot(q1: Where): any {

  // rules are:
  // not { a: 1}             -> { a: { ne: 1 }}
  // not { a: { gt: 1 }}    -> { a: { le: 1}}}
  // not { and: { a: 1, b: 2 } -> { or:  { a: { $ne: 1 }, b: { $ne 2 }}}
  // not { or  { a: 1, b: 2 } -> { and: [ a: { $ne: 1 }, b: { $ne 2 }]}

  let results = [], result;
  let keys = Reflect.ownKeys(q1);
  for (let k of keys) {
    let v = q1[k];
    if (k === Op.or) {
      result = { [Op.and]: [applyNot(v[0]), applyNot(v[1])] };
    } else if (k === Op.and) {
      result = { [Op.or]: [applyNot(v[0]), applyNot(v[1])] };
    } else if (_notOps[k]) {
      result = {};
      result[_notOps[k]] = v;
    } else {
      result = {};
      if (v != null && typeof (v) === "object") {
        result[k] = applyNot(v);
      } else {
        result[k] = { [Op.ne]: v };
      }
    }

    results.push(result);
  }
  if (results.length === 1) {
    return results[0];
  } else {
    // Don't think we should ever get here with the current logic because all
    // queries should only have a single node
    return { [Op.or]: results };
  }
}


let _boolOpMap = {
  eq: { not: Op.ne },
  gt: { sequelizeOp: Op.gt, not: Op.lte },
  ge: { sequelizeOp: Op.gte, not: Op.lt },
  lt: { sequelizeOp: Op.lt, not: Op.gte },
  le: { sequelizeOp: Op.lte, not: Op.gt },
  ne: { sequelizeOp: Op.ne, not: Op.eq },
  in: { sequelizeOp: Op.in },
  like: { sequelizeOp: Op.like }
};

let _notOps = {
  gt: "lte",
  lte: "gt",
  gte: "lt",
  lt: "gte",
  ne: "eq",
  eq: "ne",
  like: "nlike",
  nlike: "like",
  in: "notIn",
  notIn: "in",

  [Op.gt]: Op.lte,
  [Op.lte]: Op.gt,
  [Op.gte]: Op.lt,
  [Op.lt]: Op.gte,
  [Op.ne]: Op.eq,
  [Op.like]: Op.notLike,
  [Op.notLike]: Op.like,
  [Op.in]: Op.notIn,
  [Op.notIn]: Op.in

};

// Used to determine if a clause is the result of a Sequelize.and/or method call.
// Not currently need because of processAndOr method below
//let isSequelizeAnd = function(o) {
//  return Object.getPrototypeOf(o).constructor == Sequelize.Utils.and;
//}
//
//let isSequelizeOr = function(o) {
//  return Object.getPrototypeOf(o).constructor == Sequelize.Utils.or;
//}
// --------------------------------
