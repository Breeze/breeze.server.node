var breezeSequelize  = require("breeze-sequelize");
var adapter_model    = require("breeze-client/adapter-model-library-backing-store");
var adapter_json     = require("breeze-client/adapter-uri-builder-json");
var adapter_data     = require("breeze-client/adapter-data-service-webapi");
var adapter_ajax     = require("breeze-client/adapter-ajax-fetch");

var fs               = require('fs');
var expect           = require('chai').expect;
var _                = require('lodash');

// Don't use this
// var breeze = require('breeze-client');
// Use this
var breeze = breezeSequelize.breeze;
exports.breeze = breeze;

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService

// breeze.config.registerAdapter("modelLibrary", adapter_model.ModelLibraryBackingStoreAdapter);
// breeze.config.initializeAdapterInstance("modelLibrary", "backingStore", true);

adapter_model.ModelLibraryBackingStoreAdapter.register(breeze.config);
adapter_json.UriBuilderJsonAdapter.register(breeze.config);
adapter_ajax.AjaxFetchAdapter.register(breeze.config);
adapter_data.DataServiceWebApiAdapter.register(breeze.config);

// breeze.ModelLibraryBackingStoreAdapter.register();
// breeze.NamingConvention.none.setAsDefault();
console.log("registered adapters");

// test predicate extension - REMOVED in breeze-client 2.0 - TODO should we restore it?
// breeze.Predicate.extendBinaryPredicateFn( { like: {}, nlike: { alias: 'notLike' }}, function(context, expr1, expr2) {
//   var e2 = "^" + expr2.replace("%", ".*?") + "$";
//   var rx = new RegEx(e2);
//   var isLike =  rx.test(expr1);
//   return (this.op.key == 'like') ? isLike : !isLike;
// });

var __dbConfigNw = {
  host: "localhost",
  //user: "jayt",
  //password: "password",
  user: "mysql",
  password: "mysql",
  dbName: 'northwindib'
}


// exports.uriBuilderName = "odata";
exports.uriBuilderName = "json";
exports.dbConfigNw = __dbConfigNw;

exports.getSequelizeQuery = function(uriBuilderName) {
  uriBuilderName = uriBuilderName || exports.uriBuilderName;
  // return require('./../SequelizeQuery.' + uriBuilderName + '.js');
  return null;
}


exports.newEm = function() {
  var ds = new DataService({ serviceName: "Foo", uriBuilderName: exports.uriBuilderName});
  var em = new EntityManager({dataService: ds});
  // _em = new EntityManager("Foo");
  var ms = em.metadataStore;
  var breezeMetadata = fs.readFileSync('./NorthwindIBMetadata.json', { encoding: 'utf8' });
  ms.importMetadata(breezeMetadata);
  return em;
}


exports.getMetadata = function() {
  var breezeMetadata = fs.readFileSync('./NorthwindIBMetadata.json', { encoding: 'utf8' });
  var json = JSON.parse(breezeMetadata);
  // removing naming convention so that we don't camel case the data.
  // json.namingConvention = null;
  return json;
}


exports.isSorted = function(array, props, isDesc) {
  var props = _.isArray(props) ? props : [props];
  var arr = array.map(function(item) {
    return props.map(function (prop) {
      // Need to remove accents so that strings compare like they do on the server.
      return removeAccents(item[prop]);
      // return item[prop];
    }).join("-");
  });
  var isOk =  _.every(arr, function(value, index, array) {
    // either it is the first element, or otherwise this element should
    // not be smaller than the previous element.
    // spec requires string conversion
    if (index == 0) return true;
    options = { sensitivity: "base" };
    // Node does not seem to support locale args in localeCompare yet.
    // var r = String(array[index - 1]).localeCompare(String(value), "en-US", options);
    var r = String(array[index - 1]).localeCompare(String(value));
    var ok = isDesc ? r >= 0 : r <= 0;
    if (!ok) {
      var zzz = r;
    }
    return ok;
  });
  return isOk;
};

exports.isSorted = function(array, props, isDesc) {
  var props = _.isArray(props) ? props : [props];

  return  _.every(array, function(value, index, arr) {
    // either it is the first element, or otherwise this element should
    // not be smaller than the previous element.
    if (index == 0) return true;

    var pv = array[index-1];
    var cv = array[index];
    var ok = true;
    props.some(function(prop) {
      // pull out any 'desc' or 'asc' tags
      var pi = prop.split(" ");
      var v1 = pv[pi[0]];
      var v2 = cv[pi[0]];
      var isDesc = pi.length == 2 && pi[1].toLowerCase() == "desc";
      var r = compare(v1, v2);
      ok = isDesc ? r >= 0 : r <= 0;
      if (!ok) {
        var zzz = r;
      }
      // exit as soon as we have an answer;
      return r != 0;
    });

    return ok;
  });
};

exports.log = log = function(s) {
  if (!log.enabled) return;
  console.log('[Breeze] ' + s + '\n');
}

function compare(v1, v2) {
  if (v1 == null && v2 == null) return 0;
  if (v1 == null) return -1;
  if (v2 == null) return 1;
  if (typeof v1 == 'string') {
    return removeAccents(v1).localeCompare(removeAccents(v2));
  } else {
    // cant use v1-v2 because they might not be numbers.
    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
    return 0;
  }

}

exports.wordWrap = function( str, width, brk, cut ) {

  brk = brk || '\n';
  width = width || 75;
  cut = cut || false;

  if (!str) { return str; }

  var regex = '.{1,' +width+ '}(\\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\\S+?(\\s|$)');

  return str.match( RegExp(regex, 'g') ).join( brk );

}

function removeAccents(s){
  var r=s.toLowerCase();
  r = r.replace(new RegExp(/[àáâãäå]/g),"a");
  r = r.replace(new RegExp(/æ/g),"ae");
  r = r.replace(new RegExp(/ç/g),"c");
  r = r.replace(new RegExp(/[èéêë]/g),"e");
  r = r.replace(new RegExp(/[ìíîï]/g),"i");
  r = r.replace(new RegExp(/ñ/g),"n");
  r = r.replace(new RegExp(/[òóôõö]/g),"o");
  r = r.replace(new RegExp(/œ/g),"oe");
  r = r.replace(new RegExp(/[ùúûü]/g),"u");
  r = r.replace(new RegExp(/[ýÿ]/g),"y");
  return r;
};