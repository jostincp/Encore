import { Router } from 'express';
import pointsRoutes from './points';
import paymentsRoutes from './payments';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'points-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API info endpoint
router.get('/info', (req, res) => {
  res.json({
    service: 'Encore Points & Payments Service',
    version: '1.0.0',
    description: 'Microservice for managing user points and payment transactions',
    endpoints: {
      points: {
        user_routes: [
          'GET /api/points/bars/:barId/balance - Get user points balance for a bar',
          'GET /api/points/bars/:barId/transactions - Get user transactions for a bar',
          'GET /api/points/summary - Get user points summary across all bars',
          'GET /api/points/bars/:barId/leaderboard - Get leaderboard for a bar'
        ],
        admin_routes: [
          'POST /api/points/transaction - Add points transaction (admin)',
          'POST /api/points/transfer - Transfer points between users (admin)',
          'POST /api/points/bulk - Bulk add points to multiple users (admin)',
          'GET /api/points/bars/:barId/stats - Get bar points statistics (admin)',
          'GET /api/points/bars/:barId/admin/transactions - Get all bar transactions (admin)'
        ]
      },
      payments: {
        public_routes: [
          'GET /api/payments/packages - Get available points packages',
          'POST /api/payments/webhook - Handle Stripe webhooks'
        ],
        user_routes: [
          'POST /api/payments/intent - Create payment intent for points purchase',
          'GET /api/payments/:paymentId - Get payment details',
          'GET /api/payments/user/history - Get user payment history',
          'GET /api/payments/user/summary - Get user payment summary',
          'GET /api/payments/user/methods - Get saved payment methods'
        ],
        admin_routes: [
          'GET /api/payments/bars/:barId/history - Get bar payment history (admin)',
          'GET /api/payments/bars/:barId/stats - Get bar payment statistics (admin)',
          'POST /api/payments/:paymentId/refund - Refund payment (admin)'
        ]
      }
    },
    features: {
      points_system: [
        'User points balance management',
        'Transaction history tracking',
        'Points earning and spending',
        'Admin points management',
        'Points transfer between users',
        'Bulk points operations',
        'Leaderboards and statistics',
        'Real-time balance updates'
      ],
      payment_system: [
        'Stripe payment integration',
        'Points purchase with multiple packages',
        'Payment intent creation',
        'Webhook handling for payment events',
        'Payment history and analytics',
        'Refund processing',
        'Payment method management',
        'Revenue tracking and reporting'
      ],
      security: [
        'JWT authentication',
        'Role-based access control',
        'Rate limiting per endpoint',
        'Input validation and sanitization',
        'Stripe webhook signature verification',
        'Admin permission checks'
      ],
      performance: [
        'Redis caching for frequently accessed data',
        'Database connection pooling',
        'Optimized queries with indexes',
        'Pagination for large datasets',
        'Background processing for webhooks'
      ]
    },
    rate_limits: {
      general: '100 requests per 15 minutes',
      payments: '5 payment attempts per minute',
      transactions: '10 transactions per minute',
      admin: '30 admin actions per minute',
      webhooks: '1000 webhook calls per minute'
    },
    authentication: {
      required: 'JWT token in Authorization header (Bearer token)',
      roles: ['user', 'bar_owner', 'admin', 'super_admin'],
      permissions: {
        user: 'Can view own points and make payments',
        bar_owner: 'Can manage points for owned bars',
        admin: 'Can manage points for any bar',
        super_admin: 'Full system access'
      }
    },
    integrations: {
      stripe: {
        version: '2023-10-16',
        features: ['Payment Intents', 'Webhooks', 'Refunds', 'Customer Management'],
        supported_methods: ['card', 'us_bank_account', 'sepa_debit']
      },
      database: {
        type: 'PostgreSQL',
        tables: ['user_points', 'points_transactions', 'payments'],
        features: ['ACID transactions', 'Foreign key constraints', 'Indexes']
      },
      cache: {
        type: 'Redis',
        usage: ['User balances', 'Statistics', 'Payment data'],
        ttl: 'Variable based on data type'
      }
    },
    environment: {
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3004
    }
  });
});

// Mount route modules
router.use('/points', pointsRoutes);
router.use('/payments', paymentsRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    available_endpoints: {
      health: 'GET /api/health',
      info: 'GET /api/info',
      points: 'GET /api/info for full endpoint list',
      payments: 'GET /api/info for full endpoint list'
    }
  });
});

export default router;