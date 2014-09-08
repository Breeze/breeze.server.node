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

describe("breezeQuery", function() {
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
    var q0 = new EntityQuery("Customer").where("companyName", "startsWith", "S");
    var sq = toSequelizeQuery(q0)
    sq.execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(1);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.CompanyName.should.startWith("S");

      })
    }).then(done, done);
  });

  var buildOrQuery = function() {
    var c1= { CompanyName: { like: 'B%'} };
    var c2 = { City: { like: 'L%' } };
    var q = {
      where: Sequelize.or( c1, c2 )
    };

    return q;
  }

  it("should be able to query with 'or'", function(done) {
    var p = Predicate("companyName", "startsWith", "B").or("city", "startsWith", "L");
    var q0 = new EntityQuery("Customer").where(p);
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

  function processAndOr( where) {
    var clauses;
    if ( isSequelizeAnd(where)) {
      clauses = where.args.map(function(clause) {
        return processAndOr(clause);
      })
      // return Sequelize.and.apply(null, clauses)
      return Sequelize.and(clauses[0], clauses[1]);
    } else if (isSequelizeOr(where)) {
      clauses = where.args.map(function(clause) {
        return processAndOr(clause);
      })
      // return Sequelize.or.apply(null, clauses);
      return Sequelize.or(clauses[0], clauses[1]);
    } else {
      return where;
    }
  }

  it("should be able to query with 'and'", function(done) {
    var p = Predicate("companyName", "startsWith", "B").and("city", "startsWith", "L");
    var q0 = new EntityQuery("Customer").where(p);
    toSequelizeQuery(q0).execute(_sm).then( function(r) {
      r.length.should.be.greaterThan(0);
      r.forEach( function(cust) {
        cust.should.have.property("CompanyName");
        cust.should.have.property("City");
        cust.CompanyName.should.startWith("B");
        cust.City.should.startWith("L")
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