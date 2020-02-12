# breeze-sequelize

The `breeze-sequelize` library lets you easily build a Sequelize server for managing relational data.  
Starting with Breeze metadata, it will create the Sequelize model for you, and Sequelize can create a database from the model.


## Repo

The [src](./src) folder contains the TypeScript source code.

    -  Run 'npm run build' to build the '.tgz' file..  This will also deploy a copy of the build to the 'BreezeExpressDemo' folder.
    -  If you want to build a new version - change the 'package.json' 'version' and also update the same version under 'install-to-demo'
    -  To deploy - run 'npm package breeze-sequelize-{version number}.tgz' - substitute the correct version number. 

The [test](./test) folder contains 
  
  - A sql dump of the MySql database used by both the BreezeExpressDemo and local tests. Currently you will need to manually a few row to the 'UnusualDate' table for all of the client side 

The [test/BreezeExpressDemo](./test/BreezeExpressDemo) folder contains a complete server using breeze-sequelize, for running an end-to-end test suite.
  
  - To run the Demo
    - npm run tsc
    - node server



