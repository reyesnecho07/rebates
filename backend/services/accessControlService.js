import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

// ── Helper: always create a fresh ConnectionPool (avoids global pool conflicts) ──
async function getPool(database) {
  const config = getDatabaseConfig(database);
  const pool   = new sql.ConnectionPool(config);
  await pool.connect();
  return pool;
}

class AccessControlService {

  // ── Get all access control records ────────────────────────────────────────
  async getAllAccessControl(database = 'USER') {
    const pool = await getPool(database);
    try {
      const result = await pool.request().query(`
        SELECT
          ac.NavItemAccessId,
          ac.NavItemID,
          ac.RoleID,
          ac.GroupID,
          ac.UserID,
          ac.CanView,
          ac.CanCreate,
          ac.CanEdit,
          ac.CanDelete,
          ac.CanExport,
          ac.CanApprove,
          ac.CreatedAt,
          ac.UpdatedAt,
          n.NavItemName,
          n.RoutePath,
          n.DatabaseID,
          u.UserName
        FROM AccessControl ac
        LEFT JOIN NavItems n ON ac.NavItemID = n.NavItemID
        LEFT JOIN Users    u ON ac.UserID    = u.UserID
        ORDER BY ac.NavItemAccessId ASC
      `);
      return result.recordset.map(r => this._mapRow(r));
    } finally {
      await pool.close();
    }
  }

  // ── Get access for a specific user by numeric UserID ──────────────────────
  async getAccessByUserId(userId, database = 'USER') {
    const pool = await getPool(database);
    try {
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            ac.UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            d.DBName,
            d.DBTag,
            u.UserName
          FROM AccessControl ac
          LEFT JOIN NavItems  n ON ac.NavItemID = n.NavItemID
          LEFT JOIN Databases d ON n.DatabaseID = d.DatabaseID
          LEFT JOIN Users     u ON ac.UserID    = u.UserID
          WHERE ac.UserID = @userId
          ORDER BY ac.NavItemID ASC
        `);
      return result.recordset.map(r => this._mapRow(r));
    } finally {
      await pool.close();
    }
  }

  // ── Get access for a specific user by User_ID string ──────────────────────
  async getAccessByUserCode(userCode, database = 'USER') {
    const pool = await getPool(database);
    try {
      const result = await pool.request()
        .input('userCode', sql.NVarChar, userCode)
        .query(`
          SELECT
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            ac.UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            d.DBName,
            d.DBTag,
            u.UserName,
            u.User_ID
          FROM AccessControl ac
          LEFT JOIN NavItems  n ON ac.NavItemID = n.NavItemID
          LEFT JOIN Databases d ON n.DatabaseID = d.DatabaseID
          INNER JOIN Users    u ON ac.UserID    = u.UserID
          WHERE u.User_ID = @userCode
          ORDER BY ac.NavItemID ASC
        `);
      return result.recordset.map(r => this._mapRow(r));
    } finally {
      await pool.close();
    }
  }

  // ── Get access for a specific NavItem + UserID combination ────────────────
  async getAccessByNavItemAndUser(navItemId, userId, database = 'USER') {
    const pool = await getPool(database);
    try {
      const result = await pool.request()
        .input('navItemId', sql.Int, navItemId)
        .input('userId',    sql.Int, userId)
        .query(`
          SELECT TOP 1
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            ac.UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            u.UserName
          FROM AccessControl ac
          LEFT JOIN NavItems n ON ac.NavItemID = n.NavItemID
          INNER JOIN Users   u ON ac.UserID    = u.UserID
          WHERE ac.NavItemID = @navItemId
            AND ac.UserID    = @userId
        `);
      if (!result.recordset.length) return null;
      return this._mapRow(result.recordset[0]);
    } finally {
      await pool.close();
    }
  }

  // ── Get access by RoutePath + numeric UserID ───────────────────────────────
  async getAccessByRouteAndUser(routePath, userId, database = 'USER') {
    const pool = await getPool(database);
    try {
      const result = await pool.request()
        .input('routePath', sql.NVarChar, routePath)
        .input('userId',    sql.Int, userId)
        .query(`
          SELECT TOP 1
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            ac.UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            u.UserName
          FROM AccessControl ac
          LEFT JOIN NavItems n ON ac.NavItemID = n.NavItemID
          INNER JOIN Users   u ON ac.UserID    = u.UserID
          WHERE n.RoutePath = @routePath
            AND ac.UserID   = @userId
        `);
      if (!result.recordset.length) return null;
      return this._mapRow(result.recordset[0]);
    } finally {
      await pool.close();
    }
  }

  // ── Get access by RoutePath + User_ID string (user-level only) ────────────
  async getAccessByRouteAndUserCode(routePath, userCode, database = 'USER') {
    const pool = await getPool(database);
    try {
      const result = await pool.request()
        .input('routePath', sql.NVarChar, routePath)
        .input('userCode',  sql.NVarChar, userCode)
        .query(`
          SELECT TOP 1
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            ac.UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            u.UserName,
            u.User_ID
          FROM AccessControl ac
          LEFT JOIN NavItems n ON ac.NavItemID = n.NavItemID
          INNER JOIN Users   u ON ac.UserID    = u.UserID
          WHERE n.RoutePath = @routePath
            AND u.User_ID   = @userCode
        `);
      if (!result.recordset.length) return null;
      return this._mapRow(result.recordset[0]);
    } finally {
      await pool.close();
    }
  }

  // ── Get access by RoutePath + User_ID with Group → Role fallback ───────────
  // Priority: user-level → group-level → role-level → null
  // This is the main method called by the frontend useAccessControl hook.
  async getAccessByRouteAndUser_ID(routePath, userCode, database = 'USER') {
    console.log(`🔍 AccessControl (fallback): route="${routePath}" userCode="${userCode}" db:`, database);
    const pool = await getPool(database);
    try {

      // ── Priority 1: User-specific row ──────────────────────────────────────
      const userResult = await pool.request()
        .input('routePath', sql.NVarChar, routePath)
        .input('userCode',  sql.NVarChar, userCode)
        .query(`
          SELECT TOP 1
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            ac.UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            u.UserName,
            u.User_ID
          FROM AccessControl ac
          INNER JOIN NavItems n ON ac.NavItemID = n.NavItemID
          INNER JOIN Users    u ON ac.UserID    = u.UserID
          WHERE n.RoutePath = @routePath
            AND u.User_ID   = @userCode
        `);

      if (userResult.recordset.length) {
        console.log(`✅ User-level access found for "${routePath}" / "${userCode}"`);
        return this._mapRow(userResult.recordset[0]);
      }

      // ── Priority 2: Group-level row (via user's GroupID) ───────────────────
      const groupResult = await pool.request()
        .input('routePath', sql.NVarChar, routePath)
        .input('userCode',  sql.NVarChar, userCode)
        .query(`
          SELECT TOP 1
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            NULL          AS UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            u.UserName,
            u.User_ID
          FROM AccessControl ac
          INNER JOIN NavItems n ON ac.NavItemID = n.NavItemID
          INNER JOIN Users    u ON u.GroupID    = ac.GroupID
          WHERE n.RoutePath  = @routePath
            AND u.User_ID    = @userCode
            AND ac.UserID   IS NULL
        `);

      if (groupResult.recordset.length) {
        console.log(`✅ Group-level access found for "${routePath}" / "${userCode}"`);
        return this._mapRow(groupResult.recordset[0]);
      }

      // ── Priority 3: Role-level row (via user's RoleID) ─────────────────────
      const roleResult = await pool.request()
        .input('routePath', sql.NVarChar, routePath)
        .input('userCode',  sql.NVarChar, userCode)
        .query(`
          SELECT TOP 1
            ac.NavItemAccessId,
            ac.NavItemID,
            ac.RoleID,
            ac.GroupID,
            NULL          AS UserID,
            ac.CanView,
            ac.CanCreate,
            ac.CanEdit,
            ac.CanDelete,
            ac.CanExport,
            ac.CanApprove,
            ac.CreatedAt,
            ac.UpdatedAt,
            n.NavItemName,
            n.RoutePath,
            n.DatabaseID,
            u.UserName,
            u.User_ID
          FROM AccessControl ac
          INNER JOIN NavItems n ON ac.NavItemID = n.NavItemID
          INNER JOIN Users    u ON u.RoleID     = ac.RoleID
          WHERE n.RoutePath  = @routePath
            AND u.User_ID    = @userCode
            AND ac.UserID   IS NULL
            AND ac.GroupID  IS NULL
        `);

      if (roleResult.recordset.length) {
        console.log(`✅ Role-level access found for "${routePath}" / "${userCode}"`);
        return this._mapRow(roleResult.recordset[0]);
      }

      console.log(`⚠️ No access (user/group/role) for "${routePath}" / "${userCode}"`);
      return null;

    } finally {
      await pool.close();
    }
  }

  // ── Get full access map for a user (keyed by NavItemID) ───────────────────
  async getAccessMapByUserId(userId, database = 'USER') {
    const rows = await this.getAccessByUserId(userId, database);
    const map  = {};
    for (const row of rows) {
      map[row.navItemId] = row;
    }
    return map;
  }

  // ── Sync: ensure every active NavItem has a user-level AccessControl row ───
  // Inherits from group → role → defaults to all false.
  async syncUserAccessControl(userCode, database = 'USER') {
    console.log(`🔄 Syncing AccessControl for User_ID="${userCode}" db:`, database);
    const pool = await getPool(database);
    try {

      // 1. Find the user
      const userResult = await pool.request()
        .input('userCode', sql.NVarChar, userCode)
        .query(`
          SELECT TOP 1 UserID, GroupID, RoleID
          FROM Users
          WHERE User_ID = @userCode AND IsActive = 1
        `);

      if (!userResult.recordset.length) {
        console.warn(`⚠️ Sync: user "${userCode}" not found or inactive`);
        return { inserted: 0, existing: 0, skipped: 0 };
      }

      const { UserID, GroupID, RoleID } = userResult.recordset[0];

      // 2. All active NavItems
      const navResult = await pool.request()
        .query(`SELECT NavItemID FROM NavItems WHERE IsActive = 1`);
      const allNavItemIds = navResult.recordset.map(r => r.NavItemID);

      // 3. Existing user-level rows for this user
      const existingResult = await pool.request()
        .input('userId', sql.Int, UserID)
        .query(`SELECT NavItemID FROM AccessControl WHERE UserID = @userId`);
      const existingSet = new Set(existingResult.recordset.map(r => r.NavItemID));

      // 4. Only process missing ones
      const missing = allNavItemIds.filter(id => !existingSet.has(id));

      if (!missing.length) {
        console.log(`✅ Sync: all ${allNavItemIds.length} rows already exist for "${userCode}"`);
        return { inserted: 0, existing: allNavItemIds.length, skipped: 0 };
      }

      console.log(`➕ Sync: inserting ${missing.length} missing rows for "${userCode}"`);

      let inserted = 0;
      let skipped  = 0;

      for (const navItemId of missing) {
        try {
          let inherited = null;

          // Try to inherit from group
          if (GroupID) {
            const gRes = await pool.request()
              .input('navItemId', sql.Int, navItemId)
              .input('groupId',   sql.Int, GroupID)
              .query(`
                SELECT TOP 1
                  CanView, CanCreate, CanEdit, CanDelete, CanExport, CanApprove
                FROM AccessControl
                WHERE NavItemID = @navItemId
                  AND GroupID   = @groupId
                  AND UserID   IS NULL
              `);
            if (gRes.recordset.length) inherited = gRes.recordset[0];
          }

          // Try to inherit from role
          if (!inherited && RoleID) {
            const rRes = await pool.request()
              .input('navItemId', sql.Int, navItemId)
              .input('roleId',    sql.Int, RoleID)
              .query(`
                SELECT TOP 1
                  CanView, CanCreate, CanEdit, CanDelete, CanExport, CanApprove
                FROM AccessControl
                WHERE NavItemID = @navItemId
                  AND RoleID    = @roleId
                  AND UserID   IS NULL
                  AND GroupID  IS NULL
              `);
            if (rRes.recordset.length) inherited = rRes.recordset[0];
          }

          // Default all false
          const p = inherited || {
            CanView: 0, CanCreate: 0, CanEdit: 0,
            CanDelete: 0, CanExport: 0, CanApprove: 0,
          };

          const req = pool.request()
            .input('navItemId',  sql.Int, navItemId)
            .input('userId',     sql.Int, UserID)
            .input('canView',    sql.Bit, p.CanView    ? 1 : 0)
            .input('canCreate',  sql.Bit, p.CanCreate  ? 1 : 0)
            .input('canEdit',    sql.Bit, p.CanEdit    ? 1 : 0)
            .input('canDelete',  sql.Bit, p.CanDelete  ? 1 : 0)
            .input('canExport',  sql.Bit, p.CanExport  ? 1 : 0)
            .input('canApprove', sql.Bit, p.CanApprove ? 1 : 0);

          // Only bind GroupID / RoleID if they are non-null integers
          if (GroupID) req.input('groupId', sql.Int, GroupID);
          if (RoleID)  req.input('roleId',  sql.Int, RoleID);

          const groupIdSql  = GroupID ? '@groupId' : 'NULL';
          const roleIdSql   = RoleID  ? '@roleId'  : 'NULL';

          await req.query(`
            INSERT INTO AccessControl
              (NavItemID, UserID, GroupID, RoleID,
               CanView, CanCreate, CanEdit, CanDelete, CanExport, CanApprove,
               CreatedAt, UpdatedAt)
            VALUES
              (@navItemId, @userId, ${groupIdSql}, ${roleIdSql},
               @canView, @canCreate, @canEdit, @canDelete, @canExport, @canApprove,
               GETDATE(), GETDATE())
          `);

          inserted++;
        } catch (rowErr) {
          console.warn(`⚠️ Skipping NavItemID=${navItemId}:`, rowErr.message);
          skipped++;
        }
      }

      console.log(`✅ Sync complete for "${userCode}": inserted=${inserted}, existing=${existingSet.size}, skipped=${skipped}`);
      return { inserted, existing: existingSet.size, skipped };

    } finally {
      await pool.close();
    }
  }

  // ── Ensure row exists: fetch with fallback, or create a default row ────────
  async ensureAccessByRouteAndUserCode(routePath, userCode, database = 'USER') {
    console.log(`🔍 ensureAccess: route="${routePath}" userCode="${userCode}" db:`, database);

    // First try full fallback lookup (user → group → role)
    const existing = await this.getAccessByRouteAndUser_ID(routePath, userCode, database);
    if (existing) return existing;

    // Nothing found — create a default user-level row (all false)
    return await this.getOrCreateAccessByRouteAndUser(routePath, userCode, database);
  }

  // ── Get existing row OR insert a default one (all permissions = false) ─────
  async getOrCreateAccessByRouteAndUser(routePath, userCode, database = 'USER') {
    console.log(`🔍 getOrCreate: route="${routePath}" user="${userCode}" db:`, database);
    const pool = await getPool(database);
    try {

      // 1. Find the NavItem
      const navResult = await pool.request()
        .input('routePath', sql.NVarChar, routePath)
        .query(`
          SELECT TOP 1 NavItemID, NavItemName, RoutePath
          FROM NavItems
          WHERE RoutePath = @routePath AND IsActive = 1
        `);

      if (!navResult.recordset.length) {
        console.warn(`⚠️ NavItem not found for RoutePath="${routePath}"`);
        return null;
      }

      const { NavItemID: navItemId, NavItemName, RoutePath: navRoutePath } = navResult.recordset[0];

      // 2. Find the User
      const userResult = await pool.request()
        .input('userCode', sql.NVarChar, userCode)
        .query(`
          SELECT TOP 1 UserID, UserName, User_ID, GroupID, RoleID
          FROM Users
          WHERE User_ID = @userCode
        `);

      if (!userResult.recordset.length) {
        console.warn(`⚠️ User not found for User_ID="${userCode}"`);
        return null;
      }

      const { UserID, UserName, GroupID, RoleID } = userResult.recordset[0];

      // 3. Check if row already exists
      const checkResult = await pool.request()
        .input('navItemId', sql.Int, navItemId)
        .input('userId',    sql.Int, UserID)
        .query(`
          SELECT TOP 1 * FROM AccessControl
          WHERE NavItemID = @navItemId AND UserID = @userId
        `);

      if (checkResult.recordset.length) {
        console.log(`✅ Row already exists for NavItemID=${navItemId} UserID=${UserID}`);
        return this._mapRow({
          ...checkResult.recordset[0],
          NavItemName,
          RoutePath: navRoutePath,
          UserName,
        });
      }

      // 4. Try to inherit permissions from group then role
      let inherited = null;

      if (GroupID) {
        const gRes = await pool.request()
          .input('navItemId', sql.Int, navItemId)
          .input('groupId',   sql.Int, GroupID)
          .query(`
            SELECT TOP 1 CanView, CanCreate, CanEdit, CanDelete, CanExport, CanApprove
            FROM AccessControl
            WHERE NavItemID = @navItemId AND GroupID = @groupId AND UserID IS NULL
          `);
        if (gRes.recordset.length) inherited = gRes.recordset[0];
      }

      if (!inherited && RoleID) {
        const rRes = await pool.request()
          .input('navItemId', sql.Int, navItemId)
          .input('roleId',    sql.Int, RoleID)
          .query(`
            SELECT TOP 1 CanView, CanCreate, CanEdit, CanDelete, CanExport, CanApprove
            FROM AccessControl
            WHERE NavItemID = @navItemId AND RoleID = @roleId
              AND UserID IS NULL AND GroupID IS NULL
          `);
        if (rRes.recordset.length) inherited = rRes.recordset[0];
      }

      const p = inherited || {
        CanView: 0, CanCreate: 0, CanEdit: 0,
        CanDelete: 0, CanExport: 0, CanApprove: 0,
      };

      // 5. Insert default row
      const insertReq = pool.request()
        .input('navItemId',  sql.Int, navItemId)
        .input('userId',     sql.Int, UserID)
        .input('canView',    sql.Bit, p.CanView    ? 1 : 0)
        .input('canCreate',  sql.Bit, p.CanCreate  ? 1 : 0)
        .input('canEdit',    sql.Bit, p.CanEdit    ? 1 : 0)
        .input('canDelete',  sql.Bit, p.CanDelete  ? 1 : 0)
        .input('canExport',  sql.Bit, p.CanExport  ? 1 : 0)
        .input('canApprove', sql.Bit, p.CanApprove ? 1 : 0);

      if (GroupID) insertReq.input('groupId', sql.Int, GroupID);
      if (RoleID)  insertReq.input('roleId',  sql.Int, RoleID);

      const groupIdSql = GroupID ? '@groupId' : 'NULL';
      const roleIdSql  = RoleID  ? '@roleId'  : 'NULL';

      const insertResult = await insertReq.query(`
        INSERT INTO AccessControl
          (NavItemID, UserID, GroupID, RoleID,
           CanView, CanCreate, CanEdit, CanDelete, CanExport, CanApprove,
           CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES
          (@navItemId, @userId, ${groupIdSql}, ${roleIdSql},
           @canView, @canCreate, @canEdit, @canDelete, @canExport, @canApprove,
           GETDATE(), GETDATE())
      `);

      console.log(`✅ Default row created for NavItemID=${navItemId} UserID=${UserID}`);
      return this._mapRow({
        ...insertResult.recordset[0],
        NavItemName,
        RoutePath: navRoutePath,
        UserName,
      });

    } finally {
      await pool.close();
    }
  }

  // ── Debug: full snapshot for a user ───────────────────────────────────────
  async debugUserAccess(userCode, database = 'USER') {
    const pool = await getPool(database);
    try {
      const userResult = await pool.request()
        .input('userCode', sql.NVarChar, userCode)
        .query(`
          SELECT UserID, User_ID, Username, GroupID, RoleID, IsActive, IsSuperUser
          FROM Users WHERE User_ID = @userCode
        `);

      const navResult = await pool.request()
        .query(`
          SELECT NavItemID, NavItemName, RoutePath, IsActive, DatabaseID
          FROM NavItems WHERE IsActive = 1 ORDER BY NavItemID ASC
        `);

      const acResult = await pool.request()
        .query(`
          SELECT
            ac.NavItemAccessID, ac.NavItemID, ac.UserID, ac.GroupID, ac.RoleID,
            ac.CanView, ac.CanCreate, ac.CanEdit, ac.CanDelete, ac.CanExport, ac.CanApprove,
            ac.CreatedAt, ac.UpdatedAt,
            n.RoutePath, n.NavItemName,
            u.User_ID, u.Username
          FROM AccessControl ac
          LEFT JOIN NavItems n ON ac.NavItemID = n.NavItemID
          LEFT JOIN Users    u ON ac.UserID    = u.UserID
          ORDER BY ac.NavItemAccessID DESC
        `);

      let userSpecificRows = [];
      if (userResult.recordset.length) {
        const userId      = userResult.recordset[0].UserID;
        const userAcResult = await pool.request()
          .input('userId', sql.Int, userId)
          .query(`
            SELECT
              ac.NavItemAccessID, ac.NavItemID, ac.UserID,
              ac.CanView, ac.CanCreate, ac.CanEdit, ac.CanDelete, ac.CanExport, ac.CanApprove,
              n.RoutePath, n.NavItemName
            FROM AccessControl ac
            LEFT JOIN NavItems n ON ac.NavItemID = n.NavItemID
            WHERE ac.UserID = @userId
            ORDER BY ac.NavItemID ASC
          `);
        userSpecificRows = userAcResult.recordset;
      }

      return {
        searchedFor:         userCode,
        userFound:           userResult.recordset,
        userFoundCount:      userResult.recordset.length,
        activeNavItems:      navResult.recordset,
        activeNavItemsCount: navResult.recordset.length,
        allAccessControl:    acResult.recordset,
        totalAccessRows:     acResult.recordset.length,
        userSpecificRows,
        userSpecificCount:   userSpecificRows.length,
      };
    } finally {
      await pool.close();
    }
  }

  // ── Private row mapper ─────────────────────────────────────────────────────
  _mapRow(row) {
    const toBool = v => v === 1 || v === true || v === '1';
    return {
      navItemAccessId: row.NavItemAccessId ?? row.NavItemAccessID,
      navItemId:       row.NavItemID,
      roleId:          row.RoleID  ?? null,
      groupId:         row.GroupID ?? null,
      userId:          row.UserID  ?? null,
      userCode:        row.User_ID    || null,
      userName:        row.UserName   || null,
      navItemName:     row.NavItemName || null,
      routePath:       row.RoutePath  || null,
      databaseId:      row.DatabaseID || null,
      dbName:          row.DBName     || null,
      dbTag:           row.DBTag      || null,
      canView:         toBool(row.CanView),
      canCreate:       toBool(row.CanCreate),
      canEdit:         toBool(row.CanEdit),
      canDelete:       toBool(row.CanDelete),
      canExport:       toBool(row.CanExport),
      canApprove:      toBool(row.CanApprove),
      createdAt:       row.CreatedAt,
      updatedAt:       row.UpdatedAt,
    };
  }
}

export default new AccessControlService();