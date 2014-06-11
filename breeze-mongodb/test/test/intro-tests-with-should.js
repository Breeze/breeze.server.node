return; // disable all tests in this file

// 'should.js' assertions
// https://github.com/shouldjs/should.js
var should = require("should"); 
var sinon  = require('sinon');

describe('Should Array', function(){

  describe('#indexOf()', function(){

    it.skip('should fail', function(){
    	assert.equal(1,0);
    });

    it('should return -1 when the value is not present', function(){
      (-1).should.be.exactly( [1,2,3].indexOf(5));
      (-1).should.equal( [1,2,3].indexOf(0));
    });

    it('should watch this as pending');
  });

});

describe('Should user', function(){

  // SUT
  var user = {
      name: 'tj'
    , pets: ['tobi', 'loki', 'jane', 'bandit']
  };


  it('have properties', function(){
    should(user).have.property('name', 'tj');
    user.should.have.property('name', 'tj');
    user.should.have.property('pets').with.lengthOf(4)  
  });

});


describe('Should someAsyncTask', function(){

  // SUT
  function someAsyncTask(foo, callback) { 
    setTimeout(function(){
      callback(null, {bar: foo});
    }, 10);
  }

  it('return foo w/o error', function(done){
      var foo = 42;
      someAsyncTask(foo, function(err, result){
          should.not.exist(err);
          should.exist(result);
          result.bar.should.equal(foo); 
          done();      
      })
  });

});