// controllers/userAccessController.js
import {
  getAccessibleDatabases,
  getAccessibleNavGroups,
  getNavItemPermissions,
  getDatabaseOrderByUserCode,
  upsertDatabaseOrder,
  getCustomAccessByUserCode,
  getGroupAccessByGroupId,
  getAllRoles,
  getAllUserGroups,
  logHistory,
  getHistory,
} from '../services/userService.js';

const userAccessController = {

  // GET /api/user-access/databases?userCode=USR001
  // Returns only the databases this user's group OR custom access grants them
  async getAccessibleDatabases(req, res) {
    try {
      const { userCode } = req.query;
      if (!userCode) return res.status(400).json({ success: false, message: 'userCode is required' });

      const data = await getAccessibleDatabases(userCode);
      res.status(200).json({ success: true, data, message: `${data.length} databases accessible` });
    } catch (error) {
      console.error('❌ getAccessibleDatabases:', error);
      res.status(500).json({ success: false, message: 'Error fetching accessible databases', error: error.message });
    }
  },

  // GET /api/user-access/nav-groups?userCode=USR001
  // ⭐ Main endpoint the Sidebar uses — nav groups + items filtered by AccessControl
  async getAccessibleNavGroups(req, res) {
    try {
      const { userCode } = req.query;
      if (!userCode) return res.status(400).json({ success: false, message: 'userCode is required' });

      const data = await getAccessibleNavGroups(userCode);
      res.status(200).json({ success: true, data, message: 'Accessible nav groups fetched' });
    } catch (error) {
      console.error('❌ getAccessibleNavGroups:', error);
      res.status(500).json({ success: false, message: 'Error fetching nav groups', error: error.message });
    }
  },

  // GET /api/user-access/permissions?userCode=USR001&navItemId=5
  // Returns CanView/CanCreate/CanEdit/CanDelete/CanExport/CanApprove for one nav item
  async getNavItemPermissions(req, res) {
    try {
      const { userCode, navItemId } = req.query;
      if (!userCode || !navItemId) {
        return res.status(400).json({ success: false, message: 'userCode and navItemId are required' });
      }

      const data = await getNavItemPermissions(userCode, parseInt(navItemId));
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getNavItemPermissions:', error);
      res.status(500).json({ success: false, message: 'Error fetching permissions', error: error.message });
    }
  },

  // GET /api/user-access/database-order?userCode=USR001
  async getDatabaseOrder(req, res) {
    try {
      const { userCode } = req.query;
      if (!userCode) return res.status(400).json({ success: false, message: 'userCode is required' });

      const data = await getDatabaseOrderByUserCode(userCode);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getDatabaseOrder:', error);
      res.status(500).json({ success: false, message: 'Error fetching database order', error: error.message });
    }
  },

  // PUT /api/user-access/database-order
  // Body: { userCode, orders: [{ databaseId, displayOrder, isVisible }] }
  async updateDatabaseOrder(req, res) {
    try {
      const { userCode, orders } = req.body;
      if (!userCode || !Array.isArray(orders)) {
        return res.status(400).json({ success: false, message: 'userCode and orders[] are required' });
      }

      const result = await upsertDatabaseOrder(userCode, orders);
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ updateDatabaseOrder:', error);
      res.status(500).json({ success: false, message: 'Error updating database order', error: error.message });
    }
  },

  // GET /api/user-access/custom-access?userCode=USR001
  async getCustomAccess(req, res) {
    try {
      const { userCode } = req.query;
      if (!userCode) return res.status(400).json({ success: false, message: 'userCode is required' });

      const data = await getCustomAccessByUserCode(userCode);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getCustomAccess:', error);
      res.status(500).json({ success: false, message: 'Error fetching custom access', error: error.message });
    }
  },

  // GET /api/user-access/group-access?groupId=1
  async getGroupAccess(req, res) {
    try {
      const groupId = parseInt(req.query.groupId);
      if (isNaN(groupId)) return res.status(400).json({ success: false, message: 'groupId is required' });

      const data = await getGroupAccessByGroupId(groupId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getGroupAccess:', error);
      res.status(500).json({ success: false, message: 'Error fetching group access', error: error.message });
    }
  },

  // GET /api/user-access/roles
  async getRoles(req, res) {
    try {
      const data = await getAllRoles();
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getRoles:', error);
      res.status(500).json({ success: false, message: 'Error fetching roles', error: error.message });
    }
  },

  // GET /api/user-access/user-groups
  async getUserGroups(req, res) {
    try {
      const data = await getAllUserGroups();
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getUserGroups:', error);
      res.status(500).json({ success: false, message: 'Error fetching user groups', error: error.message });
    }
  },

  // POST /api/user-access/history
  // Body: { userCode, actionType, actionDescription, changedBy? }
  async logHistory(req, res) {
    try {
      const { userCode, actionType, actionDescription, changedBy } = req.body;
      if (!userCode || !actionType) {
        return res.status(400).json({ success: false, message: 'userCode and actionType are required' });
      }

      await logHistory(userCode, actionType, actionDescription, changedBy);
      res.status(200).json({ success: true, message: 'History logged' });
    } catch (error) {
      console.error('❌ logHistory:', error);
      res.status(500).json({ success: false, message: 'Error logging history', error: error.message });
    }
  },

  // GET /api/user-access/history?userCode=USR001&limit=50
  async getHistory(req, res) {
    try {
      const { userCode, limit = 50 } = req.query;
      if (!userCode) return res.status(400).json({ success: false, message: 'userCode is required' });

      const data = await getHistory(userCode, parseInt(limit));
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getHistory:', error);
      res.status(500).json({ success: false, message: 'Error fetching history', error: error.message });
    }
  },

};

export default userAccessController;