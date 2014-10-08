var Sequelize      = require('sequelize');
var breeze         = require("breeze-client");

var MetadataMapper = require('./MetadataMapper.js');
var dbUtils        = require('./dbUtils.js');
var utils          = require('./utils.js');

var _             = Sequelize.Utils._;
var log = utils.log;
/**
 * Retrieve models which match `where`, then delete them
 */
function findAndDelete (where,callback) {

  // Handle *where* argument which is specified as an integer
  if (_.isFinite(+where)) {
    where = {
      id: where
    };
  }

  Model.findAll({
    where:where
  }).success(function(collection) {
    if (collection) {
      if (_.isArray(collection)) {
        Model.deleteAll(collection, callback);
      }
      else {
        collection.destroy().
            success(_.unprefix(callback)).
            error(callback);
      }
    }  else {
      callback(null,collection);
    }
  }).error(callback);
}

/**
 * Delete all `models` using the query chainer
 */
function deleteAll(models) {
  var chainer = new Sequelize.Utils.QueryChainer();
  models.forEach(function(m) {
    chainer.add(m.destroy());
  });
  return chainer.run();
}