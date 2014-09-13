var fs               = require('fs');
var expect           = require('chai').expect;
var breeze           = require('breeze-client');
var Sequelize        = require('sequelize');
var utils            = require('./../utils.js');
//var dbUtils          = require('./../dbUtils.js');
//var SequelizeManager = require('./../SequelizeManager');
var SequelizeQuery  = require('./../SequelizeQuery.js');

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var FilterQueryOp = breeze.FilterQueryOp;

var _ = Sequelize.Utils._;
var log = utils.log;
// log.enabled = false;

describe.only("predicate tests", function() {
  this.enableTimeouts(false);

  var _ms;
  var _em;
  before(function() {
    _em = new EntityManager();
    _ms = _em.metadataStore;
    var breezeMetadata = fs.readFileSync('./sampleMetadata.json', { encoding: 'utf8' });
    _ms.importMetadata(breezeMetadata);
  });

  it("simple binary predicate - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { freight: 100});
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("Freight eq 100m");
  });

  it("simple binary predicate 2", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate("freight", ">", 100);
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("Freight gt 100m");
  });

  it("simple binary predicate 2 - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { freight: { ">" : 100}});
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("Freight gt 100m");
  });

  it("complex binary predicate 2 - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { freight: { ">" : 100, "<": 200 }});
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("(Freight gt 100m) and (Freight lt 200m)");
  });

  it("complex binary predicate 2 - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate(
        {
          freight: {
            ">": 100, "<": 200
          },
          shippedDate: new Date(1998, 3, 1)
        }
    );
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("((Freight gt 100m) and (Freight lt 200m)) and (ShippedDate eq datetime'1998-04-01T07:00:00.000Z')");
  });

  it("complex binary predicate with 3 way and - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate(
        {
          freight: { ">": 100},
          rowVersion: { $lt: 10},
          shippedDate: new Date(1998, 3, 1)
        }
    );
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("(Freight gt 100m) and (RowVersion lt 10) and (ShippedDate eq datetime'1998-04-01T07:00:00.000Z')");
  });

  it("simple binary predicate with not", function() {
    var orderType = _ms.getEntityType("Order");
    var p = (new Predicate("freight", ">", 100)).not();
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("not (Freight gt 100m)");
  });

  it("simple binary predicate with not - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { not: { freight: { ">":  100}}});
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("not (Freight gt 100m)");
  });

  it("simple binary predicate - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = Predicate( { freight: { $gt: 100} });
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("Freight gt 100m");
  });

  it("and/or predicate - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = Predicate.create(
        { $and:
            [ { freight: { $gt: 100} },
              { shipCity: { startsWith: 'S'} }
            ]
        });
    var frag = p.toODataFragment(orderType);
    expect(frag).to.eql("(Freight gt 100m) and (startswith(ShipCity,'S') eq true)");
  });

  it("contains", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("companyName", 'contains', "'");
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("substringof('''',CompanyName) eq true");
  });

  it("contains - json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create( {companyName: { 'contains':  "'"}});
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("substringof('''',CompanyName) eq true");
  });

  it("date comparisons", function() {
    var entityType = _ms.getEntityType("Order");
    var p = Predicate.create("orderDate", ">", new Date(1998, 3, 1));
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("OrderDate gt datetime'1998-04-01T07:00:00.000Z'");
  });

  it("date comparisons", function() {
    var entityType = _ms.getEntityType("Order");
    var p = Predicate.create( { "orderDate": { ">":  new Date(1998, 3, 1)}});
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("OrderDate gt datetime'1998-04-01T07:00:00.000Z'");
  });

  it("anding 1", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p2 = Predicate.create("city", "contains", "er");
    var p = p1.and(p2);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(startswith(CompanyName,'S') eq true) and (substringof('er',City) eq true)");
  });

  it("anding 2", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p = p1.and("city", "contains", "er");
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(startswith(CompanyName,'S') eq true) and (substringof('er',City) eq true)");
  });

  it("anding 3", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p = p1.and({ city: { contains: "er" }});
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(startswith(CompanyName,'S') eq true) and (substringof('er',City) eq true)");
  });

  it("or 4", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p2 = Predicate.create("companyName", "startsWith", "T");
    var p3 = Predicate.create("companyName", "startsWith", "U");
    var p = Predicate.or([p1, p2, p3]);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(startswith(CompanyName,'S') eq true) or (startswith(CompanyName,'T') eq true) or (startswith(CompanyName,'U') eq true)");
  });

  it("or 4 - json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 =  {companyName: { startsWith: "S"}};
    var p2 =  {companyName: { startsWith: "T"}};
    var p3 =  {companyName: { startsWith: "U"}};
    var p = Predicate.or([p1, p2, p3]);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(startswith(CompanyName,'S') eq true) or (startswith(CompanyName,'T') eq true) or (startswith(CompanyName,'U') eq true)");
  });

  it("null comparisons", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = new Predicate("region", FilterQueryOp.Equals, null);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Region eq null");
  });

  it("nested comparisons", function() {
    var entityType = _ms.getEntityType("Order");
    var p = new Predicate("customer.region", "==", "CA");
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Customer/Region eq 'CA'");
  });

  it("nested comparisons - json", function() {
    var entityType = _ms.getEntityType("Order");
    var p = new Predicate( { "customer.region": "CA"});
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Customer/Region eq 'CA'");
  });

  it("two field comparison", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("lastName", 'startsWith', "firstName");
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("startswith(LastName,FirstName) eq true");
  });

  it("two field comparison w/literal", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("lastName", "startsWith", { value: "firstName", isLiteral: true })
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("startswith(LastName,'firstName') eq true");
  });

  it("predicate functions 1", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("month(hireDate)", ">", 6);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("month(HireDate) gt 6");
  });

  it("predicate functions 2", function() {
    var entityType = _ms.getEntityType("Employee");
    var p1 = Predicate.create("month(hireDate)", ">", 6);
    var p = p1.and("month(hireDate)", "<", 11);
    // var p = Predicate.create("month(hireDate)", ">", 6).and("month(hireDate)", "<", 11);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(month(HireDate) gt 6) and (month(HireDate) lt 11)");
  });

  it("any/all functions 1", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "freight",  ">", 950);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Orders/any(x1: x1/Freight gt 950m)");
  });

  it("any/all functions 2", function() {
    var entityType = _ms.getEntityType("Customer");
    var p2 = Predicate.create("freight", "==", 10);
    var p1 = Predicate.create("orders", "all", p2);
    var p = Predicate.create("companyName", "contains", "ar").and(p1);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(substringof('ar',CompanyName) eq true) and (Orders/all(x1: x1/Freight eq 10m))");
  });

  it("any/all functions 2 - json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p2 = { and: [
          { companyName: { contains: "ar" }},
          { orders: { all: { freight: 10 }}}
             ]      };

    var p = Predicate.create(p2);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(substringof('ar',CompanyName) eq true) and (Orders/all(x1: x1/Freight eq 10m))");
  });

  it("any/all with not", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "rowVersion", ">=", 0).not();
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("not (Orders/any(x1: x1/RowVersion ge 0))");
  });

  it("any/all with not null", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "rowVersion", "!=", null).not();
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("not (Orders/any(x1: x1/RowVersion ne null))");
  });

  it("any/all with nested property", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "customer.companyName", "startsWith", "Lazy");
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Orders/any(x1: startswith(x1/Customer/CompanyName,'Lazy') eq true)");
  });

  it("any/all with anded predicate", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("freight", ">", 950).and("shipCountry", "startsWith", "G");
    var p = Predicate.create("orders", "any", p1);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Orders/any(x1: (x1/Freight gt 950m) and (startswith(x1/ShipCountry,'G') eq true))");
  });

  it("any/all with 2 anys anded", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "freight", ">", 950)
        .and("orders", "any", "shipCountry", "startsWith", "G");
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(Orders/any(x1: x1/Freight gt 950m)) and (Orders/any(x1: startswith(x1/ShipCountry,'G') eq true))");
  });

  it("any/all nested 1", function() {
    var entityType = _ms.getEntityType("Customer");
    var p2 = new Predicate("unitPrice", ">", 200).and("quantity", ">", 50);
    var p = Predicate.create("orders", "any", "orderDetails", "any", p2)
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Orders/any(x1: x1/OrderDetails/any(x2: (x2/UnitPrice gt 200m) and (x2/Quantity gt 50)))");
  });

  it("any/all nested 2", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = new Predicate("orders", "any", "orderDetails", "some", "unitPrice", ">", 200);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("Orders/any(x1: x1/OrderDetails/any(x2: x2/UnitPrice gt 200m))");
  });

  it("odata literals 1", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("EmployeeID add ReportsToEmployeeID gt 3");
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("EmployeeID add ReportsToEmployeeID gt 3");
  });

  it("odata literals 2", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("EmployeeID add ReportsToEmployeeID gt 3").and("employeeID", "<", 9999);
    var frag = p.toODataFragment(entityType);
    expect(frag).to.eql("(EmployeeID add ReportsToEmployeeID gt 3) and (EmployeeID lt 9999)");
  });


});