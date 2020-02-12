import * as fs from 'fs';

// Note: breeze is available from both 'breeze-client' and indirectly from 'breeze-sequelize'
// if you compare them the ARE '==='.
import { EntityQuery, breeze} from 'breeze-client';
import { SaveMap, SequelizeManager, SequelizeQuery, SequelizeQueryResult, SequelizeSaveHandler, SequelizeSaveResult, ServerEntityInfo, urlToEntityQuery } from 'breeze-sequelize';
import { ModelLibraryBackingStoreAdapter } from "breeze-client/adapter-model-library-backing-store";

import { NextFunction, Request, Response } from 'express';
import { Options } from 'sequelize';
import { DemoKeyGenerator } from './demo-key-generator';

export type OpenObj = {[k: string]: any}; {}

type ReturnQueryResultsFn = (results: SequelizeQueryResult, res: Response) => void;
type ReturnSaveResultsFn = (results: SequelizeSaveResult, res: Response) => void;

ModelLibraryBackingStoreAdapter.register(breeze.config);


const _dbConfigNw = {
  //user: "jayt",
  //password: "password",
  user: "root",
  password: "mysql",
  dbName: 'northwindib'
};

const _seqOpts: Options = {
  dialect: "mysql",
  host: "localhost",
  port: 3306,
  pool: {
    max: 100
  }
};

const _sequelizeManager = createSequelizeManager();

function createSequelizeManager() {
  const filename = "NorthwindIBMetadata.json";
  if (!fs.existsSync(filename)) {
    // next(new Error("Unable to locate file: " + filename));
    throw new Error("Unable to locate file: " + filename);
  }
  const metadata = fs.readFileSync(filename, 'utf8');
  const sm = new SequelizeManager(_dbConfigNw, _seqOpts);
  sm.importMetadata(metadata);

  sm.keyGenerator = new DemoKeyGenerator(sm.sequelize);
  return sm;
}
  

export function getMetadata(req: Request, res: Response, next: NextFunction) {
    const filename = "NorthwindIBMetadata.json";
    if (!fs.existsSync(filename)) {
      next(new Error("Unable to locate file: " + filename));
    }
    const metadata = fs.readFileSync(filename, 'utf8');
    res.sendfile(filename);
}

export function get(req: Request, res: Response, next: NextFunction) {
  const resourceName = req.params.slug;
  if (namedQuery[resourceName]) {
    namedQuery[resourceName](req, res, next);
  } else {
    const entityQuery = urlToEntityQuery(req.url, resourceName);
    executeEntityQuery(entityQuery, null, res, next);
  }
}

export function saveChanges(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = beforeSaveEntity;
  saveHandler.beforeSaveEntities = beforeSaveEntities.bind(saveHandler);
  saveHandler.save().then(function(r: any) {
    returnSaveResults(r, res);
  }).catch(function(e) {
    next(e);
  });
}

async function executeEntityQuery(entityQuery: EntityQuery, returnResultsFn: ReturnQueryResultsFn, res: Response, next: NextFunction) {
  returnResultsFn = returnResultsFn || returnQueryResults;
  console.log(entityQuery);
  try {
    const query = new SequelizeQuery(_sequelizeManager, entityQuery);
    const r = await query.execute(null);
    returnResultsFn(r, res);
  } catch (e) {
    next(e);
  }
}

async function saveUsingCallback(saveHandler: SequelizeSaveHandler, res: Response, next: NextFunction) {
  try {
    const r = await saveHandler.save();
    returnSaveResults(r, res);
  } catch (e) {
    next(e);
  }
}

// Used to return
function returnQueryResults(results: SequelizeQueryResult, res: Response) {
  res.setHeader("Content-Type", "application/json");
  res.send(results);
}

function returnSaveResults(results: SequelizeSaveResult, res: Response) {
  res.setHeader("Content-Type", "application/json");
  res.send(results);
}

export const namedQuery: OpenObj = {};

namedQuery.CustomerFirstOrDefault = function(req: Request, res: Response, next: NextFunction) {
  // should return empty array
  const entityQuery = urlToEntityQuery(req.url, "Customers").where("companyName", "StartsWith", "blah").take(1);
  executeEntityQuery(entityQuery, null, res, next);
};


namedQuery.CustomersStartingWithA = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers")
    .where("companyName", "startsWith", "A");
  executeEntityQuery(entityQuery, null, res, next);

};

namedQuery.CustomersStartingWith = function(req: Request, res: Response, next: NextFunction) {
    // start with client query and add an additional filter.
  const companyName = req.query.companyName;
  if (companyName == undefined) {
    const err = { statusCode: 404, message: "'companyName must be provided'" };
    next(err);
  }
  // need to use upper case because base query came from server
  const pred = new breeze.Predicate("companyName", "startsWith", companyName);
  const entityQuery = urlToEntityQuery(req.url, "Customers").where(pred);
  executeEntityQuery(entityQuery, null, res, next);
};


namedQuery.CustomersOrderedStartingWith =    function(req: Request, res: Response, next: NextFunction) {
  // start with client query and add an additional filter.
  const companyName = req.query.companyName;
  // need to use upper case because base query came from server
  const entityQuery = urlToEntityQuery(req.url, "Customers")
      .where("companyName", "startsWith", companyName)
      .orderBy("companyName");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.CustomersAndOrders = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers").expand("orders");
  executeEntityQuery(entityQuery, null,  res, next);
};

namedQuery.CustomerWithScalarResult = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers").take(1);
  executeEntityQuery(entityQuery, null,  res, next);
};

namedQuery.CustomersWithHttpError = function(req: Request, res: Response, next: NextFunction) {
    const err = { statusCode: 404, message: "Unable to do something"  };
    next(err);
};

// HRM is HttpResponseMessage ( just for
namedQuery.CustomersAsHRM = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers");
  executeEntityQuery(entityQuery, null,  res, next);
};

namedQuery.CustomersWithBigOrders = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = breeze.EntityQuery.from("Customers").where("orders", "any", "freight", ">", 100).expand("orders");
  const processResults: ReturnQueryResultsFn = (results, res) => {
    const newResults = (results as any[]).map(function(r) {
      return {
        customer: r,
        bigOrders:  r.orders.filter(function (order: any) {
          return order.Freight > 100;
        })
      };
    });
    returnQueryResults(newResults, res);
  };
  executeEntityQuery(entityQuery, processResults,  res, next);

};

namedQuery.CustomersAndProducts = function(req: Request, res: Response, next: NextFunction) {
  const eq1 = EntityQuery.from("Customers");
  const sq1 = new SequelizeQuery(_sequelizeManager, eq1);
  let r1: any;
  sq1.execute().then(function (r) {
    r1 = r;
    const eq2 = EntityQuery.from("Products");
    const sq2 = new SequelizeQuery(_sequelizeManager, eq2);
    return sq2.execute();
  }).then(function(r2) {
    returnQueryResults( <any> { Customers: r1, Products: r2 }, res);
  });
};


//// AltCustomers will not be in the resourceName/entityType map;
namedQuery.AltCustomers = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.SearchCustomers = function(req: Request, res: Response, next: NextFunction) {
  const qbe  = req.query;
  const ok = qbe != null && qbe.CompanyName != null && qbe.ContactNames.length > 0 && qbe.City.length > 1;
  if (!ok) {
    throw new Error("qbe error");
  }
  // const entityQuery = EntityQuery.from("Customers").where("companyName", "startsWith", qbe.companyName);
  // just testing that qbe actually made it in not attempted to write qbe logic here
  // so just return first 3 customers.
  const entityQuery = EntityQuery.from("Customers").take(3);
  executeEntityQuery(entityQuery, null, res, next);
};


namedQuery.SearchCustomers2 = function(req: Request, res: Response, next: NextFunction) {
  const qbeList = req.query.qbeList;
  if (qbeList.Length < 2) {
    throw new Error("all least two items must be passed in");
  }
  qbeList.forEach(function(qbe: any) {
    const ok = qbe != null && qbe.CompanyName != null && qbe.ContactNames.length > 0 && qbe.City.length > 1;
    if (!ok) {
      throw new Error("qbe error");
    }
  });
  // just testing that qbe actually made it in not attempted to write qbe logic here
  // so just return first 3 customers.
  const entityQuery = EntityQuery.from("Customers").take(3);
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.OrdersCountForCustomer = function(req: Request, res: Response, next: NextFunction) {
  const companyName = req.query.companyName;
  const entityQuery = EntityQuery.from("Customers")
      .where("companyName", "startsWith", companyName)
      .expand("orders")
      .take(1);
  const processResults: ReturnQueryResultsFn = function(results, res) {
    let r: any;
    if ((results as any[]).length > 0) {
      r = r.orders.length;
    } else {
      r = 0;
    }
    returnQueryResults(r, res);
  };
  executeEntityQuery(entityQuery, processResults, res, next);
};

namedQuery.EnumerableEmployees = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Employees");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.EmployeesMultipleParams = function(req: Request, res: Response, next: NextFunction) {
  const empId = req.query.employeeID;
  const city = req.query.city;
  const where = { or: [{ employeeID: empId }, { city: city }] };
  const entityQuery = EntityQuery.from("Employees").where(where);
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.CompanyNames = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = EntityQuery.from("Customers").select("companyName");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.CompanyNamesAndIds = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers").select("companyName, customerID");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.CompanyNamesAndIdsAsDTO = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers").select("companyName, customerID");
  const projectResults = function(results: any, res: Response) {
    const newResults = results.map(function(r: any) {
      return { companyName: r.companyName, customerID: r.customerID };
    });
    returnQueryResults(newResults, res);
  };
  executeEntityQuery(entityQuery, projectResults , res, next);
};


namedQuery.CompanyInfoAndOrders = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Customers").select("companyName, customerID, orders");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.OrdersAndCustomers = function(req: Request, res: Response, next: NextFunction) {
  const entityQuery = urlToEntityQuery(req.url, "Orders").expand("customer");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.SearchEmployees = function(req: Request, res: Response, next: NextFunction) {

  const employeeIds = req.query.employeeIds;
  const pred = { employeeID: { in: employeeIds }};
  const entityQuery = urlToEntityQuery(req.url, "Employees").where(pred);

  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.EmployeesFilteredByCountryAndBirthdate = function(req: Request, res: Response, next: NextFunction) {
  const birthDate = new Date(Date.parse(req.query.birthDate));
  const country = req.query.country;
  const pred = { birthDate: { ge: birthDate}, country: country };
  const entityQuery = urlToEntityQuery(req.url, "Employees").where(pred);
  executeEntityQuery(entityQuery, null, res, next);
};

// not yet implemented



//public Object CustomerCountsByCountry() {
//    return ContextProvider.Context.Customers.GroupBy(c => c.Country).Select(g => new { g.Key, Count = g.Count() });

// need expand support for these.
//public IQueryable<Object> CustomersWithBigOrders() {
//    const stuff = ContextProvider.Context.Customers.Select(c => new { Customer = c, BigOrders = c.Orders.Where(o => o.Freight > 100) });

//public Object CustomersAndProducts() {
//    const stuff = new { Customers = ContextProvider.Context.Customers.ToList(), Products = ContextProvider.Context.Products.ToList() };




namedQuery.saveWithComment = function(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = async (saveMap) => {
    const tag = saveHandler.saveOptions.tag;
    const entity = {
      comment1: (tag == null) ? "Generic comment" : tag,
      createdOn: new Date(),
      seqNum: 1
    };
    saveMap.addEntity("Comment", entity);
    return saveMap;
  };
  saveUsingCallback(saveHandler, res, next);
};

namedQuery.saveWithFreight = function(req: Request, res: Response, next: NextFunction) {
    const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntity = checkFreightOnOrder.bind(saveHandler);
    saveUsingCallback(saveHandler, res, next);
};

namedQuery.saveWithFreight2 = function(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = async (saveMap) => {
    const orderInfos = saveMap.getEntityInfosOfType("Order");
    const fn = checkFreightOnOrder.bind(saveHandler);
    orderInfos.forEach( (order) => fn(order));
    return saveMap;
  };
  saveUsingCallback(saveHandler, res, next);
};

namedQuery.saveWithExit = function(req: Request, res: Response, next: NextFunction) {
    res.setHeader("Content-Type", "application/json");
    const results: SequelizeSaveResult = {
        entities: [],
        keyMappings: []
    };
    res.send(results);
};

namedQuery.saveWithEntityErrorsException = function(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = async function(saveMap) {
    const orderInfos = saveMap.getEntityInfosOfType("Order");
    const errorDetails = orderInfos.map(function(orderInfo) {
      saveMap.addEntityError(orderInfo, "WrongMethod", "Cannot save orders with this save method", "orderID");
    });
    saveMap.setErrorMessage("test of custom exception message");
    return saveMap;
  };
  saveUsingCallback(saveHandler, res, next);
};

namedQuery.saveCheckInitializer = function(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = async function(saveMap) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const order = {
      orderDate: today
    };
    saveMap.addEntity("Order", order);
    return saveMap;
  };
  saveUsingCallback(saveHandler, res, next);
};

namedQuery.saveCheckUnmappedProperty = function(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = function(entityInfo) {
    const unmappedValue = entityInfo.unmapped["myUnmappedProperty"];
    // in c#
    // const unmappedValue = entityInfo.UnmappedValuesMap["myUnmappedProperty"];
    if (unmappedValue !== "anything22") {
      throw new Error("wrong value for unmapped property:  " + unmappedValue);
    }
    return false;
  };
  saveUsingCallback(saveHandler, res, next);
};

namedQuery.saveCheckUnmappedPropertySerialized = function(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = function(entityInfo) {
    const unmappedValue = entityInfo.unmapped["myUnmappedProperty"];
    if (unmappedValue !== "ANYTHING22") {
      throw new Error("wrong value for unmapped property:  " + unmappedValue);
    }
    const anotherOne = entityInfo.unmapped["anotherOne"];

    if ( anotherOne.z[5].foo !== 4) {
      throw new Error("wrong value for 'anotherOne.z[5].foo'");
    }

    if (anotherOne.extra !== 666) {
      throw new Error("wrong value for 'anotherOne.extra'");
    }

    const cust = entityInfo.entity as any;
    if (cust.companyName.toUpperCase() !== cust.companyName) {
      throw new Error("Uppercasing of company name did not occur");
    }
    return false;
  };
  saveUsingCallback(saveHandler, res, next);
};

namedQuery.saveCheckUnmappedPropertySuppressed = function(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = (entityInfo) => {
    const unmapped = entityInfo.unmapped;
    if (unmapped != null) {
      throw new Error("unmapped properties should have been suppressed");
    }
    return false;
  };
  saveUsingCallback(saveHandler, res, next);
};

function beforeSaveEntity(entityInfo: ServerEntityInfo) {

  if ( entityInfo.entityType.shortName === "Region" && entityInfo.entityAspect.entityState === "Added") {
    if (entityInfo.entity.regionDescription.toLowerCase().indexOf("error") === 0) {
      return false;
    }
  }

  if ( entityInfo.entityType.shortName === "Employee") {
    const emp = entityInfo.entity;
    if (emp.fullName === null) {
      emp.fullName = emp.firstName + " " + emp.lastName;
    }
  }

  return true;
}

// returns undefined or a Promise;
async function beforeSaveEntities(saveMap: SaveMap) {
  const tag = this.saveOptions.tag;

  const customers = saveMap.getEntityInfosOfType("Customer");
  customers.forEach(function(custInfo: any) {
    if (custInfo.entityAspect.entityState !== "Deleted") {
      const companyName = custInfo.entity.companyName || custInfo.entity.CompanyName;
      if (companyName.toLowerCase().indexOf("error") === 0) {
        saveMap.addEntityError(custInfo, "Bad customer", "This customer is not valid!", "companyName");
      }
      const contactName = custInfo.entity.contactName || custInfo.entity.ContactName;
      if (contactName && contactName.toLowerCase().indexOf("error") === 0) {
        saveMap.addEntityError(custInfo, "Bad ContactName", "This contact name should not contain the word 'Error'", "contactName");
      }
    }
  });

  if (tag === "addProdOnServer") {
    const suppliers = saveMap.getEntityInfosOfType("Supplier");
    suppliers.forEach(function(supplierInfo: any) {
      const product = {
        productName: "Test_ Product added on server",
        supplierID: supplierInfo.entity.supplierID
      };
      saveMap.addEntity("Product", product);
    });
  }

  if (tag === "increaseProductPrice") {
    // interesting because it returns a promise
    // forEach category update the product price for all products in the category
    const categoryInfos = saveMap.getEntityInfosOfType("Category");
    const promises = categoryInfos.filter(function (catInfo: any) {
      return catInfo.entity.categoryID != null;
    }).map(function (catInfo: any) {
      const entityQuery = EntityQuery.from("Products").where("categoryID", "==", catInfo.entity.categoryID);
      const query = new SequelizeQuery(_sequelizeManager, entityQuery);
      return query.execute().then(function (r) {
        const products: any = r;
        products.forEach(function (product: any) {
          product.unitPrice = product.unitPrice + .01;
          const ei = saveMap.addEntity("Product", product, "Modified");
          ei.forceUpdate = true;
        });
      });
    });
    await Promise.all(promises);
    return saveMap;
  }

}

function checkFreightOnOrder(orderInfo: any) {
  const order = orderInfo.entity;
  if (this.saveOptions.tag === "freight update") {
    order.freight = order.freight + 1;
  } else if (this.saveOptions.tag === "freight update-ov") {
    order.freight = order.freight + 1;
    orderInfo.entityAspect.originalValuesMap["freight"] = null;
  } else if (this.saveOptions.tag === "freight update-force") {
    order.freight = order.freight + 1;
    orderInfo.forceUpdate = true;
  }
  return true;
}



// TODO: can't do this yet because it require an async version of beforeSaveEntities
// i.e. think about a beforeSaveEntitiesAsync call.
//function increaseProductPrice(saveMap) {
//  // for every 'modififed"category entity found update all of its product's prices by +1 or -1 $
//  // and include these in the save
//  categories = saveMap.getEntitiesOfType("Category");
//  const modCats = categories.filter(function(cat) {
//    return cat.entityAspect.entityState == "Modified";
//  });
//  modCats.forEach(function(cat){
//    const query = EntityQuery.from("Products").where("CategoryID", "==", cat.CategoryID);
//    // more here
//
//  });
//}


// C# version
//protected override Dictionary<Type, List<EntityInfo>> BeforeSaveEntities(Dictionary<Type, List<EntityInfo>> saveMap) {
//
//  const tag = (string)SaveOptions.Tag;
//
//  if (tag == "CommentOrderShipAddress.Before") {
//    const orderInfos = saveMap[typeof(Order)];
//    byte seq = 1;
//    foreach (const info in orderInfos) {
//      const order = (Order)info.Entity;
//      AddComment(order.ShipAddress, seq++);
//    }
//  } else if (tag == "UpdateProduceShipAddress.Before") {
//    const orderInfos = saveMap[typeof(Order)];
//    const order = (Order)orderInfos[0].Entity;
//    UpdateProduceDescription(order.ShipAddress);
//  } else if (tag == "LookupEmployeeInSeparateContext.Before") {
//    LookupEmployeeInSeparateContext(false);
//  } else if (tag == "LookupEmployeeInSeparateContext.SameConnection.Before") {
//    LookupEmployeeInSeparateContext(true);
//  } else if (tag == "ValidationError.Before") {
//    foreach (const type in saveMap.Keys) {
//      const list = saveMap[type];
//      foreach (const entityInfo in list) {
//        const entity = entityInfo.Entity;
//        const entityError = new EntityError() {
//          EntityTypeName = type.Name,
//              ErrorMessage = "Error message for " + type.Name,
//              ErrorName = "Server-Side Validation",
//        };
//        if (entity is Order) {
//          const order = (Order)entity;
//          entityError.KeyValues = new object[] { order.OrderID };
//          entityError.PropertyName = "OrderDate";
//        }
//
//      }
//    }
//  } else if (tag == "increaseProductPrice") {
//    Dictionary<Type, List<EntityInfo>> saveMapAdditions = new Dictionary<Type, List<EntityInfo>>();
//    foreach (const type in saveMap.Keys) {
//      if (type == typeof(Category)) {
//        foreach (const entityInfo in saveMap[type]) {
//          if (entityInfo.EntityState == EntityState.Modified) {
//            Category category = (entityInfo.Entity as Category);
//            const products = this.Context.Products.Where(p => p.CategoryID == category.CategoryID);
//            foreach (const product in products) {
//              if (!saveMapAdditions.ContainsKey(typeof(Product)))
//                saveMapAdditions[typeof(Product)] = new List<EntityInfo>();
//
//              const ei = this.CreateEntityInfo(product, EntityState.Modified);
//              ei.ForceUpdate = true;
//              const incr = (Convert.ToInt64(product.UnitPrice) % 2) == 0 ? 1 : -1;
//              product.UnitPrice += incr;
//              saveMapAdditions[typeof(Product)].Add(ei);
//            }
//          }
//        }
//      }
//    }
//    foreach (const type in saveMapAdditions.Keys) {
//      if (!saveMap.ContainsKey(type)) {
//        saveMap[type] = new List<EntityInfo>();
//      }
//      foreach (const enInfo in saveMapAdditions[type]) {
//        saveMap[type].Add(enInfo);
//      }
//    }
//  }


