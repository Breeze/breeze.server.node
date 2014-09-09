var fs               = require('fs');
var should           = require('should');
var Sequelize        = require('sequelize');
var uuid             = require('node-uuid');
var Promise          = require('bluebird');
var breeze           = require('breeze-client');

var utils            = require('./../utils.js');
var SequelizeManager = require('./../SequelizeManager');
var SequelizeQuery   = require('./../SequelizeQuery.js');

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

describe.only("breezeQuery", function() {
  this.enableTimeouts(false);

  var _nwConfig = {
    host: "localhost",
    user: "root",
    password: "password",
    dbName: 'northwindib'
  }

  var _ms;
  var _em;
  before(function() {
    _em = new EntityManager();
    _ms = _em.metadataStore;
    var breezeMetadata = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    _ms.importMetadata(breezeMetadata);

    _sm = new SequelizeManager(_nwConfig);
    _sm.importMetadata(breezeMetadata);

  });

  it("should be able to query with 'startsWith'", function(done) {
    var q0 = new EntityQuery("Customers").where("companyName", "startsWith", "S");
    var sq = toSequelizeQuery(q0)
    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(1);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.CompanyName.should.startWith("S");

      })
    }).then(done, done);
  });

  it("should be able to query with 'endsWith'", function(done) {
    var q0 = new EntityQuery("Customers").where("companyName", "endsWith", "en");
    var sq = toSequelizeQuery(q0)
    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(1);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.CompanyName.should.endWith("en");

      })
    }).then(done, done);
  });

  it("should be able to query with dates", function(done) {
    var q0 = new EntityQuery("Employees").where("hireDate", ">", new Date(1994,0,1));
    var sq = toSequelizeQuery(q0)
    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(1);
      r.forEach( function(emp) {
        emp.should.have.property("HireDate");
        emp.HireDate.should.be.greaterThan(new Date(1994,0,1));

      })
    }).then(done, done);
  });

  it("should be able to query with 'contains'", function(done) {
    var q0 = new EntityQuery("Customers").where("companyName", "contains", "er");
    var sq = toSequelizeQuery(q0)
    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(1);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        // ugh...
        cust.CompanyName.toLowerCase().should.match(/.*[èeé]r.*/);

      })
    }).then(done, done);
  });

  it("should be able to query with two string field names", function(done) {
    // BUG: casing issue...
    var q0 = new EntityQuery("Employees").where("lastName", "startsWith", "firstName");
    var sq = toSequelizeQuery(q0)
    var q0 = new EntityQuery("Employees").where("hireDate", ">", "birthDate");
    // var q0 = new EntityQuery("Employee").where("hireDate", ">", { value: "birthDate", isLiteral: false });
    var sq = toSequelizeQuery(q0)
    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(1);
      r.forEach( function(emp) {
        emp.should.have.property("HireDate");
        emp.HireDate.should.be.greaterThan(emp.BirthDate);

      })
    }).then(done, done);
  });

  it("should be able to query with two date field names", function(done) {
    var q0 = new EntityQuery("Employees").where("hireDate", ">", "birthDate");
    var sq = toSequelizeQuery(q0);
    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(1);
      r.forEach( function(emp) {
        emp.should.have.property("HireDate");
        emp.HireDate.should.be.greaterThan(emp.BirthDate);
      });
      var q1 = new EntityQuery("Employees").where("hireDate", "<", "birthDate");
      var sq = toSequelizeQuery(q1);
      return sq.execute(_sm);
    }).then(function(r) {
      r.length.should.be.eql(0);
    }).then(done, done);
  });

  it("should be able to query with 'or'", function(done) {
    var p = Predicate("companyName", "startsWith", "B").or("city", "startsWith", "L");
    var q0 = new EntityQuery("Customers").where(p);
    var sq = toSequelizeQuery(q0);

    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(0);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.should.have.property("City");
        // cust.CompanyName.should.either.startWith("B");
        // cust.City.should.startWith("L");
      });
    }).then(done, done);
  })

  it("should be able to query with 'or' and 'not'", function(done) {
    var p = Predicate("companyName", "startsWith", "B").or("city", "startsWith", "L").not();
    var q0 = new EntityQuery("Customers").where(p);
    var sq = toSequelizeQuery(q0);

    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(0);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.should.have.property("City");
        cust.CompanyName.should.not.startWith("B");
        cust.City.should.not.startWith("L");
      });
    }).then(done, done);
  })

  it("should be able to query with 'and'", function(done) {
    var p = Predicate("companyName", "startsWith", "B").and("city", "startsWith", "L");
    var q0 = new EntityQuery("Customers").where(p);
    toSequelizeQuery(q0).execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(0);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.should.have.property("City");
        cust.CompanyName.should.startWith("B");
        cust.City.should.startWith("L");
      })
    }).then(done, done);
  });

  it("should be able to query with 'and' and 'not'", function(done) {
    var p = Predicate("companyName", "startsWith", "B").and("city", "startsWith", "L").not();
    var q0 = new EntityQuery("Customers").where(p);
    toSequelizeQuery(q0).execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(0);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.should.have.property("City");
      })

    }).then(done, done);
  })

  function toSequelizeQuery(breezeQuery) {
    var uri = breezeQuery._toUri(_ms);
    var sq = new SequelizeQuery(uri);
    return sq;
  }

  var isSequelizeAnd = function(o) {
    return Object.getPrototypeOf(o).constructor == Sequelize.Utils.and;
  }

  var isSequelizeOr = function(o) {
    return Object.getPrototypeOf(o).constructor == Sequelize.Utils.or;
  }

});