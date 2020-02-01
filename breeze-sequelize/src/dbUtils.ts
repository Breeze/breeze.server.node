import { Options, QueryTypes, Sequelize } from "sequelize";

let utils = require('./utils.js');
let log = utils.log;

exports.connect = connect;
exports.createDb = createDb;

/** Config for connecting to a database */
export interface DbConfig {
  dbName: string;
  user: string;
  password: string;
}

/** Connect to existing database.
 *  @returns Promise<"success"> or throws an error */
export function connect(dbConfig: DbConfig, sequelizeOptions: Options): Promise<string> {

  let sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, sequelizeOptions);
  let statement = 'SELECT 1';
  return sequelize.query(statement, { type: QueryTypes.RAW }).then(function (results) {
    log("Connected to database: " + dbConfig.dbName);
    return "success";
  }).error(function (err) {
    log("Database error: " + dbConfig.dbName + " error: " + err.message);
    throw err;
  });
};

/** Create new database.
 *  @returns Promise<void> or throws an error */
export function createDb(dbConfig: DbConfig, sequelizeOptions: Options): Promise<void> {
  let sequelize = new Sequelize(null, dbConfig.user, dbConfig.password, sequelizeOptions);
  let statement = 'CREATE DATABASE ' + dbConfig.dbName;
  return sequelize.query(statement, { type: QueryTypes.RAW }).then(() => {
    log("Database created: " + dbConfig.dbName);
  }).error(err => {
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

