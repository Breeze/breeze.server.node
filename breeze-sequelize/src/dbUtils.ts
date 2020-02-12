import { Options, QueryTypes, Sequelize } from "sequelize";

let utils = require('./utils.js');
let log = utils.log;

// exports.connect = connect;
// exports.createDb = createDb;

/** Config for connecting to a database */
export interface DbConfig {
  dbName: string;
  user: string;
  password: string;
}

/** Connect to existing database.
 *  @returns Promise<"success"> or throws an error */
export async function connect(dbConfig: DbConfig, sequelizeOptions: Options): Promise<string> {

  let sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, sequelizeOptions);
  let statement = 'SELECT 1';
  try {
    const results = await sequelize.query(statement, { type: QueryTypes.RAW });
    log("Connected to database: " + dbConfig.dbName);
    return "success";
  } catch (err) {
    log("Database error: " + dbConfig.dbName + " error: " + err.message);
    throw err;
  }
}

/** Create new database.
 *  @returns Promise<void> or throws an error */
export async function createDb(dbConfig: DbConfig, sequelizeOptions: Options): Promise<void> {
  let sequelize = new Sequelize(null, dbConfig.user, dbConfig.password, sequelizeOptions);
  let statement = 'CREATE DATABASE ' + dbConfig.dbName;
  try {
    await sequelize.query(statement, { type: QueryTypes.RAW });
    log("Database created: " + dbConfig.dbName);
  } catch (err) {
    if (err.message && err.message.indexOf("ER_DB_CREATE_EXISTS") >= 0) {
      log("Database already exists: " + dbConfig.dbName);
    } else {
      log("Database creation error: " + dbConfig.dbName + " error: " + err.message);
      throw err;
    }
  }
}
