var Sequelize      = require('Sequelize');
var utils        = require('./utils.js');
var log = utils.log;

exports.createSequelize = createSequelize;

function createSequelize(dbConfig, done) {
  sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, {
    dialect: "mysql", // or 'sqlite', 'postgres', 'mariadb'
    port:    3306 // or 5432 (for postgres)
  });

  sequelize
      .authenticate()
      .complete(function(err) {
        if (err) {
          log('Unable to connect to sequelize:', err)
          return done(err);
        }
        log('sequelize connection has been established.')
        done(null, sequelize);
      });
}


function log(s) {
  console.log(s + "\n");
}
