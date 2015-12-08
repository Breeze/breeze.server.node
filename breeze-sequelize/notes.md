## Possible areas for improvement

#### Query Implicit Includes

When using a navigation property in a where clause, breeze-sequelize includes the related entity in the query.  For example, 

    EntityQuery.from("Orders").where("customer.companyName", "eq", "ACME")
    
The resulting SQL will select all the columns from both Order and Customer, as if we had `.include`d Customer.
This is because sequelize needs it that way, apparently: https://github.com/sequelize/sequelize/issues/4993

See if there is another way to express the query without the `.include`, or perhaps specify `attributes: []` that
will remove/reduce the unneeded columns from the included tables.

#### Result Shaping Performance

When the results are returned from sequelize, they are processed by SequelizeQuery._reshapeResults.  
Depending upon the type of query (select, expand, etc), this can be an expensive process.  
Try to improve performance by caching property accessors, etc.
