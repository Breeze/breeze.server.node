import { breeze, ComplexType, DataProperty, EntityType, MetadataStore, NavigationProperty, StructuralType } from "breeze-client";
import { AbstractDataType, DataTypes, Model, ModelAttributeColumnOptions, ModelAttributes, ModelCtor, ModelOptions, Sequelize } from "sequelize";
import * as _ from 'lodash';
import * as utils from "./utils";

const log = utils.log;

/** Map name to Sequelize Model type */
export interface NameModelMap { [modelName: string]: ModelCtor<any>; }

// TODO: still need to handle inherited entity types - TPT
/** Maps Breeze metadata to Sequelize Models */
export class MetadataMapper {
  readonly sequelize: Sequelize;
  readonly metadataStore: MetadataStore;
  /** Maps entity type name to Sequelize Model */
  entityTypeSqModelMap: NameModelMap;
  /** Maps resource name to Sequelize Model */
  resourceNameSqModelMap: NameModelMap;

  constructor(breezeMetadata: MetadataStore | string | Object, sequelize: Sequelize) {
    this.sequelize = sequelize;
    let ms;
    if (breezeMetadata instanceof MetadataStore) {
      ms = breezeMetadata;
    } else {
      ms = new breeze.MetadataStore();
      ms.importMetadata(breezeMetadata);
    }

    this.metadataStore = ms;
    this._createMaps();
  }

  /** creates entityTypeSqModelMap and resourceNameSqModelMap */
  private _createMaps() {

    const ms = this.metadataStore;
    const allTypes = ms.getEntityTypes();
    const typeMap = _.groupBy(allTypes, t => {
      return t.isComplexType ? "complexType" : "entityType";
    });
    // let complexTypes = typeMap["complexType"];
    const entityTypes = typeMap["entityType"];

    // map of entityTypeName to sqModel
    const entityTypeSqModelMap: NameModelMap = this.entityTypeSqModelMap = {};
    // first create all of the sequelize types with just data properties
    entityTypes.forEach(entityType => {
      const typeConfig = this.mapToSqModelConfig(entityType);
      const modelName = entityType.shortName;

      // find model in sequelize instance, else create model
      let sqModel: ModelCtor<any>;
      if (this.sequelize.isDefined(modelName)) {
        log("model already defined: ", modelName);
        sqModel = this.sequelize.model(modelName);
      } else {
        const options: ModelOptions = {
          // NOTE: case sensitivity of the table name may not be the same on some sql databases.
          modelName: modelName, // this will define the table's name; see options.define
        };
        log("model not defined: ", modelName);
        sqModel = this.sequelize.define(modelName, typeConfig, options) as ModelCtor<any>;
      }
      entityTypeSqModelMap[entityType.name] = sqModel;

    }, this);
    // now add navigation props
    this.createNavProps(entityTypes, entityTypeSqModelMap);
    // map of breeze resourceName to sequelize model
    this.resourceNameSqModelMap = _.mapValues(ms._resourceEntityTypeMap, (value, key) => {
      return entityTypeSqModelMap[value];
    });

  }

  // source.fn(target, { foreignKey: })
  // hasOne - adds a foreign key to target
  // belongsTo - add a foreign key to source
  // hasMany - adds a foreign key to target, unless you also specifiy that target hasMany source, in which case a junction table is created with sourceId and targetId

  /** Adds relationships to the Models based on Breeze NavigationProperties */
  private createNavProps(entityTypes: StructuralType[], entityTypeSqModelMap: NameModelMap) {
    // TODO: we only support single column foreignKeys for now.

    entityTypes.forEach(entityType => {
      const navProps = entityType.navigationProperties as NavigationProperty[];
      const sqModel = entityTypeSqModelMap[entityType.name];
      navProps.forEach(np => {
        const npName = np.nameOnServer;

        const targetEntityType = np.entityType;
        const targetSqModel = entityTypeSqModelMap[targetEntityType.name];
        if (np.isScalar) {
          if (np.foreignKeyNamesOnServer.length > 0) {
            sqModel.belongsTo(targetSqModel, { as: npName, foreignKey: np.foreignKeyNamesOnServer[0], onDelete: "no action" }); // Product, Category
          } else {
            sqModel.hasOne(targetSqModel, { as: npName, foreignKey: np.invForeignKeyNamesOnServer[0], onDelete: "no action" }); // Order, InternationalOrder
          }
        } else {
          if (np.foreignKeyNamesOnServer.length > 0) {
            throw new Error("not sure what kind of reln this is");
            // sqModel.hasMany(targetSqModel, { as: npName, foreignKey: np.foreignKeyNamesOnServer[0]})
          } else {
            sqModel.hasMany(targetSqModel, { as: npName, foreignKey: np.invForeignKeyNamesOnServer[0], onDelete: "no action" }); // Category, Product
          }
        }
      });
    });

  }

  /** Creates a set of Sequelize attributes based on DataProperties */
  private mapToSqModelConfig(entityOrComplexType: StructuralType): ModelAttributes {
    // propConfig looks like
    //   {   firstProp: { type: Sequelize.XXX, ... },
    //       secondProp: { type: Sequelize.XXX, ... }
    //       ..
    //   }

    const typeConfig = {} as ModelAttributes;
    entityOrComplexType.dataProperties.forEach(dataProperty => {
      const propConfig = this.mapToSqPropConfig(dataProperty);
      _.merge(typeConfig, propConfig);
    });

    return typeConfig;
  }

  /** Creates Sequelize column attributes based on a DataProperty  */
  private mapToSqPropConfig(dataProperty: DataProperty): ModelAttributes {
    if (dataProperty.isComplexProperty) {
      return this.mapToSqModelConfig(dataProperty.dataType as ComplexType);
    }
    const propConfig = {} as ModelAttributes;
    const attributes = {} as ModelAttributeColumnOptions;
    propConfig[dataProperty.nameOnServer] = attributes;
    const sqModel = _dataTypeMap[dataProperty.dataType.name];
    if (sqModel == null) {
      const template = _.template("Unable to map the dataType '${ dataType }' of dataProperty: '${ dataProperty }'");
      throw new Error(template({ dataProperty: dataProperty.parentType.shortName + "." + dataProperty.name, dataType: dataProperty.dataType.name }));
    }
    attributes.type = sqModel;
    if (dataProperty.dataType === breeze.DataType.String && dataProperty.maxLength) {
      attributes.type = DataTypes.STRING(dataProperty.maxLength);
    }
    if (!dataProperty.isNullable) {
      attributes.allowNull = false;
    }
    if (dataProperty.isPartOfKey) {
      attributes.primaryKey = true;
      if ((dataProperty.parentType as EntityType).autoGeneratedKeyType === breeze.AutoGeneratedKeyType.Identity) {
        const dt = attributes.type as AbstractDataType;
        if (dt.key === "INTEGER" || dt.key === "BIGINT") {
          attributes.autoIncrement = true;
        }
      }
    }
    if (dataProperty.defaultValue !== undefined && !dataProperty.isPartOfKey) {
      // if (dataProperty.defaultValue !== undefined) {
      attributes.defaultValue = dataProperty.defaultValue;
    }
    return propConfig;
  }
}


const _dataTypeMap = {
  String: DataTypes.STRING,
  Boolean: DataTypes.BOOLEAN,
  DateTime: DataTypes.DATE,
  DateTimeOffset: DataTypes.DATE,
  Byte: DataTypes.TINYINT.UNSIGNED,
  Int16: DataTypes.SMALLINT,
  Int32: DataTypes.INTEGER,
  Int64: DataTypes.BIGINT,
  Decimal: DataTypes.DECIMAL(19, 4),
  Double: DataTypes.DOUBLE,
  Single: DataTypes.FLOAT,
  Guid: DataTypes.UUID,
  Binary: DataTypes.STRING().BINARY,
  Time: DataTypes.STRING,
  Undefined: DataTypes.BLOB
};
