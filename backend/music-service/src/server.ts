import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger from '../../../shared/utils/logger';
import { initializeDatabase, closeDatabase, runMigrations } from '../../../shared/database';
import { initRedis, getRedisClient, closeRedis } from '../../../shared/utils/redis';
import { errorHandler, notFoundHandler } from '../../../shared/utils/errors';
import {
  requestLoggingMiddleware,
  healthCheckMiddleware,
  corsMiddleware,
  basicRateLimit,
  securityMiddleware
} from '../../../shared/middleware';
import routes from './routes';
import { setupSwagger } from './swagger/swagger.config';
import { 
  performanceMonitoring, 
  errorTracking, 
  detailedHealthCheck, 
  getMetrics 
} from './middleware/monitoring';

const app = express();
const PORT = config.server.port;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/music', routes);

// Error handling middleware (simplified)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    await closeDatabase();
    logger.info('Database connections closed');
    
    // Close Redis connection
    await closeRedis();
    logger.info('Redis connection closed');
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const startServer = async () => {
  try {
    // Initialize database
  await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Run migrations
    await runMigrations();
    logger.info('Database migrations completed');
    
    // Initialize Redis
    await initRedis();
    logger.info('Redis connected successfully');
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🎵 Music Service running on port ${PORT}`);
      logger.info(`Environment: ${config.server.env || 'development'}`);
      logger.info(`YouTube API configured: ${!!config.youtube.apiKey}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;