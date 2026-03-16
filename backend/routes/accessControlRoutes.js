import express from 'express';
import accessControlController from '../controllers/accessControlController.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Test route — GET /api/access-control/test
// ─────────────────────────────────────────────────────────────────────────────
router.get('/test', (req, res) => {
  res.json({
    success:   true,
    message:   'Access control routes are working',
    timestamp: new Date().toISOString(),
    endpoints: {
      all:                      'GET  /api/access-control?db=USER',
      byUserId:                 'GET  /api/access-control/user/:userId?db=USER',
      byUserCode:               'GET  /api/access-control/usercode/:userCode?db=USER',
      byNavItemAndUser:         'GET  /api/access-control/nav-item/:navItemId/user/:userId?db=USER',
      byRouteAndUser:           'GET  /api/access-control/route?path=/Nexchem_SalesEmployee&userId=5&db=USER',
      byRouteAndUserCode:       'GET  /api/access-control/route/usercode?path=/Nexchem_SalesEmployee&userCode=AACC10&db=USER',
      byRouteAndUser_ID:        'GET  /api/access-control/route/by-user?path=/Nexchem_SalesEmployee&userCode=AACC10&db=USER',
      ensureByRouteAndUserCode: 'GET  /api/access-control/route/usercode/ensure?path=/Nexchem_SalesEmployee&userCode=AACC10&db=USER',
      accessMap:                'GET  /api/access-control/map/:userId?db=USER',
      debug:                    'GET  /api/access-control/debug/:userCode?db=USER',
      sync:                     'POST /api/access-control/sync/:userCode?db=USER',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/access-control
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', accessControlController.getAll);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/access-control/map/:userId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/map/:userId', accessControlController.getAccessMap);

// ─────────────────────────────────────────────────────────────────────────────
// /route/* routes — MOST SPECIFIC FIRST (Express matches top-down)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/access-control/route/usercode/ensure?path=...&userCode=...
router.get('/route/usercode/ensure', accessControlController.ensureAccessByRouteAndUserCode);

// GET /api/access-control/route/usercode?path=...&userCode=...
router.get('/route/usercode', accessControlController.getByRouteAndUserCode);

// GET /api/access-control/route/by-user?path=...&userCode=...
router.get('/route/by-user', accessControlController.getByRouteAndUser_ID);

// GET /api/access-control/route?path=...&userId=...
router.get('/route', accessControlController.getByRouteAndUser);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/access-control/usercode/:userCode
// ─────────────────────────────────────────────────────────────────────────────
router.get('/usercode/:userCode', accessControlController.getByUserCode);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/access-control/user/:userId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user/:userId', accessControlController.getByUserId);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/access-control/nav-item/:navItemId/user/:userId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/nav-item/:navItemId/user/:userId', accessControlController.getByNavItemAndUser);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/access-control/debug/:userCode
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debug/:userCode', accessControlController.debugUserAccess);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/access-control/sync/:userCode
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync/:userCode', accessControlController.syncUserAccess);

export default router;