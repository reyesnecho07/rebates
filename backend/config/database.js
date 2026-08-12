// config/database.js
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

export const dbConfigs = {
  // Company Databases (all using same server credentials, 192.168.11.103)
  NEXCHEM: {
    user: process.env.SERVER_DB_USER,
    password: process.env.SERVER_DB_PASS,
    server: process.env.SERVER_DB_HOST,
    database: process.env.NEXCHEM_DB_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  },
  VAN: {
    user: process.env.SERVER_DB_USER,
    password: process.env.SERVER_DB_PASS,
    server: process.env.SERVER_DB_HOST,
    database: process.env.VAN_DB_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  },
  VCP: {
    user: process.env.SERVER_DB_USER,
    password: process.env.SERVER_DB_PASS,
    server: process.env.SERVER_DB_HOST,
    database: process.env.VCP_DB_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  },

  // User Database for Authentication
  USER: {
    user: process.env.USER_DB_USER,
    password: process.env.USER_DB_PASS,
    server: process.env.USER_DB_HOST,
    database: process.env.USER_DB_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  }
};

// Helper function to get database config
export const getDatabaseConfig = (database) => {
  if (database) {
    const dbConfig = dbConfigs[database];
    if (!dbConfig) {
      throw new Error(`Unknown database: ${database}`);
    }
    return dbConfig;
  }
  return dbConfigs;
};

// Helper function to get all company databases
export const getSourceDatabases = () => {
  return {
    NEXCHEM: dbConfigs.NEXCHEM,
    VAN: dbConfigs.VAN,
    VCP: dbConfigs.VCP
  };
};

// Factory function to create a database config dynamically
export const createDatabaseConfig = (dbName) => {
  return {
    user: process.env.SERVER_DB_USER,
    password: process.env.SERVER_DB_PASS,
    server: process.env.SERVER_DB_HOST,
    database: dbName,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
};