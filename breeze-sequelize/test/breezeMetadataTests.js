var breeze = require('breeze-client');
var fs = require('fs');
var expect = require('chai').expect;

var testFns = require('./testFns.js');

describe('breezeMetadata', function () {
  this.enableTimeouts(false);

  it('should be able to import metadata', function() {

    var data = testFns.getMetadata();
    var ms = new breeze.MetadataStore();
    ms.importMetadata(data);
    var entityTypes = ms.getEntityTypes();

    expect(entityTypes).to.be.instanceOf(Array);
    expect(entityTypes).to.have.length.above(0);


  });
});

