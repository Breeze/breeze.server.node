var breeze = require('breeze-client');
var fs = require('fs');
var should = require('should');
// test should
true.should.be.ok;

describe('metadata', function () {
  this.enableTimeouts(false);

  it('should be able to import metadata', function() {

    var data = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    var ms = new breeze.MetadataStore();
    ms.importMetadata(data);
    var entityTypes = ms.getEntityTypes();
    // entityTypes.should.be.instanceOf(Array).and.not.be.empty;

    entityTypes.should.be.an.Array;
    entityTypes.length.should.be.greaterThan(0);
    // would rather do this but..
    // don't know why but next line just hangs the test;
    // entityTypes.should.not.be.empty;
  });
});

