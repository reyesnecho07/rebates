import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/authRoutes.js';
import nexchemRoutes from './routes/nexchemRoutes.js';
import vanRoutes from './routes/vanRoutes.js';
import vcpRoutes from './routes/vcpRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

// VAN routes
import vanrebateRoutes from './routes/Van_rebateRoutes.js';
import vandashboardRoutes from './routes/Van_dashboardRoutes.js';
import vanpayoutRoutes from './routes/Van_payoutRoutes.js';

// NEXCHEM routes
import nexchemrebateRoutes from './routes/Nexchem_rebateRoutes.js';
import nexchemdashboardRoutes from './routes/Nexchem_dashboardRoutes.js';
import nexchempayoutRoutes from './routes/Nexchem_payoutRoutes.js';
import nexchemReportRoutes from './routes/Nexchem_reportRoutes.js';

// VCP routes
import vcprebateRoutes from './routes/Vcp_rebateRoutes.js';
import vcpdashboardRoutes from './routes/Vcp_dashboardRoutes.js';
import vcppayoutRoutes from './routes/Vcp_payoutRoutes.js';

// User preferences routes
import userPreferencesRoutes from './routes/userPreferences.js';
import userAccessRoutes from './routes/userAccessRoutes.js';

// Component routes
import componentRoutes from './routes/componentRoutes.js';

// Database routes
import databaseRoutes from './routes/databaseRoutes.js';

// Nav Items routes
import navItemsRoutes from './routes/navItemsRoutes.js';

// Nav Items Group routes ← NEW
import navItemsGroupRoutes from './routes/navItemsGroupRoutes.js';

import accessControlRoutes from './routes/accessControlRoutes.js';

// Import services and config
import { initializePools } from './services/databaseService.js';
import { initializeUserDb, testUserDbConnection } from './services/userService.js';
import { config } from './config/environment.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    'http://192.168.100.193:3007',
    'http://localhost:3007',
    'http://127.0.0.1:3007',
  ],
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Component-Name',
    'X-Component-Version',
    'X-Session-Id',
    'X-Requested-With',
    'Accept',
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Handle preflight requests
app.options('*', cors());

// 2. Request logging
app.use(requestLogger);

// 3. Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Routes
app.use('/api/auth', authRoutes);
app.use('/api/nexchem', nexchemRoutes);
app.use('/api/van', vanRoutes);
app.use('/api/vcp', vcpRoutes);
app.use('/api', debugRoutes);
app.use('/api/sync', syncRoutes);

// VAN endpoints
app.use('/api', vanrebateRoutes);
app.use('/api/van/dashboard', vandashboardRoutes);
app.use('/api/van/payouts', vanpayoutRoutes);

// NEXCHEM endpoints
app.use('/api', nexchemrebateRoutes);
app.use('/api/nexchem/dashboard', nexchemdashboardRoutes);
app.use('/api/nexchem/payouts', nexchempayoutRoutes);
app.use('/api', nexchemReportRoutes);

// VCP endpoints
app.use('/api', vcprebateRoutes);
app.use('/api/vcp/dashboard', vcpdashboardRoutes);
app.use('/api/vcp/payouts', vcppayoutRoutes);

// User Preferences routes
app.use('/api/user', userPreferencesRoutes);
app.use('/api/user-access', userAccessRoutes);

// Component routes
app.use('/api/components', componentRoutes);

// Database routes
app.use('/api/databases', databaseRoutes);

// Nav Items routes
app.use('/api/nav-items', navItemsRoutes);

// Nav Items Group routes ← NEW
app.use('/api/nav-groups', navItemsGroupRoutes);

app.use('/api/access-control', accessControlRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const userDbTest = await testUserDbConnection();

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Rebate System API',
      version: '1.0.0',
      databases: {
        userDb: userDbTest.success ? '✅ Connected' : '❌ Failed',
        connection: userDbTest.success ? {
          database: userDbTest.database,
          server: userDbTest.server,
        } : null,
      },
      endpoints: {
        userPreferences:    '/api/user/preferences',
        componentAnalytics: '/api/components',
        databaseManagement: '/api/databases',
        navItems:           '/api/nav-items',
        navGroups:          '/api/nav-groups',
        rebateEndpoints: {
          van:     '/api/van-rebates',
          nexchem: '/api/nexchem-rebates',
          vcp:     '/api/vcp-rebates',
        },
        dashboardEndpoints: {
          van:     '/api/dashboard/van',
          nexchem: '/api/dashboard/nexchem',
          vcp:     '/api/dashboard/vcp',
        },
        payoutEndpoints: {
          van:     '/api/payouts/van',
          nexchem: '/api/payouts/nexchem',
          vcp:     '/api/payouts/vcp',
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// 5. Error handling (must be last)
app.use(errorHandler);

// Initialize and start server
const startServer = async () => {
  try {
    console.log('🚀 Starting server initialization...');

    console.log('🔐 Initializing USER Database...');
    await initializeUserDb();
    console.log('✅ USER Database initialized successfully');

    console.log('🔗 Initializing other database pools...');
    await initializePools();
    console.log('✅ All database pools initialized');

    app.listen(config.PORT, config.HOST, () => {
      console.log(`\n🎉 Server running on ${config.HOST}:${config.PORT}`);
      console.log('='.repeat(50));
      console.log('🔐 AUTHENTICATION SYSTEM');
      console.log('='.repeat(50));
      console.log('📊 Database: UserDB_v1.2');
      console.log('👤 Login with: User_ID from Users table');
      console.log('🔒 Password: Encrypted password from Users table');
      console.log('');
      console.log('🌐 AVAILABLE ENDPOINTS:');
      console.log('├── POST /api/login              - User login');
      console.log('├── POST /api/change-password    - Change password');
      console.log('├── GET  /api/health             - Health check');
      console.log('├── GET  /api/login/test-connection - Test DB connection');
      console.log('├── User Preferences API:');
      console.log('│   ├── GET  /api/user/preferences/:userId/theme - Get user theme');
      console.log('│   ├── POST /api/user/preferences/save         - Save preference');
      console.log('│   ├── GET  /api/user/preferences/:userId      - Get all preferences');
      console.log('│   └── DELETE /api/user/preferences/:userId/:key - Delete preference');
      console.log('├── Component Analytics API:');
      console.log('│   ├── POST /api/components/register           - Register a component');
      console.log('│   ├── POST /api/components/register-multiple  - Register multiple');
      console.log('│   ├── GET  /api/components/available-paths    - Get available paths');
      console.log('│   ├── POST /api/components/refresh            - Refresh paths');
      console.log('│   └── POST /api/components/scan-all          - Scan all components');
      console.log('├── Database Management API:');
      console.log('│   ├── GET  /api/nav-groups/dbname/:name       - Groups by DBName');
      console.log('│   ├── GET  /api/databases/test                - Test route');
      console.log('│   ├── GET  /api/databases/test-connection     - Test DB connection');
      console.log('│   ├── GET  /api/databases/with-user-order     - Get DBs with user order');
      console.log('│   ├── GET  /api/databases/all                 - Get all databases');
      console.log('│   ├── GET  /api/databases/active              - Get active databases');
      console.log('│   ├── GET  /api/databases/system-active       - Get system active DBs');
      console.log('│   ├── GET  /api/databases/server-databases    - Get server DBs');
      console.log('│   ├── GET  /api/databases/user/:userId        - Get user accessible DBs');
      console.log('│   ├── POST /api/databases                     - Create database');
      console.log('│   ├── PUT  /api/databases/:id                 - Update database');
      console.log('│   ├── POST /api/databases/access              - Update DB access');
      console.log('│   ├── PUT  /api/databases/user-order/:userId  - Update user order');
      console.log('│   └── GET  /api/databases/:id/users           - Get DB users');
      console.log('├── Nav Items API:');
      console.log('│   ├── GET  /api/nav-items/test                - Test route');
      console.log('│   ├── GET  /api/nav-items/grouped?db=USER     - All nav items grouped');
      console.log('│   ├── GET  /api/nav-items/database/:id        - By DatabaseID');
      console.log('│   └── GET  /api/nav-items/dbname/:name        - By DBName');
      console.log('├── Nav Groups API:');
      console.log('│   ├── GET  /api/nav-groups/test               - Test route');
      console.log('│   ├── GET  /api/nav-groups/all?db=USER        - All active groups');
      console.log('│   ├── GET  /api/nav-groups/database/:id       - Groups by DatabaseID');
      console.log('│   ├── GET  /api/nav-groups/with-items?db=USER - ⭐ Sidebar main endpoint');
      console.log('│   └── GET  /api/nav-groups/dbname/:name       - Groups by DBName');
      console.log('');
      console.log('📊 TARGET DATABASES:');
      console.log('├── NEXCHEM');
      console.log('├── VAN');
      console.log('├── VCP');
      console.log('└── OWN');
      console.log('');
      console.log('📋 REBATE ENDPOINTS:');
      console.log('├── VAN:     /api/van-rebates');
      console.log('├── NEXCHEM: /api/nexchem-rebates');
      console.log('└── VCP:     /api/vcp-rebates');
      console.log('');
      console.log('📊 DASHBOARD ENDPOINTS:');
      console.log('├── VAN:     /api/dashboard/van');
      console.log('├── NEXCHEM: /api/dashboard/nexchem');
      console.log('└── VCP:     /api/dashboard/vcp');
      console.log('');
      console.log('💰 PAYOUT ENDPOINTS:');
      console.log('├── VAN:     /api/payouts/van');
      console.log('├── NEXCHEM: /api/payouts/nexchem');
      console.log('└── VCP:     /api/payouts/vcp');
      console.log('');
      console.log('🔗 Quick Links:');
      console.log(`├── Health Check:          http://${config.HOST}:${config.PORT}/api/health`);
      console.log(`├── Login:                 POST http://${config.HOST}:${config.PORT}/api/login`);
      console.log(`├── DB Test:               http://${config.HOST}:${config.PORT}/api/login/test-connection`);
      console.log(`├── Theme API:             GET  http://${config.HOST}:${config.PORT}/api/user/preferences/USR001/theme`);
      console.log(`├── Component Register:    POST http://${config.HOST}:${config.PORT}/api/components/register`);
      console.log(`├── Database Test:         GET  http://${config.HOST}:${config.PORT}/api/databases/test`);
      console.log(`├── Databases with Order:  GET  http://${config.HOST}:${config.PORT}/api/databases/with-user-order`);
      console.log(`├── Nav Items Grouped:     GET  http://${config.HOST}:${config.PORT}/api/nav-items/grouped`);
      console.log(`└── Nav Groups+Items:      GET  http://${config.HOST}:${config.PORT}/api/nav-groups/with-items`);
      console.log('');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();