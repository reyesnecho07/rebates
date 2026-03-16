// routes/userAccessRoutes.js
import express from 'express';
import userAccessController from '../controllers/userAccessController.js';

const router = express.Router();

// GET /api/user-access/test
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'User access routes working',
    endpoints: {
      accessibleDatabases: 'GET  /api/user-access/databases?userCode=USR001',
      accessibleNavGroups: 'GET  /api/user-access/nav-groups?userCode=USR001   ⭐ Sidebar uses this',
      navItemPermissions:  'GET  /api/user-access/permissions?userCode=USR001&navItemId=5',
      getDatabaseOrder:    'GET  /api/user-access/database-order?userCode=USR001',
      updateDatabaseOrder: 'PUT  /api/user-access/database-order',
      customAccess:        'GET  /api/user-access/custom-access?userCode=USR001',
      groupAccess:         'GET  /api/user-access/group-access?groupId=1',
      roles:               'GET  /api/user-access/roles',
      userGroups:          'GET  /api/user-access/user-groups',
      logHistory:          'POST /api/user-access/history',
      getHistory:          'GET  /api/user-access/history?userCode=USR001&limit=50',
    }
  });
});

// Databases this user is allowed to access
router.get('/databases',        userAccessController.getAccessibleDatabases);

// ⭐ Nav groups + items filtered through AccessControl — Sidebar uses this
router.get('/nav-groups',       userAccessController.getAccessibleNavGroups);

// Per-item permission check (pages use this to show/hide buttons)
router.get('/permissions',      userAccessController.getNavItemPermissions);

// Database display order + visibility per user
router.get('/database-order',   userAccessController.getDatabaseOrder);
router.put('/database-order',   userAccessController.updateDatabaseOrder);

// Custom DB access granted directly to a user
router.get('/custom-access',    userAccessController.getCustomAccess);

// Group DB access (admin use)
router.get('/group-access',     userAccessController.getGroupAccess);

// Reference data
router.get('/roles',            userAccessController.getRoles);
router.get('/user-groups',      userAccessController.getUserGroups);

// User action history
router.get('/history',          userAccessController.getHistory);
router.post('/history',         userAccessController.logHistory);

export default router;