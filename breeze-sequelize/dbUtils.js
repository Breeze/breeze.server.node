
var Promise    = require('bluebird');
var mysql      = require('mysql');
Promise.promisifyAll(require("mysql/lib/Connection").prototype);
Promise.promisifyAll(require("mysql/lib/Pool").prototype);

var utils        = require('./utils.js');
var log = utils.log;

exports.connect = connect;
exports.createDb = createDb;

// returns a Promise(connection)
function connect(dbConfig) {
  var connection = mysql.createConnection(dbConfig);

  connection.on('error', function(err) {
    log("Unable to connect to mySql (on err):" + err.code); // 'ER_BAD_DB_ERROR'
  });

  // promisified connect
  return connection.connectAsync().then(function() {
    log("mysql connected: " + dbConfig.host);
    return connection;
  }).error(function(err) {
    log("Unable to connect to mySql:" + err);
    throw err;
  });
}

// return promise(null);
function createDb(dbConfig) {
  return connect(dbConfig).then(function(connection) {
    // promisified query
    return connection.queryAsync('CREATE DATABASE ' + dbConfig.dbName);
  }).then(function() {

  }).then(function() {
    log("Database created: " + dbConfig.dbName);
  }).error(function(err) {
    if (err.cause && err.cause.code == "ER_DB_CREATE_EXISTS") {
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

