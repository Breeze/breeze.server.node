var Sequelize      = require('sequelize');
var breeze         = require("breeze-client");
var Promise        = require("bluebird");

var MetadataMapper = require('./MetadataMapper.js');
var dbUtils        = require('./dbUtils.js');
var utils          = require('./utils.js');

var _             = Sequelize.Utils._;
var log = utils.log;

module.exports = SequelizeManager;

function SequelizeManager(dbConfig, sequelizeOptions) {
  var defaultOptions = {
    dialect: "mysql", // or 'sqlite', 'postgres', 'mariadb'
    port: 3306, // or 5432 (for postgres)
    // omitNull: true,
    logging: console.log
  };
  this.sequelizeOptions = _.extend(defaultOptions, sequelizeOptions || {});
  this.dbConfig = dbConfig;
  this.sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, this.sequelizeOptions);
}

// Expose Sequelize from outside
SequelizeManager.Sequelize = Sequelize;

// returns Promise(null);
SequelizeManager.prototype.authenticate = function() {
  // check database connection
  return this.sequelize.authenticate().then(function() {
    log('Connection has been established successfully.');
  }).error(function(err) {
    log('Unable to connect to the database:', err);
    throw err;
  });

};

SequelizeManager.prototype.createDb = function() {
  return dbUtils.createDb(this.dbConfig);
};

SequelizeManager.prototype.importMetadata = function(breezeMetadata) {
  var metadataMapper = new MetadataMapper(breezeMetadata, this.sequelize);
  // TODO: should we merge here instead ; i.e. allow multiple imports...
  this.models = this.resourceNameSqModelMap = metadataMapper.resourceNameSqModelMap;
  this.entityTypeSqModelMap = metadataMapper.entityTypeSqModelMap;
  this.metadataStore = metadataMapper.metadataStore;

};

// returns Promise(sequelize);
SequelizeManager.prototype.sync = function(shouldCreateDb) {
  if (shouldCreateDb) {
    var that = this;
    return this.createDb().then(function() {
      return syncCore(that.sequelize);
    });
  } else {
    return syncCore(this.sequelize);
  }
};

// returns Promise(sequelize);
function syncCore(sequelize) {

  return sequelize.sync({ force: true}).then(function() {
    log("schema created");
    return sequelize;
  }).catch(function(err) {
    console.log("schema creation failed");
    throw err;
  });
}

