var breeze = require('breeze-client');
var fs = require('fs');
var expect = require('chai').expect;


describe('metadata', function () {
  this.enableTimeouts(false);

  it('should be able to import metadata', function() {

    var data = fs.readFileSync('./test/sampleMetadata.json', { encoding: 'utf8' });
    var ms = new breeze.MetadataStore();
    ms.importMetadata(data);
    var entityTypes = ms.getEntityTypes();

    expect(entityTypes).to.be.instanceOf(Array);
    expect(entityTypes).to.have.length.above(0);


  });
});

