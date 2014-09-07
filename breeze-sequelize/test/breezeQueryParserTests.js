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


  it("should parse simple query", function() {
    var q0 = new EntityQuery("Customer").where("companyName", "startsWith", "S");
    var uri = q0._toUri(_ms);
    var x = queryTranslator(uri);

  });
});