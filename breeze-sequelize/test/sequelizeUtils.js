var Sequelize      = require('Sequelize');
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
          console.log('Unable to connect to the database:', err)
          done(err);
        }
        console.log('connection has been established successfully again.')
        done(null, sequelize);
      });
}
