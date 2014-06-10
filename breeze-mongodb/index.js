/*
 * Copyright 2014 IdeaBlade, Inc.  All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the IdeaBlade Breeze license, available at http://www.breezejs.com/license
 *
 * Author: Jay Traband
 */
var queryModule = require("./mongoQuery");
var saveModule = require("./mongoSaveHandler");

exports.MongoQuery = queryModule.MongoQuery;
exports.MongoSaveHandler = saveModule.MongoSaveHandler;
exports.version = "1.4.13";
