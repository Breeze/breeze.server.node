var fs = require('fs');
var expect = require('chai').expect;
var Sequelize = require('sequelize');
var Promise = require('bluebird');
var breeze = require('breeze-client');
var breezeSequelize = require("breeze-sequelize");
var testFns          = require('./testFns.js');

var SequelizeManager = breezeSequelize.SequelizeManager;
var SequelizeQuery = breezeSequelize.SequelizeQuery;
var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService;
var _ = Sequelize.Utils._;
var log = testFns.log;

describe("EntityQuery to SequelizeQuery - execute", function () {
  
  this.enableTimeouts(false);

  var _ms, _em, _sm;
  
  before(function () {
    _em = testFns.newEm();
    _ms = _em.metadataStore;

    _sm = new SequelizeManager(testFns.dbConfigNw);
    _sm.importMetadata(testFns.getMetadata());

  });

  function toSequelizeQuery(entityQuery) {
    // comment next 3 line out to test client side queries implemented on the server.
    var uri = entityQuery._toUri(_em);
    console.log(uri);
    var entityQuery = EntityQuery.fromUrl(uri);
    var sq = new SequelizeQuery(_sm, entityQuery);
    return sq;
  }

  it("should be able to use fn 'toupper'", function (done) {
//    var query = new EntityQuery()
//        .from("Customers")
//        .where("toUpper(substring(companyName, 1, 2))", "startsWith", "OM");
    var q = EntityQuery.from("Customers")
        .where("toUpper(CompanyName)", "startsWith", "C")
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(1);
      r.forEach(function (cust) {
        ok = cust.CompanyName.indexOf("C") == 0;
        expect(ok).true;
      });

    }).then(done, done);
  });


  it("should be able to use fn 'tolower'", function (done) {
    var q = EntityQuery.from("Customers")
        .where("toLower(CompanyName)", "startsWith", "c")
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(1);
      r.forEach(function (cust) {
        ok = cust.CompanyName.indexOf("C") == 0;
        expect(ok).true;
      });

    }).then(done, done);
  });

  it("should be able to use fn 'substring'", function (done) {
    var q = EntityQuery.from("Customers")
        .where("substring(CompanyName,0,2)", "==", "Co");
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(1);
      r.forEach(function (cust) {
        ok = cust.CompanyName.indexOf("Co") == 0;
        expect(ok).true;
      });

    }).then(done, done);
  });

  it("should be able to use fn 'substring' and 'tolower'", function (done) {
    var q = EntityQuery.from("Customers")
        .where("substring(toLower(CompanyName),1,2)", "==", "om");
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      r.forEach(function (cust) {
        ok = cust.CompanyName.substr(1,2).toLowerCase() == 'om';
        expect(ok).true;
      });

    }).then(done, done);
  });

  it("should be able to use fn 'length'", function (done) {
    var minLength = 26;
    var q = EntityQuery.from("Customers")
        .where("length(Address)", ">", minLength)
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(5);
      expect(r).to.have.length.lessThan(20);
      r.forEach(function (cust) {
        expect(cust.Address).to.have.length.greaterThan(minLength);
      });

    }).then(done, done);
  });

  it("should be able to use fn 'month'", function (done) {
    var q = EntityQuery.from("Employees")
        .where("month(BirthDate)", "==", 12)
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);

      r.forEach(function (emp) {
        expect(emp.BirthDate.getMonth()).to.eql(11);
      });

    }).then(done, done);
  });

  it("should be able to use fn 'day'", function (done) {
    var q = EntityQuery.from("Employees")
        .where("day(BirthDate)", ">", 20)
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);

      r.forEach(function (emp) {
        expect(emp.BirthDate.getDate()).to.be.greaterThan(20);
      });

    }).then(done, done);
  });



  it("should be able to use fn 'floor'", function (done) {
    var q = EntityQuery.from("Orders")
        .where("floor(freight)", "==", 10)
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      expect(r).to.have.length.lessThan(15);
      r.forEach(function (order) {
        expect(Math.floor(order.Freight)).to.eql(10);
      });

    }).then(done, done);
  });

  it("should be able to use fn 'round'", function (done) {
    var q = EntityQuery.from("Orders")
        .where("round(freight)", "==", 10)
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      expect(r).to.have.length.lessThan(15);
      r.forEach(function (order) {
        expect(Math.round(order.Freight)).to.eql(10);
      });

    }).then(done, done);
  });

  it("should be able to use 'any' with expand on same type", function (done) {
    // problem here is that the query works fine EXCEPT
    // that the expand only returns orders.freight > 950
    // not all orders that match the parent;
    var q = EntityQuery.from("Employees")
        .where("orders", "any", "freight", ">", 950)
        .expand("orders");
    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(1);
      r.forEach(function (emp) {
        ok = emp.Orders.some(function (order) {
          return order.Freight > 950;
        });
        expect(ok).true;
      });

    }).then(done, done);
  });

  it("should be able to use 'in'", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var countries = ['Austria', 'Italy', 'Norway']
    var q = EntityQuery.from("Customers")
        .where("country", 'in', countries);


    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(5);
      ok = r.every(function(cust) {
        return countries.indexOf(cust.Country) >= 0;
      })
      expect(ok).true;
    }).then(done, done);
  });



  it("should be able to use inlineCount", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Customers")
        .orderBy("companyName")
        .take(20)
        .inlineCount();
    var last10;

    var sq = toSequelizeQuery(q)
    sq.executeRaw().then(function (r) {
      expect(r).to.have.property("rows");
      expect(r).to.have.property("count");
      expect(r.rows.length).to.be.lessThan(r.count);
      var r2 = sq._reshapeResults(r);
      expect(r2).to.have.property("results");
      expect(r2).to.have.property("inlineCount");
      expect(r.count).to.eql(r2.inlineCount);
    }).then(done, done);
  });


  it("should be able to skip and take", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Customers")
        .orderBy("companyName")
        .take(20);
    var last10;
    var sq = toSequelizeQuery(q);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length(20);
      last10 = r.slice(10);
      var q2 = q.skip(10).take(10);
      return toSequelizeQuery(q2).executeRaw();
    }).then(function(r2) {
      expect(r2).eql(last10, "last10 should be the same");
    }).then(done, done);
  });


  it("should be able to order by a single property", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Customers")
        .orderBy("companyName")
        .take(10);
    var sq = toSequelizeQuery(q);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length(10);
      var ok = testFns.isSorted(r, "CompanyName");
      expect(ok).true;
      r.forEach(function(cust) {
        expect(cust).to.have.property("CompanyName");
      });
      var r2 = sq._reshapeResults(r);
      expect(r2).to.have.length(10);

    }).then(done, done);
  });

  it("should be able to order by two properties", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Customers")
        .orderBy("country, companyName DESC")
        .take(10);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length(10);
      var ok = testFns.isSorted(r, ["Country", "CompanyName desc"]);
      expect(ok, "should be sorted").true;
      r.forEach(function(cust) {
        expect(cust).to.have.property("CompanyName");
      });
    }).then(done, done);
  });

  it("should be able to order by nested property", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Orders")
        .where("freight", ">", 300)
        .orderBy("customer.companyName desc");
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(1);
      var custs = r.map(function (order) {
        expect(order).to.have.property("Customer");
        return order.Customer;
      })
      var ok = testFns.isSorted(custs, ["CompanyName desc"]);
      expect(ok, "should be sorted").true;
      return toSequelizeQuery(q).execute(_sm);
    }).then(function(r2) {
      expect(r2).to.have.length.greaterThan(1);
      expect(r2).not.to.have.property("Customer");

    }).then(done, done);
  });

  it("should be able to order by nested property and regular property", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Orders")
        .where("freight", ">", 300)
        .orderBy("customer.companyName desc, freight");
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(1);
      var anons = r.map(function(order) {
        expect(order).to.have.property("Customer");
        return { CompanyName: order.Customer.CompanyName, Freight: order.Freight };
      })
      var ok = testFns.isSorted(anons, ["CompanyName desc", "Freight"]);
      expect(ok, "should be sorted").true;

    }).then(done, done);
  });

  it("should be able to order by nested properties with a nested where", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Orders")
        // .where("customer.companyName", "startsWith", "S")
        .where( {
          "customer.companyName": { startsWith: "S"},
          "freight" : { ">": 300 }
        })
        .orderBy("customer.companyName desc, freight");

    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(1);

      var anons = r.map(function(order) {
        expect(order.Freight).to.be.greaterThan(300);
        expect(order).to.have.property("Customer");
        expect(order.Customer.CompanyName).to.match(/^S/);
        return { CompanyName: order.Customer.CompanyName, Freight: order.Freight };
      })
      var ok = testFns.isSorted(anons, ["CompanyName desc", "Freight"]);
      expect(ok, "should be sorted").true;

    }).then(done, done);
  });


  it("should be able to query with where on a nested property", function (done) {
    // needs to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("Orders")
        .where("customer.companyName", "startsWith", "B")
        .take(2);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length(2);

      r.forEach(function(order) {
        expect(order).to.have.property("Customer");
        var cust = order.Customer;
        expect(cust.CompanyName.indexOf("B", 0)).to.eql(0);
        // insure that we are only bringing the min necessary down.
        expect(Object.keys(cust.values)).to.have.length(1);
      });
    }).then(done, done);
  });

  it("should be able to query with where on a nested property - 2", function (done) {
    // TODO: need to turn the query into one with an include with a where condition.
    var q = EntityQuery.from("OrderDetails")
        .where("product.productID", "==", 1);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      r.forEach(function(od) {
        expect(od).to.have.property("Product");
        var product = od.Product;
        expect(product).to.have.property("ProductID");
        expect(product.ProductID).to.eql(1);
        expect(Object.keys(product.values)).to.have.length(1);

      });
    }).then(done, done);
  });

  it("should be able to query with where on a nested property - 3", function (done) {
    // TODO: need to turn the query into one with an include with a where condition.
    var p =   {
      "product.productID": { '>':  11},
      "product.productName": {startsWith:  'Q'}
    };
    var q = EntityQuery.from("OrderDetails")
        .where(p);

    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.gt(1);
      r.forEach(function(od) {
        expect(od).to.have.property("Product");
        var product = od.Product;
        expect(product).to.have.property("ProductID");
        expect(product).to.have.property("ProductName");
        expect(product.ProductID).to.be.greaterThan(11);
        expect(product.ProductName.indexOf("Q") == 0).true;
        expect(Object.keys(product.values)).to.have.length(2);

      });
    }).then(done, done);
  });

  it("should succeed when or'ing on data properties of the same navigation property", function (done) {
    var p =  { or: [
      { "product.productID": { '>':  76} },
      { "product.productName": {startsWith:  'Z'} }
    ]};
    var q = EntityQuery.from("OrderDetails")
        .where(p);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.gt(1);
      r.forEach(function(od) {
        expect(od).to.have.property("Product");
        var product = od.Product;
        expect(product).to.have.property("ProductID");
        expect(product).to.have.property("ProductName");
        var ok = product.ProductID > 76 || product.ProductName.indexOf("Z") == 0;
        expect(ok).true;
      });
    }).then(done, done);
  });

  it("should fail on a nested query with an 'or' condition", function () {
    var p =  { or: [
      { "quantity": { '>':  11} },
      { "product.productName": {startsWith:  'Q'} }
    ]};
    var q = EntityQuery.from("OrderDetails")
        .where(p);
    try {
      toSequelizeQuery(q)
      throw new Error("shouldn't get here");
    } catch(e) {
      expect(e.message).to.contain('nested property paths');
    }
  });


  it("should be able to select from table with bool/tinyint cols", function (done) {
    var q = new EntityQuery("Products").where("discontinued","==", true).take(2);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length(2);
      r.forEach(function(order) {
        expect(order).to.have.property("Discontinued");
        expect(order.Discontinued == true);
      });
    }).then(done, done);
  });

  it("should be able to select scalar navigation property", function (done) {
    var q = new EntityQuery("Orders").select("orderDate, customer").take(2);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length(2);
      r.forEach(function(order) {
        expect(order).to.have.property("OrderDate");
        expect(order).to.have.property("Customer");
      });
    }).then(done, done);
  });

  it("should be able to select nested data property", function (done) {
    var q = new EntityQuery("Orders").select("orderDate,  customer.companyName").take(2);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length(2);
      r.forEach(function(order) {
        expect(order).to.have.property("OrderDate");
        expect(order).to.have.property("Customer");
        var customer = order.Customer;
        expect(customer).to.have.property("CompanyName");
        expect(Object.keys(customer.values)).to.have.length(1);
      });
    }).then(done, done);
  });

  it("should be able to 'ignore' nested data property projections if they conflict", function (done) {
    // customer projection 'trumps' customer.companyName projection.
    var q = new EntityQuery("Orders").select("orderDate, customer, customer.companyName").take(2);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length(2);
      r.forEach(function(order) {
        expect(order).to.have.property("OrderDate");
        expect(order).to.have.property("Customer");
        var customer = order.Customer;
        expect(customer).to.have.property("CompanyName");
        expect(Object.keys(customer.values).length).to.be.greaterThan(1);
      });
    }).then(done, done);
  });

  it("should be able to 'ignore' nested data property projections if they conflict - 2", function (done) {
    // same as above but the order of projections in different.
    var q = new EntityQuery("Orders").select("orderDate, customer.companyName, customer").take(2);
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length(2);
      r.forEach(function(order) {
        expect(order).to.have.property("OrderDate");
        expect(order).to.have.property("Customer");
        var customer = order.Customer;
        expect(customer).to.have.property("CompanyName");
        expect(Object.keys(customer.values).length).to.be.greaterThan(1);
      });
    }).then(done, done);
  });

  it("should be able to expand nonscalar properties", function (done) {
    var q = EntityQuery.from("Customers")
        .where("companyName", 'startsWith', "B")
        .expand("orders");
    var sq = toSequelizeQuery(q);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      var count = 0;
      r.forEach(function (cust) {
        expect(cust).to.have.property("Orders");
        count = count + cust.Orders.length;
      });
      expect(count).to.be.greaterThan(0);
      var r2 = sq._reshapeResults(r);
      expect(r2).to.have.length(r.length);
    }).then(done, done);
  });

  it("should be able to expand nested nonscalar properties", function (done) {
    var q = EntityQuery.from("Customers")
        .where("companyName", 'startsWith', "B")
        .expand("orders.orderDetails");
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      var ordersCount = odCount = 0;
      r.forEach(function (cust) {
        expect(cust).to.have.property("Orders");
        var orders = cust.Orders;
        ordersCount = ordersCount + orders.length;
        orders.forEach(function (order) {
          expect(order).to.have.property("OrderDetails");
          odCount = odCount + order.OrderDetails.length;
        });

      });
      expect(ordersCount).to.be.greaterThan(0);
      expect(odCount).to.be.greaterThan(0);
      return toSequelizeQuery(q).execute();
    }).then(function(r2) {
      r2.forEach(function(cust) {
        expect(cust).to.have.property("Orders");
        var orders = cust.Orders;
        expect(orders[0]).to.have.property("OrderDetails");
      });
    }).then(done, done);
  });

  it("should be able to expand scalar properties", function (done) {
    var q = EntityQuery.from("Orders").take(5)
        .expand("customer");
    var sq = toSequelizeQuery(q);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      r.forEach(function (order) {
        expect(order).to.have.property("Customer");
        var cust = order.Customer;
        expect(cust).to.have.property("CompanyName");
      });
      var r2 = sq._reshapeResults(r);
      expect(r2).to.have.length(r.length);
      expect(r2).to.have.length.greaterThan(0);
      r2.forEach(function(order) {
        expect(order).to.have.property("Customer");
        expect(order).not.to.have.property("Employee");
        expect(order).not.to.have.property("dataValues");
      });
    }).then(done, done);
  });

  it("should be able to expand nested scalar and nonscalar properties", function (done) {
    var q = EntityQuery.from("Orders").take(5)
        .expand("customer, orderDetails");
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      r.forEach(function (order) {
        expect(order).to.have.property("Customer");
        expect(order).to.have.property("OrderDetails");
        var cust = order.Customer;
        expect(cust).to.have.property("CompanyName");
        var orderDetails = order.OrderDetails;
        expect(orderDetails[0]).to.have.property("UnitPrice");
      });
    }).then(done, done);
  });

  it("should be able to expand recursively", function (done) {
    var q = EntityQuery.from("Orders").take(5)
        .expand("customer, customer.orders");
    var sq = toSequelizeQuery(q);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      r.forEach(function (order) {
        expect(order).to.have.property("Customer");
        var cust = order.Customer;
        expect(cust).to.have.property("Orders");
        var orders = cust.Orders;
        expect(orders[0]).to.have.property("Freight");
      });
      var r2 = sq._reshapeResults(r);
      expect(r2.length).to.eql(r.length);
      // TODO: check for $refs
    }).then(done, done);
  });

  it("should be able to expand recursively 2", function (done) {
    // save-a-lot markets
    var q = EntityQuery.from("Orders").where("customer.companyName", "startsWith", "Save")
        .expand("customer, customer.orders");
    var sq = toSequelizeQuery(q);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
      r.forEach(function (order) {
        expect(order).to.have.property("Customer");
        var cust = order.Customer;
        expect(cust).to.have.property("Orders");
        var orders = cust.Orders;
        expect(orders[0]).to.have.property("Freight");
      });
      var r2 = sq._reshapeResults(r);
      expect(r2.length).to.eql(r.length);
      // TODO: check for $refs
    }).then(done, done);
  });

  it("should be able to query with embedded quotes", function (done) {
    var q = EntityQuery.from("Customers")
        .where("companyName", 'contains', "'");
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.greaterThan(0);
    }).then(done, done);
  });

  it("should be able to query with 'startsWith'", function (done) {
    var q0 = new EntityQuery("Customers").where("companyName", "startsWith", "S");
    var sq = toSequelizeQuery(q0);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.above(1);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust.CompanyName).to.match(/^S.*/);
      });
    }).then(done, done);
  });
  
  it("should be able to query with 'endsWith'", function (done) {
    var q0 = new EntityQuery("Customers").where("companyName", "endsWith", "en");
    var sq = toSequelizeQuery(q0);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.above(1);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust.CompanyName).to.match(/.*en/);
      });
    }).then(done, done);
  });
  
  it("should be able to query with dates", function (done) {
    var q0 = new EntityQuery("Employees").where("hireDate", ">", new Date(1994, 0, 1));
    var sq = toSequelizeQuery(q0);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.above(1);
      r.forEach(function (emp) {
        expect(emp).to.have.property("HireDate");
        expect(emp.HireDate).to.be.above(new Date(1994, 0, 1));
      });
    }).then(done, done);
  });
  
  it("should be able to query with 'contains'", function (done) {
    var q0 = new EntityQuery("Customers").where("companyName", "contains", "er");
    var sq = toSequelizeQuery(q0);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.above(1);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        // ugh...
        expect(cust.CompanyName.toLowerCase()).to.match(/.*[èeé]r.*/);
      });
    }).then(done, done);
  });
  
  it("should be able to query with contains and two field names", function (done) {
    var q0 = new EntityQuery("Employees").where("firstName", "contains", "lastName");
    var sq = toSequelizeQuery(q0);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length(0);
      var q1 = new EntityQuery("Employees").where("firstName", "contains", "firstName");
      var sq = toSequelizeQuery(q1);
      return sq.executeRaw();
    }).then(function (r1) {
      expect(r1).to.have.length.above(5);
    }).then(done, done);
  });
  
  it("should be able to query using startsWith with two field names", function (done) {
    var q0 = new EntityQuery("Employees").where("firstName", "startsWith", "lastName");
    var sq = toSequelizeQuery(q0);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length(0);
      var q1 = new EntityQuery("Employees").where("lastName", "endsWith", "lastName");
      var sq = toSequelizeQuery(q1)
      return sq.executeRaw();
    }).then(function (r1) {
      expect(r1).to.have.length.above(5);
    }).then(done, done);
  });
  
  it("should be able to query with two date field names", function (done) {
    var q0 = new EntityQuery("Employees").where("hireDate", ">", "birthDate");
    var sq = toSequelizeQuery(q0);
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.above(1);
      r.forEach(function (emp) {
        expect(emp).to.have.property("HireDate");
        expect(emp.HireDate).to.be.above(emp.BirthDate);
      });
      var q1 = new EntityQuery("Employees").where("hireDate", "<", "birthDate");
      var sq = toSequelizeQuery(q1);
      return sq.executeRaw();
    }).then(function (r) {
      expect(r).to.have.length(0);
    }).then(done, done);
  });
  
  it("should be able to query with 'or'", function (done) {
    var p = Predicate("companyName", "startsWith", "B").or("city", "startsWith", "L");
    var q0 = new EntityQuery("Customers").where(p);
    var sq = toSequelizeQuery(q0);
    
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.above(0);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
            // cust.CompanyName.should.either.startWith("B");
            // cust.City.should.startWith("L");
      });
    }).then(done, done);
  });
  
  it("should be able to query with 'or' and 'not'", function (done) {
    var p = Predicate("companyName", "startsWith", "B").or("city", "startsWith", "L").not();
    
    var q0 = new EntityQuery("Customers").where(p);
    var sq = toSequelizeQuery(q0);
    
    sq.executeRaw().then(function (r) {
      expect(r).to.have.length.above(0);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
        expect(cust.CompanyName).to.not.match(/^B.*/);
        expect(cust.City).to.not.match(/^L.*/);
      });
    }).then(done, done);
  });
  
  it("should be able to query with 'and'", function (done) {
    var p = Predicate("companyName", "startsWith", "B").and("city", "startsWith", "L");
    var q0 = new EntityQuery("Customers").where(p);
    toSequelizeQuery(q0).executeRaw().then(function (r) {
      expect(r).to.have.length.above(0);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
        expect(cust.CompanyName).to.match(/^B.*/);
        expect(cust.City).to.match(/^L.*/);
      });
    }).then(done, done);
  });
  
  it("should be able to query with 'and' and 'not'", function (done) {
    var p = Predicate("companyName", "startsWith", "B").and("city", "startsWith", "L").not();
    var q0 = new EntityQuery("Customers").where(p);
    toSequelizeQuery(q0).executeRaw().then(function (r) {
      expect(r).to.have.length.above(0);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
      });

    }).then(done, done);
  });
  
  it("should be able to use take", function (done) {
    var q0 = new EntityQuery("Customers").take(2);
    toSequelizeQuery(q0).executeRaw().then(function (r) {
      expect(r).to.have.length(2);
      r.every(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
      });
    }).then(done, done);
  });
  
  it("should be able to use skip and take", function (done) {
    var q0 = new EntityQuery("Customers").take(2);
    var q1 = new EntityQuery("Customers").skip(2).take(3);
    var cust;
    toSequelizeQuery(q0).executeRaw().then(function (r) {
      expect(r).to.have.length(2);
      cust = r[0];
      return toSequelizeQuery(q1).executeRaw();
    }).then(function (r1) {
      expect(r1).to.have.length(3);
      expect(cust.CompanyName).to.not.eql(r1[0].CompanyName);
    }).then(done, done);
  });
  
  it("should be able to select specific simple properties", function (done) {
    
    var q = new EntityQuery("Customers").where("companyName", "startsWith", "C").select("companyName, city");
    toSequelizeQuery(q).executeRaw().then(function (r) {
      expect(r).to.have.length.above(3);
      r.every(function (cust) {
        expect(Object.keys(cust.values)).to.have.length(2);
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
      });

    }).then(done, done);
  });

});