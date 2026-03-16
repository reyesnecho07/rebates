// config/database.js - Updated with reduced duplication
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

export const dbConfigs = {
  // Source Databases (all using same server credentials)
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
  
  // Own Databases (all using same own server credentials)
  NEXCHEM_OWN: {
    user: process.env.OWN_DB_USER,
    password: process.env.OWN_DB_PASS,
    server: process.env.OWN_DB_HOST,
    database: process.env.NEXCHEM_OWN_DB_NAME,
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
  VAN_OWN: {
    user: process.env.OWN_DB_USER,
    password: process.env.OWN_DB_PASS,
    server: process.env.OWN_DB_HOST,
    database: process.env.VAN_OWN_DB_NAME,
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
  VCP_OWN: {
    user: process.env.OWN_DB_USER,
    password: process.env.OWN_DB_PASS,
    server: process.env.OWN_DB_HOST,
    database: process.env.VCP_OWN_DB_NAME,
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

// Helper function to get all OWN databases
export const getOwnDatabases = () => {
  return {
    NEXCHEM_OWN: dbConfigs.NEXCHEM_OWN,
    VAN_OWN: dbConfigs.VAN_OWN,
    VCP_OWN: dbConfigs.VCP_OWN
  };
};

// Helper function to get all source databases
export const getSourceDatabases = () => {
  return {
    NEXCHEM: dbConfigs.NEXCHEM,
    VAN: dbConfigs.VAN,
    VCP: dbConfigs.VCP
  };
};

// Optional: Factory function to create database configs dynamically
export const createDatabaseConfig = (type, dbName) => {
  if (type === 'source') {
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
  } else if (type === 'own') {
    return {
      user: process.env.OWN_DB_USER,
      password: process.env.OWN_DB_PASS,
      server: process.env.OWN_DB_HOST,
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
  }
  throw new Error(`Unknown database type: ${type}`);
};