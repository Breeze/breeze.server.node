var fs               = require("fs");
var should           = require("should");
var Sequelize        = require('Sequelize');
var uuid             = require('node-uuid');
var Promise          = require("bluebird");
var breeze           = require("breeze-client");


var utils            = require('./../utils.js');
var dbUtils          = require('./../dbUtils.js');
var SequelizeManager = require('./../SequelizeManager');
var queryTranslator  = require('./../queryTranslator.js');

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

describe("breezeToSequelizeQuery", function() {
  this.enableTimeouts(false);

  var _ms;
  var _em;
  before(function() {
    _em = new EntityManager();
    _ms = _em.metadataStore;
    var breezeMetadata = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    _ms.importMetadata(breezeMetadata);
  });


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

  function check(entityQuery, expectedResult) {
    var uri = entityQuery._toUri(_ms);
    var result = queryTranslator(uri);
    expectedResult.should.eql(result);
  }
});