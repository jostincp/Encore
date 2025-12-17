import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import 'express-async-errors';

import { config } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { initializeDatabase } from '../../shared/database';
import { initRedis, getRedisClient } from '../../shared/utils/redis';
import {
  securityMiddleware,
  corsOptions,
  helmetOptions,
  generalRateLimit,
  authRateLimit,
  externalApiRateLimit
} from '../../shared/security';
import routes from './routes';

const app: express.Application = express();
const PORT = config.services.points.port;


// Security middleware con configuraciones centralizadas
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));

// Compression middleware
app.use(compression() as any);

// Raw body parser for Stripe webhooks (must be before express.json)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Rate limiting específico para puntos
app.use('/api/points/earn', authRateLimit as any);
app.use('/api/points/redeem', authRateLimit as any);
app.use('/api/rewards', generalRateLimit as any);

// Rate limiting general para API
app.use('/api', generalRateLimit as any);

// Middleware de seguridad centralizado
app.use(securityMiddleware);

// Mount API routes
app.use('/api', routes);



// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await checkDatabaseHealth();
    // Check Redis connection
    const redisStatus = await checkRedisHealth();

    const status = dbStatus && redisStatus ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status,
      service: 'points-service',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus ? 'connected' : 'disconnected',
        redis: redisStatus ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'points-service',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    service: 'points-service'
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? error.message : 'Something went wrong',
    service: 'points-service',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Health check helper functions
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: config.database.url });
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    await redis.quit();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

// Graceful shutdown handler
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout. Forcing exit.');
    process.exit(1);
  }, parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'));

  // Close server and cleanup resources
  Promise.all([
    // Add cleanup logic here if needed
  ]).then(() => {
    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed.');
    process.exit(0);
  }).catch((error) => {
    logger.error('Error during graceful shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  });
}

// Start server
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis connection
    await initRedis();
    logger.info('Redis connected successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Points service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}


export default app;