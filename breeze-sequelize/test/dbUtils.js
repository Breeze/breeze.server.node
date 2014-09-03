
var mysql      = require('mysql');
exports.connect = connect;
exports.createDb = createDb;

function connect(dbConfig, done) {
  var connection = mysql.createConnection(dbConfig);

  connection.on('error', function(err) {
    console.log(err.code); // 'ER_BAD_DB_ERROR'
  });

  connection.connect(function(err) {
    if (err) {
      console.log("ERROR: " + err.message);
      done(err);
    }
    console.log("connected.");
    done(null, connection);
  });
}

function createDb(dbConfig, done ) {
  connect(dbConfig, function(err, connection) {
    connection.query('CREATE DATABASE ' + dbConfig.dbName, function(err, results) {
      if (err && err.code != "ER_DB_CREATE_EXISTS") {
        console.log("ERROR: " + err.message);
        done(err);
      }
      console.log("database created OR already exists.");
      done(null, connection);
    });
  });
}