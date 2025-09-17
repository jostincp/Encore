import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { connectDatabase, runMigrations } from '../../shared/database';
import { connectRedis } from '../../shared/cache';
import { errorHandler } from '../../shared/middleware/errorHandler';
import { requestLogger } from '../../shared/middleware/requestLogger';
import { rateLimitMiddleware } from '../../shared/middleware/rateLimit';
import { corsOptions, helmetOptions } from '../../shared/security';
import routes from './routes';
import { initializeSocketHandler } from './websocket/socketHandler';
import { QueueEventEmitter } from './events/queueEvents';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Global rate limiting
app.use(rateLimitMiddleware('global', 1000, 15 * 60 * 1000)); // 1000 requests per 15 minutes

// Health check endpoint (before routes)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'queue-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    websocket: {
      connected_clients: io.engine.clientsCount,
      status: 'active'
    }
  });
});

// Routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    service: 'queue-service'
  });
});

// Initialize WebSocket handling
initializeSocketHandler(io);

// Initialize queue event emitter
QueueEventEmitter.initialize(io);

// Server startup
async function startServer() {
  try {
    // Initialize database connection
    logger.info('Connecting to database...');
    await connectDatabase();
    logger.info('Database connected successfully');

    // Run database migrations
    logger.info('Running database migrations...');
    await runMigrations();
    logger.info('Database migrations completed');

    // Initialize Redis connection
    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected successfully');

    // Start server
    const port = config.server.port || 3003;
    server.listen(port, () => {
      logger.info(`Queue Service started on port ${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`WebSocket server initialized`);
      logger.info(`Service: ${config.server.serviceName}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close WebSocket connections
  io.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Close WebSocket connections
  io.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
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

// Start the server
startServer();

export { app, server, io };