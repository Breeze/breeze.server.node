// These tests assume access to a mySql installation
var fs               = require('fs');
var expect           = require('chai').expect;
var _                = require('lodash');
var breezeSequelize  = require("breeze-sequelize");
var testFns          = require('./testFns.js');

var connect = breezeSequelize.connect;

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

  xit('should connect', function(done) {
    connect(dbConfig, optionsConfig).then(function(success) {
      expect(success).to.eql("success");
    }).then(done, done);
  })

  // xit("should create a db", function(done) {
  //   dbUtils.createDb(dbConfig, optionsConfig).then(function() {
  //     log(dbConfig.dbName + " created or exists");
  //   }).then(done, done);
  // });

});


