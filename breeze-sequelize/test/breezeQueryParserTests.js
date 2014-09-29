var fs               = require('fs');
var expect           = require('chai').expect;
var Sequelize        = require('sequelize');
var uuid             = require('node-uuid');
var Promise          = require("bluebird");
var breeze           = require("breeze-client");

var utils            = require('./../utils.js');
var testFns          = require('./testFns.js');

var SequelizeQuery   = testFns.getSequelizeQuery();

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService;

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

describe("breezeQuery - parse", function() {
  this.enableTimeouts(false);

  var _ms, _em;
  before(function() {
    _em = testFns.newEm();
    _ms = _em.metadataStore;

  });

  function check(entityQuery, expectedResult) {
    // _em is client side entityManager;
    var uri = entityQuery._toUri(_em);
    var sq = new SequelizeQuery(uri );
    log(JSON.stringify(sq.jsonQuery));
    expect(sq.queryObj).to.be.eql(expectedResult);
  }


  it("should parse where startsWith", function() {
    var q0 = new EntityQuery("Customer").where("companyName", "startsWith", "S");
    check(q0,
      { where:
        { CompanyName: { like: 'S%' } }
      }
    );
  });

  it("should parse simple where not startsWith", function () {
    var p = Predicate.not(Predicate("companyName", "startsWith", "S"));
    var q0 = new EntityQuery("Customer").where(p);
    check(q0,
        { where:
          { CompanyName: { nlike: 'S%' } }
        }
    );
  });

  it("should parse or clauses", function () {
    var p = Predicate("companyName", "startsWith", "S").or("companyName", "startsWith", "D");
    var q0 = new EntityQuery("Customer").where(p);
    check(q0,
        { where:
          Sequelize.or( { CompanyName: { like: 'S%' }}, { CompanyName: { like: 'D%'}})
        }
    );
  });

  it("should parse and clauses that don't normalize", function () {
    var p = Predicate("companyName", "startsWith", "S").and("companyName", "startsWith", "D");
    var q0 = new EntityQuery("Customer").where(p);
    check(q0,
        { where:
            Sequelize.and( { CompanyName: { like: 'S%' }}, { CompanyName: { like: 'D%'}})
        }
    );
  });

  it("should parse and clauses that do normalize", function () {
    var p = new Predicate( { freight: { ">" : 100, "<": 200 }});
    var q0 = new EntityQuery("Order").where(p);
    check(q0,
        { where:
            Sequelize.and( { Freight: { gt: 100 }}, { Freight: { lt: 200}})
        }
    );
  });

});