/**
 * =============================================================================
 * Encore Analytics Service - Analytics Routes
 * =============================================================================
 * Description: Routes for analytics and metrics endpoints
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { validationMiddleware } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { body, query, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Simple validation middleware for express-validator
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// =============================================================================
// Router Setup
// =============================================================================

const router = Router();
const analyticsController = new AnalyticsController();

// =============================================================================
// Validation Rules
// =============================================================================

const createAnalyticsValidation = [
  body('bar_id')
    .isString()
    .notEmpty()
    .withMessage('bar_id is required and must be a string'),
  body('metric_type')
    .isString()
    .notEmpty()
    .withMessage('metric_type is required and must be a string'),
  body('metricName')
    .isString()
    .notEmpty()
    .withMessage('metricName is required and must be a string'),
  body('value')
    .isNumeric()
    .withMessage('value must be a number'),
  body('unit')
    .optional()
    .isString()
    .withMessage('unit must be a string'),
  body('dimensions')
    .optional()
    .isObject()
    .withMessage('dimensions must be an object'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('tags must be an array'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('date must be a valid ISO 8601 date')
];

const batchAnalyticsValidation = [
  body('analytics')
    .isArray({ min: 1, max: 100 })
    .withMessage('analytics must be an array with 1-100 items'),
  body('analytics.*.bar_id')
    .isString()
    .notEmpty()
    .withMessage('Each analytics item must have a valid bar_id'),
  body('analytics.*.metric_type')
    .isString()
    .notEmpty()
    .withMessage('Each analytics item must have a valid metric_type'),
  body('analytics.*.metricName')
    .isString()
    .notEmpty()
    .withMessage('Each analytics item must have a valid metricName'),
  body('analytics.*.value')
    .isNumeric()
    .withMessage('Each analytics item must have a valid numeric value')
];

const queryValidation = [
  query('bar_id')
    .optional()
    .isString()
    .withMessage('bar_id must be a string'),
  query('metric_type')
    .optional()
    .isString()
    .withMessage('metric_type must be a string'),
  query('metricName')
    .optional()
    .isString()
    .withMessage('metricName must be a string'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO 8601 date'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('limit must be between 1 and 1000'),
  query('sort_by')
    .optional()
    .isString()
    .withMessage('sort_by must be a string'),
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sort_order must be either asc or desc')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid analytics ID format')
];

const aggregationValidation = [
  query('bar_id')
    .isString()
    .notEmpty()
    .withMessage('bar_id is required'),
  query('metric_type')
    .optional()
    .isString()
    .withMessage('metric_type must be a string'),
  query('aggregation')
    .optional()
    .isIn(['sum', 'avg', 'min', 'max', 'count'])
    .withMessage('aggregation must be one of: sum, avg, min, max, count'),
  query('group_by')
    .optional()
    .isString()
    .withMessage('group_by must be a string'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO 8601 date')
];

const timeSeriesValidation = [
  query('bar_id')
    .isString()
    .notEmpty()
    .withMessage('bar_id is required'),
  query('metricName')
    .isString()
    .notEmpty()
    .withMessage('metricName is required'),
  query('interval')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('interval must be one of: hour, day, week, month'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO 8601 date')
];

const exportValidation = [
  query('bar_id')
    .isString()
    .notEmpty()
    .withMessage('bar_id is required'),
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('format must be either json or csv'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO 8601 date')
];

// =============================================================================
// Routes
// =============================================================================

// Create single analytics record
router.post('/',
  createAnalyticsValidation,
  validateRequest,
  analyticsController.createAnalytics.bind(analyticsController)
);

// Create multiple analytics records
router.post('/batch',
  rateLimitMiddleware({ windowMs: 60000, max: 10 }), // More restrictive for batch operations
  batchAnalyticsValidation,
  validateRequest,
  analyticsController.createAnalyticsBatch.bind(analyticsController)
);

// Get analytics with filtering and pagination
router.get('/',
  queryValidation,
  validateRequest,
  analyticsController.getAnalytics.bind(analyticsController)
);

// =============================================================================
// Aggregation and Analysis Routes
// =============================================================================

// Get aggregated metrics
router.get('/aggregated/metrics',
  aggregationValidation,
  validateRequest,
  analyticsController.getAggregatedMetrics.bind(analyticsController)
);

// Get time series data
router.get('/timeseries/:metricName',
  timeSeriesValidation,
  validateRequest,
  analyticsController.getTimeSeriesData.bind(analyticsController)
);

// Get top metrics
router.get('/top/metrics',
  queryValidation,
  validateRequest,
  analyticsController.getTopMetrics.bind(analyticsController)
);

// Get trending metrics
router.get('/trending/metrics',
  queryValidation,
  validateRequest,
  analyticsController.getTrendingMetrics.bind(analyticsController)
);

// =============================================================================
// Dashboard Routes
// =============================================================================

// Get dashboard data
router.get('/dashboard/overview',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  query('period').optional().isIn(['today', 'week', 'month', 'year']).withMessage('Invalid period'),
  validateRequest,
  analyticsController.getDashboardOverview.bind(analyticsController)
);

// Get real-time metrics
router.get('/realtime/metrics',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  validateRequest,
  analyticsController.getRealTimeMetrics.bind(analyticsController)
);

// =============================================================================
// Time-based Analytics Routes
// =============================================================================

// Get daily analytics
router.get('/daily/:date',
  param('date').isISO8601().withMessage('Invalid date format'),
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  validateRequest,
  analyticsController.getDailyAnalytics.bind(analyticsController)
);

// Get weekly analytics
router.get('/weekly',
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
  query('week').isInt({ min: 1, max: 53 }).withMessage('Invalid week number'),
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  validateRequest,
  analyticsController.getWeeklyAnalytics.bind(analyticsController)
);

// Get monthly analytics
router.get('/monthly',
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
  query('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  validateRequest,
  analyticsController.getMonthlyAnalytics.bind(analyticsController)
);

// =============================================================================
// Type-specific Analytics Routes
// =============================================================================

// Get analytics by type
router.get('/type/:type',
  param('type').isString().notEmpty().withMessage('type is required'),
  queryValidation,
  validateRequest,
  analyticsController.getAnalyticsByType.bind(analyticsController)
);

// =============================================================================
// Bulk Operations Routes
// =============================================================================

// Bulk upsert analytics
router.post('/bulk/upsert',
  rateLimitMiddleware({ windowMs: 60000, max: 5 }), // Very restrictive for bulk operations
  batchAnalyticsValidation,
  validateRequest,
  analyticsController.bulkUpsertAnalytics.bind(analyticsController)
);

// Aggregate metrics from events
router.post('/aggregate/from-events',
  body('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  body('start_date').optional().isISO8601().withMessage('start_date must be a valid date'),
  body('end_date').optional().isISO8601().withMessage('end_date must be a valid date'),
  body('event_types').optional().isArray().withMessage('event_types must be an array'),
  validateRequest,
  analyticsController.aggregateFromEvents.bind(analyticsController)
);

// =============================================================================
// Export and Reporting Routes
// =============================================================================

// Export analytics data
router.get('/export/data',
  exportValidation,
  validateRequest,
  analyticsController.exportData.bind(analyticsController)
);

// =============================================================================
// Maintenance Routes
// =============================================================================

// Clean up old analytics data
router.delete('/cleanup/old',
  body('older_than_days').optional().isInt({ min: 1 }).withMessage('older_than_days must be a positive integer'),
  body('batch_size').optional().isInt({ min: 1, max: 1000 }).withMessage('batch_size must be between 1 and 1000'),
  body('dry_run').optional().isBoolean().withMessage('dry_run must be a boolean'),
  validateRequest,
  analyticsController.cleanupOldData.bind(analyticsController)
);

// =============================================================================
// Health and Status Routes
// =============================================================================

// Analytics service health check
router.get('/health/check',
  analyticsController.healthCheck.bind(analyticsController)
);

// =============================================================================
// Generic ID Routes (Must be last to avoid conflicts)
// =============================================================================

// Get analytics by ID
router.get('/:id',
  idValidation,
  validateRequest,
  analyticsController.getAnalyticsById.bind(analyticsController)
);

// Update analytics record
router.put('/:id',
  idValidation,
  createAnalyticsValidation,
  validateRequest,
  analyticsController.updateAnalytics.bind(analyticsController)
);

// Delete analytics record
router.delete('/:id',
  idValidation,
  validateRequest,
  analyticsController.deleteAnalytics.bind(analyticsController)
);

// =============================================================================
// Export
// =============================================================================

export default router;