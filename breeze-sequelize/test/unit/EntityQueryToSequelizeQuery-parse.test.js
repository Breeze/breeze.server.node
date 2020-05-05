var fs               = require('fs');
var expect           = require('chai').expect;
var Sequelize        = require('sequelize');
var Promise          = require("bluebird");
var breezeSequelize  = require("breeze-sequelize");
var _                = require('lodash');
var testFns          = require('./testFns.js');

var SequelizeManager = breezeSequelize.SequelizeManager;
var SequelizeQuery = breezeSequelize.SequelizeQuery;

var breeze = testFns.breeze;
var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService;

var log = testFns.log;
var Op = Sequelize.Op;

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
        { CompanyName: { [Op.like]: 'S%' } }
      }
    );
  });

  it("should parse simple where not startsWith", function () {
    var p = Predicate.not(Predicate("companyName", "startsWith", "S"));
    var q0 = new EntityQuery("Customers").where(p);
    check(q0,
        { where:
          { CompanyName: { [Op.notLike]: 'S%' } }
        }
    );
  });

  it("should parse or clauses", function () {
    var p = Predicate("companyName", "startsWith", "S").or("companyName", "startsWith", "D");
    var q0 = new EntityQuery("Customers").where(p);
    check(q0,
        { where:
          Sequelize.or( { CompanyName: { [Op.like]: 'S%' }}, { CompanyName: { [Op.like]: 'D%'}})
        }
    );
  });

  it("should parse and clauses that don't normalize", function () {
    var p = Predicate("companyName", "startsWith", "S").and("companyName", "startsWith", "D");
    var q0 = new EntityQuery("Customers").where(p);
    check(q0,
        { where:
            Sequelize.and( { CompanyName: { [Op.like]: 'S%' }}, { CompanyName: { [Op.like]: 'D%'}})
        }
    );
  });

  it("should parse and clauses that do normalize", function () {
    var p = new Predicate( { freight: { ">" : 100, "<": 200 }});
    var q0 = new EntityQuery("Orders").where(p);
    check(q0,
        { where:
            Sequelize.and( { Freight: { [Op.gt]: 100 }}, { Freight: { [Op.lt]: 200}})
        }
    );
  });

  it.only("should parse OR predicate with ANDS inside", function () {

    var predicate1 = Predicate.create('contactTitle', '==', 'Owner')
      .and('country', '==', 'Sweden');
    var predicate2 = Predicate.create('contactTitle', '==', 'Owner')
      .and('country', '==', 'Germany');
    var predicate = predicate1.or(predicate2);
    var query = EntityQuery.from('Customers').where(predicate);

    check(query,
        { where:
            Sequelize.or( 
              Sequelize.and({ ContactTitle: { [Op.eq]: 'Owner'}}, { Country: { [Op.eq]: 'Sweden'}}),
              Sequelize.and({ ContactTitle: { [Op.eq]: 'Owner'}}, { Country: { [Op.eq]: 'Germany'}}))
        }
    );
  });


});