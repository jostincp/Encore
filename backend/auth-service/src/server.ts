import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { initializeDatabase, runMigrations } from '../../shared/database';
import { initializeRedis } from '../../shared/utils/redis';
import { errorHandler, notFoundHandler } from '../../shared/utils/errors';
import { requestLogger, healthCheck } from '../../shared/middleware';
import routes from './routes';

const app = express();
const PORT = config.server.port || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Bar-ID', 'X-Table-ID']
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Health check
app.use('/health', healthCheck);

import routes from './routes';

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Run migrations
    await runMigrations();
    logger.info('Database migrations completed');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start Auth Service:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

export default app;