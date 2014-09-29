var fs               = require('fs');
var expect           = require('chai').expect;
var breeze           = require('breeze-client');
var Sequelize        = require('sequelize');
var utils            = require('./../utils.js');

var testFns          = require('./testFns.js');

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var FilterQueryOp = breeze.FilterQueryOp;
var OrderByClause = breeze.OrderByClause;
var FetchStrategy = breeze.FetchStrategy;

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

describe("EntityQuery tests", function() {
  this.enableTimeouts(false);

  var _ms, _em;
  before(function() {
    _em = testFns.newEm();
    _ms = _em.metadataStore;
  });

  function testPropCount(q, propCount) {
    var json = q.toJSON();
    var keys = Object.keys(json);
    expect(keys.length).to.eql(propCount, "wrong # of props");

    var jsonString = JSON.stringify(q);
    var jsonParsed = JSON.parse(jsonString);

    var q2 = new EntityQuery(jsonParsed);
    if (q.expandClause) {
      expect(q2).to.have.deep.property("expandClause.propertyPaths");
    }
    if (q.selectClause) {
      expect(q2).to.have.deep.property("selectClause.propertyPaths");
    }
    if (q.orderByClause) {
      expect(q2).to.have.deep.property("orderByClause.items");
    }
    if (q.queryOptions && q.queryOptions.fetchStrategy) {
      expect(q2.queryOptions.fetchStrategy).to.eql(q.queryOptions.fetchStrategy);
    }
    if (q.resultEntityType) {
      var name = (typeof q.resultEntityType == 'string') ? q.resultEntityType : q.resultEntityType.name;
      expect(q2.resultEntityType).to.eql(name);
    }
    var json2 = q2.toJSON();
    var json2String = JSON.stringify(q2);
    console.log(json2String);
    expect(json2String).to.eql(jsonString);
  }

  it("query just resource - toJSON", function() {
    var q = EntityQuery.from("Customers")
    testPropCount(q, 1);
  });


  it("query where - toJSON", function() {
    var p = new Predicate( { freight: 100});
    var q = new EntityQuery("Customers").where(p);
    testPropCount(q, 2);
  });

  it("query where 2 - toJSON", function() {
    var p = Predicate.create("freight", ">", 100).and("freight", "<", 200);
    var q = new EntityQuery()
        .from("Orders")
        .where(p);
    testPropCount(q, 2);
  });


  it("query where, skip, take - toJSON", function() {
    var p = new Predicate( { freight: 100});
    var q = new EntityQuery("Customers").where(p).take(4).skip(3);
    testPropCount(q, 4);
  });

  it("query take, expand - toJSON", function() {
    var q = EntityQuery.from("Orders").take(5).expand("orderDetails.product.category");
    testPropCount(q, 3);
  });

  it("query where, expand, take - toJSON", function() {
    var p = Predicate.create("freight", ">", 100).and("customerID", "!=", null);
    var q = new EntityQuery()
        .from("Orders")
        .where(p)
        .expand("customer")
        .take(1);
    testPropCount(q, 4);
  });

  it("query with FetchStrategy - toJSON", function() {
    var p = Predicate.create("freight", ">", 100);
    var q = new EntityQuery()
        .from("Orders")
        .where(p)
        .using(FetchStrategy.FromLocalCache);
    testPropCount(q, 3);
  });

  it("query with toType - toJSON", function() {
    var p = Predicate.create("freight", ">", 100);
    var q = new EntityQuery()
        .from("Foos")
        .where(p)
        .toType("Order")
    testPropCount(q, 3);
  });

  it("query kitchen sink - toJSON", function() {
    var p = Predicate.create("orderID", "<", 10500);
    var q = new EntityQuery()
        .from("Orders")
        .expand("orderDetails, orderDetails.product")
        .where(p)
        .inlineCount()
        .orderBy("orderDate")
        .take(2)
        .skip(1);
    testPropCount(q, 7);

  });

  it("query kitchen sink 2 - toJSON", function() {
    var p2 = Predicate.create("freight", "==", 10);
    var p = Predicate.create("orders", "all", p2);

    var q = new EntityQuery()
        .from("Customers")
        .expand("orders, orders.orderDetails")
        .where(p)
        .inlineCount()
        .orderBy("companyName")
        .take(2)
        .skip(1);
    testPropCount(q, 7);
  });

  it("query kitchen sink 3 - toJSON", function() {
    var p2 = Predicate.create("freight", "==", 10);
    var p1 = Predicate.create("orders", "all", p2);
    var p = Predicate.create("companyName", "contains", "ar").and(p1);

    var q = new EntityQuery()
        .from("Customers")
        .expand("orders, orders.orderDetails")
        .where(p)
        .inlineCount()
        .orderBy("companyName")
        .take(2)
        .skip(1);
    testPropCount(q, 7);
  });

});