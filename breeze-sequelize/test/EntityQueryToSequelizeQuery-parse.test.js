var fs               = require('fs');
var expect           = require('chai').expect;
var Sequelize        = require('sequelize');
var Promise          = require("bluebird");
var breezeSequelize  = require("breeze-sequelize");
var testFns          = require('./testFns.js');

var SequelizeManager = breezeSequelize.SequelizeManager;
var SequelizeQuery = breezeSequelize.SequelizeQuery;

var breeze = breezeSequelize.breeze;
var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService;


var _ = Sequelize.Utils._;
var log = testFns.log;

describe("EntityQuery to SequelizeQuery - parse", function() {

  this.enableTimeouts(false);

  var _ms, _em, _sm;
  before(function() {
    _em = testFns.newEm();
    _ms = _em.metadataStore;

    _sm = new SequelizeManager(testFns.dbConfigNw);
    _sm.importMetadata(_ms);
  });

  function check(entityQuery, expectedResult) {
    // _em is client side entityManager;
    var uri = entityQuery._toUri(_em);
    entityQuery = EntityQuery.fromUrl(uri);
    var sq = new SequelizeQuery(_sm, entityQuery );
    log(JSON.stringify(sq.jsonQuery));
    if (_.isEmpty(sq.sqQuery.include)) {
      delete sq.sqQuery.include;
    }
    expect(sq.sqQuery).to.be.eql(expectedResult);
  }

  //it("should parse where nested any with expand", function() {
  //  var q0 = EntityQuery.from("Employees")
  //      .where("orders", "any", "customer.companyName", "startsWith", "Lazy")
  //      .expand("orders.customer");
  //  check(q0,
  //      { where: { CompanyName: { like: 'S%' } }
  //      }
  //  );
  //});

  it("should parse where startsWith", function() {
    var q0 = new EntityQuery("Customers").where("companyName", "startsWith", "S");
    check(q0,
      { where:
        { CompanyName: { like: 'S%' } }
      }
    );
  });

  it("should parse simple where not startsWith", function () {
    var p = Predicate.not(Predicate("companyName", "startsWith", "S"));
    var q0 = new EntityQuery("Customers").where(p);
    check(q0,
        { where:
          { CompanyName: { nlike: 'S%' } }
        }
    );
  });

  it("should parse or clauses", function () {
    var p = Predicate("companyName", "startsWith", "S").or("companyName", "startsWith", "D");
    var q0 = new EntityQuery("Customers").where(p);
    check(q0,
        { where:
          Sequelize.or( { CompanyName: { like: 'S%' }}, { CompanyName: { like: 'D%'}})
        }
    );
  });

  it("should parse and clauses that don't normalize", function () {
    var p = Predicate("companyName", "startsWith", "S").and("companyName", "startsWith", "D");
    var q0 = new EntityQuery("Customers").where(p);
    check(q0,
        { where:
            Sequelize.and( { CompanyName: { like: 'S%' }}, { CompanyName: { like: 'D%'}})
        }
    );
  });

  it("should parse and clauses that do normalize", function () {
    var p = new Predicate( { freight: { ">" : 100, "<": 200 }});
    var q0 = new EntityQuery("Orders").where(p);
    check(q0,
        { where:
            Sequelize.and( { Freight: { gt: 100 }}, { Freight: { lt: 200}})
        }
    );
  });

});