var mysql      = require('mysql');

var utils        = require('./utils.js');
var log = utils.log;

exports.connect = connect;
exports.createDb = createDb;

// next => function(err, connection);
function connect(dbConfig, next) {
  var connection = mysql.createConnection(dbConfig);

  connection.on('error', function(err) {
    log("Unable to connect to mySql (on err):" + err.code); // 'ER_BAD_DB_ERROR'
  });

  connection.connect(function(err) {
    if (err) {
      log("Unable to connect to mySql");
      return next(err);
    }

    log("mysql connected: " + dbConfig.host);
    next(null, connection);
  });
}

// next => function(err, connection);
function createDb(dbConfig, next ) {
  connect(dbConfig, function(err, connection) {
    if (err)  return next(err);

    connection.query('CREATE DATABASE ' + dbConfig.dbName, function(err, results) {
      if (err && err.code != "ER_DB_CREATE_EXISTS") {
        log("Database creation error: " + err.message);
        next(err);
      }
      log("database created OR already exists.");
      next(null, connection);
    });
  });
}

