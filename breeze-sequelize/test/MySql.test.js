// These tests assume access to a mySql installation
var fs               = require('fs');
var expect           = require('chai').expect;
var _                = require('lodash');
var breezeSequelize = require("breeze-sequelize");
var testFns          = require('./testFns.js');

var dbUtils = breezeSequelize.dbUtils;
var log = testFns.log;

var dbConfig = _.clone(testFns.dbConfigNw);

var sequelizeOptions = {
    dialect: "mysql",
    port: 3306,
    logging: console.log,
    dialectOptions: { decimalNumbers: true },
    define: {
        freezeTableName: true,  // prevent sequelize from pluralizing table names
        timestamps: false       // deactivate the timestamp columns (createdAt, etc.)
    }  
  };

describe("MySql", function() {

  this.enableTimeouts(false);

  it('sanity check', function(){
    expect('an arbitrary string').to.have.string("arb");
  });

  it('should connect', function(done) {
    dbUtils.connect(dbConfig, sequelizeOptions).then(function(success) {
      expect(success).to.eql("success");
    }).then(done, done);
  })

  xit("should create a db", function(done) {
    dbConfig.dbName = 'test' + new Date().getTime();
    dbUtils.createDb(dbConfig, sequelizeOptions).then(function() {
      log(dbConfig.dbName + " created or exists");
    }).then(done, done);
  });

});


