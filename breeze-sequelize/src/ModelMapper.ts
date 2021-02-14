import { AutoGeneratedKeyType, DataProperty, DataType, EntityType, MetadataStore, NavigationProperty } from "breeze-client";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { DataTypes, ModelAttributeColumnReferencesOptions, ModelType, Sequelize, StringDataType, Utils } from "sequelize";
import { log } from "./utils";

/** Maps Sequelize model definitions to Breeze metadata */
export class ModelMapper {
  readonly metadataStore: MetadataStore;

  constructor(metadataStore: MetadataStore) {
    this.metadataStore = metadataStore;
  }

  /** Load the sequelize instance with the model files from the directory */
  static loadSequelizeModels(sequelize: Sequelize, modeldir: string) {
    const initFile = join(modeldir, "init-models.js");
    if (existsSync(initFile)) {
      // load models via initModels function
      log("loading", initFile);
      const init = require(initFile);
      init.initModels(sequelize);
    } else {
      // load models by requiring each file
      const files = readdirSync(modeldir);
      files.forEach(file => {
        const modelpath = join(modeldir, file);
        log("loading", modelpath);
        const mod = require(modelpath);
        if (typeof mod === "function") {
          mod(sequelize, DataTypes);
        }
      });
    }
  }

  /** Add all the Models in the Sequelize instance to the MetadataStore */
  addModels(sequelize: Sequelize, namespace: string) {
    const models = sequelize.models;
    const modelNames = Object.keys(models);
    modelNames.forEach(name => {
      log(`Adding ${name}`);
      const modelCtor = sequelize.model(name);
      this.addModel(modelCtor, namespace);
    });

    this.addInverseNavigations();
  }

  /** Convert the Sequelize Model to a Breeze EntityType and add it to the MetadataStore */
  addModel(model: ModelType, namespace: string) {
    if (model.options.schema) {
      namespace += "." + model.options.schema;
    }
    const pluralName = Utils.pluralize(model.name);
    const config = {
      shortName: model.name,
      namespace: namespace,
      defaultResourceName: pluralName,
      // baseTypeName - TODO support hierarchy
    };
    const et = new EntityType(config);
    const attrNames = Object.keys(model.rawAttributes);
    const version = model.options.version === true ? "version" : model.options.version;
    attrNames.forEach(attrName => {
      const attr = model.rawAttributes[attrName];
      const dataType = this.mapDataType(attr.type);

      if (!dataType || dataType === DataType.Undefined) {
        log(`Sequelize data type ${attr.type} is not supported.  Model '${model.name}', attr '${attrName}'.`);
      }

      const dp = new DataProperty({
        nameOnServer: attrName,
        isNullable: attr.allowNull,
        isPartOfKey: attr.primaryKey,
        dataType: dataType,
        defaultValue: attr.defaultValue,
      });

      if (version && attrName === version) {
        dp.concurrencyMode = "Fixed";
      }

      const maxLength = this.getLength(attr.type);
      if (maxLength) {
        dp.maxLength = maxLength;
      }

      if (attr.primaryKey && attr.autoIncrement) {
        // Guessing about Identity vs KeyGenerator
        et.autoGeneratedKeyType = dataType.isInteger ? AutoGeneratedKeyType.Identity : AutoGeneratedKeyType.KeyGenerator;
      }

      if (attr.references) {
        // attr is a foreign key
        const ref = attr.references as ModelAttributeColumnReferencesOptions;
        // refName is name of referenced entity, e.g. customer
        const refName = (typeof ref.model === "string") ? ref.model : ref.model.name;

        // use the id property name to make the navigation property name
        let propName: string;
        if (attrName.toLowerCase().endsWith('id')) {
          propName = attrName.substring(0, attrName.length - 2);
        } else {
          propName = this.matchCase(refName, attrName);
          // if there's an existing property, add fk name to property name to make it unique
          if (et.getNavigationProperty(propName)) {
            propName = attr.field + '_' + propName;
          }
        }
        const np = new NavigationProperty({
          associationName: (model.name + '_' + propName + '_' + attrName).toLocaleLowerCase(),
          entityTypeName: refName,
          foreignKeyNamesOnServer: [attrName],
          isScalar: true,
          nameOnServer: propName
        });
        et.addProperty(np);
      }

      et.addProperty(dp);
    });
    this.metadataStore.addEntityType(et);
  }

  /** Create non-scalar navigation properties on the inverse side of the scalar properties,
   * for all EntityTypes in the MetadataStore.
    */
  private addInverseNavigations() {
    const ms = this.metadataStore;
    const entityTypes = this.metadataStore.getEntityTypes().filter(t => !t.isComplexType) as EntityType[];
    entityTypes.forEach(entityType => {
      const navs = entityType.getProperties().filter(p => p.isNavigationProperty && p.isScalar) as NavigationProperty[];

      navs.forEach(nav => {
        // nav is e.g. Order.Customer property
        // inverseName is e.g. "Orders"
        let inverseName = this.matchCase(Utils.pluralize(entityType.shortName), nav.nameOnServer);
        // navType is e.g. Customer
        const navType = ms.getAsEntityType(nav.entityTypeName);

        // inverseNav is e.g. Customer.Orders
        const inverseNav = navType.getNavigationProperty(inverseName);
        if (inverseNav == null || inverseNav.associationName !== nav.associationName) {
          if (inverseNav != null) {
            // already a property with this name, so add uniquifier e.g. Customer_Orders
            inverseName = nav.name + '_' + inverseName;
          }

          const np = new NavigationProperty({
            associationName: nav.associationName,
            entityTypeName: entityType.name,
            invForeignKeyNames: nav.foreignKeyNames,
            isScalar: false,
            nameOnServer: inverseName
          });

          navType.addProperty(np);
        }

      });
    });
  }

  /** Make the first char of s match the case of the first char of the target string */
  private matchCase(s: string, target: string): string {
    if (/^[A-Z]/.test(target)) {
      s = s[0].toUpperCase() + s.substring(1);
    } else {
      s = s[0].toLowerCase() + s.substring(1);
    }
    return s;
  }

  /** Return the Breeze DataType for the given Sequelize DataType */
  private mapDataType(sqDataType: DataTypes.DataType): DataType {
    let name = (typeof sqDataType === "string") ? sqDataType as string : sqDataType.key;
    let type = this.dataTypeMap[name];
    if (!type) {
      // if type is e.g. NCHAR(5), try without the (5)
      const p = name.indexOf('(');
      if (p > 0) {
        name = name.substring(0, p);
        type = this.dataTypeMap[name];
      }
    }
    return type;
  }

  /** For string data types, return the length, else undefined */
  private getLength(sqDataType: DataTypes.DataType): number {
    if (typeof sqDataType === "string" || (sqDataType.key !== "STRING" && sqDataType.key !== "CHAR")) {
      return undefined;
    }
    const stringType = sqDataType as StringDataType;
    return stringType.options && stringType.options.length;
  }

  /** Map from Sequelize DataTypes.DataType to Breeze DataType*/
  private dataTypeMap = {
    "STRING": DataType.String,
    "CHAR": DataType.String,
    "NCHAR": DataType.String,
    "TEXT": DataType.String,
    "NUMBER": DataType.Decimal,
    "TINYINT": DataType.Byte,
    "SMALLINT": DataType.Int16,
    "MEDIUMINT": DataType.Int32, // 24 bits in Sequelize
    "INTEGER": DataType.Int32,
    "BIGINT": DataType.Int64,
    "FLOAT": DataType.Single,
    "REAL": DataType.Single,
    "DOUBLE": DataType.Double,
    "DECIMAL": DataType.Decimal,
    "MONEY": DataType.Decimal,
    "SMALLMONEY": DataType.Decimal,
    "BOOLEAN": DataType.Boolean,
    "TIME": DataType.Time,
    "DATE": DataType.DateTime,
    "DATEONLY": DataType.DateTime,
    "HSTORE": DataType.Undefined, // not supported
    "JSON": DataType.String,
    "JSONB": DataType.String,
    "NOW": DataType.DateTimeOffset,
    "BLOB": DataType.Binary,
    "LONGBLOB": DataType.Binary,
    "IMAGE": DataType.Binary,
    "VARBINARY": DataType.Binary,
    "RANGE": DataType.Undefined, // not supported
    "UUID": DataType.Guid,
    "UUIDV1": DataType.Guid,
    "UUIDV4": DataType.Guid,
    "VIRTUAL": DataType.String, // not stored in DB; has subtype of actual data type
    "ENUM": DataType.String,
    "ARRAY": DataType.Undefined, // not supported; should use complex type for this
    "GEOMETRY": DataType.String, // TODO what type should this be?
    "GEOGRAPHY": DataType.String,
    "CIDR": DataType.String,
    "INET": DataType.String,
    "MACADDR": DataType.String,
    "CITEXT": DataType.String,
  };

}