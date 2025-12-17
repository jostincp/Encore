import express from 'express';
import { logger, requestLogger } from './utils/logger';
import { initializeDatabase, runMigrations } from './utils/database';
import { initRedis } from './utils/redis';
import { AppError, NotFoundError } from './utils/errors';
import routes from './routes';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Configuración CORS simple para desarrollo
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

// Configuración de Helmet mínima para desarrollo
const helmetOptions = {
  contentSecurityPolicy: false
};

// Rate limiters
const rateLimiters = {
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // límite de 5 intentos por ventana
    message: { error: 'Demasiados intentos de autenticación. Intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
};

// Configuración de puerto vía variables de entorno para evitar conflictos
const app: express.Application = express();
const PORT = parseInt(process.env.AUTH_PORT || process.env.PORT || '3001', 10);

// Security middleware avanzado
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));

// Rate limiting específico para autenticación
if (process.env.DISABLE_RATE_LIMIT === 'true') {
  logger.warn('Auth rate limiting is DISABLED via DISABLE_RATE_LIMIT=true');
} else {
  app.use('/api/auth/login', rateLimiters.auth as any);
  app.use('/api/auth/register-guest', rateLimiters.auth as any);
  app.use('/api/auth/register-user', rateLimiters.auth as any);
  app.use('/api/auth/register-bar-owner', rateLimiters.auth as any);
}

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
    version: '1.0.1'
  });
});

// Routes
app.use('/api', routes);

// 404 handler for undefined routes (Express v5: use (.*) or no path)
app.use((req, res, next) => {
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
  } else if ((error as any)?.statusCode && typeof (error as any).statusCode === 'number') {
    // Manejar errores compatibles provenientes de paquetes compartidos
    statusCode = (error as any).statusCode;
    message = (error as any).message || message;
    if ((error as any).validationErrors) {
      data = { validationErrors: (error as any).validationErrors };
    }
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
  // Initialize database (optional in development)
  if (process.env.DISABLE_DB === 'true') {
    logger.warn('Database initialization skipped (DISABLE_DB=true)');
  } else {
    try {
      await initializeDatabase();
      logger.info('Database initialized');

      // Run migrations
      await runMigrations();
      logger.info('Database migrations completed');
    } catch (dbError) {
      // Do not crash the server in development
      const isDev = (process.env.NODE_ENV || 'development') === 'development';
      const message = (dbError as Error).message || 'Unknown DB error';
      if (isDev) {
        logger.warn('Database not available, continuing without DB in development', { error: message });
      } else {
        logger.error('Failed to initialize database', { error: message });
      }
    }
  }

  // Initialize Redis (optional in development)
  if (process.env.DISABLE_REDIS === 'true') {
    logger.warn('Redis initialization skipped (DISABLE_REDIS=true)');
  } else {
    try {
      await initRedis();
      logger.info('Redis initialized');
    } catch (redisError) {
      logger.warn('Redis not available, continuing without Redis in development', { error: (redisError as Error).message });
    }
  }

  // Start server (always attempt to start)
  try {
    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (listenError) {
    logger.error('Failed to start Auth Service (listen error):', listenError);
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