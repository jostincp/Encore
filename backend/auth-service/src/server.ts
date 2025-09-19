import express from 'express';
import { logger, requestLogger } from './utils/logger';
import { initializeDatabase, runMigrations } from './utils/database';
import { initRedis } from './utils/redis';
import { AppError, NotFoundError } from './utils/errors';
import routes from './routes';
import {
  corsOptions,
  helmetOptions,
  rateLimiters,
  securityMiddleware
} from '../../shared/security';
import cors from 'cors';
import helmet from 'helmet';

// Configuración básica sin shared
const config = {
  services: { auth: { port: 3001 } }
};

const app: express.Application = express();
const PORT = config.services.auth.port;

// Security middleware avanzado
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));

// Rate limiting específico para autenticación
app.use('/api/auth/login', rateLimiters.auth);
app.use('/api/auth/register-guest', rateLimiters.auth);
app.use('/api/auth/register-member', rateLimiters.auth);
app.use('/api/auth/register-bar-owner', rateLimiters.auth);

// General middleware with stricter limits for security
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    version: '1.0.0'
  });
});

// Routes
app.use('/api', routes);

// 404 handler for undefined routes
app.use('*', (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
});

// Global error handler (must be last)
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let data: any = undefined;

  // Enhanced logging for security events
  const logData: any = {
    error: error.message,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  // Add user info if available
  if ((req as any).user) {
    logData.userId = (req as any).user.userId;
    logData.userRole = (req as any).user.role;
  }

  // Log security-related errors with higher priority
  if (error instanceof AppError && (error.statusCode === 401 || error.statusCode === 403)) {
    logger.warn('Security event: Authentication/Authorization failure', logData);
  } else if (statusCode >= 500) {
    logger.error('Server error', { ...logData, stack: error.stack });
  } else {
    logger.error('Application error', logData);
  }

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }

  if (process.env.NODE_ENV === 'development') {
    data = { stack: error.stack };
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    data
  });
});

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
    await initRedis();
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