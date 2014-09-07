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

describe("sequelizeQuery", function() {

  this.enableTimeouts(false);

  var _nwConfig = {
    host: "localhost",
    user: "root",
    password: "password",
    dbName: 'northwindib'
  }

  var _nwSm;
  var _sequelize;


  before(function() {
    _nwSm = new SequelizeManager(_nwConfig);
    var breezeMetadata = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    _nwSm.importMetadata(breezeMetadata);
    _sequelize = _nwSm.sequelize;
  });

  it("should be able to use 'like'", function(done) {
    _nwSm.models.Customer.findAll( { where: { CompanyName: { like: 'B%'} }}).then(function(r) {
      r.length.should.be.greaterThan(5);
      r.forEach(function(cust) {
        cust.CompanyName.should.startWith('B');
      });
    }).then(done, done);
  });

  it("should be able to use include on 1-N reln", function(done) {
    var Order = _nwSm.models.Order;
    _nwSm.models.Customer.findAll( {
      where: { CompanyName: { like: 'B%'} },
      include: { model: Order, as: "Orders" }
    }).then(function(r) {
      r.length.should.be.greaterThan(5);
      r.forEach(function(cust) {
        cust.CompanyName.should.startWith('B');
        var x = cust.Orders;
      });
    }).then(done, done);
  });

});