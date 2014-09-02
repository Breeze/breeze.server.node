var breeze = require('breeze-client');
var fs = require("fs");
var should = require("should");

describe("odata parse", function() {
    this.enableTimeouts(false);


    it("should be able to import metadata", function() {
        var data = fs.readFileSync( './sampleMetadata.json', { encoding: 'utf8' } );
        var ms = new breeze.MetadataStore();
        ms.importMetadata(data);
        ms.should
    });
});

