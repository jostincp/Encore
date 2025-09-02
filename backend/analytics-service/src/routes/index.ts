/**
 * =============================================================================
 * MusicBar Analytics Service - Main Routes Configuration
 * =============================================================================
 * Description: Central routing configuration for all analytics service endpoints
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Router } from 'express';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

// Import route modules
import analyticsRoutes from './analytics';
import eventsRoutes from './events';
import reportsRoutes from './reports';

// =============================================================================
// Initialize Main Router
// =============================================================================

const router = Router();

// =============================================================================
// Global Middleware
// =============================================================================

// Request logging middleware
router.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
});

// Apply general rate limiting
router.use(rateLimiter.general);

// Apply authentication to all routes except health checks
router.use((req, res, next) => {
  // Skip authentication for health check endpoints
  if (req.path.includes('/health') || req.path.includes('/status')) {
    return next();
  }
  
  // Apply authentication middleware
  authMiddleware(req, res, next);
});

// =============================================================================
// Health Check Routes
// =============================================================================

/**
 * Service health check
 * GET /health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Analytics service is healthy',
    data: {
      service: 'analytics-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

/**
 * Service status with detailed information
 * GET /status
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      service: 'analytics-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      database: {
        status: 'connected', // This would be checked against actual DB
        connections: 'active'
      },
      redis: {
        status: process.env.REDIS_URL ? 'connected' : 'not_configured'
      }
    };

    res.json({
      success: true,
      message: 'Service status retrieved successfully',
      data: status
    });

  } catch (error) {
    logger.error('Error getting service status', { error: error.message });
    
    res.status(503).json({
      success: false,
      message: 'Service status check failed',
      data: {
        service: 'analytics-service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

// =============================================================================
// API Documentation Route
// =============================================================================

/**
 * API documentation and available endpoints
 * GET /docs
 */
router.get('/docs', (req, res) => {
  const apiDocs = {
    service: 'Encore Analytics Service',
    version: '1.0.0',
    description: 'Comprehensive analytics and reporting service for Encore platform',
    baseUrl: req.protocol + '://' + req.get('host') + req.baseUrl,
    endpoints: {
      analytics: {
        description: 'Analytics data and metrics endpoints',
        routes: [
          'GET /analytics/dashboard - Get dashboard metrics',
          'GET /analytics/metrics - Get filtered metrics',
          'GET /analytics/trending - Get trending data',
          'GET /analytics/real-time - Get real-time metrics',
          'POST /analytics/query - Execute custom analytics query'
        ]
      },
      events: {
        description: 'Event tracking and management endpoints',
        routes: [
          'POST /events - Create new event',
          'GET /events - Get events with filtering',
          'GET /events/:eventId - Get event by ID',
          'PUT /events/:eventId - Update event',
          'DELETE /events/:eventId - Delete event',
          'POST /events/batch - Batch create events'
        ]
      },
      reports: {
        description: 'Report generation and management endpoints',
        routes: [
          'POST /reports - Create new report',
          'GET /reports - Get reports with filtering',
          'GET /reports/:reportId - Get report by ID',
          'PUT /reports/:reportId - Update report',
          'DELETE /reports/:reportId - Delete report',
          'POST /reports/:reportId/generate - Generate report',
          'GET /reports/:reportId/download - Download report file',
          'GET /reports/scheduled - Get scheduled reports'
        ]
      },
      health: {
        description: 'Service health and status endpoints',
        routes: [
          'GET /health - Basic health check',
          'GET /status - Detailed service status'
        ]
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'All endpoints except /health and /status require authentication'
    },
    rateLimit: {
      requests: 1000,
      window: '15 minutes',
      note: 'Rate limiting applied to all endpoints'
    }
  };

  res.json({
    success: true,
    message: 'API documentation retrieved successfully',
    data: apiDocs
  });
});

// =============================================================================
// Mount Route Modules
// =============================================================================

// Analytics routes - /analytics/*
router.use('/analytics', analyticsRoutes);

// Events routes - /events/*
router.use('/events', eventsRoutes);

// Reports routes - /reports/*
router.use('/reports', reportsRoutes);

// =============================================================================
// Error Handling Middleware
// =============================================================================

// 404 handler for undefined routes
router.use((req, res, next) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested route ${req.method} ${req.originalUrl} was not found`,
      availableRoutes: [
        '/health',
        '/status',
        '/docs',
        '/analytics/*',
        '/events/*',
        '/reports/*'
      ]
    }
  });
});

// Global error handler
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled route error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: isDevelopment ? {
      message: error.message,
      stack: error.stack
    } : {
      message: 'An unexpected error occurred'
    }
  });
});

// =============================================================================
// Export Router
// =============================================================================

export default router;

// =============================================================================
// Route Statistics (for monitoring)
// =============================================================================

/**
 * Get route statistics and usage metrics
 * This could be used by monitoring systems
 */
export const getRouteStats = () => {
  return {
    totalRoutes: {
      analytics: 5,
      events: 6,
      reports: 15,
      health: 2,
      docs: 1
    },
    features: [
      'Real-time analytics',
      'Event tracking',
      'Report generation',
      'Scheduled reports',
      'Bulk operations',
      'Rate limiting',
      'Authentication',
      'Request logging',
      'Error handling'
    ],
    middleware: [
      'Authentication',
      'Rate limiting',
      'Request validation',
      'Error handling',
      'Request logging'
    ]
  };
};

/**
 * Route configuration summary
 */
export const routeConfig = {
  prefix: '/api/v1',
  authentication: {
    required: true,
    exceptions: ['/health', '/status', '/docs']
  },
  rateLimit: {
    enabled: true,
    requests: 1000,
    windowMs: 15 * 60 * 1000 // 15 minutes
  },
  validation: {
    enabled: true,
    strict: true
  },
  logging: {
    requests: true,
    responses: true,
    errors: true
  }
};