var fs               = require('fs');
var path             = require('path');
var expect           = require('chai').expect;
var Sequelize        = require('sequelize');
var breezeSequelize  = require("breeze-sequelize");
var testFns          = require('./testFns.js');
var SequelizeAuto    = require('sequelize-auto');

var SequelizeManager = breezeSequelize.SequelizeManager;

var breeze = testFns.breeze;
var ModelMapper = breezeSequelize.ModelMapper;

// directory for Sequelize models.  Run `npm run gen-model-my` before running these tests
var modelDir = './mymodels';

describe("ModelMapper", function() {

  this.enableTimeouts(false);

  var _ms, _em, _sm, _sq;
  before(function() {
    debugger;

    var config = testFns.dbConfigNw;
    var directory = path.resolve('mymodels');

    var auto = new SequelizeAuto(config.dbName, config.user, config.password, {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        directory: directory,
        additional: { // Sequelize options
            timestamps: false
        }
    });

    // export sequelize models into the models directory
    return auto.run().then(_ => {
      _sm = new SequelizeManager(config);
      _sq = _sm.sequelize;

      // load models into sequelize instance
      ModelMapper.loadSequelizeModels(_sq, directory);
    });

  });

  this.beforeEach(function() {
    _em = new breeze.EntityManager();
    _ms = _em.metadataStore;
  });

  it("sequelize should load the models", function() {  
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

  it("should create ModelMapper", function() {
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

  it("should add Customer navigation property to Order", function() {
    var mm = new ModelMapper(_ms);
    mm.addModels(_sq, 'foo');
    var ord = _ms.getAsEntityType('order');

    var prop = ord.getNavigationProperty('Customer');
    expect(prop.name).to.eql('Customer');
    expect(prop.isScalar).to.be.true;
    expect(prop.foreignKeyNames).to.have.lengthOf(1);
    expect(prop.foreignKeyNames[0]).to.eql("CustomerID");
    expect(prop.entityType.shortName).to.eql("customer");    
  });

  it("should add Orders navigation property to Customer", function() {
    var mm = new ModelMapper(_ms);
    mm.addModels(_sq, 'foo');
    var cust = _ms.getAsEntityType('customer');

    var prop = cust.getNavigationProperty('Orders');
    expect(prop.name).to.eql('Orders');
    expect(prop.isScalar).to.be.false;
    expect(prop.invForeignKeyNames).to.have.lengthOf(1);
    expect(prop.invForeignKeyNames[0]).to.eql("CustomerID");
    expect(prop.entityType.shortName).to.eql("order");    
  });

  it("should populate maps in SequelizeManager", function() {
    var mm = new ModelMapper(_ms);
    mm.addModels(_sm.sequelize, 'foo');
    _sm.importMetadata(_ms);

    var custModel = _sm.entityTypeSqModelMap["customer:#foo"];
    expect(custModel.tableName).to.eql("customer");

    custModel = _sm.models["customer"];
    expect(custModel.tableName).to.eql("customer");

  });

  // it("should export metadata", function() {
  //   var mm = new ModelMapper(_ms);
  //   mm.addModels(_sq, 'foo');
  //   var metadata = _ms.exportMetadata();
  //   console.log(metadata);    
  // });



});