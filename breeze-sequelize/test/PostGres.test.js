// These tests assume access to a mySql installation
var fs               = require('fs');
var expect           = require('chai').expect;
var _                = require('lodash');
var dbUtils          = require('../src/dbUtils.js');
var testFns          = require('./testFns.js');

var log = testFns.log;

var dbConfig = {
  host: "localhost",
  user: "postgres",
  password: "postgres",
  dbName: 'test1'
}

describe("PostGres", function() {
  var optionsConfig = {
    dialect: 'postgres',
    port: '5432'
  }

  this.enableTimeouts(false);

  it('sanity check', function(){
    expect('an arbitrary string').to.have.string("arb");
  });

  it('should connect', function(done) {
    dbUtils.connect(dbConfig).then(function(success) {
      expect(success).to.eql("success");
    }).then(done, done);
  })

  it("should create a db", function(done) {
    dbUtils.createDb(dbConfig).then(function() {
      log(dbConfig.dbName + " created or exists");
    }).then(done, done);
  });

});


