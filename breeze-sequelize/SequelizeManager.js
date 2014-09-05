var Sequelize      = require('Sequelize');
var breeze         = require("breeze-client");

var MetadataMapper = require('./MetadataMapper.js');
var dbUtils        = require('./dbUtils.js');
var utils          = require('./utils.js');

var _             = Sequelize.Utils._;
var log = utils.log;

module.exports = SequelizeManager = function(dbConfig) {
  this.dbConfig = dbConfig;
  this.sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, {
    dialect: "mysql", // or 'sqlite', 'postgres', 'mariadb'
    port:    3306 // or 5432 (for postgres)
  });
  // map of modelName -> model
  this.models = {};
};

SequelizeManager.prototype.authenticate = function(next) {
  // check database connection
  this.sequelize.authenticate().complete(function(err) {
    if (err) {
      log('Unable to connect to the database:', err);
      next(err);
    } else {
      log('Connection has been established successfully.');
      next();
    }
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

SequelizeManager.prototype.sync = function(shouldCreateDb, next) {
  if (shouldCreateDb) {
    var that = this;
    dbUtils.createDb(this.dbConfig, function(err) {
      if (err) next(err);
      sync(that.sequelize, next);
    });
  } else {
    sync(this.sequelize, next);
  }
};


function sync(sequelize, next) {
  sequelize.sync({ force: true}).success(function(xx){
    log("schema created");
    next(null, sequelize);
  }).error(function(err) {
    console.log("schema creation failed");
    next(err)
  });
}