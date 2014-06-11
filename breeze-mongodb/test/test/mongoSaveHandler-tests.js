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

	it('should exist', function(){
		should.exist(MongoSaveHandler);
	});

	describe('#ctor', function(){

		beforeEach(function(){
			callback = sinon.spy();
			derek = getDerek();
			//console.log("derek keys are: "+Object.keys(derek));
			fakeDb = { collection: failToFindCollection};

		    handler = new MongoSaveHandler(fakeDb, derek, callback);
		})

		it('can create handler instance', function(){
			should.exist(handler);
		});

		it('handler has metadata for customer', function(){
			var metadata =  handler.metadata;
			should.exist(metadata && metadata[custTypeName]);
		});
	});

});

//////// helpers ////////////
function getTestData() {
	try {
	  //var path = __dirname + '../SaveDerek.json';
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
