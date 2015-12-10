## Possible areas for improvement

#### Result Shaping Performance

When the results are returned from sequelize, they are processed by SequelizeQuery._reshapeResults.  
Depending upon the type of query (select, expand, etc), this can be an expensive process.  
Try to improve performance by caching property accessors, etc.
