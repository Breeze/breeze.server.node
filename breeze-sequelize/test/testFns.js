var breeze           = require("breeze-client");
var fs               = require('fs');
var expect           = require('chai').expect;

var utils            = require('./../utils.js');
var log = utils.log;

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService;

var __dbConfigNw = {
  host: "localhost",
  user: "jayt",
  password: "password",
  dbName: 'northwindib'
}


// exports.uriBuilderName = "odata";
exports.uriBuilderName = "json";
exports.dbConfigNw = __dbConfigNw;
exports.newEm = newEm;
exports.getMetadata = getMetadata;
exports.getSequelizeQuery = getSequelizeQuery;

function getSequelizeQuery(uriBuilderName) {
  uriBuilderName = uriBuilderName || exports.uriBuilderName;
  return require('./../SequelizeQuery.' + uriBuilderName + '.js');
}


function newEm() {
  var ds = new DataService({ serviceName: "Foo", uriBuilderName: exports.uriBuilderName});
  var em = new EntityManager({dataService: ds});
  // _em = new EntityManager("Foo");
  var ms = em.metadataStore;
  var breezeMetadata = fs.readFileSync('./sampleMetadata.json', { encoding: 'utf8' });
  ms.importMetadata(breezeMetadata);
  return em;
}


function getMetadata() {
  var breezeMetadata = fs.readFileSync('./sampleMetadata.json', { encoding: 'utf8' });
  var json = JSON.parse(breezeMetadata);
  // removing naming convention so that we don't camel case the data.
  // json.namingConvention = null;
  return json;
}