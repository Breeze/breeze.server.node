var fs               = require('fs');
var expect           = require('chai').expect;
var Sequelize        = require('sequelize');
var breezeSequelize  = require("breeze-sequelize");
var testFns          = require('./testFns.js');

var SequelizeManager = breezeSequelize.SequelizeManager;

var breeze = testFns.breeze;
var ModelMapper = breezeSequelize.ModelMapper;

var log = testFns.log;

describe("ModelMapper", function() {

  this.enableTimeouts(false);

  var _ms, _em, _sm, _sq;
  before(function() {
    _sm = new SequelizeManager(testFns.dbConfigNw);

    // load model data - should run `npm run gen-model` before running these tests
    _sq = _sm.sequelize;
    _sq.import('./models/customer.js');
    _sq.import('./models/order.js');

  });

  this.beforeEach(function() {
    _em = new breeze.EntityManager();
    _ms = _em.metadataStore;
  });

  it("sequelize should load the model", function() {  
    debugger;
    var models = _sq.models;
    var modelNames = Object.keys(models);
    console.log(modelNames);
    expect(modelNames).to.include('customer');
    expect(modelNames).to.include('order');

    var custModel = _sq.model('customer');
    expect(!!custModel).to.be.true;

    var table = custModel.getTableName();
    expect(table).to.equal('customer');

    var idProp = custModel.tableAttributes['CustomerID'];
    expect(idProp.primaryKey).to.be.true;

    var cust = custModel.build({ CustomerID: '123', CompanyName: 'bar' });
    expect(cust.CustomerID).to.equal('123');
  });

  it("should have a ModelMapper", function() {
    var mm = new ModelMapper(_ms);
    expect(!mm).to.eql(false);
    expect(mm.metadataStore).to.eql(_ms);
  });

  it("should add customer and order entities", function() {
    var mm = new ModelMapper(_ms);
    mm.addModels(_sq, 'foo');
    var cust = _ms.getAsEntityType('customer');
    expect(cust.shortName).to.eql('customer');
    expect(cust.namespace).to.eql('foo');

    var ord = _ms.getAsEntityType('order');
    expect(ord.shortName).to.eql('order');
  });

  it("should add data properties to order", function() {
    var mm = new ModelMapper(_ms);
    mm.addModels(_sq, 'foo');
    var ord = _ms.getAsEntityType('order');

    var prop = ord.getDataProperty('OrderID');
    expect(prop.name).to.eql('OrderID');
    expect(prop.dataType).to.eql(breeze.DataType.Int32);
    expect(prop.isNullable).to.be.false;
    expect(prop.isPartOfKey).to.be.true;

    prop = ord.getDataProperty('OrderDate');
    expect(prop.name).to.eql('OrderDate');
    expect(prop.dataType).to.eql(breeze.DataType.DateTime);
    expect(prop.isNullable).to.be.true;
    expect(prop.isPartOfKey).to.be.undefined;

    prop = ord.getDataProperty('Freight');
    expect(prop.name).to.eql('Freight');
    expect(prop.dataType).to.eql(breeze.DataType.Decimal);
    expect(prop.isNullable).to.be.true;
    expect(prop.isPartOfKey).to.be.undefined;
    expect(prop.defaultValue).to.eql(0);

    prop = ord.getDataProperty('ShipName');
    expect(prop.name).to.eql('ShipName');
    expect(prop.dataType).to.eql(breeze.DataType.String);
    expect(prop.isNullable).to.be.true;
    expect(prop.isPartOfKey).to.be.undefined;
    expect(prop.defaultValue).to.eql(null);
    expect(prop.maxLength).to.eql(40);

  });


});