var Sequelize      = require('Sequelize');
var breeze         = require("breeze-client");
var Promise        = require("bluebird");

var MetadataMapper = require('./MetadataMapper.js');
var dbUtils        = require('./dbUtils.js');
var utils          = require('./utils.js');

var _             = Sequelize.Utils._;
var log = utils.log;

module.exports = SequelizeManager = function(dbConfig) {
  this.dbConfig = dbConfig;
  this.sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, {
    dialect: "mysql", // or 'sqlite', 'postgres', 'mariadb'
    port:    3306, // or 5432 (for postgres)
    omitNull: true
  });
  // map of modelName -> model
  this.models = {};
};

SequelizeManager.prototype.authenticate = function(next) {
  // check database connection
  this.sequelize.authenticate().then(function() {
    log('Connection has been established successfully.');
  }).error(function(err) {
    log('Unable to connect to the database:', err);
    throw err;
  });

};

SequelizeManager.prototype.createDb = function(next) {
  dbUtils.createDb(dbConfig, next);
};

SequelizeManager.prototype.importMetadata = function(breezeMetadata) {
  var metadataMapper = new MetadataMapper(breezeMetadata, this.sequelize);
  var etMap = metadataMapper.mapToSqTypes();
  // TODO: should we merge here instead ; i.e. allow multiple imports...
  this.models = _.indexBy(etMap, "name");
};

// returns Promise(sequelize);
SequelizeManager.prototype.sync = function(shouldCreateDb) {
  if (shouldCreateDb) {
    var that = this;
    return dbUtils.createDb(this.dbConfig).then(function() {
      return syncCore(that.sequelize);
    });
  } else {
    return syncCore(this.sequelize);
  }
};


//SequelizeManager.prototype.sync = function(shouldCreateDb, next) {
//  if (shouldCreateDb) {
//    var that = this;
//    dbUtils.createDb(this.dbConfig, function(err) {
//      if (err) next(err);
//      sync(that.sequelize, next);
//    });
//  } else {
//    sync(this.sequelize, next);
//  }
//};

// returns promise(sequelize);
function syncCore(sequelize) {
  return sequelize.sync({ force: true}).then(function() {
    log("schema created");
    return sequelize;
  }).catch(function(err) {
    console.log("schema creation failed");
    throw err;
  });
}