// These tests assume access to a mySql installation
var fs               = require('fs');
var should           = require('should');
var Sequelize        = require('sequelize');
var uuid             = require('node-uuid');
var Promise          = require('bluebird');

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



  before(function() {
    _nwSm = new SequelizeManager(_nwConfig);
    var breezeMetadata = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    _nwSm.importMetadata(breezeMetadata);

  });

  it("should be able to use 'like'", function(done) {
    _nwSm.models.Customers.findAll( { where: { CompanyName: { like: 'B%'} }}).then(function(r) {
      r.length.should.be.greaterThan(5);
      r.forEach(function(cust) {
        cust.CompanyName.should.startWith('B');
      });
    }).then(done, done);
  });

  it("should be able to use include on 1-N reln", function(done) {
    var Order = _nwSm.models.Orders;
    _nwSm.models.Customers.findAll( {
      where: { CompanyName: { like: 'B%'} },
      include: { model: Order, as: "Orders" }
    }).then(function(r) {
      r.length.should.be.greaterThan(5);
      r.forEach(function(cust) {
        cust.CompanyName.should.startWith('B');
        (cust.Orders || cust.orders).should.exist;
      });
    }).then(done, done);
  });

  it("should be able to use include on 1-N reln with where ( any) ", function(done) {
    var Order = _nwSm.models.Orders;
    _nwSm.models.Customers.findAll( {
      where: { CompanyName: { like: 'B%'} },
      include: { model: Order, as: "Orders" , where: { ShipCity : "London" }}
    }).then(function(r) {
          r.length.should.be.within(1, 3);
          r.forEach(function(cust) {
            cust.CompanyName.should.startWith('B');
            var orders = cust.Orders;
            orders.should.exist;
            orders.forEach(function(order) {
              order.ShipCity.should.be.eql("London");
            })
          });
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

  it("should be able to use Sequelize.or ", function(done) {

    var q = buildOrQuery();

    _nwSm.models.Customers.findAll( q).then(function(r) {
      r.length.should.be.greaterThan(10);
    }).then(done, done);
  });

  it("should be able to use Sequelize.and ", function(done) {
    var Order = _nwSm.models.Orders;
    var q = {
      where: Sequelize.and( { CompanyName: { like: 'B%'} }, { City: { like: 'L%' } })
    };
    _nwSm.models.Customers.findAll( q).then(function(r) {
      r.length.should.greaterThan(1);
    }).then(done, done);
  });
});