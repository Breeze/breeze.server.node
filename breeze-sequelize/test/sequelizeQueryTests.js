// These tests assume access to a mySql installation
var fs               = require("fs");
var should           = require("should");
var Sequelize        = require('Sequelize');
var uuid             = require('node-uuid');
var Promise          = require("bluebird");

var utils            = require('./../utils.js');
var dbUtils          = require('./../dbUtils.js');
var SequelizeManager = require('./../SequelizeManager');

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;


var _nwConfig = {
  host: "localhost",
  user: "root",
  password: "password",
  dbName: 'northwindib'
}

var _nwSm;
var _sequelize;

describe("sequelizeQuery", function() {

  this.enableTimeouts(false);


  before(function() {
    _nwSm = new SequelizeManager(_nwConfig);
    var breezeMetadata = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    _nwSm.importMetadata(breezeMetadata);
    _sequelize = _nwSm.sequelize;
  });

  it("should be able to use 'like'", function(done) {
    log("customers starting with B");
    _nwSm.models.Customer.findAll( { where: { CompanyName: { like: 'B%'} }}).then(function(r) {
      r.length.should.be.greaterThan(5);
      r.forEach(function(cust) {
        cust.CompanyName.should.startWith('B');
      });
    }).then(done, done);
  });

});