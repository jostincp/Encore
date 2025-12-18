import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
// import { createProxyMiddleware } from 'http-proxy-middleware';
import routes from './routes';
import { errorHandler, notFoundHandler, addRequestId, handleValidationErrors } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { connectDatabase } from './utils/database';
import { connectRedis } from './utils/redis';
import { config } from './utils/config';
import { MenuModel } from './models/Menu';

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'https://encore.vercel.app',
    'https://encore-admin.vercel.app'
    ];
    
    // Add environment-specific origins
    if (config.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3001', 'http://127.0.0.1:3000');
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'X-Bar-ID'
  ],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count', 'X-Page-Count']
}));

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}) as any);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

app.use(limiter as any);

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit auth requests per IP
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// Apply auth rate limiting to sensitive endpoints
app.use('/api/bars/:barId/menu', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return (authLimiter as any)(req, res, next);
  }
  return next();
});

app.use('/api/bars/:barId/categories', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return (authLimiter as any)(req, res, next);
  }
  return next();
});

app.use('/api/bars/:barId/specials', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return (authLimiter as any)(req, res, next);
  }
  return next();
});

app.use('/api/specials/:specialId', (req, res, next) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return (authLimiter as any)(req, res, next);
  }
  return next();
});

// Request parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      const response = res as any;
      response.status(400).json({
        success: false,
        error: 'Invalid JSON format',
        code: 'INVALID_JSON'
      });
      return;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Add request ID to all requests
app.use(addRequestId);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[level]('Request completed', {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
});

// Health check endpoint (before routes)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Menu service is healthy',
    timestamp: new Date().toISOString(),
    service: 'menu-service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: config.NODE_ENV
  });
});

// API routes
app.use('/', routes);

// Handle validation errors
app.use(handleValidationErrors);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize database and Redis connections
const initializeConnections = async () => {
  try {
    // Connect to PostgreSQL
    const pool = await connectDatabase();
    logger.info('Database connected successfully');
    
    // Initialize Models
    await MenuModel.initialize(pool);
    logger.info('MenuModel initialized');
    
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize connections', { error });
    return false;
  }
};

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  const server = app.listen();
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections
    // Note: Add actual database and Redis cleanup here
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

export { app, initializeConnections };
export default app;