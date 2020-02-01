import { DataProperty, EntityProperty, EntityQuery, EntityType, MetadataStore, NavigationProperty, Predicate, VisitContext } from "breeze-client";
import * as _ from 'lodash';
import { FindOptions, IncludeOptions, Model, Op, OrderItem, Sequelize, Transaction, WhereOptions } from "sequelize";
import { SequelizeManager } from "./SequelizeManager";
import * as urlUtils from "url";
import { toSQVisitor } from "./SQVisitor";

/** Create an EntityQuery from a JSON-format breeze query string 
 * @param url - url containing query, e.g. `/orders?{freight:{">":100}}`
 * @param resourceName - Name of the resource/entity.  If omitted, resourceName is derived from the pathname of the url.
*/
export function entityQueryFromUrl(url: string, resourceName?: string): EntityQuery {
  let parsedUrl = urlUtils.parse(url, true);
  resourceName = resourceName || parsedUrl.pathname;
  // this is because everything after the '?' is turned into a query object with a single key
  // where the key is the value of the string after the '?" and with a 'value' that is an empty string.
  // So we want the key and not the value.
  let keys = Object.keys(parsedUrl.query);
  let jsonQueryString = keys.length ? keys[0] : '{}';
  let jsonQuery = JSON.parse(jsonQueryString);

  let entityQuery = new EntityQuery(jsonQuery);
  entityQuery = entityQuery.from(resourceName).useNameOnServer(true);

  // for debugging
  entityQuery['jsonQuery'] = jsonQuery;
  return entityQuery;
} 

// patch Breeze EntityQuery for server-side use
// TODO make this a method on SequelizeQuery, so we don't have to patch Breeze?
EntityQuery['fromUrl'] = entityQueryFromUrl;

export interface SequelizeQueryOptions {
  useTransaction: boolean;
  beforeQueryEntities: (sq: SequelizeQuery) => void;
}

/** Object returned from a query with inlineCountEnabled */
export interface CountModel {
  rows: Model[];
  count: number;
}

export interface SqVisitContext extends VisitContext {
  sequelizeQuery: SequelizeQuery
}

// TODO: still need to add support for fns like toUpper, length etc.
// TODO: still need to add support for any/all

// config.url:
// config.pathName: if null - url
// config.entityQuery:
// config.entityQueryFn: a fn(entityQuery) -> entityQuery

/** Converts Breeze queries to Sequelize queries */
export class SequelizeQuery {
  sequelizeManager: SequelizeManager;
  metadataStore: MetadataStore;
  entityType: EntityType;
  entityQuery: EntityQuery;
  sqQuery: FindOptions;
  transaction: Transaction;
  private _nextId: any;
  private _keyMap: { [key: string]: any };
  private _refMap: { [key: string]: any };

  /** Create instance for the given EntityQuery, and process the query into Sequelize form */
  constructor(sequelizeManager: SequelizeManager, serverSideEntityQuery: EntityQuery) {
    this.sequelizeManager = sequelizeManager;
    this.metadataStore = sequelizeManager.metadataStore;

    this.entityType = serverSideEntityQuery._getFromEntityType(this.metadataStore, true);
    this.entityQuery = serverSideEntityQuery;
    this.sqQuery = this._processQuery();
  }

  /** Execute the current query and return data objects */
  execute(options: SequelizeQueryOptions) {
    return this.executeRaw(options).then(r => {
      let result = this._reshapeResults(r);
      return Promise.resolve(result);
    });
  }

  /** Execute the current query and return the Sequelize Models */
  executeRaw(options: SequelizeQueryOptions):  Promise<CountModel | Model[]> {
    let self = this;
    let model = self.sequelizeManager.resourceNameSqModelMap[self.entityQuery.resourceName];
    let methodName = self.entityQuery.inlineCountEnabled ? "findAndCountAll" : "findAll";
    options = options || { useTransaction: false, beforeQueryEntities: undefined };

    return (function () {
      if (options.useTransaction)
        return self.sequelizeManager.sequelize.transaction()
          .then(function (trans) {
            self.transaction = trans;
            self.sqQuery.transaction = trans;
          });
      else
        return Promise.resolve();
    })()
      .then(function () {
        if (options.beforeQueryEntities)
          return options.beforeQueryEntities.call(self);
        else
          return Promise.resolve();
      })
      .then(function () {
        return model[methodName].call(model, self.sqQuery);
      })
      .then(
        function (results) {
          if (options.useTransaction)
            self.sqQuery.transaction.commit();
          return results;
        },
        function (e) {
          if (options.useTransaction)
            self.sqQuery.transaction.rollback();
          throw e;
        }
      );
  }

  // pass in either a query string or a urlQuery object
  //    a urlQuery object is what is returned by node's url.parse(aUrl, true).query;
  private _processQuery(): FindOptions {
    let entityQuery = this.entityQuery;
    let sqQuery: FindOptions = this.sqQuery = {};
    sqQuery.include = [];

    this._processWhere();

    this._processSelect();

    this._processOrderBy();

    this._processExpand();

    let section = entityQuery.takeCount;
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

    // Empty include is ok with Sequelize, but we clean it up.
    if (_.isEmpty(this.sqQuery.include)) {
      delete this.sqQuery.include;
    }
    return this.sqQuery;

  }

  private _processWhere() {
    let wherePredicate = this.entityQuery.wherePredicate as Predicate;
    if (wherePredicate == null) return;
    let sqQuery = wherePredicate.visit({
      entityType: this.entityType,
      toNameOnServer: this.entityQuery.usesNameOnServer,
      sequelizeQuery: this,
      metadataStore: this.metadataStore
    } as SqVisitContext, toSQVisitor);

    if (sqQuery && sqQuery.where) this.sqQuery.where = sqQuery.where;
    if (sqQuery && sqQuery.include) this.sqQuery.include = sqQuery.include;

    processAndOr(this.sqQuery);
  }

  private _processSelect() {
    let selectClause = this.entityQuery.selectClause;
    let usesNameOnServer = this.entityQuery.usesNameOnServer;
    if (selectClause == null) return;
    // extract any nest paths and move them onto the include
    let navPropertyPaths = [];
    this.sqQuery.attributes = selectClause.propertyPaths.map(pp => {
      let props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
      let isNavPropertyPath = props[0].isNavigationProperty;
      if (isNavPropertyPath) {
        this._addFetchInclude(this.sqQuery, props as NavigationProperty[], false);
      }
      if (isNavPropertyPath) return null;
      return usesNameOnServer ? pp : _.map(props, "nameOnServer").join(".");
    }, this).filter(pp => {
      return pp != null;
    });
  }

  private _processOrderBy() {
    let orderByClause = this.entityQuery.orderByClause;
    let usesNameOnServer = this.entityQuery.usesNameOnServer;
    if (orderByClause == null) return;
    let orders: OrderItem[] = this.sqQuery.order = [];
    orderByClause.items.forEach(item => {
      let pp = item.propertyPath;
      let props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
      let isNavPropertyPath = props[0].isNavigationProperty;
      if (isNavPropertyPath) {
        this._addInclude(this.sqQuery, props as NavigationProperty[]);
      }

      let r: any = [];
      orders.push(r);

      props.forEach((prop: DataProperty | NavigationProperty) => {
        if (prop.isNavigationProperty) {
          let modelAs = this._getModelAs(prop as NavigationProperty);
          r.push(modelAs);
        } else {
          r.push(prop.nameOnServer);
          if (item.isDesc) {
            r.push("DESC");
          }
        }
      }, this);
    }, this);

  }

  private _processExpand() {
    let expandClause = this.entityQuery.expandClause;
    let usesNameOnServer = this.entityQuery.usesNameOnServer;
    if (expandClause == null) return;
    expandClause.propertyPaths.forEach(pp => {
      let props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
      this._addFetchInclude(this.sqQuery, props as NavigationProperty[], true);
    }, this);

  }

  private _reshapeResults(sqResults: CountModel | Model[]) {
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
    let inlineCount;
    if (this.entityQuery.inlineCountEnabled && (sqResults as CountModel).count) {
      inlineCount = (sqResults as CountModel).count;
      sqResults = (sqResults as CountModel).rows;
    }
    let expandClause = this.entityQuery.expandClause;
    let usesNameOnServer = this.entityQuery.usesNameOnServer;
    let expandPaths: EntityProperty[][] = [];
    if (expandClause) {
      // each expand path consist of an array of expand props.
      expandPaths = expandClause.propertyPaths.map(pp => {
        return this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
      }, this);
    }

    // needed because we had to turn take(0) into limit(1)
    if (this.entityQuery.takeCount == 0) {
      sqResults = [];
    }
    let results = (sqResults as Model[]).map(sqResult => {
      let result = this._createResult(sqResult, this.entityType, expandClause != null);
      // each expandPath is a collection of expandProps

      // if (!result.$ref) {
      expandPaths.forEach(expandProps => {
        this._populateExpand(result, sqResult, expandProps as NavigationProperty[]);
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

  private _reshapeSelectResults(sqResults: CountModel | Model[]) {
    let inlineCount;
    if (this.entityQuery.inlineCountEnabled) {
      inlineCount = (sqResults as CountModel).count;
      sqResults = (sqResults as CountModel).rows;
    }
    let propertyPaths = this.entityQuery.selectClause.propertyPaths;
    let usesNameOnServer = this.entityQuery.usesNameOnServer;
    let results = (sqResults as Model[]).map(sqResult => {
      // start with the sqResult and then promote nested properties up to the top level
      // while removing nested path.
      let result = (sqResult as any).dataValues;
      let parent;
      propertyPaths.forEach(pp => {
        parent = sqResult;
        let props = this.entityType.getPropertiesOnPath(pp, usesNameOnServer, true);
        let nextProp = props[0];
        let remainingProps = props.slice(0);
        while (remainingProps.length > 1 && nextProp.isNavigationProperty) {
          parent = parent[nextProp.nameOnServer];
          remainingProps = remainingProps.slice(1);
          nextProp = remainingProps[0];
        }
        let val = parent && parent[nextProp.nameOnServer];
        // if last property in path is a nav prop then we need to wrap the results
        // as either an entity or entities.
        if (nextProp.isNavigationProperty) {
          if (nextProp.isScalar) {
            val = this._createResult(val, (nextProp as NavigationProperty).entityType, true);
          } else {
            val = val.map((v: any) => {
              return this._createResult(v, (nextProp as NavigationProperty).entityType, true);
            }, this);
          }
        } else {
          val = val && (val.dataValues || val);
        }
        pp = usesNameOnServer ? pp : _.map(props, "nameOnServer").join(".");
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

  private _createResult(sqResult: Model, entityType: EntityType, checkCache: boolean) {
    if (!sqResult) return null;
    let result = (sqResult as any).dataValues;
    if (checkCache) {
      let key = getKey(sqResult, entityType);
      let cachedItem = this._keyMap[key];
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
    let nps = entityType.navigationProperties;
    // first remove all nav props
    nps.forEach(np => {
      let navValue = sqResult[np.nameOnServer];
      if (navValue) {
        result[np.nameOnServer] = undefined;
      }
    });
    return result;
  }

  private _populateExpand(result: any, sqResult: Model, expandProps: NavigationProperty[]) {
    if (result.$ref) {
      result = this._refMap[result.$ref];
    }
    if (expandProps == null || expandProps.length == 0) return;
    // now blow out all of the expands
    // each expand path consist of an array of expand props.
    let npName = expandProps[0].nameOnServer;
    let nextResult = result[npName];

    let nextEntityType = expandProps[0].entityType;
    let nextSqResult = sqResult[npName];

    // if it doesn't already exist then create it
    if (nextResult == null) {
      if (_.isArray(nextSqResult)) {
        nextResult = nextSqResult.map(nextSqr => {
          return this._createResult(nextSqr, nextEntityType, true);
        }, this).filter(r => {
          return r != null;
        });
      } else {
        nextResult = this._createResult(nextSqResult, nextEntityType, true);
      }
      result[npName] = nextResult;
    }

    if (_.isArray(nextSqResult)) {
      nextSqResult.forEach((nextSqr, ix) => {
        this._populateExpand(nextResult[ix], nextSqr, expandProps.slice(1));
      }, this)
    } else {
      if (nextResult) {
        this._populateExpand(nextResult, nextSqResult, expandProps.slice(1));
      }
    }

  }

  // Add an include for a where or order by clause.  Returns last include in the props chain.
  public _addInclude(parent: FindOptions, props: NavigationProperty[]): IncludeOptions {
    let include = this._getIncludeFor(parent, props[0]);
    // empty attributes array tells sequelize not to retrieve the entity data
    if (!include['$disallowAttributes']) include.attributes = include.attributes || [];
    props = props.slice(1);
    if (props.length > 0) {
      if (props[0].isNavigationProperty) {
        return this._addInclude(include, props);
      }
    }
    return include;

  }

  // Add an include for a select or expand clause.  Returns last include in the props chain.
  private _addFetchInclude(parent: FindOptions, props: NavigationProperty[], isExpand: boolean): IncludeOptions {
    // $disallowAttributes code is used to insure two things
    // 1) if a navigation property is declared as the last prop of a select or expand expression
    //    that it is not 'trimmed' i.e. has further 'attributes' added that would narrow the projection.
    // 2) that we support restricted projections on expanded nodes as long as we don't
    //    violate #1 above.

    let include = this._getIncludeFor(parent, props[0]) as IncludeOptions;
    props = props.slice(1);
    if (props.length > 0) {
      if (props[0].isNavigationProperty) {
        if (isExpand) {
          // expand = include the whole entity = no attributes
          include['$disallowAttributes'] = true
          delete include.attributes;
        } else {
          // select = include at least one attribute at each level, so sequelize will create an object
          if (!include['$disallowAttributes']) {
            include.attributes = include.attributes || [];
            if ((include.attributes as string[]).length == 0) {
              include.attributes = include.model.primaryKeyAttributes;
            }
          }
        }
        return this._addFetchInclude(include, props, isExpand);
      } else {
        // dataProperty
        if (!include['$disallowAttributes']) {
          include.attributes = include.attributes || [];
          (include.attributes as string[]).push(props[0].nameOnServer);
        }
      }
    } else {
      // do not allow attributes set on any final navNodes nodes
      include['$disallowAttributes'] = true
      // and remove any that might have been added.
      delete include.attributes;
    }
    return include;

  }

  // Find or create an include object, and attach it to parent
  private _getIncludeFor(parent: FindOptions, prop: NavigationProperty): IncludeOptions {
    let sqModel = this.sequelizeManager.entityTypeSqModelMap[prop.entityType.name];
    let includes = parent.include = parent.include || [];
    let findInclude = { model: sqModel, as: prop.nameOnServer };
    let include = _.find(includes, findInclude) as IncludeOptions;
    if (!include) {
      includes.push(findInclude);
      include = findInclude;
    }
    return include;
  }

  private _getModelAs(prop: NavigationProperty) {
    let sqModel = this.sequelizeManager.entityTypeSqModelMap[prop.entityType.name];
    return { model: sqModel, as: prop.nameOnServer }
  }
}

function getKey(sqResult: Model, entityType: EntityType) {
  let key = entityType.keyProperties.map(function (kp) {
    return sqResult[kp.nameOnServer];
  }).join("::") + "^" + entityType.name;
  return key;
}

// needed to convert 'or:' and 'and:' clauses into Sequelize.and/or clauses
function processAndOr(parent: IncludeOptions) {
  if (parent == null) return;
  if (parent.where) {
    parent.where = processAndOrClause(parent.where);
  }
  parent.include && parent.include.forEach(function (inc) {
    processAndOr(inc as IncludeOptions);
  });
  console.trace(parent);
}

function processAndOrClause(where: WhereOptions): WhereOptions {
  console.log("processAndOrClause", where);
  let ands = (where[Op.and] || where['and']) as WhereOptions[];
  let ors = (where[Op.or] || where['or']) as WhereOptions[];
  if (ands) {
    let clauses = ands.map(function (clause) {
      return processAndOrClause(clause);
    })
    return Sequelize.and.apply(null, clauses)
    // return Sequelize.and(clauses[0], clauses[1]);
  } else if (ors) {
    let clauses = ors.map(function (clause) {
      return processAndOrClause(clause);
    })
    return Sequelize.or.apply(null, clauses);
  } else {
    return where;
  }
}

