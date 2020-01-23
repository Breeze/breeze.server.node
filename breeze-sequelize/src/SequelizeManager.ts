import { Sequelize, Options, SyncOptions } from "sequelize";
import { MetadataStore, DataProperty } from "breeze-client";
import { DbConfig, createDb } from "./dbUtils";
import { MetadataMapper, NameModelMap } from "./MetadataMapper";

import * as _ from 'lodash';
import * as utils from "./utils";
let log = utils.log;

export interface KeyGenerator {
  getNextId: (prop: DataProperty) => any;
}

/** Manages the Sequelize instance for Breeze query and save operations */
export class SequelizeManager {
  static Sequelize = Sequelize;
  sequelizeOptions: Options;
  dbConfig: DbConfig;
  sequelize: Sequelize;
  models: NameModelMap;
  resourceNameSqModelMap: NameModelMap;
  entityTypeSqModelMap: NameModelMap;
  metadataStore: MetadataStore;
  keyGenerator: KeyGenerator;

  constructor(dbConfig: DbConfig, sequelizeOptions: Options) {
    let defaultOptions: Options = {
      dialect: "mysql", // or 'sqlite', 'postgres', 'mariadb'
      port: 3306, // or 5432 (for postgres)
      // omitNull: true,
      logging: console.log,
      dialectOptions: { decimalNumbers: true },
      define: {
        freezeTableName: true,  // prevent sequelize from pluralizing table names
        timestamps: false       // deactivate the timestamp columns (createdAt, etc.)
      }
    };
    let define = defaultOptions.define;
    this.sequelizeOptions = _.extend(defaultOptions, sequelizeOptions || {});
    this.sequelizeOptions.define = _.extend(define, (sequelizeOptions && sequelizeOptions.define) || {});
    this.dbConfig = dbConfig;
    this.sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, this.sequelizeOptions);
  }

  /** Connect to the database */
  authenticate(): Promise<void> {
    // check database connection
    return this.sequelize.authenticate().then(() => {
      log('Connection has been established successfully.');
    }).error(err => {
      log('Unable to connect to the database:', err);
      throw err;
    });
  }

  /** Create a new database */
  createDb() {
    return createDb(this.dbConfig, this.sequelizeOptions);
  }

  /** Convert Breeze metadata to Sequelize models */
  importMetadata(breezeMetadata: MetadataStore | string | Object) {
    let metadataMapper = new MetadataMapper(breezeMetadata, this.sequelize);
    // TODO: should we merge here instead ; i.e. allow multiple imports...
    this.models = this.resourceNameSqModelMap = metadataMapper.resourceNameSqModelMap;
    this.entityTypeSqModelMap = metadataMapper.entityTypeSqModelMap;
    this.metadataStore = metadataMapper.metadataStore;
  }

  /** Sync the Sequelize model with the database */
  sync(shouldCreateDb: boolean, sequelizeOpts: SyncOptions): Promise<Sequelize> {
    if (shouldCreateDb) {
      return this.createDb().then(() => {
        return this.syncCore(this.sequelize, sequelizeOpts);
      });
    } else {
      return this.syncCore(this.sequelize, sequelizeOpts);
    }
  }

  private syncCore(sequelize: Sequelize, sequelizeOpts: SyncOptions): Promise<Sequelize> {
    let defaultOptions = { force: true };
    sequelizeOpts = _.extend(defaultOptions, sequelizeOpts || {});

    return sequelize.sync(sequelizeOpts).then(() => {
      log("schema created");
      return sequelize;
    }).catch(err => {
      console.log("schema creation failed");
      throw err;
    });

  }
}

