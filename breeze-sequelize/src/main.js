
exports.SequelizeQuery = require("./SequelizeQuery.json.js");
exports.SequelizeManager = require("./SequelizeManager.js");
exports.SequelizeSaveHandler = require("./SequelizeSaveHandler.js");
exports.utils = require("./utils.js");
exports.dbUtils = require("./dbUtils");

exports.breeze = require("breeze-client");  // needed because we have augmented breeze in the SequelizeQuery component

exports.Sequelize = exports.SequelizeManager.Sequelize;
