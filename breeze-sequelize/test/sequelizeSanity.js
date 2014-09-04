// These tests assume access to a mySql installation
var fs               = require("fs");
var should           = require("should");
var Sequelize        = require('Sequelize');

var utils            = require('./../utils.js');
var dbUtils          = require('./../dbUtils.js')
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


describe("mySql", function() {
  this.enableTimeouts(false);

  it('sanity check', function(){
    'an arbitrary string'.should.containEql("arb");
  });

  it('should connect', function(done) {
    dbUtils.connect(dbConfig, function(err, connection) {
      if (err) return done(err);
      connection.state.should.eql("authenticated");
      done();
    })
  })

  it("should create a db", function(done) {
    dbUtils.createDb(dbConfig, done);
  });

});

describe("sequelize", function() {
  this.enableTimeouts(false);

  it("should create a simple schema", function(done) {
    var sm = new SequelizeManager(dbConfig);
    createSimpleSchema(sm.sequelize);
    sm.sync(true, done);
  });

  it("should convert breeze metadata", function(done) {
    nwConfig = _.clone(dbConfig);
    nwConfig.dbName = "NorthwindIB";
    var sm = new SequelizeManager(nwConfig);
    var breezeMetadata = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    sm.importMetadata(breezeMetadata);
    sm.sync(true, done);
  });
});

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

