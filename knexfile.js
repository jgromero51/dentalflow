const path = require('path');


module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_PATH || path.join(__dirname, 'backend', 'db', 'dentalflow.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'backend', 'db', 'migrations')
    }
  },

  production: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_PATH || path.join(__dirname, 'backend', 'db', 'dentalflow.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'backend', 'db', 'migrations')
    }
  }
};
