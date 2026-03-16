import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

// ── Helper: turn a flat items array into a parent→children tree ──────────────
// Items with parentId = null are top-level.
// Items with a parentId become children of the matching navItemId.
function buildItemTree(flatItems) {
  const byId  = {};
  const roots = [];

  // Index by navItemId first
  for (const item of flatItems) {
    byId[item.navItemId] = { ...item, children: [] };
  }

  // Attach children to parents; collect roots
  for (const item of Object.values(byId)) {
    if (item.parentId && byId[item.parentId]) {
      byId[item.parentId].children.push(item);
    } else {
      roots.push(item);
    }
  }

  // Sort roots and children by sortOrder
  const sort = arr => arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  sort(roots);
  for (const item of Object.values(byId)) sort(item.children);

  return roots;
}

class NavItemsGroupService {

  // ── Get all active groups (flat list) ──────────────────────────────────────
  async getAllGroups(database = 'USER') {
    try {
      const dbConfig = getDatabaseConfig(database);
      const pool     = await sql.connect(dbConfig);

      const result = await pool.request().query(`
        SELECT GroupID, GroupName, Description, IsActive, SortOrder, CreatedAt, UpdatedAt
        FROM NavItemGroups
        WHERE IsActive = 1
        ORDER BY SortOrder ASC, GroupName ASC
      `);

      await pool.close();
      return result.recordset;
    } catch (error) {
      console.error('❌ NavItemsGroupService.getAllGroups:', error);
      throw error;
    }
  }

  // ── Groups that have at least one active NavItem for a DatabaseID ──────────
  async getGroupsByDatabaseId(databaseId, database = 'USER') {
    try {
      const dbConfig = getDatabaseConfig(database);
      const pool     = await sql.connect(dbConfig);

      const result = await pool.request()
        .input('databaseId', sql.Int, databaseId)
        .query(`
          SELECT DISTINCT
            g.GroupID, g.GroupName, g.Description,
            g.IsActive, g.SortOrder, g.CreatedAt, g.UpdatedAt
          FROM NavItemGroups g
          INNER JOIN NavItems n ON g.GroupID = n.GroupID
          WHERE n.DatabaseID = @databaseId
            AND n.IsActive   = 1
            AND g.IsActive   = 1
          ORDER BY g.SortOrder ASC, g.GroupName ASC
        `);

      await pool.close();
      return result.recordset;
    } catch (error) {
      console.error('❌ NavItemsGroupService.getGroupsByDatabaseId:', error);
      throw error;
    }
  }

  // ── MAIN: all DBs → groups → nav items (with parent/child tree) ───────────
  // Returned shape:
  // {
  //   [DatabaseID]: {
  //     databaseId, dbName, dbTag,
  //     groups: [
  //       {
  //         groupId, groupName, sortOrder,
  //         items: [                        ← top-level items only
  //           {
  //             navItemId, navItemName, routePath, sortOrder, parentId,
  //             children: [                ← sub-items (can be nested further)
  //               { navItemId, navItemName, routePath, ... children: [] }
  //             ]
  //           }
  //         ]
  //       }
  //     ]
  //   }
  // }
  async getGroupedWithNavItems(database = 'USER') {
    try {
      console.log('🔍 NavItemsGroup: fetching full grouped nav structure from:', database);

      const dbConfig = getDatabaseConfig(database);
      const pool     = await sql.connect(dbConfig);

      const result = await pool.request().query(`
        SELECT
          d.DatabaseID,
          d.DBName,
          d.DBTag,
          g.GroupID,
          g.GroupName,
          g.Description  AS GroupDescription,
          g.SortOrder    AS GroupSortOrder,
          n.NavItemID,
          n.ParentID,
          n.NavItemName,
          n.RoutePath,
          n.SortOrder    AS NavSortOrder,
          n.Description  AS NavDescription
        FROM Databases d
        INNER JOIN NavItems      n ON d.DatabaseID = n.DatabaseID
        INNER JOIN NavItemGroups g ON n.GroupID    = g.GroupID
        WHERE d.IsActive = 1
          AND n.IsActive = 1
          AND g.IsActive = 1
        ORDER BY
          d.DatabaseID   ASC,
          g.SortOrder    ASC,
          n.SortOrder    ASC,
          n.NavItemName  ASC
      `);

      await pool.close();
      console.log(`✅ NavItemsGroup: fetched ${result.recordset.length} rows`);

      // ── Build structure ───────────────────────────────────────────────────
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
            flatItems:   [],            // temp flat list
          };
        }

        structure[dbId].groups[grpId].flatItems.push({
          navItemId:   row.NavItemID,
          parentId:    row.ParentID,   // null for top-level
          navItemName: row.NavItemName,
          routePath:   row.RoutePath,
          sortOrder:   row.NavSortOrder,
          description: row.NavDescription,
        });
      }

      // ── Convert flat items → tree, groups object → sorted array ──────────
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
      console.error('❌ NavItemsGroupService.getGroupedWithNavItems:', error);
      throw error;
    }
  }

  // ── Grouped nav items for a single DB by DBName ───────────────────────────
  async getGroupedByDBName(dbName, database = 'USER') {
    try {
      const dbConfig = getDatabaseConfig(database);
      const pool     = await sql.connect(dbConfig);

      const result = await pool.request()
        .input('dbName', sql.NVarChar, dbName)
        .query(`
          SELECT
            d.DatabaseID, d.DBName, d.DBTag,
            g.GroupID,
            g.GroupName,
            g.Description  AS GroupDescription,
            g.SortOrder    AS GroupSortOrder,
            n.NavItemID,
            n.ParentID,
            n.NavItemName,
            n.RoutePath,
            n.SortOrder    AS NavSortOrder,
            n.Description  AS NavDescription
          FROM Databases d
          INNER JOIN NavItems      n ON d.DatabaseID = n.DatabaseID
          INNER JOIN NavItemGroups g ON n.GroupID    = g.GroupID
          WHERE d.DBName   = @dbName
            AND d.IsActive = 1
            AND n.IsActive = 1
            AND g.IsActive = 1
          ORDER BY
            g.SortOrder  ASC,
            n.SortOrder  ASC,
            n.NavItemName ASC
        `);

      await pool.close();

      const groupsMap = {};
      for (const row of result.recordset) {
        if (!groupsMap[row.GroupID]) {
          groupsMap[row.GroupID] = {
            groupId:     row.GroupID,
            groupName:   row.GroupName,
            description: row.GroupDescription,
            sortOrder:   row.GroupSortOrder,
            flatItems:   [],
          };
        }
        groupsMap[row.GroupID].flatItems.push({
          navItemId:   row.NavItemID,
          parentId:    row.ParentID,
          navItemName: row.NavItemName,
          routePath:   row.RoutePath,
          sortOrder:   row.NavSortOrder,
          description: row.NavDescription,
        });
      }

      const firstRow = result.recordset[0];
      return {
        databaseId: firstRow?.DatabaseID || null,
        dbName:     firstRow?.DBName     || dbName,
        dbTag:      firstRow?.DBTag      || null,
        groups: Object.values(groupsMap)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(group => {
            const { flatItems, ...rest } = group;
            return { ...rest, items: buildItemTree(flatItems) };
          }),
      };
    } catch (error) {
      console.error('❌ NavItemsGroupService.getGroupedByDBName:', error);
      throw error;
    }
  }
}

export default new NavItemsGroupService();