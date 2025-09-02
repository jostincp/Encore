import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { database } from '../../shared/database';
import { redisClient } from '../../shared/utils/redis';
import { errorHandler, notFoundHandler } from '../../shared/utils/errors';
import { requestLogger, healthCheck } from '../../shared/middleware';
import routes from './routes';

const app = express();
const PORT = config.music.port || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials
}));

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(requestLogger);

// Health check endpoint
app.use('/health', healthCheck);

// Routes
import routes from './routes';
app.use('/api', routes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    await database.close();
    logger.info('Database connections closed');
    
    // Close Redis connection
    await redisClient.quit();
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
    await database.initialize();
    logger.info('Database initialized successfully');
    
    // Run migrations
    await database.runMigrations();
    logger.info('Database migrations completed');
    
    // Initialize Redis
    await redisClient.connect();
    logger.info('Redis connected successfully');
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🎵 Music Service running on port ${PORT}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Service: ${config.serviceName}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;