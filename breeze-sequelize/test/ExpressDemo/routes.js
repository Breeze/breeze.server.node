
var fs = require('fs');
var breezeSequelize = require('breeze-sequelize');
var breeze = require('breeze-client');

var SequelizeManager =breezeSequelize.SequelizeManager;
var SequelizeQuery = breezeSequelize.SequelizeQuery;
var EntityQuery = breeze.EntityQuery;

var _dbConfigNw = {
  host: "localhost",
  user: "jayt",
  password: "password",
  dbName: 'northwindib'
}

var _sequelizeManager = createSequelizeManager();

function createSequelizeManager() {
  var filename = "NorthwindIBMetadata.json";
  if (!fs.existsSync(filename)) {
    next(new Error("Unable to locate file: " + filename));
  }
  var metadata = fs.readFileSync(filename, 'utf8');
  var sm = new SequelizeManager(_dbConfigNw);
  sm.importMetadata(metadata);
  return sm;
}

exports.getMetadata = function(req, res, next) {
    var filename = "NorthwindIBMetadata.json";
    if (!fs.existsSync(filename)) {
      next(new Error("Unable to locate file: " + filename));
    }
    var metadata = fs.readFileSync(filename, 'utf8');
    res.sendfile(filename);
}

exports.get = function (req, res, next) {
  var resourceName = req.params.slug;
  if (namedQuery[resourceName]) {
    namedQuery[resourceName](req, res, next);
  } else {
    var entityQuery = EntityQuery.fromUrl(req.url, resourceName);
    executeEntityQuery(entityQuery, null, res, next);
  }
};


function executeEntityQuery(entityQuery, returnResultsFn, res, next) {
  var returnResultsFn = returnResultsFn || returnResults;
  var query = new SequelizeQuery(_sequelizeManager, entityQuery);
  query.execute().then(function (r) {
    returnResultsFn(r, res);
  }).catch(next)
}

function returnResults(results, res) {
  res.setHeader("Content-Type:", "application/json");
  res.send(results);
}

var namedQuery = {};


namedQuery.CustomerFirstOrDefault = function(req, res, next) {
  // should return empty array
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").where("CompanyName", "StartsWith", "blah").take(1);
  executeEntityQuery(entityQuery, null, res, next);
}


namedQuery.CustomersStartingWithA = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers")
    .andWhere("CompanyName", "startsWith", "A");
  executeEntityQuery(entityQuery, null, res, next);

};

namedQuery.CustomersStartingWith = function(req, res, next) {
    // start with client query and add an additional filter.
  var companyName = req.query.companyName;
  if (companyName == undefined) {
    var err = { statusCode: 404, message: "'companyName must be provided'" };
    next(err);
  }
  // need to use upper case because base query came from server
  var pred = new breeze.Predicate("CompanyName", "startsWith", companyName);
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").andWhere(pred);
  executeEntityQuery(entityQuery, null, res, next);
};


namedQuery.CustomersOrderedStartingWith =    function(req, res, next) {
    // start with client query and add an additional filter.
    var companyName = req.query.companyName;
  // need to use upper case because base query came from server
    var entityQuery = EntityQuery.fromUrl(req.url, "Customers")
        .andWhere("CompanyName", "startsWith", companyName)
        .orderBy("CompanyName");
    executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.CustomersAndOrders = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").expand("Orders");
  executeEntityQuery(entityQuery, null,  res, next);
}

namedQuery.CustomerWithScalarResult = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").take(1);
  executeEntityQuery(entityQuery, null,  res, next);
};


namedQuery.CustomersWithHttpError = function(req, res, next) {
    var err = { statusCode: 404, message: "Unable to do something"  };
    next(err);
};

// HRM is HttpResponseMessage ( just for
namedQuery.CustomersAsHRM = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers");
  executeEntityQuery(entityQuery, null,  res, next);
}

namedQuery.CustomersWithBigOrders = function(req, res, next) {
  var entityQuery = EntityQuery.from("Customers").where("orders", "any", "freight", ">", 100).expand("orders");
  var processResults = function(results, res) {
    var newResults = results.map(function(r) {
      return {
        Customer: r,
        BigOrders:  r.Orders.filter(function (order) {
          return order.Freight > 100;
        })
      }
    })
    returnResults(newResults, res);
  };
  executeEntityQuery(entityQuery, processResults,  res, next);

}

namedQuery.CustomersAndProducts = function(req, res, next) {
  // var stuff = new { Customers = ContextProvider.Context.Customers.ToList(), Products = ContextProvider.Context.Products.ToList() };
//  var q1 = new SequelizeQuery(_sequelizeManager, entityQuery);
//    query.execute().then(function (r) {
//    returnResults(r, res);
//  }).catch(next)
  throw new Error("Not yet written")
}


//// AltCustomers will not be in the resourceName/entityType map;
namedQuery.AltCustomers = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers");
  executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.SearchCustomers = function(req, res, next) {
  var qbe = req.query;
  var ok = qbe != null && qbe.CompanyName != null & qbe.ContactNames.length > 0 && qbe.City.length > 1;
  if (!ok) {
    throw new Exception("qbe error");
  }
  // var entityQuery = EntityQuery.from("Customers").where("companyName", "startsWith", qbe.companyName);
  // just testing that qbe actually made it in not attempted to write qbe logic here
  // so just return first 3 customers.
  var entityQuery = EntityQuery.from("Customers").take(3);
  executeEntityQuery(entityQuery, null, res, next);
}


namedQuery.SearchCustomers2 = function(req, res, next) {
  var qbeList = req.query.qbeList;
  if (qbeList.Length < 2) {
    throw new Exception("all least two items must be passed in");
  }
  qbeList.forEach(function(qbe) {
    var ok = qbe != null && qbe.CompanyName != null & qbe.ContactNames.length > 0 && qbe.City.length > 1;
    if (!ok) {
      throw new Exception("qbe error");
    }
  });
  // just testing that qbe actually made it in not attempted to write qbe logic here
  // so just return first 3 customers.
  var entityQuery = EntityQuery.from("Customers").take(3);
  executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.OrdersCountForCustomer = function(req, res, next) {
  var companyName = req.query.companyName;
  var entityQuery = EntityQuery.from("Customers")
      .where("companyName", "startsWith", companyName)
      .expand("orders")
      .take(1);
  var processResults = function(results, res) {
    var r;
    if (results.length > 0) {
      r = r.Orders.length;
    } else {
      r = 0;
    }
    returnResults(r, res)
  };
  executeEntityQuery(entityQuery, processResults, res, next);
}

namedQuery.EnumerableEmployees = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Employees");
  executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.EmployeesMultipleParams = function(req, res, next) {
  var empId = req.query.employeeID;
  var city = req.query.city;
  var where = { or: [{ employeeID: empId }, { city: city }] }
  var entityQuery = EntityQuery.from("Employees").where(where);
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.CompanyNames = function(req, res, next) {
  var entityQuery = EntityQuery.from("Customers").select("companyName");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.CompanyNamesAndIds = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").select("CompanyName, CustomerID");
  executeEntityQuery(entityQuery, null, res, next);
};

namedQuery.CompanyNamesAndIdsAsDTO = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").select("CompanyName, CustomerID");
  var projectResults = function(results, res) {
    var newResults = results.map(function(r) {
      return { CompanyName: r.CompanyName, CustomerID: r.CustomerID };
    })
    returnResults(newResults, res);
  };
  executeEntityQuery(entityQuery, projectResults , res, next);
}


namedQuery.CompanyInfoAndOrders = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").select("CompanyName, CustomerID, Orders");
  executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.OrdersAndCustomers = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "Orders").expand("Customer");
  executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.SearchEmployees = function(req, res, next) {

  var employeeIds = req.query.employeeIds;
  var pred = { EmployeeID: { in: employeeIds }};
  var entityQuery = EntityQuery.fromUrl(req.url, "Employees").andWhere(pred);

  executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.EmployeesFilteredByCountryAndBirthdate= function(req, res, next) {
  var birthDate = new Date(Date.parse(req.query.birthDate));
  var country = req.query.country;
  var pred = { BirthDate: { ge: birthDate}, Country: country };
  var entityQuery = EntityQuery.fromUrl(req.url, "Employees").andWhere(pred);
  executeEntityQuery(entityQuery, null, res, next);
};

// not yet implemented



//public Object CustomerCountsByCountry() {
//    return ContextProvider.Context.Customers.GroupBy(c => c.Country).Select(g => new { g.Key, Count = g.Count() });

// need expand support for these.
//public IQueryable<Object> CustomersWithBigOrders() {
//    var stuff = ContextProvider.Context.Customers.Select(c => new { Customer = c, BigOrders = c.Orders.Where(o => o.Freight > 100) });

//public Object CustomersAndProducts() {
//    var stuff = new { Customers = ContextProvider.Context.Customers.ToList(), Products = ContextProvider.Context.Products.ToList() };

//exports.saveChanges = function(req, res, next) {
//    var saveHandler = new breezeMongo.MongoSaveHandler(db, req.body, returnResults(res, next));
//    saveHandler.beforeSaveEntity = beforeSaveEntity;
//    saveHandler.beforeSaveEntities = beforeSaveEntities;
//    saveHandler.save();
//};

function beforeSaveEntity(entity) {
  if ( entity.entityAspect.entityTypeName.indexOf("Region") >= 0 && entity.entityAspect.entityState == "Added") {
    if (entity.RegionDescription.toLowerCase().indexOf("error") === 0) return false;
  }
  return true;
}

function beforeSaveEntities(callback) {
  var tag = this.saveOptions.tag;
  if (tag === "increaseProductPrice") {
    this.registerEntityType("Product", "Products", "Identity");
  }
  var categories = this.saveMap["Category"] || [];
  categories.forEach(function(cat) {
    // NOT YET IMPLEMENTED

  });
  callback();
}

// C# version
//protected override Dictionary<Type, List<EntityInfo>> BeforeSaveEntities(Dictionary<Type, List<EntityInfo>> saveMap) {
//    if ((string)SaveOptions.Tag == "increaseProductPrice") {
//        Dictionary<Type, List<EntityInfo>> saveMapAdditions = new Dictionary<Type, List<EntityInfo>>();
//        foreach (var type in saveMap.Keys) {
//            if (type == typeof(Category)) {
//                foreach (var entityInfo in saveMap[type]) {
//                    if (entityInfo.EntityState == EntityState.Modified) {
//                        Category category = (entityInfo.Entity as Category);
//                        var products = this.Context.Products.Where(p => p.CategoryID == category.CategoryID);
//                        foreach (var product in products) {
//                            if (!saveMapAdditions.ContainsKey(typeof(Product)))
//                                saveMapAdditions[typeof(Product)] = new List<EntityInfo>();
//
//                            var ei = this.CreateEntityInfo(product, EntityState.Modified);
//                            ei.ForceUpdate = true;
//                            var incr = (Convert.ToInt64(product.UnitPrice) % 2) == 0 ? 1 : -1;
//                            product.UnitPrice += incr;
//                            saveMapAdditions[typeof(Product)].Add(ei);
//                        }
//                    }
//                }
//            }
//        }
//        foreach (var type in saveMapAdditions.Keys) {
//            if (!saveMap.ContainsKey(type)) {
//                saveMap[type] = new List<EntityInfo>();
//            }
//            foreach (var enInfo in saveMapAdditions[type]) {
//                saveMap[type].Add(enInfo);
//            }
//        }
//        return saveMap;
//    }
//
//    return base.BeforeSaveEntities(saveMap);

//
//
//
//exports.saveWithFreight = function(req, res, next) {
//    var saveHandler = new breezeMongo.MongoSaveHandler(db, req.body, returnResults(res, next));
//    saveHandler.beforeSaveEntity = checkFreightOnOrder;
//    saveHandler.save(db, req.body, returnResults(res,next));
//}
//
//exports.saveWithFreight2 = function(req, res, next) {
//    var saveHandler = new breezeMongo.MongoSaveHandler(db, req.body, returnResults(res, next));
//    saveHandler.beforeSaveEntities = checkFreightOnOrders;
//    saveHandler.save(db, req.body, returnResults(res,next));
//}
//
//exports.saveWithExit = function(req, res, next) {
//    res.setHeader("Content-Type:", "application/json");
//    results = {
//        insertedKeys: [],
//        deletedKeys: [],
//        updatedKeys: [],
//        keyMappings: [],
//        entitiesCreatedOnServer: []
//    }
//    res.send(results);
//}
//
//
//function checkFreightOnOrder(order) {
//    if (this.saveOptions.tag === "freight update") {
//        order.Freight = order.Freight + 1;
//    } else if (this.saveOptions.tag === "freight update-ov") {
//        order.Freight = order.Freight + 1;
//        order.entityAspect.originalValuesMap["Freight"] = null;
//    } else if (this.saveOptions.tag === "freight update-force") {
//        order.Freight = order.Freight + 1;
//        order.entityAspect.forceUpdate = true;
//    }
//    return true;
//}
//
//function checkFreightOnOrders(callback) {
//    var orderTypeName = this.qualifyTypeName("Order");
//    var orders = this.saveMap[orderTypeName] || [];
//    var fn = checkFreightOnOrder.bind(this);
//    orders.forEach(function(order) {
//        fn(order);
//    });
//    callback();
//}
//
//exports.saveWithComment = function(req, res, next) {
//    var saveHandler = new breezeMongo.MongoSaveHandler(db, req.body, returnResults(res, next));
//    var dataProperties = [ {
//        name: "_id",
//        dataType: "MongoObjectId"
//    }];
//
//    saveHandler.registerEntityType("Comment", "Comments", "Identity", dataProperties);
//    saveHandler.beforeSaveEntities = function(callback) {
//        var tag = this.saveOptions.tag;
//        var entity = {
//            Comment1: (tag == null) ? "Generic comment" : tag,
//            CreatedOn: new Date(),
//            SeqNum: 1
//        };
//        this.addToSaveMap(entity, "Comment");
//        callback();
//    }
//    saveHandler.save(db, req.body, returnResults(res,next));
//
//}
//



