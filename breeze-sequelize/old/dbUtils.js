var Sequelize  = require('sequelize');
var Promise    = require('bluebird');

var utils        = require('./utils.js');
var log = utils.log;

exports.connect = connect;
exports.createDb = createDb;

// returns a Promise(connection)
function connect(dbConfig, sequelizeOptions) {

  var sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, sequelizeOptions);
  var statement = 'SELECT 1';
  return sequelize.query(statement, { type: sequelize.QueryTypes.RAW}).then(function(results) {
    log("Connected to database: " + dbConfig.dbName);
    return "success";
  }).error(function(err) {
      log("Database error: " + dbConfig.dbName + " error: " + err.message);
      throw err;
  });
};

// return promise(null);
function createDb(dbConfig, sequelizeOptions) {
  var sequelize = new Sequelize(null, dbConfig.user, dbConfig.password, sequelizeOptions);
  var statement = 'CREATE DATABASE ' + dbConfig.dbName;
  return sequelize.query(statement, { type: sequelize.QueryTypes.RAW}).then(function() {
    log("Database created: " + dbConfig.dbName);
  }).error(function(err) {
    if (err.message && err.message.indexOf("ER_DB_CREATE_EXISTS") >= 0) {
      log("Database already exists: " + dbConfig.dbName);
    } else {
      log("Database creation error: " + dbConfig.dbName + " error: " + err.message);
      throw err;
    }
  });
};

// old version using node 'next' semantics.
// next => function(err, connection);
//function createDb(dbConfig, next ) {
//  connect(dbConfig, function(err, connection) {
//    if (err)  return next(err);
//
//    connection.query('CREATE DATABASE ' + dbConfig.dbName, function(err, results) {
//      if (err && err.code != "ER_DB_CREATE_EXISTS") {
//        log("Database creation error: " + err.message);
//        next(err);
//      }
//      log("database created OR already exists.");
//      next(null, connection);
//    });
//  });
//}

