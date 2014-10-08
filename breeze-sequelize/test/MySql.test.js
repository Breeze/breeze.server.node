// These tests assume access to a mySql installation
var fs               = require('fs');
var expect           = require('chai').expect;
var _                = require('lodash');
var breezeSequelize = require("breeze-sequelize");
var testFns          = require('./testFns.js');

var dbUtils = breezeSequelize.dbUtils;
var log = testFns.log;

var dbConfig = {
  host: "localhost",
  user: "jayt",
  password: "password",
  dbName: 'test1'
}


describe("MySql", function() {

  this.enableTimeouts(false);

  it('sanity check', function(){
    expect('an arbitrary string').to.have.string("arb");
  });

  it('should connect', function(done) {
    dbUtils.connect(dbConfig).then(function(connection) {
      expect(connection.state).to.eql("authenticated");
    }).then(done, done);
  })

  it("should create a db", function(done) {
    // dbUtils.createDb(dbConfig).then(done, done);
    dbUtils.createDb(dbConfig).then(function() {
      log(dbConfig.dbName + " created or exists");
    }).then(done, done);
  });

});


