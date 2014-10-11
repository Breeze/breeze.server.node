var fs = require("fs");
var express = require('express');
var app = express();
var routes = require('./routes');

app.use(express.bodyParser());
// app.use(express.methodOverride());
app.use(app.router);
app.use(logErrors);
app.use(errorHandler);

var testCaseDir = "C:/GitHub/breeze.js/test/"

app.get('/', function(req,res) {
    res.sendfile(testCaseDir + 'index.sequelize.html');
});
app.get('/breeze/NorthwindIBModel/Metadata', routes.getMetadata);
//app.get('/breeze/NorthwindIBModel/Products', routes.getProducts);
//app.post('/breeze/NorthwindIBModel/SaveChanges', routes.saveChanges);
//app.post('/breeze/NorthwindIBModel/SaveWithFreight', routes.saveWithFreight);
//app.post('/breeze/NorthwindIBModel/SaveWithFreight2', routes.saveWithFreight2);
//app.post('/breeze/NorthwindIBModel/SaveWithComment', routes.saveWithComment);
//app.post('/breeze/NorthwindIBModel/SaveWithExit', routes.saveWithExit);

app.get('/breeze/NorthwindIBModel/:slug', routes.get);
// alt other files
app.get(/^(.+)$/, function(req, res) {
    res.sendfile(testCaseDir + req.params[0]);
});

app.listen(3000);
console.log('Listening on port 3000');


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