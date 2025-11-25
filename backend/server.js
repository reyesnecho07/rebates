import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/authRoutes.js';
import nexchemRoutes from './routes/nexchemRoutes.js';
import vanRoutes from './routes/vanRoutes.js';
import vcpRoutes from './routes/vcpRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import syncRoutes from './routes/syncRoutes.js'; // Add this line

// Import services and config
import { initializePools } from './services/databaseService.js';
import { config } from './config/environment.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(requestLogger);
app.use(express.json());
app.use(cors({ origin: '*' }));

// Routes
app.use('/api', authRoutes);
app.use('/api/nexchem', nexchemRoutes);
app.use('/api/van', vanRoutes);
app.use('/api/vcp', vcpRoutes);
app.use('/api', debugRoutes);
app.use('/api/sync', syncRoutes); // Add this line

// Error handling middleware
app.use(errorHandler);

// Initialize and start server
const startServer = async () => {
  try {
    // Initialize database connection pools
    await initializePools();
    
    // Start the server
    app.listen(config.PORT, config.HOST, () => {
      console.log(`🚀 Server running on ${config.HOST}:${config.PORT}`);
      console.log(`📊 Multi-database support enabled for: NEXCHEM, VAN, VCP`);
      console.log(`🔄 Sync endpoints available at: /api/sync`);
      console.log(`🔗 Health check: http://192.168.100.193:${config.PORT}/api/health`);
      console.log(`🐛 Debug databases: http://192.168.100.193:${config.PORT}/api/debug-databases`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();