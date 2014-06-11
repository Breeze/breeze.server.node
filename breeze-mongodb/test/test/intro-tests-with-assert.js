return; // disable all tests in this file

var sinon  = require('sinon');
var assert = require("assert"); // node's assertion module
/*
assert.fail(actual, expected, message, operator) // just write wrong should assertion
assert(value, message), assert.ok(value, [message]) // should(value).ok
assert.equal(actual, expected, [message]) // should(actual).eql(expected, [message])
assert.notEqual(actual, expected, [message]) // should(actual).not.eql(expected, [message])
assert.deepEqual(actual, expected, [message]) // should(actual).eql(expected, [message])
assert.notDeepEqual(actual, expected, [message]) // should(actual).not.eql(expected, [message])
assert.strictEqual(actual, expected, [message]) // should(actual).equal(expected, [message])
assert.notStrictEqual(actual, expected, [message]) // should(actual).not.equal(expected, [message])
assert.throws(block, [error], [message]) // should(block).throw([error])
assert.doesNotThrow(block, [message]) // should(block).not.throw([error])
assert.ifError(value) // should(value).Error (to check if it is error) or should(value).not.ok (to check that it is falsy)
*/

describe('Assert Array', function(){

  describe('#indexOf()', function(){

    it.skip('should fail', function(){
    	assert.equal(1,0);
    });

    it('should return -1 when the value is not present', function(){
      assert.equal(-1, [1,2,3].indexOf(5));
      assert.equal(-1, [1,2,3].indexOf(0));
    });

    it('should watch this as pending');
  });

});

//http://sinonjs.org/
describe('Assert Sinon', function(){

  // SUT
  // The following takes a function as its argument and returns a new function. 
  // You can call the resulting function as many times as you want, 
  // but the original function will only be called once.
  function once(fn) {
    var returnValue, called = false;
    return function () {
        if (!called) {
            called = true;
            returnValue = fn.apply(this, arguments);
        }
        return returnValue;
    };
  }

    describe('spies', function(){

      it("calls the original function", function () {
          var callback = sinon.spy();
          var proxy = once(callback);

          proxy();

          assert(callback.called);
      });

      it("calls the original function only once", function () {
          var callback = sinon.spy();
          var proxy = once(callback);

          proxy();
          proxy();

          assert(callback.calledOnce);
          // ...or:
          // assert.equals(callback.callCount, 1);
      });

      it("calls original function with right this and args", function () {
          var callback = sinon.spy();
          var proxy = once(callback);
          var obj = {};

          proxy.call(obj, 1, 2, 3);

          assert(callback.calledOn(obj));
          assert(callback.calledWith(1, 2, 3));
      });

    });

    describe('stubs', function(){
        it("returns the return value from the original function", function () {
            var callback = sinon.stub().returns(42);
            var proxy = once(callback);

            assert.equal(proxy(), 42);
        });
    });
});