"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var bodyParser = require("body-parser");
var routes = require("./routes");
var app = express();
var testCaseDir = "C:/git/Breeze/breeze.js/test/";
app.use(bodyParser({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.get('/', function (req, res) {
    res.sendfile(testCaseDir + 'index.sequelize.html');
});
app.get('/breeze/NorthwindIBModel/Metadata', routes.getMetadata);
app.post('/breeze/NorthwindIBModel/SaveChanges', routes.saveChanges);
// app.get('/breeze/NorthwindIBModel/Products', routes.getProducts);
app.post('/breeze/NorthwindIBModel/SaveWithFreight', routes.namedQuery.saveWithFreight);
app.post('/breeze/NorthwindIBModel/SaveWithFreight2', routes.namedQuery.saveWithFreight2);
app.post('/breeze/NorthwindIBModel/SaveWithComment', routes.namedQuery.saveWithComment);
app.post('/breeze/NorthwindIBModel/SaveWithExit', routes.namedQuery.saveWithExit);
app.post('/breeze/NorthwindIBModel/SaveCheckInitializer', routes.namedQuery.saveCheckInitializer);
app.post('/breeze/NorthwindIBModel/SaveWithEntityErrorsException', routes.namedQuery.saveWithEntityErrorsException);
app.post('/breeze/NorthwindIBModel/SaveCheckUnmappedProperty', routes.namedQuery.saveCheckUnmappedProperty);
app.post('/breeze/NorthwindIBModel/SaveCheckUnmappedPropertySerialized', routes.namedQuery.saveCheckUnmappedPropertySerialized);
app.post('/breeze/NorthwindIBModel/SaveCheckUnmappedPropertySuppressed', routes.namedQuery.saveCheckUnmappedPropertySuppressed);
app.get('/breeze/NorthwindIBModel/:slug', noCache, routes.get);
// alt other files
app.get(/^(.+)$/, function (req, res) {
    res.sendfile(testCaseDir + req.params[0]);
});
app.use(logErrors);
app.use(errorHandler);
app.listen(3000);
console.log('Listening on port 3000');
function noCache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}
function errorHandler(err, req, res, next) {
    var status = err.statusCode || 500;
    if (err.message) {
        res.status(status).send(err.message);
    }
    else {
        res.status(status);
    }
}
function logErrors(err, req, res, next) {
    console.error(err.stack);
    next(err);
}
//# sourceMappingURL=server.js.map