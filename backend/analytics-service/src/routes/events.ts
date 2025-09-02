/**
 * =============================================================================
 * MusicBar Analytics Service - Events Routes
 * =============================================================================
 * Description: Routes for event collection and processing endpoints
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Router } from 'express';
import { EventsController } from '../controllers/eventsController';
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
const eventsController = new EventsController();

// =============================================================================
// Validation Rules
// =============================================================================

const createEventValidation = [
  body('bar_id')
    .isString()
    .notEmpty()
    .withMessage('bar_id is required and must be a string'),
  body('event_type')
    .isString()
    .isIn(['music', 'menu', 'user', 'queue', 'payment', 'system'])
    .withMessage('event_type must be one of: music, menu, user, queue, payment, system'),
  body('event_name')
    .isString()
    .notEmpty()
    .withMessage('event_name is required and must be a string'),
  body('user_id')
    .optional()
    .isString()
    .withMessage('user_id must be a string'),
  body('session_id')
    .optional()
    .isString()
    .withMessage('session_id must be a string'),
  body('data')
    .optional()
    .isObject()
    .withMessage('data must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('metadata must be an object'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('priority must be one of: low, medium, high, critical'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('tags must be an array'),
  body('real_time')
    .optional()
    .isBoolean()
    .withMessage('real_time must be a boolean')
];

const bulkEventsValidation = [
  body('events')
    .isArray({ min: 1, max: 1000 })
    .withMessage('events must be an array with 1-1000 items'),
  body('events.*.bar_id')
    .isString()
    .notEmpty()
    .withMessage('Each event must have a valid bar_id'),
  body('events.*.event_type')
    .isString()
    .isIn(['music', 'menu', 'user', 'queue', 'payment', 'system'])
    .withMessage('Each event must have a valid event_type'),
  body('events.*.event_name')
    .isString()
    .notEmpty()
    .withMessage('Each event must have a valid event_name')
];

const queryValidation = [
  query('bar_id')
    .optional()
    .isString()
    .withMessage('bar_id must be a string'),
  query('user_id')
    .optional()
    .isString()
    .withMessage('user_id must be a string'),
  query('session_id')
    .optional()
    .isString()
    .withMessage('session_id must be a string'),
  query('event_type')
    .optional()
    .isIn(['music', 'menu', 'user', 'queue', 'payment', 'system'])
    .withMessage('event_type must be one of: music, menu, user, queue, payment, system'),
  query('event_name')
    .optional()
    .isString()
    .withMessage('event_name must be a string'),
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'processed', 'failed', 'skipped'])
    .withMessage('status must be one of: pending, processing, processed, failed, skipped'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('priority must be one of: low, medium, high, critical'),
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
    .withMessage('sort_order must be either asc or desc'),
  query('tags')
    .optional()
    .isString()
    .withMessage('tags must be a comma-separated string'),
  query('processed')
    .optional()
    .isBoolean()
    .withMessage('processed must be a boolean'),
  query('real_time')
    .optional()
    .isBoolean()
    .withMessage('real_time must be a boolean')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid event ID format')
];

const processValidation = [
  body('batch_size')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('batch_size must be between 1 and 1000'),
  body('max_retries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('max_retries must be between 0 and 10'),
  body('parallel_workers')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('parallel_workers must be between 1 and 10')
];

const statisticsValidation = [
  query('bar_id')
    .optional()
    .isString()
    .withMessage('bar_id must be a string'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO 8601 date')
];

const cleanupValidation = [
  body('older_than_days')
    .optional()
    .isInt({ min: 1 })
    .withMessage('older_than_days must be a positive integer'),
  body('status_filter')
    .optional()
    .isArray()
    .withMessage('status_filter must be an array'),
  body('batch_size')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('batch_size must be between 1 and 1000'),
  body('dry_run')
    .optional()
    .isBoolean()
    .withMessage('dry_run must be a boolean')
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
  query('event_type')
    .optional()
    .isIn(['music', 'menu', 'user', 'queue', 'payment', 'system'])
    .withMessage('event_type must be one of: music, menu, user, queue, payment, system'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO 8601 date')
];

const validateEventValidation = [
  body('bar_id')
    .isString()
    .notEmpty()
    .withMessage('bar_id is required'),
  body('event_type')
    .isString()
    .isIn(['music', 'menu', 'user', 'queue', 'payment', 'system'])
    .withMessage('event_type must be one of: music, menu, user, queue, payment, system'),
  body('event_name')
    .isString()
    .notEmpty()
    .withMessage('event_name is required'),
  body('data')
    .optional()
    .isObject()
    .withMessage('data must be an object')
];

// =============================================================================
// Routes
// =============================================================================

// Create single event
router.post('/',
  createEventValidation,
  validateRequest,
  eventsController.createEvent.bind(eventsController)
);

// Create multiple events (bulk)
router.post('/bulk',
  rateLimitMiddleware({ windowMs: 60000, max: 20 }), // More restrictive for bulk operations
  bulkEventsValidation,
  validateRequest,
  eventsController.createEventsBulk.bind(eventsController)
);

// Get events with filtering and pagination
router.get('/',
  queryValidation,
  validateRequest,
  eventsController.getEvents.bind(eventsController)
);

// Get event by ID
router.get('/:id',
  idValidation,
  validateRequest,
  eventsController.getEventById.bind(eventsController)
);

// Update event
router.put('/:id',
  idValidation,
  createEventValidation,
  validateRequest,
  eventsController.updateEvent.bind(eventsController)
);

// Delete event
router.delete('/:id',
  idValidation,
  validateRequest,
  eventsController.deleteEvent.bind(eventsController)
);

// =============================================================================
// Processing Routes
// =============================================================================

// Process single event
router.post('/:id/process',
  idValidation,
  validateRequest,
  eventsController.processEvent.bind(eventsController)
);

// Process events in batch
router.post('/process/batch',
  processValidation,
  validateRequest,
  eventsController.processEventsBatch.bind(eventsController)
);

// Get processing queue status
router.get('/process/queue/status',
  eventsController.getProcessingQueueStatus.bind(eventsController)
);

// =============================================================================
// Statistics and Analytics Routes
// =============================================================================

// Get event statistics
router.get('/statistics/overview',
  statisticsValidation,
  validateRequest,
  eventsController.getEventStatistics.bind(eventsController)
);

// Get real-time events
router.get('/realtime/stream',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  validateRequest,
  eventsController.getRealTimeEvents.bind(eventsController)
);

// =============================================================================
// Event Types and Validation Routes
// =============================================================================

// Get supported event types
router.get('/types/supported',
  eventsController.getSupportedEventTypes.bind(eventsController)
);

// Validate event data
router.post('/validate',
  validateEventValidation,
  validateRequest,
  eventsController.validateEventData.bind(eventsController)
);

// =============================================================================
// Export and Reporting Routes
// =============================================================================

// Export events data
router.get('/export/data',
  exportValidation,
  validateRequest,
  eventsController.exportEvents.bind(eventsController)
);

// =============================================================================
// Maintenance Routes
// =============================================================================

// Clean up old events
router.delete('/cleanup/old',
  cleanupValidation,
  validateRequest,
  eventsController.cleanupOldEvents.bind(eventsController)
);

// =============================================================================
// Health and Status Routes
// =============================================================================

// Events service health check
router.get('/health/check',
  eventsController.healthCheck.bind(eventsController)
);

// =============================================================================
// Event Type Specific Routes
// =============================================================================

// Music events
router.get('/music/events',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.event_type = 'music';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// Menu events
router.get('/menu/events',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.event_type = 'menu';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// User events
router.get('/user/events',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.event_type = 'user';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// Queue events
router.get('/queue/events',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.event_type = 'queue';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// Payment events
router.get('/payment/events',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.event_type = 'payment';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// System events
router.get('/system/events',
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.event_type = 'system';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// =============================================================================
// Advanced Filtering Routes
// =============================================================================

// Get events by date range
router.get('/range',
  query('startDate').isISO8601().withMessage('Invalid startDate format'),
  query('endDate').isISO8601().withMessage('Invalid endDate format'),
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  eventsController.getEvents.bind(eventsController)
);

// Get events by user
router.get('/user/:userId/events',
  param('userId').isString().notEmpty().withMessage('userId is required'),
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  eventsController.getEvents.bind(eventsController)
);

// Get events by session
router.get('/session/:sessionId/events',
  param('sessionId').isString().notEmpty().withMessage('sessionId is required'),
  query('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  queryValidation,
  validateRequest,
  eventsController.getEvents.bind(eventsController)
);

// =============================================================================
// Monitoring and Debugging Routes
// =============================================================================

// Get failed events
router.get('/failed/list',
  query('bar_id').optional().isString().withMessage('bar_id must be a string'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit must be between 1 and 1000'),
  validateRequest,
  (req, res, next) => {
    req.query.status = 'failed';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// Get pending events
router.get('/pending/list',
  query('bar_id').optional().isString().withMessage('bar_id must be a string'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit must be between 1 and 1000'),
  validateRequest,
  (req, res, next) => {
    req.query.status = 'pending';
    next();
  },
  eventsController.getEvents.bind(eventsController)
);

// Retry failed events
router.post('/failed/retry',
  body('event_ids').optional().isArray().withMessage('event_ids must be an array'),
  body('bar_id').optional().isString().withMessage('bar_id must be a string'),
  body('max_retries').optional().isInt({ min: 1, max: 10 }).withMessage('max_retries must be between 1 and 10'),
  validateRequest,
  eventsController.processEventsBatch.bind(eventsController)
);

// =============================================================================
// Export
// =============================================================================

export default router;