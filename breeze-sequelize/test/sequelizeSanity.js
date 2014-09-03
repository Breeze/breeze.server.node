// These tests assume access to a mySql installation
var should = require("should");
var Sequelize = require('sequelize');
var mysql      = require('mysql');

var host = "localhost";
var userName = "root";
var password = "password";
var dbName = 'test3';

describe('sanity', function(){

  this.enableTimeouts(false);

  it('should just work', function(){
    'an arbitrary string'.should.containEql("arb");
    'another arbitrary string'.should.containEql("ano");
  });

});

describe("mySql", function() {
  this.enableTimeouts(false);

  it('should connect', function(done) {
    connect(userName, password, function(connection) {
      connection.state.should.eql("authenticated");
      done();
    })
  })

  it("should create a db", function(done) {
    connect(userName, password, function(connection) {
      createDb(connection, dbName, done);
    })
  });

});

describe("sequelize", function() {
  this.enableTimeouts(false);

  it("should create a schema", function(done) {
    createSequelize(userName, password, dbName, function(sequelize) {
      createSchema(sequelize, done);
    });
  });

  it("should convert breeze metadata")
});

function connect(userName, password, done) {
  var connection = mysql.createConnection({
    host     : host,
    user     : userName,
    password : password
  });

  connection.on('error', function(err) {
    console.log(err.code); // 'ER_BAD_DB_ERROR'
  });


  connection.connect(function(err) {
    if (err) {
      console.log("ERROR: " + err.message);
      done(err);
    }
    console.log("connected.");
    done(connection);
  });
}

function createDb(connection, dbName, done ) {
  connection.query('CREATE DATABASE ' + dbName, function(err, results) {
    if (err && err.code != "ER_DB_CREATE_EXISTS") {
      console.log("ERROR: " + err.message);
      throw err;
    }
    console.log("database created OR already exists.");
    done();
  });
}

function createSequelize(userName, password, dbName, returnFn) {
  sequelize = new Sequelize(dbName, userName, password, {
    dialect: "mysql", // or 'sqlite', 'postgres', 'mariadb'
    port:    3306, // or 5432 (for postgres)
  });

  sequelize
      .authenticate()
      .complete(function(err) {
        if (err) {
          console.log('Unable to connect to the database:', err)
          throw err;
        }
        console.log('connection has been established successfully again.')
        returnFn(sequelize);
      });
}

function createSchema(sequelize, done) {
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
      })

}

