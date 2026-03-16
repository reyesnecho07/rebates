import accessControlService from '../services/accessControlService.js';

const accessControlController = {

  // GET /api/access-control
  async getAll(req, res) {
    try {
      const dbName = req.query.db || 'USER';
      const data   = await accessControlService.getAllAccessControl(dbName);
      res.status(200).json({ success: true, data, message: 'Fetched successfully' });
    } catch (error) {
      console.error('❌ getAll:', error);
      res.status(500).json({ success: false, message: 'Error fetching', error: error.message });
    }
  },

  // GET /api/access-control/user/:userId
  async getByUserId(req, res) {
    try {
      const dbName = req.query.db || 'USER';
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid userId' });
      }
      const data = await accessControlService.getAccessByUserId(userId, dbName);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getByUserId:', error);
      res.status(500).json({ success: false, message: 'Error fetching', error: error.message });
    }
  },

  // GET /api/access-control/usercode/:userCode
  async getByUserCode(req, res) {
    try {
      const dbName   = req.query.db || 'USER';
      const userCode = req.params.userCode;
      if (!userCode) {
        return res.status(400).json({ success: false, message: 'Missing userCode' });
      }
      const data = await accessControlService.getAccessByUserCode(userCode, dbName);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getByUserCode:', error);
      res.status(500).json({ success: false, message: 'Error fetching', error: error.message });
    }
  },

  // GET /api/access-control/nav-item/:navItemId/user/:userId
  async getByNavItemAndUser(req, res) {
    try {
      const dbName    = req.query.db || 'USER';
      const navItemId = parseInt(req.params.navItemId, 10);
      const userId    = parseInt(req.params.userId, 10);
      if (isNaN(navItemId) || isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid navItemId or userId' });
      }
      const data = await accessControlService.getAccessByNavItemAndUser(navItemId, userId, dbName);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('❌ getByNavItemAndUser:', error);
      res.status(500).json({ success: false, message: 'Error fetching', error: error.message });
    }
  },

  // GET /api/access-control/route?path=...&userId=...
  async getByRouteAndUser(req, res) {
    try {
      const dbName    = req.query.db || 'USER';
      const routePath = req.query.path;
      const userId    = parseInt(req.query.userId, 10);
      if (!routePath) {
        return res.status(400).json({ success: false, message: 'Missing path' });
      }
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid userId' });
      }
      const data = await accessControlService.getAccessByRouteAndUser(routePath, userId, dbName);
      res.status(200).json({ success: true, data: data || null, found: !!data });
    } catch (error) {
      console.error('❌ getByRouteAndUser:', error);
      res.status(500).json({ success: false, message: 'Error fetching', error: error.message });
    }
  },

  // GET /api/access-control/route/usercode?path=...&userCode=...
  async getByRouteAndUserCode(req, res) {
    try {
      const dbName    = req.query.db || 'USER';
      const routePath = req.query.path;
      const userCode  = req.query.userCode;
      if (!routePath) {
        return res.status(400).json({ success: false, message: 'Missing path' });
      }
      if (!userCode) {
        return res.status(400).json({ success: false, message: 'Missing userCode' });
      }
      const data = await accessControlService.getAccessByRouteAndUserCode(routePath, userCode, dbName);
      res.status(200).json({ success: true, data: data || null, found: !!data });
    } catch (error) {
      console.error('❌ getByRouteAndUserCode:', error);
      res.status(500).json({ success: false, message: 'Error fetching', error: error.message });
    }
  },

  // GET /api/access-control/route/by-user?path=...&userCode=...
  // Main method used by the frontend hook — user → group → role fallback
  async getByRouteAndUser_ID(req, res) {
    try {
      const dbName    = req.query.db || 'USER';
      const routePath = req.query.path;
      const userCode  = req.query.userCode;
      if (!routePath) {
        return res.status(400).json({ success: false, message: 'Missing path' });
      }
      if (!userCode) {
        return res.status(400).json({ success: false, message: 'Missing userCode' });
      }
      const data = await accessControlService.getAccessByRouteAndUser_ID(routePath, userCode, dbName);
      res.status(200).json({ success: true, data: data || null, found: !!data });
    } catch (error) {
      console.error('❌ getByRouteAndUser_ID:', error);
      res.status(500).json({ success: false, message: 'Error fetching', error: error.message });
    }
  },

  // GET /api/access-control/route/usercode/ensure?path=...&userCode=...
  // Gets existing record (with fallback) OR creates a default row
  async ensureAccessByRouteAndUserCode(req, res) {
    try {
      const dbName    = req.query.db || 'USER';
      const routePath = req.query.path;
      const userCode  = req.query.userCode;
      if (!routePath) {
        return res.status(400).json({ success: false, message: 'Missing path' });
      }
      if (!userCode) {
        return res.status(400).json({ success: false, message: 'Missing userCode' });
      }
      const data = await accessControlService.ensureAccessByRouteAndUserCode(routePath, userCode, dbName);
      res.status(200).json({ success: true, data: data || null, found: !!data });
    } catch (error) {
      console.error('❌ ensureAccessByRouteAndUserCode:', error);
      res.status(500).json({ success: false, message: 'Error ensuring access', error: error.message });
    }
  },

  // GET /api/access-control/map/:userId
  async getAccessMap(req, res) {
    try {
      const dbName = req.query.db || 'USER';
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid userId' });
      }
      const map = await accessControlService.getAccessMapByUserId(userId, dbName);
      res.status(200).json({ success: true, data: map });
    } catch (error) {
      console.error('❌ getAccessMap:', error);
      res.status(500).json({ success: false, message: 'Error fetching map', error: error.message });
    }
  },

  // POST /api/access-control/sync/:userCode
  async syncUserAccess(req, res) {
    try {
      const dbName   = req.query.db || 'USER';
      const userCode = req.params.userCode;
      if (!userCode) {
        return res.status(400).json({ success: false, message: 'Missing userCode' });
      }
      const result = await accessControlService.syncUserAccessControl(userCode, dbName);
      res.status(200).json({
        success: true,
        data:    result,
        message: `Sync complete: ${result.inserted} inserted, ${result.existing} existed, ${result.skipped} skipped`,
      });
    } catch (error) {
      console.error('❌ syncUserAccess:', error);
      res.status(500).json({ success: false, message: 'Error syncing', error: error.message });
    }
  },

  // GET /api/access-control/debug/:userCode
  async debugUserAccess(req, res) {
    try {
      const dbName   = req.query.db || 'USER';
      const userCode = req.params.userCode;
      if (!userCode) {
        return res.status(400).json({ success: false, message: 'Missing userCode' });
      }
      const debug = await accessControlService.debugUserAccess(userCode, dbName);
      res.json({ success: true, debug });
    } catch (error) {
      console.error('❌ debugUserAccess:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

};

export default accessControlController;