var fs               = require('fs');
var expect           = require('chai').expect;

var Sequelize        = require('sequelize');
var testFns          = require('./testFns.js');

var breezeSequelize = require("breeze-sequelize");

// Don't use this
// var breeze = require('breeze-client');
// Use this
var breeze = breezeSequelize.breeze;

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var DataService = breeze.DataService;

var EntityManager = breeze.EntityManager;
var EntityQuery = breeze.EntityQuery;
var Predicate = breeze.Predicate;
var FilterQueryOp = breeze.FilterQueryOp;
var _ = Sequelize.Utils._;
var log = testFns.log;

describe("Predicate - parse", function() {
  this.enableTimeouts(false);

  var _ms, _em;
  before(function() {
    _em = testFns.newEm();
    _ms = _em.metadataStore;
  });

  function test(predicate, entityType, expected) {
    var frag1 = predicate.toODataFragment(entityType);
    expect(frag1).to.eql(expected, "frag");
    // console.log(frag1);
    var json = predicate.toJSON();
    var jsonString = JSON.stringify(predicate);
    var jsonExplicit = predicate.toJSONExt( { entityType: entityType, useExplicitDataType: true });
    var jsonStringExplicit = JSON.stringify(jsonExplicit);
    console.log("OData: " + frag1 + "\nJSON:  " + jsonString + "\nJSONx: " + jsonStringExplicit);

    var json2 = JSON.parse(jsonString);
    var newP = Predicate(json2);
    var frag2 = newP.toODataFragment(entityType);
    expect(frag2).to.eql(expected, "frag2");

    var json2Explicit = JSON.parse(jsonStringExplicit);
    var newP = Predicate(json2Explicit);
    var frag2Explicit = newP.toODataFragment(entityType);
    expect(frag2Explicit).to.eql(expected, "frag2Explict");
  }

  it("added like predicate - json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = new Predicate( { companyName: { like: "%er%" }});
    test(p, entityType, "CompanyName like '%er%'" );

  });

  it("mixed null predicates", function() {
    var entityType = _ms.getEntityType("Employee");
    var predicate1 = Predicate.create("lastName", "startsWith", "D");
    var predicate2 = Predicate.create("firstName", "startsWith", "A");
    var predicates = Predicate.or([undefined, predicate1, null, predicate2, null]);
    test(predicates, entityType, "(startswith(LastName,'D') eq true) or (startswith(FirstName,'A') eq true)" );
  });

  it("simple binary predicate - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { freight: 100});
    test(p, orderType, "Freight eq 100m" );

  });

  it("simple binary predicate - reserved word any  - json", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = new Predicate( { lastName: 'any'});
    test(p, entityType, "LastName eq 'any'" );

  });

  it("simple binary predicate - reserved word any 2 - json", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = new Predicate( { lastName: { value: 'any'}} );
    test(p, entityType, "LastName eq 'any'" );

  });

  it("binary predicate int32", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate("freight", ">", 100);
    test(p, orderType, "Freight gt 100m");
  });

  it("binary predicate int32 - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { freight: { ">" : 100}});
    test(p, orderType, "Freight gt 100m");
  });

  it("binary predicate bool - json", function() {
    var entityType = _ms.getEntityType("Product");
    var p = new Predicate("discontinued", "==", true);
    test(p, entityType, "Discontinued eq true");
  });

  it("binary predicate date - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate({ shippedDate: new Date(1998, 3, 1) });
    test(p, orderType, "ShippedDate eq datetime'1998-04-01T07:00:00.000Z'");
  });

  it("binary predicate date - explicit - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate({
      shippedDate: {
        value: new Date(1998, 3, 1),
        dataType: 'DateTime'
      }
    });
    test(p, orderType, "ShippedDate eq datetime'1998-04-01T07:00:00.000Z'");
  });

  it("binary predicate int32 (and) - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { freight: { ">" : 100, "<": 200 }});

    test(p, orderType, "(Freight gt 100m) and (Freight lt 200m)");
  });

  it("binary predicate combo - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate(
        {
          freight: {
            ">": 100, "<": 200
          },
          shippedDate: new Date(1998, 3, 1)
        }
    );
    test(p, orderType, "((Freight gt 100m) and (Freight lt 200m)) and (ShippedDate eq datetime'1998-04-01T07:00:00.000Z')");
  });

  it("complex binary predicate with 3 way and - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate(
        {
          freight: { ">": 100},
          rowVersion: { lt: 10},
          shippedDate: new Date(1998, 3, 1)
        }
    );

    test(p, orderType, "(Freight gt 100m) and (RowVersion lt 10) and (ShippedDate eq datetime'1998-04-01T07:00:00.000Z')");
  });

  it("simple binary predicate with not", function() {
    var orderType = _ms.getEntityType("Order");
    var p = (new Predicate("freight", ">", 100)).not();

    test(p, orderType, "not (Freight gt 100m)");
  });

  it("simple binary predicate with not - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = new Predicate( { not: { freight: { ">":  100}}});

    test(p, orderType, "not (Freight gt 100m)");
  });

  it("and/or predicate - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = Predicate.create(
        { and:
            [ { freight: { gt: 100} },
              { shipCity: { startsWith: 'S'} }
            ]
        });

    test(p, orderType, "(Freight gt 100m) and (startswith(ShipCity,'S') eq true)");
  });

  it("and/or predicate 2 - json", function() {
    var orderType = _ms.getEntityType("Order");
    var p = Predicate.create(
        {
             freight: { gt: 100} ,
             shipCity: { startsWith: 'S'}
        });

    test(p, orderType, "(Freight gt 100m) and (startswith(ShipCity,'S') eq true)");
  });

  it("contains", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("companyName", 'contains', "'");

    test(p, entityType,  "substringof('''',CompanyName) eq true");
  });

  it("contains w/single quote- json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create( {companyName: { 'contains':  "'"}});
    test(p, entityType, "substringof('''',CompanyName) eq true");
  });

  it("contains w/double quote- json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create( {companyName: { 'contains':  '"'}});
    test(p, entityType, "substringof('\"',CompanyName) eq true");
  });

  it("date comparisons", function() {
    var entityType = _ms.getEntityType("Order");
    var p = Predicate.create("orderDate", ">", new Date(1998, 3, 1));
    test(p, entityType, "OrderDate gt datetime'1998-04-01T07:00:00.000Z'");
  });

  it("date comparisons", function() {
    var entityType = _ms.getEntityType("Order");
    var p = Predicate.create( { "orderDate": { ">":  new Date(1998, 3, 1)}});
    test(p, entityType,"OrderDate gt datetime'1998-04-01T07:00:00.000Z'");
  });

  it("oring just 1", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p = Predicate.or([p1]);
    test(p, entityType,"startswith(CompanyName,'S') eq true");
  });

  it("anding just 1", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p = Predicate.and([p1]);
    test(p, entityType,"startswith(CompanyName,'S') eq true");
  });

  it("anding 1", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p2 = Predicate.create("city", "contains", "er");
    var p = p1.and(p2);
    test(p, entityType,"(startswith(CompanyName,'S') eq true) and (substringof('er',City) eq true)");
  });

  it("anding 2", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p = p1.and("city", "contains", "er");

    test(p, entityType, "(startswith(CompanyName,'S') eq true) and (substringof('er',City) eq true)");
  });

  it("anding 3", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p = p1.and({ city: { contains: "er" }});
    test(p, entityType, "(startswith(CompanyName,'S') eq true) and (substringof('er',City) eq true)");
  });

  it("or 4", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("companyName", "startsWith", "S");
    var p2 = Predicate.create("companyName", "startsWith", "T");
    var p3 = Predicate.create("companyName", "startsWith", "U");
    var p = Predicate.or([p1, p2, p3]);
    test(p, entityType, "(startswith(CompanyName,'S') eq true) or (startswith(CompanyName,'T') eq true) or (startswith(CompanyName,'U') eq true)");
  });

  it("or 4 - json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 =  {companyName: { startsWith: "S"}};
    var p2 =  {companyName: { startsWith: "T"}};
    var p3 =  {companyName: { startsWith: "U"}};
    var p = Predicate.or([p1, p2, p3]);
    test(p, entityType, "(startswith(CompanyName,'S') eq true) or (startswith(CompanyName,'T') eq true) or (startswith(CompanyName,'U') eq true)");
  });

  it("null comparisons", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = new Predicate("region", FilterQueryOp.Equals, null);

    test(p, entityType, "Region eq null");
  });

  it("nested comparisons", function() {
    var entityType = _ms.getEntityType("Order");
    var p = new Predicate("customer.region", "==", "CA");
    test(p, entityType, "Customer/Region eq 'CA'");
  });

  it("nested comparisons - json", function() {
    var entityType = _ms.getEntityType("Order");
    var p = new Predicate( { "customer.region": "CA"});

    test(p, entityType, "Customer/Region eq 'CA'");
  });

  it("two field comparison", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("lastName", 'startsWith', "firstName");

    test(p, entityType, "startswith(LastName,FirstName) eq true");
  });

  it("two field comparison w/literal", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("lastName", "startsWith", { value: "firstName", isLiteral: true })

    test(p, entityType, "startswith(LastName,'firstName') eq true");
  });

  it("two field comparison w/literal 2", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("lastName", "startsWith", { value: "firstName" })

    test(p, entityType, "startswith(LastName,'firstName') eq true");
  });

  it("predicate functions 1", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("month(hireDate)", ">", 6);

    test(p, entityType, "month(HireDate) gt 6");
  });

  it("predicate functions 2", function() {
    var entityType = _ms.getEntityType("Employee");
    var p1 = Predicate.create("month(hireDate)", ">", 6);
    var p = p1.and("month(hireDate)", "<", 11);
    // var p = Predicate.create("month(hireDate)", ">", 6).and("month(hireDate)", "<", 11);

    test(p, entityType, "(month(HireDate) gt 6) and (month(HireDate) lt 11)");
  });

  it("any/all functions 1", function() {
    var entityType = _ms.getEntityType("Customer");
    // var p = Predicate.create("orders", "any", "freight",  ">", 950);
    var p = Predicate({ orders: { any: {freight: { '>': 950}}}});

    test(p, entityType, "Orders/any(x1: x1/Freight gt 950m)");
  });

  it("any/all functions 2", function() {
    var entityType = _ms.getEntityType("Customer");
    var p2 = Predicate.create("freight", "==", 10);
    var p1 = Predicate.create("orders", "all", p2);
    var p = Predicate.create("companyName", "contains", "ar").and(p1);

    test(p, entityType, "(substringof('ar',CompanyName) eq true) and (Orders/all(x1: x1/Freight eq 10m))");
  });

  it("any/all functions 2 - json", function() {
    var entityType = _ms.getEntityType("Customer");
    var p2 = { and: [
          { companyName: { contains: "ar" }},
          { orders: { all: { freight: 10 }}}
             ]      };

    var p = Predicate.create(p2);

    test(p, entityType, "(substringof('ar',CompanyName) eq true) and (Orders/all(x1: x1/Freight eq 10m))");
  });

  it("any/all with not", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "rowVersion", ">=", 0).not();

    test(p, entityType, "not (Orders/any(x1: x1/RowVersion ge 0))");
  });

  it("any/all with not null", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "rowVersion", "!=", null).not();

    test(p, entityType, "not (Orders/any(x1: x1/RowVersion ne null))");
  });

  it("any/all with nested property", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "customer.companyName", "startsWith", "Lazy");

    test(p, entityType, "Orders/any(x1: startswith(x1/Customer/CompanyName,'Lazy') eq true)");
  });

  it("any/all with anded predicate", function() {
    var entityType = _ms.getEntityType("Customer");
    var p1 = Predicate.create("freight", ">", 950).and("shipCountry", "startsWith", "G");
    var p = Predicate.create("orders", "any", p1);
    test(p, entityType, "Orders/any(x1: (x1/Freight gt 950m) and (startswith(x1/ShipCountry,'G') eq true))");
  });

  it("any/all with 2 anys anded", function() {
    // strange case here; - going thru toJSON and reimporting actually normalizes the odata.
    var entityType = _ms.getEntityType("Customer");
    var p = Predicate.create("orders", "any", "freight", ">", 950)
        .and("orders", "any", "shipCountry", "startsWith", "G");
    var json = p.toJSON( { entityType: entityType });
    var newP = Predicate(json);
    test(newP, entityType, "Orders/any(x1: (x1/Freight gt 950m) and (startswith(x1/ShipCountry,'G') eq true))");
  });

  it("any/all nested 1", function() {
    var entityType = _ms.getEntityType("Customer");
    var p2 = new Predicate("unitPrice", ">", 200).and("quantity", ">", 50);
    var p = Predicate.create("orders", "any", "orderDetails", "any", p2)

    test(p, entityType, "Orders/any(x1: x1/OrderDetails/any(x2: (x2/UnitPrice gt 200m) and (x2/Quantity gt 50)))");
  });

  it("any/all nested 2", function() {
    var entityType = _ms.getEntityType("Customer");
    var p = new Predicate("orders", "any", "orderDetails", "some", "unitPrice", ">", 200);

    test(p, entityType, "Orders/any(x1: x1/OrderDetails/any(x2: x2/UnitPrice gt 200m))");
  });

  it("odata literals 1", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("EmployeeID add ReportsToEmployeeID gt 3");

    test(p, entityType, "EmployeeID add ReportsToEmployeeID gt 3");
  });

  it("odata literals 2", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.create("EmployeeID add ReportsToEmployeeID gt 3").and("employeeID", "<", 9999);

    test(p, entityType, "(EmployeeID add ReportsToEmployeeID gt 3) and (EmployeeID lt 9999)");
  });

  it("empty predicates", function() {
    var entityType = _ms.getEntityType("Employee");
    var p = Predicate.and([]);
    expect(p).to.be.null;

  });

  it("reserved words 1", function() {

    var p = Predicate.create( { any: { gt: 10} });
    test(p, null, "any gt 10d");

    var p = Predicate.create( { any: { gt: { value: 10, dataType: breeze.DataType.Int32} }});
    test(p, null, "any gt 10");

                                        //  1998-04-01T07:00:00.000Z
    var p = Predicate.create( { any: { gt: "1998-04-01T07:00:00.000Z" }});
    test(p, null, "any gt datetime'1998-04-01T07:00:00.000Z'");
  });


});