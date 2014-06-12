var fs     = require('fs');
var should = require("should"); 
var sinon  = require('sinon');

// MAKE SURE to have run 'npm install' in the breeze-mongodb directory
var MongoSaveHandler = require('../../mongoSaveHandler').MongoSaveHandler;

var getDerek; // fn returning test save request for customer named Derek
getTestData();

describe('MongoSaveHandler', function(){

	var  callback,
	     custTypeName = "Customer:#Zza.Model", 
	     derek, fakeDb, handler;

	var createHandler = function (){
		callback = sinon.spy();
		derek = getDerek();
		//console.log("derek keys are: "+Object.keys(derek));
		fakeDb = { collection: sinon.spy(failToFindCollection)};

	    handler = new MongoSaveHandler(fakeDb, derek, callback);			
	}

	it('should be a function', function(){
		MongoSaveHandler.should.be.a.Function;
	});

	describe('#ctor', function(){

		beforeEach(createHandler);

		it('can create handler instance', function(){
			should.exist(handler);
		});

		it('handler has metadata for customer', function(){
			var metadata =  handler.metadata;
			should.exist(metadata && metadata[custTypeName]);
		});
	});

	describe('#beforeSaveEntity', function(){	
		var entityApproval;

		beforeEach(function(){
			createHandler();
			entityApproval = {isApproved: true};
			this.bse = handler.beforeSaveEntity = sinon.spy(function(){
				return entityApproval.isApproved;
			});
		});

		it('is called by save', function(){
			handler.save();
			this.bse.calledOnce.should.be.true;
			this.bse.returned(true).should.be.true;
		});

		it('leaves the customer in the saveMap when it returns true', function(){
			handler.save();
			handler.saveMap.should.hasOwnProperty(custTypeName);
		});

		describe('when it returns false', function(){
			beforeEach(function(){
				entityApproval.isApproved = false;
				handler.save();
			});

			it('omits the customer from the saveMap', function(){
				this.bse.returned(false).should.be.true;
				handler.saveMap.should.not.hasOwnProperty(custTypeName);
			});

			it('save responds OK with an empty saveResult', function(){
				callback.should.be.okEmptyCallback();
			});

		});

	}); 


	describe('#beforeSaveEntities', function(){	
		var entityApproval;

		beforeEach(createHandler);

		it('is called by save', function(){
			this.bse = handler.beforeSaveEntities = sinon.spy(function(continueSave){
				continueSave();
			});
			handler.save();
			this.bse.calledOnce.should.be.true;
		});


		describe('when it quietly removes all entities', function(){
			beforeEach(function(){
				handler.beforeSaveEntities = function(continueSave){
					this.saveMap = {};
					continueSave();
				} 
				handler.save();
			});

			it('omits the customer from the saveMap', function(){
				handler.saveMap.should.not.hasOwnProperty(custTypeName);
			});

			it('save responds OK with an empty saveResult', function(){
				callback.should.be.okEmptyCallback();
			});

		});
		describe("when it calls '_raiseError'", function(){
			var expectedErr = {statusCode: 418, message: "I'm a teapot"};
			beforeEach(function(){
				handler.beforeSaveEntities = function(continueSave){
					this._raiseError(expectedErr);
				} 
				handler.save();
			});

			it('customer remains in the saveMap', function(){
				handler.saveMap.should.hasOwnProperty(custTypeName);
			});

			it("save responds with err === the arg to 'raiseError'", function(){
				callback.calledOnce.should.be.true;
				var err = callback.args[0][0];
				should.exist(err);
				err.should.be.exactly(expectedErr);
			});

		});
		describe("when it throws an exception", function(){
			var expectedErr = new Error("Wah, wah; c u l8r.");
			beforeEach(function(){
				handler.beforeSaveEntities = function(continueSave){
					throw expectedErr;
				} 
				handler.save();
			});

			it('customer remains in the saveMap', function(){
				handler.saveMap.should.hasOwnProperty(custTypeName);
			});

			it('save responds with err === the exception', function(){
				callback.calledOnce.should.be.true;
				var err = callback.args[0][0];
				should.exist(err);
				err.should.be.exactly(expectedErr); 
			});

		});

	}); 
});

//////// helpers ////////////
function getTestData() {
	try {
	  //var path = __dirname + '../saveDerek.json';
	  var path = 'saveDerek.json';
	  var derek = fs.readFileSync(path, 'utf8'); 
	  //console.log("Hooray! we read "+path);
	  //console.log("typeof saveDerek = "+typeof saveDerekSrc);
	  //console.log("'saveDerek is: "+saveDerekSrc);
	  getDerek = function(){return JSON.parse(derek);}
	} catch (e) {
		console.log("Failed to read 'saveDerek'. Error: "+e.message);
	}	
}

function failToFindCollection (collectionName, opts, callback){
	var emsg = "Collection "+collectionName+"does not exist. Currently in safe mode.";
	var err = new Error(emsg);
	callback(err);
}

//////// Custom should.js assertions /////////
// Can only define these ONCE per mocha session
// so if you change it, terminate and restart mocha
if (!should.Assertion.prototype.okCallback){
	//console.log("++++++++ defining custom should.js assertions ++++++++");
	should.Assertion.add('okCallback', okCallback );
	should.Assertion.add('okEmptyCallback', okEmptyCallback );
}

function okCallback() {
	var params = this.params = {};
	var setReason = function(msg){
		params.message = 
			"expected handler callback with an OK saveResult but "+msg;
	};

	var callbackSpy = this.callbackSpy = this.obj;
	callbackSpy.should.hasOwnProperty('calledOnce', setReason('not called exactly once'));
	this.assert(callbackSpy.calledOnce);
	var args = callbackSpy.args[0];
	this.assert(Array.isArray(args), setReason('not called with 2 args'));
	this.assert(args.length === 2);
	this.assert(args[0] == null, setReason('called with an error'));
	this.assert(args[1].errors.length === 0, setReason('saveResult contains errors'));
}
function okEmptyCallback() {
	okCallback.bind(this)();
    var params = this.params;
	var setReason = function(msg){
		params.message = 
			"expected handler callback with an OK EMPTY saveResult but "+msg;
	};
	var count = 0, sr = this.callbackSpy.args[0][1];
	for (prop in sr){
		var val = sr[prop];
		if (Array.isArray(val)){count += val.length;}
	}
	count.should.equal(0, setReason('there were saved '+count+' entities'));
}