/*
 * Copyright 2014 IdeaBlade, Inc.  All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the IdeaBlade Breeze license, available at http://www.breezejs.com/license
 *
 * Author: Jay Traband
 */
var queryModule = require("./mongoQuery");
var saveModule = require("./mongoSaveHandler");
var version;

exports.MongoQuery = queryModule.MongoQuery;
exports.MongoSaveHandler = saveModule.MongoSaveHandler;

try {
    //  version = require("./package.json").version works but everyone seems to use the following technique
    var fs = require('fs');
    version = JSON.parse(fs.readFileSync(__dirname + '/package.json', 'utf8')).version;
} catch (e) {
    version = "0.4.0-x"
}
exports.version = version;
