
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import * as  bodyParser  from 'body-parser';

import * as routes from "./routes"

var app = express();
var testCaseDir = "C:/git/Breeze/breeze.js/test/";

app.use(bodyParser({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function (req: Request, res: Response) {
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
app.get(/^(.+)$/, function (req: Request, res: Response) {
  res.sendfile(testCaseDir + req.params[0]);
});

app.use(logErrors);
app.use(errorHandler);

app.listen(3000);
console.log('Listening on port 3000');

function noCache(req: Request, res: Response, next: NextFunction) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  var status = err.statusCode || 500;
  if (err.message) {
    res.status(status).send(err.message);
  } else {
    res.status(status);
  }
}

function logErrors(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err.stack);
  next(err);
}