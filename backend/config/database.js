import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

export const dbConfigs = {
  NEXCHEM: {
    user: process.env.NEXCHEM_DB_USER,
    password: process.env.NEXCHEM_DB_PASS,
    server: process.env.NEXCHEM_DB_HOST,
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
    user: process.env.VAN_DB_USER,
    password: process.env.VAN_DB_PASS,
    server: process.env.VAN_DB_HOST,
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
    user: process.env.VCP_DB_USER,
    password: process.env.VCP_DB_PASS,
    server: process.env.VCP_DB_HOST,
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
  }
};

export const getDatabaseConfig = (database) => {
  if (database) {
    const dbConfig = dbConfigs[database];
    if (!dbConfig) {
      throw new Error(`Unknown database: ${database}`);
    }
    return dbConfig;
  }
  return dbConfigs; // Return all configs if no specific database requested
};