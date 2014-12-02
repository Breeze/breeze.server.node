var fs = require("fs");
var express = require('express');
var routes = require('./routes');

var app = express();
//Set Request Size Limit

app.use(express.bodyParser({limit: '50mb'}));
// app.use(express.methodOverride());
app.use(app.router);
app.use(logErrors);
app.use(errorHandler);

var testCaseDir = "C:/GitHub/breeze.js/test/"

app.get('/', function(req,res) {
    res.sendfile(testCaseDir + 'index.sequelize.html');
});
app.get('/breeze/NorthwindIBModel/Metadata', routes.getMetadata);
app.post('/breeze/NorthwindIBModel/SaveChanges', routes.saveChanges);

// app.get('/breeze/NorthwindIBModel/Products', routes.getProducts);
app.post('/breeze/NorthwindIBModel/SaveWithFreight', routes.saveWithFreight);
app.post('/breeze/NorthwindIBModel/SaveWithFreight2', routes.saveWithFreight2);
app.post('/breeze/NorthwindIBModel/SaveWithComment', routes.saveWithComment);
app.post('/breeze/NorthwindIBModel/SaveWithExit', routes.saveWithExit);
app.post('/breeze/NorthwindIBModel/SaveCheckInitializer', routes.saveCheckInitializer);
app.post('/breeze/NorthwindIBModel/SaveWithEntityErrorsException', routes.saveWithEntityErrorsException);
app.post('/breeze/NorthwindIBModel/SaveCheckUnmappedProperty', routes.saveCheckUnmappedProperty);
app.post('/breeze/NorthwindIBModel/SaveCheckUnmappedPropertySerialized', routes.saveCheckUnmappedPropertySerialized);
app.post('/breeze/NorthwindIBModel/SaveCheckUnmappedPropertySuppressed', routes.saveCheckUnmappedPropertySuppressed);

app.get('/breeze/NorthwindIBModel/:slug', noCache, routes.get);
// alt other files
app.get(/^(.+)$/, function(req, res) {
    res.sendfile(testCaseDir + req.params[0]);
});

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
      res.send(status, err.message);
  } else {
      res.send(status, err);
  }
}

function logErrors(err, req, res, next) {
    console.error(err.stack);
    next(err);
}