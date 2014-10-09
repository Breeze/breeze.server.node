var Sequelize    = require('sequelize');

var breeze       = require("breeze-client");
var utils        = require('./utils.js');

var _            = Sequelize.Utils._;
var log = utils.log;

// TODO: still need to handle inherited entity types - TPT

module.exports = MetadataMapper = function(breezeMetadata, sequelize) {

  this.sequelize = sequelize;
  var ms;
  if (breezeMetadata instanceof breeze.MetadataStore) {
    ms = breezeMetadata;
  } else {
    var ms = new breeze.MetadataStore();
    ms.importMetadata(breezeMetadata);
  }

  this.metadataStore = ms;
  this._createMaps();
}

MetadataMapper.prototype._createMaps = function() {
  // creates entityTypeSqModelMap and resourceNameSqModelMap

  var ms = this.metadataStore;
  var allTypes = ms.getEntityTypes();
  var typeMap = _.groupBy(allTypes, function(t) {
    return t.isComplexType ? "complexType" : "entityType";
  });
  var complexTypes = typeMap["complexType"];
  var entityTypes = typeMap["entityType"];

  // map of entityTypeName to sqModel
  var entityTypeSqModelMap = this.entityTypeSqModelMap = {};
  // first create all of the sequelize types with just data properties
  entityTypes.forEach(function(entityType) {
    var typeConfig = mapToSqModelConfig(this, entityType);
    var options = {
      // NOTE: case sensitivity of the table name may not be the same on some sql databases.
      tableName: entityType.shortName, // this will define the table's name
      timestamps: false           // this will deactivate the timestamp columns
    };
    var sqModel = this.sequelize.define(entityType.shortName, typeConfig, options);
    entityTypeSqModelMap[entityType.name] = sqModel;

  }, this);
  // now add navigation props
  createNavProps(entityTypes, entityTypeSqModelMap);
  // map of breeze resourceName to sequelize model
  this.resourceNameSqModelMap = _.mapValues(ms._resourceEntityTypeMap, function(value, key) {
    return entityTypeSqModelMap[value];
  });

};

// source.fn(target, { foreignKey: })
// hasOne - adds a foreign key to target
// belongsTo - add a foreign key to source
// hasMany - adds a foreign key to target, unless you also specifiy that target hasMany source, in which case a junction table is created with sourceId and targetId

// entityTypeMap is a map of entityType.name to sequelize model
function createNavProps(entityTypes, entityTypeSqModelMap) {
  // TODO: we only support single column foreignKeys for now.

  entityTypes.forEach(function(entityType) {
    var navProps = entityType.navigationProperties;
    var sqModel = entityTypeSqModelMap[entityType.name];
    navProps.forEach(function(np) {
      var npName = np.nameOnServer;

      var targetEntityType = np.entityType;
      var targetSqModel = entityTypeSqModelMap[targetEntityType.name];
      if (np.isScalar) {
        if (np.foreignKeyNamesOnServer.length > 0) {
          sqModel.belongsTo(targetSqModel, { as: npName, foreignKey: np.foreignKeyNamesOnServer[0], onDelete: "no action" }); // Product, Category
        } else {
          sqModel.hasOne(targetSqModel, { as: npName, foreignKey: np.invForeignKeyNamesOnServer[0], onDelete: "no action" }); // Order, InternationalOrder
        }
      } else {
        if ( np.foreignKeyNamesOnServer.length > 0) {
          throw new Error("not sure what kind of reln this is");
          // sqModel.hasMany(targetSqModel, { as: npName, foreignKey: np.foreignKeyNamesOnServer[0]})
        } else {
          sqModel.hasMany(targetSqModel, { as: npName, foreignKey: np.invForeignKeyNamesOnServer[0], onDelete: "no action"}) // Category, Product
        }
      }
    });
  });
}

function mapToSqModelConfig(mapper, entityOrComplexType) {
  // propConfig looks like
  //   {   firstProp: { type: Sequelize.XXX, ... },
  //       secondProp: { type: Sequelize.XXX, ... }
  //       ..
  //   }

  var typeConfig = {};
  entityOrComplexType.dataProperties.forEach(function(dataProperty) {
    var propConfig = mapToSqPropConfig(mapper,  dataProperty);
    _.merge(typeConfig, propConfig);
  });

  return typeConfig;
}

function mapToSqPropConfig(mapper, dataProperty) {
  if (dataProperty.isComplexProperty) {
    return mapToSqModelConfig(mapper, dataProperty.dataType);
  }
  var propConfig = {};
  var attributes = {};
  propConfig[dataProperty.nameOnServer] = attributes;
  var sqModel = _dataTypeMap[dataProperty.dataType.name];
  if (sqModel == null) {
    var template = _.template("Unable to map the dataType '${ dataType }' of dataProperty: '${ dataProperty }'");
    throw new Error( template({ dataProperty: dataProperty.parentType.shortName + "." + dataProperty.name, dataType: dataProperty.dataType.name }));
  }
  attributes.type = sqModel;
  if (dataProperty.dataType == breeze.DataType.String && dataProperty.maxLength) {
    attributes.type = Sequelize.STRING(dataProperty.maxLength);
  }
  if (!dataProperty.isNullable) {
    attributes.allowNull = false;
  }
  if (dataProperty.isPartOfKey) {
    attributes.primaryKey = true;
    if (dataProperty.parentType.autoGeneratedKeyType == breeze.AutoGeneratedKeyType.Identity) {

      if (attributes.type == "INTEGER" || attributes.type=="BIGINT") {
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

var _dataTypeMap = {
  String: Sequelize.STRING,
  Boolean: Sequelize.BOOLEAN,
  DateTime: Sequelize.DATE,
  DateTimeOffset: Sequelize.DATE,
  Byte: Sequelize.INTEGER.UNSIGNED,
  Int16: Sequelize.INTEGER,
  Int32: Sequelize.INTEGER,
  Int64: Sequelize.BIGINT,
  Decimal: Sequelize.DECIMAL(19,4),
  Double: Sequelize.FLOAT,
  Single: Sequelize.FLOAT,
  Guid: Sequelize.UUID,
  Binary: Sequelize.STRING.BINARY,
  Time: Sequelize.STRING,
  Undefined: Sequelize.BLOB
};