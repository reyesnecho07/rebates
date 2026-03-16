// services/userService.js
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { getDatabaseConfig } from '../config/database.js';

// Connection pool for UsersDB_v1.2
let userDbPool = null;

// ─────────────────────────────────────────────────────────────────────────────
// Pool management
// ─────────────────────────────────────────────────────────────────────────────
export const initializeUserDb = async () => {
  try {
    const userConfig = getDatabaseConfig('USER');
    console.log('🔐 Initializing UsersDB_v1.2 Database connection...');
    console.log('📊 Config:', { server: userConfig.server, database: userConfig.database, user: userConfig.user });

    userDbPool = new sql.ConnectionPool(userConfig);
    await userDbPool.connect();

    console.log('✅ UsersDB_v1.2 Database connected successfully');

    const testResult = await userDbPool.request().query('SELECT DB_NAME() as dbname');
    console.log('✅ Connection test passed:', testResult.recordset[0].dbname);

    return userDbPool;
  } catch (error) {
    console.error('❌ Failed to connect to UsersDB_v1.2 database:', error.message);
    throw error;
  }
};

export const getUserDbConnection = async () => {
  if (!userDbPool || !userDbPool.connected) {
    await initializeUserDb();
  }
  return userDbPool;
};

// ─────────────────────────────────────────────────────────────────────────────
// Authentication (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const authenticateUser = async (userCode, password) => {
  console.log('🔐 ========== START AUTHENTICATION ==========');
  console.log('📨 Input received:', { userCode, password: password ? '***' : 'EMPTY' });

  try {
    const pool = await getUserDbConnection();

    const result = await pool.request()
      .input('userCode', sql.VarChar, userCode)
      .query(`
        SELECT
          User_ID, Username, Password, Password1, Password2,
          IsActive, OneLogPwd, GroupID, RoleID, IsSuperUser, Notes
        FROM Users
        WHERE User_ID = @userCode
      `);

    console.log(`📊 Database returned ${result.recordset.length} record(s)`);

    if (result.recordset.length === 0) {
      console.log('❌ User not found in UsersDB_v1.2');
      throw new Error("Invalid username or password");
    }

    const user = result.recordset[0];

    console.log('👤 USER RECORD DETAILS:');
    console.log('  User_ID:', user.User_ID);
    console.log('  Username:', user.Username);
    console.log('  IsActive:', user.IsActive);
    console.log('  OneLogPwd:', user.OneLogPwd, '(type:', typeof user.OneLogPwd, ')');
    console.log('  Raw Password:', user.Password ? 'HASHED' : 'EMPTY');

    const isActive = user.IsActive === 1 || user.IsActive === true || user.IsActive === '1';
    if (!isActive) {
      console.log('❌ User account is INACTIVE');
      throw new Error("User account is inactive");
    }

    if (!user.Password || user.Password.trim() === '') {
      console.log('❌ No password set for user');
      throw new Error("Password not set. Please contact administrator.");
    }

    console.log('🔑 Comparing passwords...');
    const isPasswordValid = await bcrypt.compare(password, user.Password);
    console.log('🔑 Password comparison result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Password mismatch');
      throw new Error("Invalid username or password");
    }

    let oneLogPwdNum = 0;
    const oneLogPwdValue = user.OneLogPwd;
    if (oneLogPwdValue !== null && oneLogPwdValue !== undefined) {
      oneLogPwdNum = Number(oneLogPwdValue);
      if (isNaN(oneLogPwdNum)) oneLogPwdNum = 0;
    }

    const needsPasswordChange = oneLogPwdNum === 1;
    console.log('🔄 Final decision - needsPasswordChange:', needsPasswordChange);

    const displayName = user.Username && user.Username.includes(' ')
      ? user.Username.split(' ').slice(1).join(' ')
      : user.Username || user.User_ID;

    // ── Log login to UserHistory ────────────────────────────────────────────
    try {
      await pool.request()
        .input('userCode', sql.VarChar, userCode)
        .input('action',   sql.NVarChar, 'LOGIN')
        .input('desc',     sql.NVarChar, `User ${userCode} logged in`)
        .query(`
          INSERT INTO UserHistory (UserID, ActionType, ActionDescription, ChangedBy, ChangedAt, CreatedAt)
          SELECT UserID, @action, @desc, @userCode, GETDATE(), GETDATE()
          FROM Users WHERE User_ID = @userCode
        `);
    } catch (histErr) {
      console.warn('⚠️ Could not log login history:', histErr.message);
    }

    console.log('✅ AUTHENTICATION SUCCESSFUL!');
    console.log('========== END AUTHENTICATION ==========\n');

    return {
      success: true,
      user: {
        User_ID:     user.User_ID,
        Username:    user.Username,
        DisplayName: displayName,
        GroupID:     user.GroupID,
        RoleID:      user.RoleID,
        IsSuperUser: user.IsSuperUser || 0,
        IsActive:    user.IsActive,
        Notes:       user.Notes,
        OneLogPwd:   oneLogPwdNum,
      },
      isFirstLogin: needsPasswordChange,
      OneLogPwd:    oneLogPwdNum,
    };

  } catch (error) {
    console.error('🔴 AUTHENTICATION ERROR:', error.message);
    console.log('========== END AUTHENTICATION ==========\n');
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Change password (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = async (userCode, currentPassword, newPassword) => {
  console.log('🔑 ========== START PASSWORD CHANGE ==========');
  console.log('User:', userCode);

  try {
    const pool = await getUserDbConnection();

    const userResult = await pool.request()
      .input('userCode', sql.VarChar, userCode)
      .query(`
        SELECT Password, OneLogPwd, Username, User_ID, GroupID, RoleID, IsSuperUser, IsActive, Notes
        FROM Users WHERE User_ID = @userCode
      `);

    if (userResult.recordset.length === 0) throw new Error("User not found");

    const user = userResult.recordset[0];
    const isCurrentValid = await bcrypt.compare(currentPassword, user.Password);
    if (!isCurrentValid) throw new Error("Current password is incorrect");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.request()
      .input('userCode',    sql.VarChar, userCode)
      .input('newPassword', sql.VarChar, hashedPassword)
      .query(`
        UPDATE Users
        SET Password = @newPassword, Password1 = @newPassword, OneLogPwd = 0, UpdatedAt = GETDATE()
        WHERE User_ID = @userCode
      `);

    const verifyResult = await pool.request()
      .input('userCode', sql.VarChar, userCode)
      .query(`
        SELECT User_ID, Username, OneLogPwd, GroupID, RoleID, IsSuperUser, IsActive, Notes
        FROM Users WHERE User_ID = @userCode
      `);

    const updatedUser = verifyResult.recordset[0];
    const displayName = updatedUser.Username && updatedUser.Username.includes(' ')
      ? updatedUser.Username.split(' ').slice(1).join(' ')
      : updatedUser.Username || updatedUser.User_ID;

    // Log password change
    try {
      await pool.request()
        .input('userCode', sql.VarChar, userCode)
        .query(`
          INSERT INTO UserHistory (UserID, ActionType, ActionDescription, ChangedBy, ChangedAt, CreatedAt)
          SELECT UserID, 'PASSWORD_CHANGE', 'User changed their password', @userCode, GETDATE(), GETDATE()
          FROM Users WHERE User_ID = @userCode
        `);
    } catch (histErr) {
      console.warn('⚠️ Could not log password change history:', histErr.message);
    }

    console.log('✅ Password change COMPLETE');
    console.log('========== END PASSWORD CHANGE ==========\n');

    return {
      success: true,
      message: "Password changed successfully",
      user: {
        User_ID:     updatedUser.User_ID,
        Username:    updatedUser.Username,
        DisplayName: displayName,
        GroupID:     updatedUser.GroupID,
        RoleID:      updatedUser.RoleID,
        IsSuperUser: updatedUser.IsSuperUser || 0,
        IsActive:    updatedUser.IsActive,
        Notes:       updatedUser.Notes,
        OneLogPwd:   updatedUser.OneLogPwd,
      },
    };

  } catch (error) {
    console.error('🔴 PASSWORD CHANGE ERROR:', error.message);
    console.log('========== END PASSWORD CHANGE ==========\n');
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset password (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = async (userCode) => {
  try {
    const pool = await getUserDbConnection();
    const hashedPassword = await bcrypt.hash("abc123", 10);

    await pool.request()
      .input('userCode',    sql.VarChar, userCode)
      .input('newPassword', sql.VarChar, hashedPassword)
      .query(`
        UPDATE Users
        SET Password = @newPassword, Password1 = @newPassword, OneLogPwd = 1, UpdatedAt = GETDATE()
        WHERE User_ID = @userCode
      `);

    return {
      success: true,
      message: "Password reset to default successfully. User must change password on next login.",
    };
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW: Roles ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const getAllRoles = async () => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request().query(`
      SELECT RoleID, RoleName, Description, IsActive, CreatedAt, UpdatedAt
      FROM Roles
      WHERE IsActive = 1
      ORDER BY RoleName ASC
    `);
    return result.recordset;
  } catch (error) {
    console.error('❌ getAllRoles:', error);
    throw error;
  }
};

export const getRoleById = async (roleId) => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request()
      .input('roleId', sql.Int, roleId)
      .query(`SELECT * FROM Roles WHERE RoleID = @roleId`);
    return result.recordset[0] || null;
  } catch (error) {
    console.error('❌ getRoleById:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW: UserGroups ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const getAllUserGroups = async () => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request().query(`
      SELECT GroupID, GroupName, Description, IsActive, CreatedAt, UpdatedAt
      FROM UserGroups
      WHERE IsActive = 1
      ORDER BY GroupName ASC
    `);
    return result.recordset;
  } catch (error) {
    console.error('❌ getAllUserGroups:', error);
    throw error;
  }
};

export const getUserGroupById = async (groupId) => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request()
      .input('groupId', sql.Int, groupId)
      .query(`SELECT * FROM UserGroups WHERE GroupID = @groupId`);
    return result.recordset[0] || null;
  } catch (error) {
    console.error('❌ getUserGroupById:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW: UserGroupAccess — which DBs a group can see ─────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const getGroupAccessByGroupId = async (groupId) => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request()
      .input('groupId', sql.Int, groupId)
      .query(`
        SELECT
          uga.GroupAccessID,
          uga.GroupID,
          uga.DatabaseID,
          d.DBName,
          d.DBTag,
          d.IsActive AS DBIsActive,
          uga.CreatedAt,
          uga.UpdatedAt
        FROM UserGroupAccess uga
        INNER JOIN Databases d ON d.DatabaseID = uga.DatabaseID
        WHERE uga.GroupID = @groupId
          AND d.IsActive  = 1
        ORDER BY d.DBName ASC
      `);
    return result.recordset;
  } catch (error) {
    console.error('❌ getGroupAccessByGroupId:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW: UserCustomAccess — extra DBs granted directly to one user ────────────
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomAccessByUserCode = async (userCode) => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request()
      .input('userCode', sql.NVarChar, userCode)
      .query(`
        SELECT
          uca.UserAccessID,
          uca.UserID,
          uca.DatabaseID,
          d.DBName,
          d.DBTag,
          d.IsActive AS DBIsActive,
          uca.CreatedAt,
          uca.UpdatedAt
        FROM UserCustomAccess uca
        INNER JOIN Users     u  ON u.UserID     = uca.UserID
        INNER JOIN Databases d  ON d.DatabaseID = uca.DatabaseID
        WHERE u.User_ID = @userCode
          AND d.IsActive = 1
        ORDER BY d.DBName ASC
      `);
    return result.recordset;
  } catch (error) {
    console.error('❌ getCustomAccessByUserCode:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW: UserDatabaseOrder — per-user display order + visibility ──────────────
// ─────────────────────────────────────────────────────────────────────────────
export const getDatabaseOrderByUserCode = async (userCode) => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request()
      .input('userCode', sql.NVarChar, userCode)
      .query(`
        SELECT
          udo.UserDBPrefID,
          udo.UserID,
          udo.DatabaseID,
          d.DBName,
          d.DBTag,
          udo.DisplayOrder,
          udo.IsVisible,
          udo.CreatedAt,
          udo.UpdatedAt
        FROM UserDatabaseOrder udo
        INNER JOIN Users     u ON u.UserID     = udo.UserID
        INNER JOIN Databases d ON d.DatabaseID = udo.DatabaseID
        WHERE u.User_ID = @userCode
        ORDER BY udo.DisplayOrder ASC
      `);
    return result.recordset;
  } catch (error) {
    console.error('❌ getDatabaseOrderByUserCode:', error);
    throw error;
  }
};

export const upsertDatabaseOrder = async (userCode, orders) => {
  // orders = [{ databaseId, displayOrder, isVisible }]
  try {
    const pool = await getUserDbConnection();

    const userRes = await pool.request()
      .input('userCode', sql.NVarChar, userCode)
      .query(`SELECT UserID FROM Users WHERE User_ID = @userCode`);

    if (!userRes.recordset.length) throw new Error('User not found');
    const userId = userRes.recordset[0].UserID;

    for (const o of orders) {
      await pool.request()
        .input('userId',       sql.Int, userId)
        .input('databaseId',   sql.Int, o.databaseId)
        .input('displayOrder', sql.Int, o.displayOrder)
        .input('isVisible',    sql.Bit, o.isVisible ?? 1)
        .query(`
          IF EXISTS (
            SELECT 1 FROM UserDatabaseOrder
            WHERE UserID = @userId AND DatabaseID = @databaseId
          )
            UPDATE UserDatabaseOrder
            SET DisplayOrder = @displayOrder, IsVisible = @isVisible, UpdatedAt = GETDATE()
            WHERE UserID = @userId AND DatabaseID = @databaseId
          ELSE
            INSERT INTO UserDatabaseOrder (UserID, DatabaseID, DisplayOrder, IsVisible, CreatedAt, UpdatedAt)
            VALUES (@userId, @databaseId, @displayOrder, @isVisible, GETDATE(), GETDATE())
        `);
    }

    return { success: true, message: 'Database order updated' };
  } catch (error) {
    console.error('❌ upsertDatabaseOrder:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW: UserHistory ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const logHistory = async (userCode, actionType, actionDescription, changedBy = null) => {
  try {
    const pool = await getUserDbConnection();
    await pool.request()
      .input('userCode',   sql.NVarChar, userCode)
      .input('action',     sql.NVarChar, actionType)
      .input('desc',       sql.NVarChar, actionDescription || '')
      .input('changedBy',  sql.NVarChar, changedBy || userCode)
      .query(`
        INSERT INTO UserHistory (UserID, ActionType, ActionDescription, ChangedBy, ChangedAt, CreatedAt)
        SELECT UserID, @action, @desc, @changedBy, GETDATE(), GETDATE()
        FROM Users WHERE User_ID = @userCode
      `);
  } catch (error) {
    // Non-critical — log but don't throw
    console.error('❌ logHistory (non-fatal):', error.message);
  }
};

export const getHistory = async (userCode, limit = 50) => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request()
      .input('userCode', sql.NVarChar, userCode)
      .input('limit',    sql.Int,      limit)
      .query(`
        SELECT TOP (@limit)
          h.HistoryID,
          h.ActionType,
          h.ActionDescription,
          h.ChangedBy,
          h.ChangedAt,
          h.CreatedAt
        FROM UserHistory h
        INNER JOIN Users u ON u.UserID = h.UserID
        WHERE u.User_ID = @userCode
        ORDER BY h.ChangedAt DESC
      `);
    return result.recordset;
  } catch (error) {
    console.error('❌ getHistory:', error);
    throw error;
  }
};

// ── getNavItemPermissions (also fixed) ────────────────────────────────────────
// Same pattern: CROSS JOIN UserInfo to cleanly reference all three ID columns
// ─────────────────────────────────────────────────────────────────────────────
export const getNavItemPermissions = async (userCode, navItemId) => {
  try {
    const pool = await getUserDbConnection();

    const result = await pool.request()
      .input('userCode',  sql.NVarChar, userCode)
      .input('navItemId', sql.Int,      navItemId)
      .query(`
        WITH UserInfo AS (
          SELECT UserID, GroupID, RoleID
          FROM   Users
          WHERE  User_ID = @userCode
        )
        SELECT
          MAX(CAST(ac.CanView    AS INT)) AS CanView,
          MAX(CAST(ac.CanCreate  AS INT)) AS CanCreate,
          MAX(CAST(ac.CanEdit    AS INT)) AS CanEdit,
          MAX(CAST(ac.CanDelete  AS INT)) AS CanDelete,
          MAX(CAST(ac.CanExport  AS INT)) AS CanExport,
          MAX(CAST(ac.CanApprove AS INT)) AS CanApprove
        FROM   AccessControl ac
        CROSS JOIN UserInfo ui
        WHERE  ac.NavItemID = @navItemId
          AND (
                ac.UserID  = ui.UserID
             OR ac.GroupID = ui.GroupID
             OR ac.RoleID  = ui.RoleID
          )
      `);

    const row = result.recordset[0];
    return {
      canView:    !!(row?.CanView),
      canCreate:  !!(row?.CanCreate),
      canEdit:    !!(row?.CanEdit),
      canDelete:  !!(row?.CanDelete),
      canExport:  !!(row?.CanExport),
      canApprove: !!(row?.CanApprove),
    };
  } catch (error) {
    console.error('❌ getNavItemPermissions:', error);
    throw error;
  }
};

// ── getAccessibleDatabases ────────────────────────────────────────────────────
// Chain:
//   User_ID → Users.UserID + Users.GroupID
//   Users.GroupID → UserGroupAccess.GroupID → DatabaseID  (group grant)
//   Users.UserID  → UserCustomAccess.UserID → DatabaseID  (direct grant)
//   Users.UserID  → UserDatabaseOrder.UserID → DisplayOrder + IsVisible
// ─────────────────────────────────────────────────────────────────────────────
export const getAccessibleDatabases = async (userCode) => {
  try {
    const pool = await getUserDbConnection();

    const result = await pool.request()
      .input('userCode', sql.NVarChar, userCode)
      .query(`
        WITH UserInfo AS (
          SELECT UserID, GroupID, RoleID
          FROM   Users
          WHERE  User_ID = @userCode
        ),
        AccessibleDBs AS (
          SELECT uga.DatabaseID
          FROM   UserGroupAccess uga
          INNER JOIN UserInfo ui ON ui.GroupID = uga.GroupID

          UNION

          SELECT uca.DatabaseID
          FROM   UserCustomAccess uca
          INNER JOIN UserInfo ui ON ui.UserID = uca.UserID
        )
        SELECT DISTINCT
          d.DatabaseID,
          d.DBName,
          d.DBTag,
          d.IsActive,
          COALESCE(udo.DisplayOrder, 999) AS DisplayOrder,
          COALESCE(udo.IsVisible,    1)   AS IsVisible
        FROM   Databases d
        INNER JOIN AccessibleDBs adb ON adb.DatabaseID = d.DatabaseID
        LEFT  JOIN UserInfo           ui  ON 1 = 1
        LEFT  JOIN UserDatabaseOrder  udo ON udo.DatabaseID = d.DatabaseID
                                         AND udo.UserID     = ui.UserID
        WHERE  d.IsActive = 1
        ORDER  BY DisplayOrder ASC, d.DatabaseID ASC
      `);

    // ✅ No pool.close() here — the pool is shared and must stay open
    return result.recordset;
  } catch (error) {
    console.error('❌ getAccessibleDatabases:', error);
    throw error;
  }
};


// ── getAccessibleNavGroups ────────────────────────────────────────────────────
// Chain:
//   User_ID → Users.UserID + Users.GroupID + Users.RoleID
//   AccessControl matches if ANY of these is true:
//     ac.UserID  = Users.UserID   (direct user rule)
//     ac.GroupID = Users.GroupID  (group rule — UserGroups.GroupID)
//     ac.RoleID  = Users.RoleID   (role rule)
//   MAX(CanView) across all matching rules = most-permissive result
//   Only rows where MAX(CanView)=1 are returned (HAVING clause)
// ─────────────────────────────────────────────────────────────────────────────
export const getAccessibleNavGroups = async (userCode) => {
  try {
    const pool = await getUserDbConnection();

    const result = await pool.request()
      .input('userCode', sql.NVarChar, userCode)
      .query(`
        -- Get user's integer IDs once
        WITH UserInfo AS (
          SELECT UserID, GroupID, RoleID
          FROM   Users
          WHERE  User_ID = @userCode
        )

        SELECT
          d.DatabaseID,
          d.DBName,
          d.DBTag,
          g.GroupID,
          g.GroupName,
          g.Description   AS GroupDescription,
          g.SortOrder     AS GroupSortOrder,
          n.NavItemID,
          n.ParentID,
          n.NavItemName,
          n.RoutePath,
          n.SortOrder     AS NavSortOrder,
          n.Description   AS NavDescription,

          -- Aggregate across ALL matching rules; MAX = most permissive
          MAX(CAST(ac.CanView    AS INT)) AS CanView,
          MAX(CAST(ac.CanCreate  AS INT)) AS CanCreate,
          MAX(CAST(ac.CanEdit    AS INT)) AS CanEdit,
          MAX(CAST(ac.CanDelete  AS INT)) AS CanDelete,
          MAX(CAST(ac.CanExport  AS INT)) AS CanExport,
          MAX(CAST(ac.CanApprove AS INT)) AS CanApprove

        FROM Databases      d
        INNER JOIN NavItems      n  ON d.DatabaseID = n.DatabaseID
        INNER JOIN NavItemGroups g  ON n.GroupID    = g.GroupID
        INNER JOIN AccessControl ac ON n.NavItemID  = ac.NavItemID
        -- Join UserInfo so we can match any of the three access columns
        CROSS JOIN UserInfo ui
        WHERE
          d.IsActive = 1
          AND n.IsActive = 1
          AND g.IsActive = 1
          -- Match this user by UserID (direct), GroupID (group), or RoleID (role)
          AND (
                ac.UserID  = ui.UserID
             OR ac.GroupID = ui.GroupID
             OR ac.RoleID  = ui.RoleID
          )

        GROUP BY
          d.DatabaseID, d.DBName, d.DBTag,
          g.GroupID, g.GroupName, g.Description, g.SortOrder,
          n.NavItemID, n.ParentID, n.NavItemName,
          n.RoutePath, n.SortOrder, n.Description

        -- Only include nav items where the user has at least CanView = 1
        HAVING MAX(CAST(ac.CanView AS INT)) = 1

        ORDER BY
          d.DatabaseID  ASC,
          g.SortOrder   ASC,
          n.SortOrder   ASC,
          n.NavItemName ASC
      `);

    // ── Build nested structure identical to navItemsGroupService ─────────────
    const structure = {};

    for (const row of result.recordset) {
      const dbId  = row.DatabaseID;
      const grpId = row.GroupID;

      if (!structure[dbId]) {
        structure[dbId] = {
          databaseId: dbId,
          dbName:     row.DBName,
          dbTag:      row.DBTag,
          groups:     {},
        };
      }

      if (!structure[dbId].groups[grpId]) {
        structure[dbId].groups[grpId] = {
          groupId:     grpId,
          groupName:   row.GroupName,
          description: row.GroupDescription,
          sortOrder:   row.GroupSortOrder,
          flatItems:   [],
        };
      }

      structure[dbId].groups[grpId].flatItems.push({
        navItemId:   row.NavItemID,
        parentId:    row.ParentID,
        navItemName: row.NavItemName,
        routePath:   row.RoutePath,
        sortOrder:   row.NavSortOrder,
        description: row.NavDescription,
        permissions: {
          canView:    !!row.CanView,
          canCreate:  !!row.CanCreate,
          canEdit:    !!row.CanEdit,
          canDelete:  !!row.CanDelete,
          canExport:  !!row.CanExport,
          canApprove: !!row.CanApprove,
        },
      });
    }

    // Convert groups object → sorted array, flatItems → parent/child tree
    for (const dbId of Object.keys(structure)) {
      structure[dbId].groups = Object.values(structure[dbId].groups)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(group => {
          const { flatItems, ...rest } = group;
          return { ...rest, items: buildItemTree(flatItems) };
        });
    }

    return structure;

  } catch (error) {
    console.error('❌ getAccessibleNavGroups:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper — keep this at the bottom of userService.js (already there)
// ─────────────────────────────────────────────────────────────────────────────
function buildItemTree(flatItems) {
  const byId  = {};
  const roots = [];
  for (const item of flatItems) byId[item.navItemId] = { ...item, children: [] };
  for (const item of Object.values(byId)) {
    if (item.parentId && byId[item.parentId]) byId[item.parentId].children.push(item);
    else roots.push(item);
  }
  const sort = arr => arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  sort(roots);
  for (const item of Object.values(byId)) sort(item.children);
  return roots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test connection (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const testUserDbConnection = async () => {
  try {
    const pool   = await getUserDbConnection();
    const result = await pool.request()
      .query('SELECT DB_NAME() as dbname, @@SERVERNAME as servername');
    return {
      success:  true,
      database: result.recordset[0].dbname,
      server:   result.recordset[0].servername,
      message:  'UsersDB_v1.2 database connected successfully',
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Initialize on import
initializeUserDb().catch(err => {
  console.error('Failed to initialize UsersDB_v1.2 database:', err.message);
});