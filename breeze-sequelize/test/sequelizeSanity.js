// These tests assume access to a mySql installation
var should = require("should");

var Sequelize      = require('Sequelize');
var dbUtils = require('./dbUtils.js')
var sequelizeUtils = require('./sequelizeUtils.js');

var dbConfig = {
  host: "localhost",
  user: "root",
  password: "password",
  dbName: 'test4'
}



describe("mySql", function() {
  this.enableTimeouts(false);

  it('sanity check', function(){
    'an arbitrary string'.should.containEql("arb");
  });

  it('should connect', function(done) {
    dbUtils.connect(dbConfig, function(err, connection) {
      if (err) done(err);
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

  it("should create a schema", function(done) {
    sequelizeUtils.createSequelize(dbConfig, function(err, sequelize) {
      if (err) done(err);
      createSimpleSchema(sequelize, done);
    });
  });

  it("should convert breeze metadata")
});




function createSimpleSchema(sequelize, done) {
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
  Customer.hasMany(Order, { as: "myOrders"} );

  sequelize.sync({ force: true}).success(function(xx){
    console.log("schema created");
    done();
  }).error(function(err) {
    console.log("schema creation failed");
    done(err)
  });

}

