// These tests assume access to a mySql installation
var fs               = require("fs");
var should           = require("should");
var Sequelize        = require('Sequelize');
var uuid             = require('node-uuid');

var utils            = require('./../utils.js');
var dbUtils          = require('./../dbUtils.js');
var SequelizeManager = require('./../SequelizeManager');

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

var dbConfig = {
  host: "localhost",
  user: "root",
  password: "password",
  dbName: 'test1'
}

var _nwDbInitialized = false;
var _nwSm;

describe("sequelize", function() {
  this.enableTimeouts(false);

  before(function(done) {
    syncNw(true, function(sm) {
      _nwSm = sm;
      done();
    });
  });

  it("should create a simple schema", function(done) {
    var sm = new SequelizeManager(dbConfig);
    createSimpleSchema(sm.sequelize);
    sm.sync(true, done);
  });

  it("should convert breeze metadata", function() {
    should.exist(_nwSm);
    var CustomerModel = _nwSm.models.Customer;
    should.exist(CustomerModel);
  });



  it("should save simple with build", function(done) {
    var Customer = _nwSm.models.Customer;
    var dtos = createCustDTOs();
    var cust1 = Customer.build( dtos[0]);
    cust1.save().then(function(c1) {
      c1.companyName.should.equal("Test 1");
    }).then(function() {
      var cust2 = Customer.build( dtos[1]);
      return cust2.save();
    }).then(function(c2) {
      c2.companyName.should.equal("Test 2");
    }).then(done, done);
  });

  it("should save simple with create", function(done) {
    var Customer = _nwSm.models.Customer;
    var dtos = createCustDTOs();
    Customer.create( dtos[0] ).then(function(c1) {
      c1.companyName.should.equal("Test 1");
      return Customer.create( dtos[1]);
    }).then(function(c2) {
      c2.companyName.should.equal("Test 2");
    }).then(done, done);
  });

  it("should save simple with bulk create", function(done) {
    var Customer = _nwSm.models.Customer;
    var dtos = createCustDTOs();
    Customer.bulkCreate( dtos).then(function(custs) {
      custs.should.have.length(2);
    }).then(done, done);
  });

});

function createCustDTOs() {
  return [
    { customerID: uuid.v1(), companyName: "Test 1", City: "Los Angeles" },
    { customerID: uuid.v1(), companyName: "Test 2", City: "Oakland" }
  ];
}


function initializeNw() {
  nwConfig = _.clone(dbConfig);
  nwConfig.dbName = "NorthwindIB";
  var sm = new SequelizeManager(nwConfig);
  var breezeMetadata = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
  sm.importMetadata(breezeMetadata);
  return sm;
}


function syncNw(forceSync, done) {
  var sm = initializeNw();
  if (forceSync || !_nwDbInitialized) {
    sm.sync(true, function() {
      done(sm);
    });
  } else {
    done(sm);
  }
}


function createSimpleSchema(sequelize) {
  var Customer = sequelize.define("customer", {
    customerId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    companyName: { type: Sequelize.STRING, allowNull: false },
    city: { type: Sequelize.STRING }
  });
  var Order = sequelize.define("order", {
    orderId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    shippingCost: {type: Sequelize.DECIMAL(11,2), allowNull: false },
    orderDate: { type: Sequelize.DATE  },
    shipDate: { type: Sequelize.DATE }
  });
  Order.belongsTo(Customer, { as: "myCustomer", foreignKey: "custId"})
  Customer.hasMany(Order, { as: "myOrders", foreignKey: "custId" } );

}

