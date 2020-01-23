import { breeze, ComplexType, DataProperty, EntityType, MetadataStore, NavigationProperty, StructuralType } from "breeze-client";
import { AbstractDataType, DataTypes, Model, ModelAttributeColumnOptions, ModelAttributes, ModelOptions, Sequelize } from "sequelize";
import * as _ from 'lodash';
import * as utils from "./utils";

let log = utils.log;

export interface NameModelMap { [modelName: string]: { new(): Model } & typeof Model };

// TODO: still need to handle inherited entity types - TPT
/** Maps Breeze metadata to Sequelize Models */
export class MetadataMapper {
  sequelize: Sequelize
  metadataStore: MetadataStore;
  entityTypeSqModelMap: NameModelMap;
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

    let ms = this.metadataStore;
    let allTypes = ms.getEntityTypes();
    let typeMap = _.groupBy(allTypes, t => {
      return t.isComplexType ? "complexType" : "entityType";
    });
    // let complexTypes = typeMap["complexType"];
    let entityTypes = typeMap["entityType"];

    // map of entityTypeName to sqModel
    let entityTypeSqModelMap: NameModelMap = this.entityTypeSqModelMap = {};
    // first create all of the sequelize types with just data properties
    entityTypes.forEach(entityType => {
      let typeConfig = this.mapToSqModelConfig(entityType);
      let options: ModelOptions = {
        // NOTE: case sensitivity of the table name may not be the same on some sql databases.
        modelName: entityType.shortName, // this will define the table's name; see options.define
      };
      let sqModel = this.sequelize.define(entityType.shortName, typeConfig, options) as { new(): Model } & typeof Model;
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
      let navProps = entityType.navigationProperties as NavigationProperty[];
      let sqModel = entityTypeSqModelMap[entityType.name];
      navProps.forEach(np => {
        let npName = np.nameOnServer;

        let targetEntityType = np.entityType;
        let targetSqModel = entityTypeSqModelMap[targetEntityType.name];
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
            sqModel.hasMany(targetSqModel, { as: npName, foreignKey: np.invForeignKeyNamesOnServer[0], onDelete: "no action" }) // Category, Product
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

    let typeConfig = {} as ModelAttributes;
    entityOrComplexType.dataProperties.forEach(dataProperty => {
      let propConfig = this.mapToSqPropConfig(dataProperty);
      _.merge(typeConfig, propConfig);
    });

    return typeConfig;
  }

  /** Creates Sequelize column attributes based on a DataProperty  */
  private mapToSqPropConfig(dataProperty: DataProperty): ModelAttributes {
    if (dataProperty.isComplexProperty) {
      return this.mapToSqModelConfig(dataProperty.dataType as ComplexType);
    }
    let propConfig = {} as ModelAttributes;
    let attributes = {} as ModelAttributeColumnOptions;
    propConfig[dataProperty.nameOnServer] = attributes;
    let sqModel = _dataTypeMap[dataProperty.dataType.name];
    if (sqModel == null) {
      let template = _.template("Unable to map the dataType '${ dataType }' of dataProperty: '${ dataProperty }'");
      throw new Error(template({ dataProperty: dataProperty.parentType.shortName + "." + dataProperty.name, dataType: dataProperty.dataType.name }));
    }
    attributes.type = sqModel;
    if (dataProperty.dataType == breeze.DataType.String && dataProperty.maxLength) {
      attributes.type = DataTypes.STRING(dataProperty.maxLength);
    }
    if (!dataProperty.isNullable) {
      attributes.allowNull = false;
    }
    if (dataProperty.isPartOfKey) {
      attributes.primaryKey = true;
      if ((dataProperty.parentType as EntityType).autoGeneratedKeyType == breeze.AutoGeneratedKeyType.Identity) {
        let dt = attributes.type as AbstractDataType;
        if (dt.key == "INTEGER" || dt.key == "BIGINT") {
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


let _dataTypeMap = {
  String: DataTypes.STRING,
  Boolean: DataTypes.BOOLEAN,
  DateTime: DataTypes.DATE,
  DateTimeOffset: DataTypes.DATE,
  Byte: DataTypes.INTEGER.UNSIGNED,
  Int16: DataTypes.INTEGER,
  Int32: DataTypes.INTEGER,
  Int64: DataTypes.BIGINT,
  Decimal: DataTypes.DECIMAL(19, 4),
  Double: DataTypes.FLOAT,
  Single: DataTypes.FLOAT,
  Guid: DataTypes.UUID,
  Binary: DataTypes.STRING().BINARY,
  Time: DataTypes.STRING,
  Undefined: DataTypes.BLOB
};