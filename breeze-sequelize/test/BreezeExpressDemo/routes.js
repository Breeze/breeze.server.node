"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
// Note: breeze is available from both 'breeze-client' and indirectly from 'breeze-sequelize'
// if you compare them the ARE '==='.
var breeze_client_1 = require("breeze-client");
var breeze_sequelize_1 = require("breeze-sequelize");
var adapter_model_library_backing_store_1 = require("breeze-client/adapter-model-library-backing-store");
var demo_key_generator_1 = require("./demo-key-generator");
{ }
adapter_model_library_backing_store_1.ModelLibraryBackingStoreAdapter.register(breeze_client_1.breeze.config);
var _dbConfigNw = {
    //user: "jayt",
    //password: "password",
    user: "root",
    password: "mysql",
    dbName: 'northwindib'
};
var _seqOpts = {
    dialect: "mysql",
    host: "localhost",
    port: 3306,
    // logging: console.log,
    pool: {
        max: 100
    }
};
var _sequelizeManager = createSequelizeManager();
function createSequelizeManager() {
    var filename = "NorthwindIBMetadata.json";
    if (!fs.existsSync(filename)) {
        // next(new Error("Unable to locate file: " + filename));
        throw new Error("Unable to locate file: " + filename);
    }
    var metadata = fs.readFileSync(filename, 'utf8');
    var sm = new breeze_sequelize_1.SequelizeManager(_dbConfigNw, _seqOpts);
    sm.importMetadata(metadata);
    sm.keyGenerator = new demo_key_generator_1.DemoKeyGenerator(sm.sequelize);
    return sm;
}
function getMetadata(req, res, next) {
    var filename = "NorthwindIBMetadata.json";
    if (!fs.existsSync(filename)) {
        next(new Error("Unable to locate file: " + filename));
    }
    var metadata = fs.readFileSync(filename, 'utf8');
    res.sendfile(filename);
}
exports.getMetadata = getMetadata;
function get(req, res, next) {
    var resourceName = req.params.slug;
    if (exports.namedQuery[resourceName]) {
        exports.namedQuery[resourceName](req, res, next);
    }
    else {
        var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, resourceName);
        executeEntityQuery(entityQuery, null, res, next);
    }
}
exports.get = get;
function saveChanges(req, res, next) {
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntity = beforeSaveEntity;
    saveHandler.beforeSaveEntities = beforeSaveEntities.bind(saveHandler);
    saveHandler.save().then(function (r) {
        returnSaveResults(r, res);
    }).catch(function (e) {
        next(e);
    });
}
exports.saveChanges = saveChanges;
function executeEntityQuery(entityQuery, returnResultsFn, res, next) {
    return __awaiter(this, void 0, void 0, function () {
        var query, r, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    returnResultsFn = returnResultsFn || returnQueryResults;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = new breeze_sequelize_1.SequelizeQuery(_sequelizeManager, entityQuery);
                    return [4 /*yield*/, query.execute(null)];
                case 2:
                    r = _a.sent();
                    returnResultsFn(r, res);
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    next(e_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function saveUsingCallback(saveHandler, res, next) {
    return __awaiter(this, void 0, void 0, function () {
        var r, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, saveHandler.save()];
                case 1:
                    r = _a.sent();
                    returnSaveResults(r, res);
                    return [3 /*break*/, 3];
                case 2:
                    e_2 = _a.sent();
                    next(e_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Used to return
function returnQueryResults(results, res) {
    res.setHeader("Content-Type", "application/json");
    res.send(results);
}
function returnSaveResults(results, res) {
    res.setHeader("Content-Type", "application/json");
    res.send(results);
}
exports.namedQuery = {};
exports.namedQuery.CustomerFirstOrDefault = function (req, res, next) {
    // should return empty array
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers").where("companyName", "StartsWith", "blah").take(1);
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CustomersStartingWithA = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers")
        .where("companyName", "startsWith", "A");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CustomersStartingWith = function (req, res, next) {
    // start with client query and add an additional filter.
    var companyName = req.query.companyName;
    if (companyName == undefined) {
        var err = { statusCode: 404, message: "'companyName must be provided'" };
        next(err);
    }
    // need to use upper case because base query came from server
    var pred = new breeze_client_1.breeze.Predicate("companyName", "startsWith", companyName);
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers").where(pred);
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CustomersOrderedStartingWith = function (req, res, next) {
    // start with client query and add an additional filter.
    var companyName = req.query.companyName;
    // need to use upper case because base query came from server
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers")
        .where("companyName", "startsWith", companyName)
        .orderBy("companyName");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CustomersAndOrders = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers").expand("orders");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CustomerWithScalarResult = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers").take(1);
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CustomersWithHttpError = function (req, res, next) {
    var err = { statusCode: 404, message: "Unable to do something" };
    next(err);
};
// HRM is HttpResponseMessage ( just for
exports.namedQuery.CustomersAsHRM = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CustomersWithBigOrders = function (req, res, next) {
    var entityQuery = breeze_client_1.breeze.EntityQuery.from("Customers").where("orders", "any", "freight", ">", 100).expand("orders");
    var processResults = function (results, res) {
        var newResults = results.map(function (r) {
            return {
                customer: r,
                bigOrders: r.orders.filter(function (order) {
                    return order.Freight > 100;
                })
            };
        });
        returnQueryResults(newResults, res);
    };
    executeEntityQuery(entityQuery, processResults, res, next);
};
exports.namedQuery.CustomersAndProducts = function (req, res, next) {
    var eq1 = breeze_client_1.EntityQuery.from("Customers");
    var sq1 = new breeze_sequelize_1.SequelizeQuery(_sequelizeManager, eq1);
    var r1;
    sq1.execute().then(function (r) {
        r1 = r;
        var eq2 = breeze_client_1.EntityQuery.from("Products");
        var sq2 = new breeze_sequelize_1.SequelizeQuery(_sequelizeManager, eq2);
        return sq2.execute();
    }).then(function (r2) {
        returnQueryResults({ Customers: r1, Products: r2 }, res);
    });
};
//// AltCustomers will not be in the resourceName/entityType map;
exports.namedQuery.AltCustomers = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.SearchCustomers = function (req, res, next) {
    var qbe = req.query;
    var ok = qbe != null && qbe.CompanyName != null && qbe.ContactNames.length > 0 && qbe.City.length > 1;
    if (!ok) {
        throw new Error("qbe error");
    }
    // const entityQuery = EntityQuery.from("Customers").where("companyName", "startsWith", qbe.companyName);
    // just testing that qbe actually made it in not attempted to write qbe logic here
    // so just return first 3 customers.
    var entityQuery = breeze_client_1.EntityQuery.from("Customers").take(3);
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.SearchCustomers2 = function (req, res, next) {
    var qbeList = req.query.qbeList;
    if (qbeList.length < 2) {
        throw new Error("all least two items must be passed in");
    }
    qbeList.forEach(function (qbe) {
        var ok = qbe != null && qbe.CompanyName != null && qbe.ContactNames.length > 0 && qbe.City.length > 1;
        if (!ok) {
            throw new Error("qbe error");
        }
    });
    // just testing that qbe actually made it in not attempted to write qbe logic here
    // so just return first 3 customers.
    var entityQuery = breeze_client_1.EntityQuery.from("Customers").take(3);
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.OrdersCountForCustomer = function (req, res, next) {
    var companyName = req.query.companyName;
    var entityQuery = breeze_client_1.EntityQuery.from("Customers")
        .where("companyName", "startsWith", companyName)
        .expand("orders")
        .take(1);
    var processResults = function (results, res) {
        var r;
        if (results.length > 0) {
            r = r.orders.length;
        }
        else {
            r = 0;
        }
        returnQueryResults(r, res);
    };
    executeEntityQuery(entityQuery, processResults, res, next);
};
exports.namedQuery.EnumerableEmployees = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Employees");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.EmployeesMultipleParams = function (req, res, next) {
    var empId = req.query.employeeID;
    var city = req.query.city;
    var where = { or: [{ employeeID: empId }, { city: city }] };
    var entityQuery = breeze_client_1.EntityQuery.from("Employees").where(where);
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CompanyNames = function (req, res, next) {
    var entityQuery = breeze_client_1.EntityQuery.from("Customers").select("companyName");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CompanyNamesAndIds = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers").select("companyName, customerID");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.CompanyNamesAndIdsAsDTO = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers").select("companyName, customerID");
    var projectResults = function (results, res) {
        var newResults = results.map(function (r) {
            return { companyName: r.companyName, customerID: r.customerID };
        });
        returnQueryResults(newResults, res);
    };
    executeEntityQuery(entityQuery, projectResults, res, next);
};
exports.namedQuery.CompanyInfoAndOrders = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Customers").select("companyName, customerID, orders");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.OrdersAndCustomers = function (req, res, next) {
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Orders").expand("customer");
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.SearchEmployees = function (req, res, next) {
    var employeeIds = req.query.employeeIds;
    var pred = { employeeID: { in: employeeIds } };
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Employees").where(pred);
    executeEntityQuery(entityQuery, null, res, next);
};
exports.namedQuery.EmployeesFilteredByCountryAndBirthdate = function (req, res, next) {
    var birthDate = new Date(Date.parse(req.query.birthDate));
    var country = req.query.country;
    var pred = { birthDate: { ge: birthDate }, country: country };
    var entityQuery = breeze_sequelize_1.urlToEntityQuery(req.url, "Employees").where(pred);
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
exports.namedQuery.saveWithComment = function (req, res, next) {
    var _this = this;
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntities = function (saveMap) { return __awaiter(_this, void 0, void 0, function () {
        var tag, entity;
        return __generator(this, function (_a) {
            tag = saveHandler.saveOptions.tag;
            entity = {
                comment1: (tag == null) ? "Generic comment" : tag,
                createdOn: new Date(),
                seqNum: 1
            };
            saveMap.addEntity("Comment", entity);
            return [2 /*return*/, saveMap];
        });
    }); };
    saveUsingCallback(saveHandler, res, next);
};
exports.namedQuery.saveWithFreight = function (req, res, next) {
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntity = checkFreightOnOrder.bind(saveHandler);
    saveUsingCallback(saveHandler, res, next);
};
exports.namedQuery.saveWithFreight2 = function (req, res, next) {
    var _this = this;
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntities = function (saveMap) { return __awaiter(_this, void 0, void 0, function () {
        var orderInfos, fn;
        return __generator(this, function (_a) {
            orderInfos = saveMap.getEntityInfosOfType("Order");
            fn = checkFreightOnOrder.bind(saveHandler);
            orderInfos.forEach(function (order) { return fn(order); });
            return [2 /*return*/, saveMap];
        });
    }); };
    saveUsingCallback(saveHandler, res, next);
};
exports.namedQuery.saveWithExit = function (req, res, next) {
    res.setHeader("Content-Type", "application/json");
    var results = {
        entities: [],
        keyMappings: []
    };
    res.send(results);
};
exports.namedQuery.saveWithEntityErrorsException = function (req, res, next) {
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntities = function (saveMap) {
        return __awaiter(this, void 0, void 0, function () {
            var orderInfos, errorDetails;
            return __generator(this, function (_a) {
                orderInfos = saveMap.getEntityInfosOfType("Order");
                errorDetails = orderInfos.map(function (orderInfo) {
                    saveMap.addEntityError(orderInfo, "WrongMethod", "Cannot save orders with this save method", "orderID");
                });
                saveMap.setErrorMessage("test of custom exception message");
                return [2 /*return*/, saveMap];
            });
        });
    };
    saveUsingCallback(saveHandler, res, next);
};
exports.namedQuery.saveCheckInitializer = function (req, res, next) {
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntities = function (saveMap) {
        return __awaiter(this, void 0, void 0, function () {
            var today, order;
            return __generator(this, function (_a) {
                today = new Date();
                today.setHours(0, 0, 0, 0);
                order = {
                    orderDate: today
                };
                saveMap.addEntity("Order", order);
                return [2 /*return*/, saveMap];
            });
        });
    };
    saveUsingCallback(saveHandler, res, next);
};
exports.namedQuery.saveCheckUnmappedProperty = function (req, res, next) {
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntity = function (entityInfo) {
        var unmappedValue = entityInfo.unmapped["myUnmappedProperty"];
        // in c#
        // const unmappedValue = entityInfo.UnmappedValuesMap["myUnmappedProperty"];
        if (unmappedValue !== "anything22") {
            throw new Error("wrong value for unmapped property:  " + unmappedValue);
        }
        return false;
    };
    saveUsingCallback(saveHandler, res, next);
};
exports.namedQuery.saveCheckUnmappedPropertySerialized = function (req, res, next) {
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntity = function (entityInfo) {
        var unmappedValue = entityInfo.unmapped["myUnmappedProperty"];
        if (unmappedValue !== "ANYTHING22") {
            throw new Error("wrong value for unmapped property:  " + unmappedValue);
        }
        var anotherOne = entityInfo.unmapped["anotherOne"];
        if (anotherOne.z[5].foo !== 4) {
            throw new Error("wrong value for 'anotherOne.z[5].foo'");
        }
        if (anotherOne.extra !== 666) {
            throw new Error("wrong value for 'anotherOne.extra'");
        }
        var cust = entityInfo.entity;
        if (cust.companyName.toUpperCase() !== cust.companyName) {
            throw new Error("Uppercasing of company name did not occur");
        }
        return false;
    };
    saveUsingCallback(saveHandler, res, next);
};
exports.namedQuery.saveCheckUnmappedPropertySuppressed = function (req, res, next) {
    var saveHandler = new breeze_sequelize_1.SequelizeSaveHandler(_sequelizeManager, req);
    saveHandler.beforeSaveEntity = function (entityInfo) {
        var unmapped = entityInfo.unmapped;
        if (unmapped != null) {
            throw new Error("unmapped properties should have been suppressed");
        }
        return false;
    };
    saveUsingCallback(saveHandler, res, next);
};
function beforeSaveEntity(entityInfo) {
    if (entityInfo.entityType.shortName === "Region" && entityInfo.entityAspect.entityState === "Added") {
        if (entityInfo.entity.regionDescription.toLowerCase().indexOf("error") === 0) {
            return false;
        }
    }
    if (entityInfo.entityType.shortName === "Employee") {
        var emp = entityInfo.entity;
        if (emp.fullName === null) {
            emp.fullName = emp.firstName + " " + emp.lastName;
        }
    }
    return true;
}
// returns undefined or a Promise;
function beforeSaveEntities(saveMap) {
    return __awaiter(this, void 0, void 0, function () {
        var tag, customers, suppliers, categoryInfos, promises;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tag = this.saveOptions.tag;
                    customers = saveMap.getEntityInfosOfType("Customer");
                    customers.forEach(function (custInfo) {
                        if (custInfo.entityAspect.entityState !== "Deleted") {
                            var companyName = custInfo.entity.companyName || custInfo.entity.CompanyName;
                            if (companyName.toLowerCase().indexOf("error") === 0) {
                                saveMap.addEntityError(custInfo, "Bad customer", "This customer is not valid!", "companyName");
                            }
                            var contactName = custInfo.entity.contactName || custInfo.entity.ContactName;
                            if (contactName && contactName.toLowerCase().indexOf("error") === 0) {
                                saveMap.addEntityError(custInfo, "Bad ContactName", "This contact name should not contain the word 'Error'", "contactName");
                            }
                        }
                    });
                    if (tag === "addProdOnServer") {
                        suppliers = saveMap.getEntityInfosOfType("Supplier");
                        suppliers.forEach(function (supplierInfo) {
                            var product = {
                                productName: "Test_ Product added on server",
                                supplierID: supplierInfo.entity.supplierID
                            };
                            saveMap.addEntity("Product", product);
                        });
                    }
                    if (!(tag === "increaseProductPrice")) return [3 /*break*/, 2];
                    categoryInfos = saveMap.getEntityInfosOfType("Category");
                    promises = categoryInfos.filter(function (catInfo) {
                        return catInfo.entity.categoryID != null;
                    }).map(function (catInfo) {
                        var entityQuery = breeze_client_1.EntityQuery.from("Products").where("categoryID", "==", catInfo.entity.categoryID);
                        var query = new breeze_sequelize_1.SequelizeQuery(_sequelizeManager, entityQuery);
                        return query.execute().then(function (r) {
                            var products = r;
                            products.forEach(function (product) {
                                product.unitPrice = product.unitPrice + .01;
                                var ei = saveMap.addEntity("Product", product, "Modified");
                                ei.forceUpdate = true;
                            });
                        });
                    });
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, saveMap];
                case 2: return [2 /*return*/];
            }
        });
    });
}
function checkFreightOnOrder(orderInfo) {
    var order = orderInfo.entity;
    if (this.saveOptions.tag === "freight update") {
        order.freight = order.freight + 1;
    }
    else if (this.saveOptions.tag === "freight update-ov") {
        order.freight = order.freight + 1;
        orderInfo.entityAspect.originalValuesMap["freight"] = null;
    }
    else if (this.saveOptions.tag === "freight update-force") {
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
//# sourceMappingURL=routes.js.map