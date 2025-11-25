import sql from 'mssql';
import { handleDatabaseOperation } from './databaseService.js';

export const authenticateUser = async (username, password, database) => {
  if (!username || !password || !database) {
    throw new Error("Username, password, and database are required");
  }

  // Fixed password validation
  if (password !== "abc123") {
    throw new Error("Invalid password. Please use 'abc123'");
  }

  const user = await handleDatabaseOperation(database, async (pool) => {
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query(`
        SELECT USER_CODE, U_NAME 
        FROM OUSR 
        WHERE USER_CODE = @username
      `);

    if (result.recordset.length === 0) {
      throw new Error("User not found in selected database");
    }

    return result.recordset[0];
  });

  return user;
};

export const simpleAuthenticate = async (userCode, database) => {
  if (!userCode || !database) {
    throw new Error("User code and database are required");
  }

  const user = await handleDatabaseOperation(database, async (pool) => {
    const result = await pool.request()
      .input('userCode', sql.VarChar, userCode)
      .query(`
        SELECT USER_CODE, U_NAME 
        FROM OUSR 
        WHERE USER_CODE = @userCode
      `);

    if (result.recordset.length === 0) {
      throw new Error("User not found in selected database");
    }

    return result.recordset[0];
  });

  return user;
};

export const formatUserName = (uName) => {
  let fullName = uName || "";
  let parts = fullName.trim().split(" ");
  if (parts.length > 1) {
    parts.shift();
    fullName = parts.join(" ");
  }
  return fullName;
};