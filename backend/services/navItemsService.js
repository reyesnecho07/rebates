import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

class NavItemsService {

  // ── Get all active nav items grouped by DatabaseID ────────────────────────
  // Returns: { [databaseId]: [ { NavItemID, NavItemName, RoutePath, SortOrder, ... } ] }
  async getAllNavItemsGrouped(database = 'USER') {
    try {
      console.log('🔍 NavItems: fetching all active nav items from:', database);

      const dbConfig = getDatabaseConfig(database);
      const pool     = await sql.connect(dbConfig);

      const query = `
        SELECT
          n.NavItemID,
          n.DatabaseID,
          n.GroupID,
          n.ParentID,
          n.NavItemName,
          n.RoutePath,
          n.SortOrder,
          n.Description,
          n.IsActive,
          n.CreatedAt,
          n.UpdatedAt,
          d.DBName,
          d.DBTag
        FROM NavItems n
        INNER JOIN Databases d ON n.DatabaseID = d.DatabaseID
        WHERE n.IsActive = 1
          AND d.IsActive = 1
        ORDER BY
          d.DatabaseID ASC,
          n.SortOrder  ASC,
          n.NavItemName ASC
      `;

      const result = await pool.request().query(query);
      await pool.close();

      console.log(`✅ NavItems: fetched ${result.recordset.length} rows`);

      // Group by DatabaseID so the frontend can look them up easily
      const grouped = {};
      for (const row of result.recordset) {
        const key = row.DatabaseID;
        if (!grouped[key]) grouped[key] = { dbName: row.DBName, dbTag: row.DBTag, items: [] };
        grouped[key].items.push({
          navItemId:   row.NavItemID,
          databaseId:  row.DatabaseID,
          groupId:     row.GroupID,
          parentId:    row.ParentID,
          navItemName: row.NavItemName,
          routePath:   row.RoutePath,
          sortOrder:   row.SortOrder,
          description: row.Description,
          isActive:    row.IsActive,
        });
      }

      return grouped;
    } catch (error) {
      console.error('❌ NavItemsService.getAllNavItemsGrouped:', error);
      throw error;
    }
  }

  // ── Get nav items for a single database ───────────────────────────────────
  async getNavItemsByDatabaseId(databaseId, database = 'USER') {
    try {
      console.log(`🔍 NavItems: fetching items for DatabaseID ${databaseId} from:`, database);

      const dbConfig = getDatabaseConfig(database);
      const pool     = await sql.connect(dbConfig);

      const query = `
        SELECT
          n.NavItemID,
          n.DatabaseID,
          n.GroupID,
          n.ParentID,
          n.NavItemName,
          n.RoutePath,
          n.SortOrder,
          n.Description,
          n.IsActive,
          n.CreatedAt,
          n.UpdatedAt
        FROM NavItems n
        WHERE n.DatabaseID = @databaseId
          AND n.IsActive   = 1
        ORDER BY
          n.SortOrder  ASC,
          n.NavItemName ASC
      `;

      const result = await pool.request()
        .input('databaseId', sql.Int, databaseId)
        .query(query);

      await pool.close();

      console.log(`✅ NavItems: fetched ${result.recordset.length} items for DB ${databaseId}`);

      return result.recordset.map(row => ({
        navItemId:   row.NavItemID,
        databaseId:  row.DatabaseID,
        groupId:     row.GroupID,
        parentId:    row.ParentID,
        navItemName: row.NavItemName,
        routePath:   row.RoutePath,
        sortOrder:   row.SortOrder,
        description: row.Description,
        isActive:    row.IsActive,
      }));
    } catch (error) {
      console.error('❌ NavItemsService.getNavItemsByDatabaseId:', error);
      throw error;
    }
  }

  // ── Get nav items for a DBName (e.g. "VAN_DB") ────────────────────────────
  async getNavItemsByDBName(dbName, database = 'USER') {
    try {
      console.log(`🔍 NavItems: fetching items for DBName "${dbName}" from:`, database);

      const dbConfig = getDatabaseConfig(database);
      const pool     = await sql.connect(dbConfig);

      const query = `
        SELECT
          n.NavItemID,
          n.DatabaseID,
          n.GroupID,
          n.ParentID,
          n.NavItemName,
          n.RoutePath,
          n.SortOrder,
          n.Description,
          n.IsActive,
          n.CreatedAt,
          n.UpdatedAt,
          d.DBName,
          d.DBTag
        FROM NavItems n
        INNER JOIN Databases d ON n.DatabaseID = d.DatabaseID
        WHERE d.DBName  = @dbName
          AND n.IsActive = 1
          AND d.IsActive = 1
        ORDER BY
          n.SortOrder  ASC,
          n.NavItemName ASC
      `;

      const result = await pool.request()
        .input('dbName', sql.NVarChar, dbName)
        .query(query);

      await pool.close();

      console.log(`✅ NavItems: fetched ${result.recordset.length} items for "${dbName}"`);

      return result.recordset.map(row => ({
        navItemId:   row.NavItemID,
        databaseId:  row.DatabaseID,
        dbName:      row.DBName,
        dbTag:       row.DBTag,
        groupId:     row.GroupID,
        parentId:    row.ParentID,
        navItemName: row.NavItemName,
        routePath:   row.RoutePath,
        sortOrder:   row.SortOrder,
        description: row.Description,
        isActive:    row.IsActive,
      }));
    } catch (error) {
      console.error('❌ NavItemsService.getNavItemsByDBName:', error);
      throw error;
    }
  }
}

export default new NavItemsService();