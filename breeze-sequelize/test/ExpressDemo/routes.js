
var fs = require('fs');
var Promise = require("bluebird");
var breezeSequelize = require('breeze-sequelize');

var SequelizeManager =breezeSequelize.SequelizeManager;
var SequelizeQuery = breezeSequelize.SequelizeQuery;
var SequelizeSaveHandler = breezeSequelize.SequelizeSaveHandler;

// Don't use this
// var breeze = require('breeze-client');
// Use this
var breeze = breezeSequelize.breeze;
var EntityQuery = breeze.EntityQuery;

var _dbConfigNw = {
  //user: "jayt",
  //password: "password",
  user: "mysql",
  password: "mysql",
  dbName: 'northwindib'
}

var _seqOpts = {
  dialect: "mysql",
  host: "localhost",
  port: 3306
}

var _sequelizeManager = createSequelizeManager();

function createSequelizeManager() {
  var filename = "NorthwindIBMetadata.json";
  if (!fs.existsSync(filename)) {
    next(new Error("Unable to locate file: " + filename));
  }
  var metadata = fs.readFileSync(filename, 'utf8');
  var sm = new SequelizeManager(_dbConfigNw, _seqOpts);
  sm.importMetadata(metadata);


  sm.keyGenerator = new KeyGenerator(sm.sequelize);
  return sm;
}

function KeyGenerator(sequelize, groupSize) {
  this.nextIdModel = sequelize.define('nextid', {
    Name: { type: sequelize.Sequelize.STRING, primaryKey: true },
    NextId: sequelize.Sequelize.INTEGER
  }, {   freezeTableName: true, timestamps: false });
  this.nextId = null;
  this.groupSize = groupSize || 100;
}

// returns a promise
KeyGenerator.prototype.getNextId = function(property) {
  var retId = this.nextId;
  if (retId != null) {
    this.nextId++;
    if (this.nextId > this.maxId) {
      this.nextId = null;
    }
    return Promise.resolve(retId);
  } else {
    return this._updateNextId();
  }
}

// returns a promise;
KeyGenerator.prototype._updateNextId = function() {

  var that = this;
  var nextId;
  return this.nextIdModel.findById("GLOBAL").then(function(nextIdItem) {
    nextId = nextIdItem["NextId"];
    var nextIdToSave = nextId + that.groupSize;
    return that.nextIdModel.update({ NextId: nextIdToSave }, { where: { Name: "GLOBAL", NextId: nextId }});
  }).then(function(infoArray) {
    if (infoArray[0] == 1) {
      retId = nextId;
      that.nextId = nextId + 1;
      that.maxId = retId + that.groupSize;
      that._count = 0;
      return retId;
    } else {
      that._count++;
      if (that._count > 3) {
        that._count = 0;
        throw new Error("Unable to generate a nextId");
      }
      return that._updateNextId();
    }
  });
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

exports.saveChanges = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = beforeSaveEntity;
  saveHandler.beforeSaveEntities = beforeSaveEntities;
  saveHandler.save().then(function(r) {
    returnResults(r, res);
  }).catch(function(e) {
    next(e);
  });
};

function executeEntityQuery(entityQuery, returnResultsFn, res, next) {
  var returnResultsFn = returnResultsFn || returnResults;
  var query = new SequelizeQuery(_sequelizeManager, entityQuery);
  query.execute().then(function (r) {
    returnResultsFn(r, res);
  }).catch(next)
}



function saveUsingCallback(saveHandler, res, next) {
  saveHandler.save().then(function(r) {
    returnResults(r, res);
  }).catch(function(e) {
    next(e);
  });
}

function returnResults(results, res) {
  res.setHeader("Content-Type", "application/json");
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
    .where("CompanyName", "startsWith", "A");
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
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers").where(pred);
  executeEntityQuery(entityQuery, null, res, next);
};


namedQuery.CustomersOrderedStartingWith =    function(req, res, next) {
  // start with client query and add an additional filter.
  var companyName = req.query.companyName;
  // need to use upper case because base query came from server
  var entityQuery = EntityQuery.fromUrl(req.url, "Customers")
      .where("CompanyName", "startsWith", companyName)
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
  var eq1 = EntityQuery.from("Customers");
  var sq1 = new SequelizeQuery(_sequelizeManager, eq1);
  var r1;
  sq1.execute().then(function (r) {
    r1 = r;
    var eq2 = EntityQuery.from("Products");
    var sq2 = new SequelizeQuery(_sequelizeManager, eq2);
    return sq2.execute();
  }).then(function(r2) {
    returnResults( { Customers: r1, Products: r2 }, res);
  });
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
  var entityQuery = EntityQuery.fromUrl(req.url, "Employees").where(pred);

  executeEntityQuery(entityQuery, null, res, next);
}

namedQuery.EmployeesFilteredByCountryAndBirthdate= function(req, res, next) {
  var birthDate = new Date(Date.parse(req.query.birthDate));
  var country = req.query.country;
  var pred = { BirthDate: { ge: birthDate}, Country: country };
  var entityQuery = EntityQuery.fromUrl(req.url, "Employees").where(pred);
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


function beforeSaveEntity(entityInfo) {

  if ( entityInfo.entityType.shortName == "Region" && entityInfo.entityAspect.entityState == "Added") {
    if (entityInfo.entity.RegionDescription.toLowerCase().indexOf("error") === 0) {
      return false;
    }
  }

  return true;
}

// returns undefined or a Promise;
function beforeSaveEntities(saveMap) {
  var tag = this.saveOptions.tag;

  var customers = saveMap.getEntityInfosOfType("Customer");
  customers.forEach(function(custInfo) {
    if (custInfo.entityAspect.entityState != "Deleted") {
      if (custInfo.entity.CompanyName.toLowerCase().indexOf("error") === 0) {
        saveMap.addEntityError(custInfo, "Bad customer", "This customer is not valid!", "CompanyName");
      }
      var contactName = custInfo.entity.ContactName;
      if (contactName && contactName.toLowerCase().indexOf("error") === 0) {
        saveMap.addEntityError(custInfo, "Bad ContactName", "This contact name should not contain the word 'Error'", "ContactName");
      }
    }
  });

  if (tag == "addProdOnServer") {
    var suppliers = saveMap.getEntityInfosOfType("Supplier");
    suppliers.forEach(function(supplierInfo) {
      var product = {
        ProductName: "Test_ Product added on server",
        SupplierID: supplierInfo.entity.SupplierID
      };
      saveMap.addEntity("Product", product);
    });
  }

  if (tag === "increaseProductPrice") {
    // interesting because it returns a promise
    // forEach category update the product price for all products in the category
    var categoryInfos = saveMap.getEntityInfosOfType("Category");
    var promises = categoryInfos.filter(function (catInfo) {
      return catInfo.entity.CategoryID != null;
    }).map(function (catInfo) {
      var entityQuery = EntityQuery.from("Products").where("categoryID", "==", catInfo.entity.CategoryID);
      var query = new SequelizeQuery(_sequelizeManager, entityQuery);
      return query.execute().then(function (r) {
        var products = r;
        products.forEach(function (product) {
          product.UnitPrice = product.UnitPrice + .01;
          var ei = saveMap.addEntity("Product", product, "Modified");
          ei.forceUpdate = true;
        });
      });
    });
    return Promise.all(promises);
  }

}

exports.saveWithComment = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = function(saveMap) {
    var tag = this.saveOptions.tag;
    var entity = {
      Comment1: (tag == null) ? "Generic comment" : tag,
      CreatedOn: new Date(),
      SeqNum: 1
    };
    saveMap.addEntity("Comment", entity);
  }
  saveUsingCallback(saveHandler, res, next);
};

exports.saveWithFreight = function(req, res, next) {
    var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntity = checkFreightOnOrder;
    saveUsingCallback(saveHandler, res, next);
};

exports.saveWithFreight2 = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = function(saveMap) {
    var orderInfos = saveMap.getEntityInfosOfType("Order");
    var fn = checkFreightOnOrder.bind(this);
    orderInfos.forEach(function (order) {
      fn(order);
    }, this);
  }
  saveUsingCallback(saveHandler, res, next);
};

exports.saveWithExit = function(req, res, next) {
    res.setHeader("Content-Type", "application/json");
    results = {
        entities: [],
        keyMappings: []
    }
    res.send(results);
}

exports.saveWithEntityErrorsException = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = function(saveMap) {
    var orderInfos = saveMap.getEntityInfosOfType("Order");
    var errorDetails = orderInfos.map(function(orderInfo) {
      saveMap.addEntityError(orderInfo, "WrongMethod", "Cannot save orders with this save method", "OrderID");
    });
    saveMap.setErrorMessage("test of custom exception message");
  }
  saveUsingCallback(saveHandler, res, next);
};

exports.saveCheckInitializer = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntities = function(saveMap) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var order = {
      OrderDate: today
    };
    saveMap.addEntity("Order", order);
  };
  saveUsingCallback(saveHandler, res, next);
}

exports.saveCheckUnmappedProperty = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = function(entityInfo) {
    var unmappedValue = entityInfo.unmapped["MyUnmappedProperty"];
    // in c#
    // var unmappedValue = entityInfo.UnmappedValuesMap["myUnmappedProperty"];
    if (unmappedValue != "anything22") {
      throw new Error("wrong value for unmapped property:  " + unmappedValue);
    }
    return false;
  };
  saveUsingCallback(saveHandler, res, next);
}

exports.saveCheckUnmappedPropertySerialized = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = function(entityInfo) {
    var unmappedValue = entityInfo.unmapped["MyUnmappedProperty"];
    if (unmappedValue != "ANYTHING22") {
      throw new Error("wrong value for unmapped property:  " + unmappedValue);
    }
    var anotherOne = entityInfo.unmapped["AnotherOne"];

    if ( anotherOne.z[5].foo != 4) {
      throw new Error("wrong value for 'anotherOne.z[5].foo'");
    }

    if (anotherOne.extra != 666) {
      throw new Error("wrong value for 'anotherOne.extra'");
    }

    var cust = entityInfo.entity;
    if (cust.CompanyName.toUpperCase() != cust.CompanyName) {
      throw new Error("Uppercasing of company name did not occur");
    }
    return false;
  };
  saveUsingCallback(saveHandler, res, next);
}

exports.saveCheckUnmappedPropertySuppressed = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = function(entityInfo) {
    var unmapped = entityInfo.unmapped
    if (unmapped != null) {
      throw new Error("unmapped properties should have been suppressed");
    }
    return false;
  };
  saveUsingCallback(saveHandler, res, next);
}

function checkFreightOnOrder(orderInfo) {
  var order = orderInfo.entity;
  if (this.saveOptions.tag === "freight update") {
    order.Freight = order.Freight + 1;
  } else if (this.saveOptions.tag === "freight update-ov") {
    order.Freight = order.Freight + 1;
    orderInfo.entityAspect.originalValuesMap["Freight"] = null;
  } else if (this.saveOptions.tag === "freight update-force") {
    order.Freight = order.Freight + 1;
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
//  var modCats = categories.filter(function(cat) {
//    return cat.entityAspect.entityState == "Modified";
//  });
//  modCats.forEach(function(cat){
//    var query = EntityQuery.from("Products").where("CategoryID", "==", cat.CategoryID);
//    // more here
//
//  });
//}


// C# version
//protected override Dictionary<Type, List<EntityInfo>> BeforeSaveEntities(Dictionary<Type, List<EntityInfo>> saveMap) {
//
//  var tag = (string)SaveOptions.Tag;
//
//  if (tag == "CommentOrderShipAddress.Before") {
//    var orderInfos = saveMap[typeof(Order)];
//    byte seq = 1;
//    foreach (var info in orderInfos) {
//      var order = (Order)info.Entity;
//      AddComment(order.ShipAddress, seq++);
//    }
//  } else if (tag == "UpdateProduceShipAddress.Before") {
//    var orderInfos = saveMap[typeof(Order)];
//    var order = (Order)orderInfos[0].Entity;
//    UpdateProduceDescription(order.ShipAddress);
//  } else if (tag == "LookupEmployeeInSeparateContext.Before") {
//    LookupEmployeeInSeparateContext(false);
//  } else if (tag == "LookupEmployeeInSeparateContext.SameConnection.Before") {
//    LookupEmployeeInSeparateContext(true);
//  } else if (tag == "ValidationError.Before") {
//    foreach (var type in saveMap.Keys) {
//      var list = saveMap[type];
//      foreach (var entityInfo in list) {
//        var entity = entityInfo.Entity;
//        var entityError = new EntityError() {
//          EntityTypeName = type.Name,
//              ErrorMessage = "Error message for " + type.Name,
//              ErrorName = "Server-Side Validation",
//        };
//        if (entity is Order) {
//          var order = (Order)entity;
//          entityError.KeyValues = new object[] { order.OrderID };
//          entityError.PropertyName = "OrderDate";
//        }
//
//      }
//    }
//  } else if (tag == "increaseProductPrice") {
//    Dictionary<Type, List<EntityInfo>> saveMapAdditions = new Dictionary<Type, List<EntityInfo>>();
//    foreach (var type in saveMap.Keys) {
//      if (type == typeof(Category)) {
//        foreach (var entityInfo in saveMap[type]) {
//          if (entityInfo.EntityState == EntityState.Modified) {
//            Category category = (entityInfo.Entity as Category);
//            var products = this.Context.Products.Where(p => p.CategoryID == category.CategoryID);
//            foreach (var product in products) {
//              if (!saveMapAdditions.ContainsKey(typeof(Product)))
//                saveMapAdditions[typeof(Product)] = new List<EntityInfo>();
//
//              var ei = this.CreateEntityInfo(product, EntityState.Modified);
//              ei.ForceUpdate = true;
//              var incr = (Convert.ToInt64(product.UnitPrice) % 2) == 0 ? 1 : -1;
//              product.UnitPrice += incr;
//              saveMapAdditions[typeof(Product)].Add(ei);
//            }
//          }
//        }
//      }
//    }
//    foreach (var type in saveMapAdditions.Keys) {
//      if (!saveMap.ContainsKey(type)) {
//        saveMap[type] = new List<EntityInfo>();
//      }
//      foreach (var enInfo in saveMapAdditions[type]) {
//        saveMap[type].Add(enInfo);
//      }
//    }
//  }


