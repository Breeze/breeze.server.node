var fs     = require('fs');
var should = require("should");
var sinon  = require('sinon');

// MAKE SURE to have run 'npm install' in the breeze-mongodb directory
var MongoSaveHandler = require('../../mongoSaveHandler').MongoSaveHandler;

var dbCollectionMethods; // methods to use inside fake mongo db collection
var getDerekRequest = getDerekRequestFn();
var MONGO_ERROR_CODE_DUP_KEY = 11000;

describe('MongoSaveHandler', function(){

	var  callback,
	     custTypeName = "Customer:#Zza.Model",
	     derek, derekRequest, fakeDb, handler;

	var createHandler = function (){
		callback = sinon.spy();
		derekRequest = getDerekRequest();
		derek = derekRequest.entities[0];

		fakeDb = { collection: getHappyDbCollection()};

	    handler = new MongoSaveHandler(fakeDb, derekRequest, callback);
	};

	it('should be a function', function(){
		MongoSaveHandler.should.be.a.Function;
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

		it("save responds OK and saveResult has 1 updatedKey", function(done){
			handler.callback = asyncTestCallback(done, asserts);
			handler.save();

			function asserts(err, sr){
                (err || {}).should.not.exist;
				sr.updatedKeys.length.should.equal(1);
				sr.updatedKeys[0]._id.should.equal(derek._id);

	            // just to prove that the collection.update method was called properly
	            // first get the collection spy from fakeDb
				var dbCollection = fakeDb.collection;
				should.exist(dbCollection || {});
				var collection = dbCollection.returnValues[0];

	            // then check its update spy
				collection.update.calledOnce.should.be.true;
				// confirm '_id' criteria matches derek's id
				collection.update.args[0][0]._id.should.equal(derek._id);
			}
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
		describe("when it calls '_raiseError'", function(){
			var expectedErr = {statusCode: 418, message: "I'm a teapot"};
			beforeEach(function(){
				handler.beforeSaveEntity = function(){
					this._raiseError(expectedErr);
				};
				handler.save();
			});

			it('customer NOT be in the saveMap', function(){
				handler.saveMap.should.not.hasOwnProperty(custTypeName);
			});

			it("save responds with err === the arg to 'raiseError'", function(){
				callback.calledOnce.should.be.true;
				var err = callback.args[0][0];
				should.exist(err);
				err.should.be.exactly(expectedErr);
			});

		});
		describe('when it throws error', function(){
			var expectedErr = new Error("Wah, wah; c u l8r.");
			beforeEach(function(){
				handler.beforeSaveEntity = function(){
					throw expectedErr;
				};
				handler.save();
			});

			it('customer NOT be in the saveMap', function(){
				handler.saveMap.should.not.hasOwnProperty(custTypeName);
			});

			it('save responds with err === the exception', function(){
				callback.calledOnce.should.be.true;
				var err = callback.args[0][0];
				should.exist(err);
				err.should.be.exactly(expectedErr);
			});
		});

	});

	describe('#beforeSaveEntities', function(){
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
				};
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
				handler.beforeSaveEntities = function(/*continueSave*/){
					this._raiseError(expectedErr);
				};
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
				handler.beforeSaveEntities = function(/*continueSave*/){
					throw expectedErr;
				};
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

    describe('#afterSaveEntities', function(){
    	var ase, aseSaveResult;

    	beforeEach(function(){
    		createHandler();
    		ase = aseSaveResult = null;
    	});

		it('is called by save', function(done){
			ase = handler.afterSaveEntities =
			    sinon.spy(function(cb){cb();});

			handler.callback = asyncTestCallback(done, asserts);
			handler.save();

			function asserts(/*err, saveResult*/){
				ase.calledOnce.should.be.true;
			}
		});
		it('sees the saveResult when save OK', function(done){
			ase = handler.afterSaveEntities =
			    sinon.spy(function(cb){
			    	aseSaveResult = this.saveResult;
			    	cb();
			    });

			handler.callback = asyncTestCallback(done, asserts);
			handler.save();

			function asserts(err, saveResult){
                should.not.exist(err);
				ase.calledOnce.should.be.true;
				should.exist(aseSaveResult);
				saveResult.should.equal(aseSaveResult);
			}
	    });

	    describe('when it quietly removes "all" entities (why do that?)', function(){

			beforeEach(function(){
				ase = handler.afterSaveEntities =
				    sinon.spy(function(cb){
				    	aseSaveResult = this.saveResult;
				    	// the only one touched in this test
				    	aseSaveResult.updatedKeys=[];
				    	cb();
				    });
			});

			it('omits the customer from the save callback saveResult', function(done){

				handler.callback = asyncTestCallback(done, asserts);
				handler.save();

				function asserts(/*err, saveResult*/){
					handler.callback.should.be.okEmptyCallback();
				}
			});

		});
		describe('when it calls _raiseError', function(){
			var aseError, aseErrMsg, attachSr;
			beforeEach(function(){
				attachSr = false;
				aseErrMsg = "Test afterSaveEntities error";
				ase = handler.afterSaveEntities =
				    sinon.spy(function(/*cb*/){
				    	if (aseError instanceof Error && attachSr){
				    		aseSaveResult = this.saveResult;
				    		aseError.saveResult = aseSaveResult;
				    	}
				    	this._raiseError(aseError);
				    });
			});

			function asserts(err, result){
				should.not.exist(result);
				should.exist(err);
				if (attachSr){
					should.exist(err.saveResult);
					(err.saveResult === aseSaveResult).should.be.true;
				} else {
					should.not.exist(err.saveResult);
				}
			}
			it("with string err msg (bad!), save responds with error W/O SR", function(done){
				aseError = aseErrMsg;
				handler.callback = asyncTestCallback(done, asserts);
				handler.save();
			});
			it("with Error but doesn't add saveResult (bad!), save responds with error W/O SR", function(done){
				aseError = new Error(aseErrMsg);
				handler.callback = asyncTestCallback(done, asserts);
				handler.save();
			});
			it("with Error and adds saveResult (good!), save responds with error w/ SR", function(done){
				aseError = new Error(aseErrMsg);
				attachSr = true; // can't do it yet
				handler.callback = asyncTestCallback(done, asserts);
				handler.save();
			});
		});
		describe('when it throws an exception', function(){

			beforeEach(function(){
				ase = handler.afterSaveEntities =
				    sinon.spy(function(/*cb*/){
				    	aseSaveResult = this.saveResult;
				    	throw new Error("Test afterSaveEntities error");
				    });
			});

			it("save responds with error which has the saveResult", function(done){

				handler.callback = asyncTestCallback(done, asserts);
				handler.save();

				function asserts(err, result){
					should.not.exist(result);
					should.exist(err);
					should.exist(err.saveResult);
					(err.saveResult === aseSaveResult).should.be.true;
				}
			});

		});
    });

    describe('When reviewing metadata',function(){
        var metadata;
        beforeEach(function(){
            createHandler();
            metadata = handler.metadata;
        });
        it("the 'derek' feed has metadata for Customer", function(){
            should.exist(metadata);
            should.exist(metadata[custTypeName]);
        });

        it("should error when save with no Customer metadata", function(){
            handler.metadata = {};
            handler.save();
            var args = callback.args[0];
            should.exist(args);
            var err = args[0];
            should.exist(err);
            err.message.should.match(/Unable to locate metadata for an EntityType/);
        });
    });

    describe("#save when request is valid, ",function(){
        var derek, entities;
        beforeEach(function() {
            createHandler();
            entities = handler.entities;
            derek = entities[0];
        });

        it("added 'Derek' is ok and appears in 'insertedKeys'", function(done){
            derek.entityAspect.entityState="Added";
            handler.callback = asyncTestCallback(done, asserts);
            handler.save();

            function asserts(err, sr){
                (err || {}).should.not.exist;
                sr.insertedKeys.length.should.equal(1);
            }
        });

        it("deleted 'Derek' is ok and appears in 'deletedKeys'", function(done){
            derek.entityAspect.entityState="Deleted";
            handler.callback = asyncTestCallback(done, asserts);
            handler.save();

            function asserts(err, sr){
                (err || {}).should.not.exist;
                sr.deletedKeys.length.should.equal(1);
            }
        });

        it("modified 'Derek' is ok and appears in 'updatedKeys'", function(done){
            handler.callback = asyncTestCallback(done, asserts);
            handler.save();

            function asserts(err, sr){
                (err || {}).should.not.exist;
                sr.updatedKeys.length.should.equal(1);
            }
        });

        it("combo of add/mod/deleted 'Derek' is ok", function(done){
            entities.push(clone(derek));
            entities[1].entityAspect.entityState="Added";
            entities.push(clone(derek));
            entities[2].entityAspect.entityState="Deleted";
            entities.push(clone(derek)); // push a second, modified Derek
            entities[3].entityAspect.entityState="Modified";
            handler.callback = asyncTestCallback(done, asserts);
            handler.save();

            function asserts(err, sr){
                (err || {}).should.not.exist;
                sr.updatedKeys.length.should.equal(2);
                sr.insertedKeys.length.should.equal(1);
                sr.deletedKeys.length.should.equal(1);
            }
        });

        describe("modified 'Derek'", function(){
            it("has only 'address' and 'rowVer' $set keys", function(done){
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(/*err, sr*/){
                    var update = dbCollectionMethods.update;
                    update.calledOnce.should.be.true;
                    var setOpts = update.args[0][1];
                    //console.log("setOpts: "+JSON.stringify(setOpts, null,2));
                    setOpts.should.not.be.empty;
                    var $set = setOpts.$set || {};
                    Object.keys($set).length.should.equal(2);
                    (!!$set.address).should.be.true;
                    (!!$set.rowVer).should.be.true;
                }
            });
            it("has $criteria that include '_id' which is Derek's id", function(done){
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(/*err, sr*/){
                    var update = dbCollectionMethods.update;
                    var criteria = update.args[0][0];
                    //console.log("criteria: "+JSON.stringify(criteria, null, 2));
                    (!!criteria).should.be.true;
                    (criteria._id).should.equal(derek._id);
                }
            });
            it("has $criteria that include 'rowVer' concurrency prop", function(done){
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(/*err, sr*/){
                    var update = dbCollectionMethods.update;
                    var criteria = update.args[0][0];
                    (!!criteria).should.be.true;
                    (!!criteria.rowVer).should.be.true;
                }
            });
            it("saves entire 'address' although 'city' is only specified address value (BAD?)", function(done){
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(/*err, sr*/){
                    var update = dbCollectionMethods.update;
                    var $set  = update.args[0][1].$set;
                    var addrSetKeys = Object.keys($set.address);
                    var origAddrKeys = Object.keys(derek.entityAspect.originalValuesMap.address);
                    origAddrKeys.length.should.equal(1);
                    addrSetKeys.length.should.be.greaterThan(1);
                }
            });
            it("when has no originalValuesMap, has no $set keys", function(done){
                derek.entityAspect.originalValuesMap = {};
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(/*err, sr*/){
                    var update = dbCollectionMethods.update;
                    var $setKeys  = Object.keys(update.args[0][1].$set);
                    $setKeys.length.should.equal(0);
                }
            });
            it("when add firstName to originalValuesMap, firstName is in $set keys",
                function(done){
                    derek.entityAspect.originalValuesMap.firstName=undefined; // the orig value doesn't matter!
                    handler.callback = asyncTestCallback(done, asserts);
                    handler.save();

                    function asserts(/*err, sr*/){
                        var update = dbCollectionMethods.update;
                        var $set = update.args[0][1].$set;
                        var $setKeys  = Object.keys($set);
                        $setKeys.length.should.equal(3);
                        ($set.firstName === 'Derek').should.be.true;

                    }
                });
            it("when add firstName to originalValuesMap and firstName === null, it is NOT in $set keys",
                function(done){
                    derek.entityAspect.originalValuesMap.firstName=undefined; // the value doesn't matter!
                    derek.firstName = null; // you might think this would clear the FN ... but it won't
                    handler.callback = asyncTestCallback(done, asserts);
                    handler.save();

                    function asserts(/*err, sr*/){
                        var update = dbCollectionMethods.update;
                        var $set = update.args[0][1].$set;
                        ($set.firstName === undefined).should.be.true;
                        // which means the firstName will still be 'Derek' after save !!!
                    }
                });
            it("when entityAspect.forceUpdate === true, all properties are set",
                function(done){
                    derek.entityAspect.forceUpdate = true;
                    derek.firstName = null; // this WILL clear the FN ... because of forceUpdate

                    handler.callback = asyncTestCallback(done, asserts);
                    handler.save();

                    function asserts(/*err, sr*/){
                        var update = dbCollectionMethods.update;
                        var $set = update.args[0][1].$set;
                        var props = Object.keys(derek).filter(function(n){
                                // _id and entityAspect would not be in the $set
                                return n!=='_id' &&
                                       n!=='entityAspect';}
                        );
                        var allPropsInSet = true;
                        props.forEach(function(p){
                            allPropsInSet = allPropsInSet && ($set[p] !== undefined);
                        });
                        allPropsInSet.should.be.true;
                        ($set.firstName === null).should.be.true; // will null the firstName this time.
                    }
                });
            it("when add FOO to originalValuesMap, FOO is in $set keys although it doesn't exist (BAD?)",
                function(done){
                    derek.entityAspect.originalValuesMap.FOO='foo';
                    handler.callback = asyncTestCallback(done, asserts);
                    handler.save();

                    function asserts(/*err, sr*/){
                        var update = dbCollectionMethods.update;
                        var $set = update.args[0][1].$set;
                        ($set.FOO === undefined).should.be.true;
                    }
                });
        });

        describe("when mongodb dies", function(){
            beforeEach(function(){
                fakeDb.collection = getSadDbCollection();
            });
            it("combo of add/mod/deleted 'Derek' all fail and are in sr.errors", function(done){
                entities.push(clone(derek));
                entities[1].entityAspect.entityState="Added";
                entities.push(clone(derek));
                entities[2].entityAspect.entityState="Deleted";
                entities.push(clone(derek)); // push a second, modified Derek
                entities[3].entityAspect.entityState="Modified";
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(err, sr){
                    should.not.exist(sr);
                    should.exist(err);
                    sr = err.saveResult;
                    sr.updatedKeys.length.should.equal(0);
                    sr.insertedKeys.length.should.equal(0);
                    sr.deletedKeys.length.should.equal(0);
                    sr.errors.length.should.equal(4);
                }
            });
            it("during insert with duplicate key error, error is a 409 (conflict)",function(done){
                dbCollectionMethods.insert  = function(entity, saveOptions, cb){
                    var err = new Error("Insert died with duplicate key error for "+entity._id);
                    err.code = MONGO_ERROR_CODE_DUP_KEY;
                    setTimeout(cb, 0, err);
                };
                derek.entityAspect.entityState="Added";
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(err, sr){
                    should.not.exist(sr);
                    should.exist(err);
                    var addErr = err.saveResult.errors[0];
                    //console.log(addErr);
                    addErr.status.should.equal(409); // conflict
                    addErr.message.should.match(/duplicate key/i);
                }
            });
            it("during update with 'wasUpdated'===false, error is a 404",function(done){
                dbCollectionMethods.update = function(entity, setOpts, saveOptions, cb){
                    setTimeout(cb, 0, null, /*wasUpdated=*/false);
                };
                derek.entityAspect.entityState="Modified";
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(err, sr){
                    should.not.exist(sr);
                    should.exist(err);
                    var modErr = err.saveResult.errors[0];
                    //console.log(modErr);
                    modErr.status.should.equal(404); // not found
                    modErr.message.should.match(/not updated/i);
                }
            });
            it("during remove with 'numberRemoved'===0, error is a 404",function(done){
                dbCollectionMethods.remove = function(criteria, strict, cb){
                    setTimeout(cb, 0, null, /*numberRemoved=*/0);
                };
                derek.entityAspect.entityState = "Deleted";
                handler.callback = asyncTestCallback(done, asserts);
                handler.save();

                function asserts(err, sr){

                    should.not.exist(sr);
                    should.exist(err);
                    var delErr = err.saveResult.errors[0];
                    //console.log(delErr);
                    delErr.status.should.equal(404); // not found
                    delErr.message.should.match(/not deleted/i);

                }
            });
        })

    });

    describe("#save with bad request data",function(){
        var derek, entities;
        beforeEach(function() {
            createHandler();
            entities = handler.entities;
            derek = entities[0];
        });

        it("fails early when omit _id", function(){
            delete derek._id;
            handler.save();

            callback.calledOnce.should.be.true;
            var err = callback.args[0][0];
            should.exist(err);
            err.should.have.property('statusCode', 400);
            err.should.have.property('message').and.match(/missing _id/i);
        });
        it("fails early when _id is malformed", function(){
            derek._id = "Not.a.valid.id";
            handler.save();

            callback.calledOnce.should.be.true;
            var err = callback.args[0][0];
            should.exist(err);
            err.should.have.property('statusCode', 400);
            err.should.have.property('message').and.match(/unable to convert the _id/i);
        });
        it("fails early when birthdate is malformed", function(){
            derek.birthdate = "Not.a.valid.date";
            derek.entityAspect.originalValuesMap.birthdate = null; // the prop name is all we need
            handler.save();

            callback.calledOnce.should.be.true;
            var err = callback.args[0][0];
            should.exist(err);
            err.should.have.property('statusCode', 400);
            err.should.have.property('message').and.match(/invalid date/i);
        });
        it("fails early when entityState is bad", function(){
            derek.entityAspect.entityState="BAD-STATE";
            handler.save();

            callback.calledOnce.should.be.true;
            var err = callback.args[0][0];
            should.exist(err);
            err.should.have.property('statusCode', 400);
            err.should.have.property('message').and.match(/unknown save op/i);
        });
    });
});

//////// helpers ////////////

function clone(o){
    return JSON.parse( JSON.stringify( o ) );
}

function asyncTestCallback(done, asserts){
	return sinon.spy(function(err, saveResult){
		try {
			if (asserts) { asserts(err, saveResult); }
			done();
		} catch (e){
			console.log(e);
			done(e);
		}
	});
}

function getDerekRequestFn () {
	try {
	  //var path = __dirname + '../saveDerek.json';
	  var path = 'saveDerek.json';
	  var derek = fs.readFileSync(path, 'utf8');
	  //console.log("Hooray! we read "+path);
	  //console.log("typeof saveDerek = "+typeof saveDerekSrc);
	  //console.log("'saveDerek is: "+saveDerekSrc);
	  return function(){return JSON.parse(derek);}
	} catch (e) {
		console.log("Failed to read 'saveDerek'. Error: "+e.message);
        throw e
	}
}
/*
function getFailToFindDbCollection (){
	return sinon.spy(function(collectionName, opts, callback){
		var emsg = "Collection "+collectionName+"does not exist. Currently in safe mode.";
		var err = new Error(emsg);
		callback(err);
	});
}
*/
function getDbCollection(){
    return sinon.spy(function(collectionName, opts, callback) {
        //console.log("db.collection spy called.");
        var collection = {
            name: collectionName,
            insert: dbCollectionMethods.insert,
            remove: dbCollectionMethods.remove,
            update: dbCollectionMethods.update
        };
        callback(null, collection);
        return collection;// real db.collection fn doesn't return anything
    });
}

function getHappyDbCollection(){
    // every save method succeeds
    dbCollectionMethods = {
        // These test fns behave asynchronously
        insert: sinon.spy(function(entity, saveOptions, cb){
            //cb(null, [entity]);
            setTimeout(cb, 0, null, [entity]);
        }),

        remove: sinon.spy(function(criteria, strict, cb){
            //cb(null, 1);
            setTimeout(cb, 0, null, 1);
        }),

        update: sinon.spy(function(entity, setOpts, saveOptions, cb){
            //cb(null, true);
            setTimeout(cb, 0, null, true);
        })
    };
    return getDbCollection();
}

function getSadDbCollection(){
    // every save method fails
    dbCollectionMethods = {
        // These test fns behave asynchronously
        insert: sinon.spy(function(entity, saveOptions, cb){
            setTimeout(cb, 0, new Error("Insert died for entity "+entity._id));
        }),
        remove: sinon.spy(function(criteria, strict, cb){
            setTimeout(cb, 0, new Error("Remove died for "+JSON.stringify(criteria, null, 2)));
        }),
        update: sinon.spy(function(entity, setOpts, saveOptions, cb){
            setTimeout(cb, 0, new Error("Update died for entity "+entity._id +
                " and setOptions: "+JSON.stringify(setOpts, null, 2)));
        })
    };
    return getDbCollection();
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
	this.assert(callbackSpy.calledOnce === true,
				setReason('not called exactly once, instead called '+
					callbackSpy.callCount+' times'));
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
		//noinspection JSUnfilteredForInLoop
        var val = sr[prop];
		if (Array.isArray(val)){count += val.length;}
	}
	count.should.equal(0, setReason('there were saved '+count+' entities'));
}