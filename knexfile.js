const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'backend', 'db', 'dentalflow.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'backend', 'db', 'migrations')
    }
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, 'backend', 'db', 'migrations')
    }
  }
};
