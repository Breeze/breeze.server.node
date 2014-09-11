var fs               = require('fs');
var expect           = require('chai').expect;
var breeze           = require('breeze-client');
var Sequelize        = require('sequelize');
var utils            = require('./../utils.js');
//var dbUtils          = require('./../dbUtils.js');
//var SequelizeManager = require('./../SequelizeManager');
var SequelizeQuery  = require('./../SequelizeQuery.js');

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

describe.only("predicate tests", function() {
  this.enableTimeouts(false);

  var _ms;
  var _em;
  before(function() {
    _em = new EntityManager();
    _ms = _em.metadataStore;
    var breezeMetadata = fs.readFileSync('./sampleMetadata.json', { encoding: 'utf8' });
    _ms.importMetadata(breezeMetadata);
  });


  it("simple binary predicate", function() {
    var orderType = _ms.getEntityType("Order");
    var p = breeze.createAltPredicate("freight", ">", 100);
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("freight gt 100m");
  });

  it("simple binary predicate", function() {
    var orderType = _ms.getEntityType("Order");
    var p = breeze.createAltPredicate( { freight: { $gt: 100} });
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("freight gt 100m");
  });

  it("and/or predicate", function() {
    var orderType = _ms.getEntityType("Order");
    var p = breeze.createAltPredicate(
        { $and:
            [ { freight: { $gt: 100} },
              { shipCity: { startsWith: 'S'} }
            ]
        });
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("freight > 100m and startsWith(shipCity,'S')");
  });
});