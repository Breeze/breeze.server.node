// These tests assume access to a mySql installation
var fs               = require('fs');
var should           = require('should');
var _                = require('lodash');
var utils            = require('./../utils.js');
var dbUtils          = require('./../dbUtils.js')

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
    dbUtils.connect(dbConfig).then(function(connection) {
      connection.state.should.eql("authenticated");
    }).then(done, done);
  })

  it("should create a db", function(done) {
    // dbUtils.createDb(dbConfig).then(done, done);
    dbUtils.createDb(dbConfig).then(function() {
      log(dbConfig.dbName + " created or exists");
    }).then(done, done);
  });

});


