// These tests assume access to a mySql installation
var fs               = require('fs');
var expect           = require('chai').expect;
var Sequelize        = require('sequelize');
var uuid             = require('node-uuid');
var Promise          = require('bluebird');

var utils            = require('./../utils.js');
var dbUtils          = require('./../dbUtils.js');
var SequelizeManager = require('./../SequelizeManager');

var testFns          = require('./testFns.js');

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

describe.only("SequelizeQuery", function() {

  this.enableTimeouts(false);
  var _nwSm;

  before(function() {
    _nwSm = new SequelizeManager(testFns.dbConfigNw);
    var breezeMetadata = testFns.getMetadata();
    _nwSm.importMetadata(breezeMetadata);

  });

  it("should be able to use functions", function(done) {
    var where = {};
    var fn = Sequelize.fn("upper", Sequelize.col("CompanyName"));
    where[ fn] = { like: 'B%'} ;
    _nwSm.models.Customers.findAll( { where: where }).then(function(r) {
      expect(r).to.have.length.above(5);
      r.forEach(function(cust) {
        expect(cust.CompanyName).to.match(/B.*/);
      });
    }).then(done, done);
  });

  it("should be able to project and include nonscalar props in same query", function(done) {
    var Order = _nwSm.models.Orders;
    var q = {
      where: { CompanyName: { like: 'B%'} },
      attributes: [ "CompanyName", "City" ],
      include: [ { model: Order, as: "Orders" }]
    };
    _nwSm.models.Customers.findAll(q ).then(function(r) {
      expect(r).to.have.length.above(5);
      r.forEach(function(cust) {
        expect(Object.keys(cust.values)).to.have.length(3);
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("Orders");
        expect(cust.CompanyName).to.match(/B.*/)

      });
    }).then(done, done);
  });

  it("should be able to project and include scalar props in same query", function(done) {
    var CustomerModel = _nwSm.models.Customers;
    var q = {
      where: { Freight: { gt: 100} },
      attributes: [ "OrderID", "Freight" ],
      include: [ { model: CustomerModel, as: "Customer", attributes: [ "CompanyName" , "City"] }]
    };
    _nwSm.models.Orders.findAll(q ).then(function(r) {
      expect(r).to.have.length.above(1);
      r.forEach(function(order) {
        expect(Object.keys(order.values)).to.have.length(3);
        expect(order).to.have.property("OrderID");
        expect(order).to.have.property("Freight");
        expect(order).to.have.property("Customer");
        var cust = order.Customer;
        expect(Object.keys(cust.values)).to.have.length(2);
        expect(cust).to.have.property("CompanyName");
        expect(cust).to.have.property("City");

      });
    }).then(done, done);
  });

  it("should be able to use 'like'", function(done) {
    _nwSm.models.Customers.findAll( { where: { CompanyName: { like: 'B%'} }}).then(function(r) {
      expect(r).to.have.length.above(5);
      r.forEach(function(cust) {
        expect(cust.CompanyName).to.match(/B.*/);
      });
    }).then(done, done);
  });



  it("should be able to use include on 1-N reln", function(done) {
    var Order = _nwSm.models.Orders;
    _nwSm.models.Customers.findAll( {
      where: { CompanyName: { like: 'B%'} },
      include: { model: Order, as: "Orders" }
    }).then(function(r) {
      expect(r).to.have.length.above(5);
      r.forEach(function(cust) {
        expect(cust.CompanyName).to.match(/B*./);
        expect(cust).to.have.property("Orders");
      });
    }).then(done, done);
  });

  it("should be able to use include on 1-N reln with where ( any) ", function(done) {
    var Order = _nwSm.models.Orders;
    _nwSm.models.Customers.findAll( {
      where: { CompanyName: { like: 'B%'} },
      include: { model: Order, as: "Orders" , where: { ShipCity : "London" }}
    }).then(function(r) {
          expect(r).to.have.length.within(1, 3);
          r.forEach(function(cust) {
            expect(cust.CompanyName).to.match(/B.*/);
            expect(cust).to.have.property("Orders");
            var orders = cust.Orders;
            orders.forEach(function(order) {
              expect(order.ShipCity).to.be.eql("London");
            })
          });
        }).then(done, done);
  });

  it("should be able to project included scalar attributes on reln ", function(done) {
    var Customer = _nwSm.models.Customers;
    var Order = _nwSm.models.Orders;
    _nwSm.models.Orders.findAll( {
      limit: 2,
      include: { model: Customer, as: "Customer", attributes: [ "CompanyName"]} ,
      attributes: [ "OrderDate", "Customer.CompanyName"]
    }).then(function(r) {
      expect(r).to.have.length(2);
      r.forEach(function(orderx) {
        expect(orderx).to.have.property("Customer");
        expect(orderx.Customer).to.have.property("CompanyName");
        expect(orderx.Customer).to.not.have.property("City");
        expect(orderx).to.have.property("OrderDate");
      });
    }).then(done, done).catch(done);
  });

  it("should be able to project included nonscalar attributes on reln ", function(done) {

    var Order = _nwSm.models.Orders;
    _nwSm.models.Customers.findAll( {
      limit: 2,
      include: { model: Order, as: "Orders"} ,
      attributes: [ "CompanyName"]
    }).then(function(r) {
      expect(r).to.have.length(2);
      r.forEach(function(custx) {
        expect(custx).to.have.property("CompanyName");
        expect(custx).to.have.property("Orders");
        expect(custx).to.not.have.property("City");
        expect(custx.Orders).to.be.instanceOf(Array);
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
      expect(r).to.have.length.above(10);
    }).then(done, done);
  });

  it("should be able to use Sequelize.and ", function(done) {
    var Order = _nwSm.models.Orders;
    var q = {
      where: Sequelize.and( { CompanyName: { like: 'B%'} }, { City: { like: 'L%' } })
    };
    _nwSm.models.Customers.findAll( q).then(function(r) {
      expect(r).to.have.length.above(1);
    }).then(done, done);
  });
});