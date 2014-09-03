var mysql      = require('mysql');
var utils        = require('./utils.js');
var log = utils.log;

exports.connect = connect;
exports.createDb = createDb;

function connect(dbConfig, done) {
  var connection = mysql.createConnection(dbConfig);

  connection.on('error', function(err) {
    log("Unable to connect to mySql (on err):" + err.code); // 'ER_BAD_DB_ERROR'
  });

  connection.connect(function(err) {
    if (err) {
      log("Unable to connect to mySql");
      return done(err);
    }

    log("mysql connected: " + dbConfig.host);
    done(null, connection);
  });
}

function createDb(dbConfig, done ) {
  connect(dbConfig, function(err, connection) {
    if (err)  return done(err);

    connection.query('CREATE DATABASE ' + dbConfig.dbName, function(err, results) {
      if (err && err.code != "ER_DB_CREATE_EXISTS") {
        log("Database creation error: " + err.message);
        done(err);
      }
      log("database created OR already exists.");
      done(null, connection);
    });
  });
}

