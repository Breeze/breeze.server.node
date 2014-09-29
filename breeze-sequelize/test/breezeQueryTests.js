var fs = require('fs');
var expect = require('chai').expect;
var Sequelize = require('sequelize');
var uuid = require('node-uuid');
var Promise = require('bluebird');
var breeze = require('breeze-client');

var utils = require('./../utils.js');
var SequelizeManager = require('./../SequelizeManager');

var testFns          = require('./testFns.js');
var SequelizeQuery = testFns.getSequelizeQuery();


var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService;

var _ = Sequelize.Utils._;

var log = utils.log;
// log.enabled = false;

describe("breezeQuery - execute", function () {
  
  this.enableTimeouts(false);

  var _ms, _em, _sm;
  
  before(function () {
    _em = testFns.newEm();
    _ms = _em.metadataStore;

    _sm = new SequelizeManager(testFns.dbConfigNw);
    _sm.importMetadata(testFns.getMetadata());

  });

  function toSequelizeQuery(breezeQuery) {
    var uri = breezeQuery._toUri(_em);
    console.log(uri);
    var sq = new SequelizeQuery(uri, _sm.metadataStore);
    return sq;
  }

  it("should be inconclusive");

  it("should be able to select specific nested scalar properties", function (done) {
    var q = new EntityQuery("Orders").select("orderDate, customer").take(2);
    toSequelizeQuery(q).execute(_sm).then(function (r) {
      expect(r).to.have.length(2);
    }).then(done, done);
  });


  it("should be able to query with 'startsWith'", function (done) {
    var q0 = new EntityQuery("Customers").where("companyName", "startsWith", "S");
    var sq = toSequelizeQuery(q0);
    sq.execute(_sm).then(function (r) {
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
    sq.execute(_sm).then(function (r) {
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
    sq.execute(_sm).then(function (r) {
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
    sq.execute(_sm).then(function (r) {
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
    sq.execute(_sm).then(function (r) {
      expect(r).to.have.length(0);
      var q1 = new EntityQuery("Employees").where("firstName", "contains", "firstName");
      var sq = toSequelizeQuery(q1);
      return sq.execute(_sm);
    }).then(function (r1) {
      expect(r1).to.have.length.above(5);
    }).then(done, done);
  });
  
  it("should be able to query using startsWith with two field names", function (done) {
    var q0 = new EntityQuery("Employees").where("firstName", "startsWith", "lastName");
    var sq = toSequelizeQuery(q0);
    sq.execute(_sm).then(function (r) {
      expect(r).to.have.length(0);
      var q1 = new EntityQuery("Employees").where("lastName", "endsWith", "lastName");
      var sq = toSequelizeQuery(q1)
      return sq.execute(_sm);
    }).then(function (r1) {
      expect(r1).to.have.length.above(5);
    }).then(done, done);
  });
  
  it("should be able to query with two date field names", function (done) {
    var q0 = new EntityQuery("Employees").where("hireDate", ">", "birthDate");
    var sq = toSequelizeQuery(q0);
    sq.execute(_sm).then(function (r) {
      expect(r).to.have.length.above(1);
      r.forEach(function (emp) {
        expect(emp).to.have.property("HireDate");
        expect(emp.HireDate).to.be.above(emp.BirthDate);
      });
      var q1 = new EntityQuery("Employees").where("hireDate", "<", "birthDate");
      var sq = toSequelizeQuery(q1);
      return sq.execute(_sm);
    }).then(function (r) {
      expect(r).to.have.length(0);
    }).then(done, done);
  });
  
  it("should be able to query with 'or'", function (done) {
    var p = Predicate("companyName", "startsWith", "B").or("city", "startsWith", "L");
    var q0 = new EntityQuery("Customers").where(p);
    var sq = toSequelizeQuery(q0);
    
    sq.execute(_sm).then(function (r) {
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
    
    sq.execute(_sm).then(function (r) {
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
    toSequelizeQuery(q0).execute(_sm).then(function (r) {
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
    toSequelizeQuery(q0).execute(_sm).then(function (r) {
      expect(r).to.have.length.above(0);
      r.forEach(function (cust) {
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
      });

    }).then(done, done);
  });
  
  it("should be able to use take", function (done) {
    var q0 = new EntityQuery("Customers").take(2);
    toSequelizeQuery(q0).execute(_sm).then(function (r) {
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
    toSequelizeQuery(q0).execute(_sm).then(function (r) {
      expect(r).to.have.length(2);
      cust = r[0];
      return toSequelizeQuery(q1).execute(_sm);
    }).then(function (r1) {
      expect(r1).to.have.length(3);
      expect(cust.CompanyName).to.not.eql(r1[0].CompanyName);
    }).then(done, done);
  });
  
  it("should be able to select specific simple properties", function (done) {
    
    var q = new EntityQuery("Customers").where("companyName", "startsWith", "C").select("companyName, city");
    toSequelizeQuery(q).execute(_sm).then(function (r) {
      expect(r).to.have.length.above(3);
      r.every(function (cust) {
        expect(Object.keys(cust.values)).to.have.length(2);
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");
      });

    }).then(done, done);
  });


  

  
  

  
});