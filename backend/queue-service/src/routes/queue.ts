import { Router, RequestHandler } from 'express';
import { body, param, query } from 'express-validator';
import { QueueController } from '../controllers/queueController';
import { authenticateToken as authenticateTokenFn } from '../../../shared/middleware/auth';
import { rateLimitMiddleware } from '../../../shared/middleware/rateLimit';
import { validateRequest as validateRequestFn } from '../../../shared/middleware/validation';

const router = Router();

// Type-safe wrappers to satisfy Express RequestHandler typing
const authenticateToken: RequestHandler = (req, res, next) => (authenticateTokenFn as any)(req, res, next);
const validateRequest: RequestHandler = (req, res, next) => (validateRequestFn as any)(req, res, next);

// Rate limiting configurations
const queueRateLimit: RequestHandler = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many queue requests, please try again later'
});

const addSongRateLimit: RequestHandler = rateLimitMiddleware({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 song additions per window
  message: 'Too many song additions, please try again later'
});

const adminRateLimit: RequestHandler = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 admin requests per window
  message: 'Too many admin requests, please try again later'
});

// Validation schemas
const addToQueueValidation = [
  body('bar_id')
    .isUUID()
    .withMessage('bar_id must be a valid UUID'),
  body('song_id')
    .isUUID()
    .withMessage('song_id must be a valid UUID'),
  body('priority_play')
    .optional()
    .isBoolean()
    .withMessage('priority_play must be a boolean'),
  body('points_used')
    .optional()
    .isInt({ min: 0 })
    .withMessage('points_used must be a non-negative integer'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('notes must not exceed 500 characters')
];

const updateQueueValidation = [
  param('id')
    .isUUID()
    .withMessage('id must be a valid UUID'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'])
    .withMessage('status must be one of: pending, approved, rejected, playing, played, skipped'),
  body('position')
    .optional()
    .isInt({ min: 1 })
    .withMessage('position must be a positive integer'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('notes must not exceed 500 characters'),
  body('rejection_reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('rejection_reason must not exceed 500 characters')
];

const barIdValidation = [
  param('barId')
    .isUUID()
    .withMessage('barId must be a valid UUID')
];

const queueIdValidation = [
  param('id')
    .isUUID()
    .withMessage('id must be a valid UUID')
];

const reorderQueueValidation = [
  param('barId')
    .isUUID()
    .withMessage('barId must be a valid UUID'),
  body('queue_ids')
    .isArray({ min: 1 })
    .withMessage('queue_ids must be a non-empty array'),
  body('queue_ids.*')
    .isUUID()
    .withMessage('Each queue_id must be a valid UUID')
];

const clearQueueValidation = [
  param('barId')
    .isUUID()
    .withMessage('barId must be a valid UUID'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'])
    .withMessage('status must be one of: pending, approved, rejected, playing, played, skipped')
];

const queueQueryValidation = [
  param('barId')
    .isUUID()
    .withMessage('barId must be a valid UUID'),
  query('status')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'].includes(value);
      }
      if (Array.isArray(value)) {
        return value.every(v => ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'].includes(v));
      }
      return false;
    })
    .withMessage('status must be one of: pending, approved, rejected, playing, played, skipped'),
  query('user_id')
    .optional()
    .isUUID()
    .withMessage('user_id must be a valid UUID'),
  query('priority_play')
    .optional()
    .isBoolean()
    .withMessage('priority_play must be a boolean'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('date_from must be a valid ISO 8601 date'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('date_to must be a valid ISO 8601 date'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  query('include_details')
    .optional()
    .isBoolean()
    .withMessage('include_details must be a boolean')
];

const statsQueryValidation = [
  param('barId')
    .isUUID()
    .withMessage('barId must be a valid UUID'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('date_from must be a valid ISO 8601 date'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('date_to must be a valid ISO 8601 date')
];

const skipSongValidation = [
  param('barId')
    .isUUID()
    .withMessage('barId must be a valid UUID'),
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('reason must not exceed 500 characters')
];

// User routes - authenticated users can add songs and view their queue

/**
 * @route POST /add
 * @desc Add a song to a bar's queue
 * @access Private (authenticated users)
 * @rateLimit 10 requests per 5 minutes
 */
router.post('/add',
  addSongRateLimit,
  authenticateToken,
  addToQueueValidation,
  validateRequest,
  QueueController.addToQueue
);

/**
 * @route GET /bars/:barId/user
 * @desc Get user's queue entries for a specific bar
 * @access Private (authenticated users)
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/user',
  queueRateLimit,
  authenticateToken,
  barIdValidation,
  query('status').optional(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validateRequest,
  QueueController.getUserQueue
);

/**
 * @route GET /bars/:barId/user/position
 * @desc Get user's current position in a bar's queue
 * @access Private (authenticated users)
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/user/position',
  queueRateLimit,
  authenticateToken,
  barIdValidation,
  validateRequest,
  QueueController.getUserQueuePosition
);

/**
 * @route DELETE /:id/user
 * @desc Remove user's own pending song from queue
 * @access Private (authenticated users)
 * @rateLimit 100 requests per 15 minutes
 */
router.delete('/:id/user',
  queueRateLimit,
  authenticateToken,
  queueIdValidation,
  validateRequest,
  QueueController.removeFromQueue
);

// Public routes - anyone can view queue information

/**
 * @route GET /bars/:barId
 * @desc Get current queue for a bar
 * @access Public
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId',
  queueRateLimit,
  queueQueryValidation,
  validateRequest,
  QueueController.getQueue
);

/**
 * @route GET /bars/:barId/current
 * @desc Get currently playing song for a bar
 * @access Public
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/current',
  queueRateLimit,
  barIdValidation,
  validateRequest,
  QueueController.getCurrentlyPlaying
);

/**
 * @route GET /bars/:barId/next
 * @desc Get next song in a bar's queue
 * @access Public
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/next',
  queueRateLimit,
  barIdValidation,
  validateRequest,
  QueueController.getNextInQueue
);

// Admin/Bar Owner routes - require elevated permissions

/**
 * @route PUT /:id
 * @desc Update a queue entry (status, position, notes, etc.)
 * @access Private (admin/bar owner)
 * @rateLimit 200 requests per 15 minutes
 */
router.put('/:id',
  adminRateLimit,
  authenticateToken,
  updateQueueValidation,
  validateRequest,
  QueueController.updateQueueEntry
);

/**
 * @route DELETE /:id
 * @desc Remove a song from the queue
 * @access Private (admin/bar owner or song owner if pending)
 * @rateLimit 200 requests per 15 minutes
 */
router.delete('/:id',
  adminRateLimit,
  authenticateToken,
  queueIdValidation,
  validateRequest,
  QueueController.removeFromQueue
);

/**
 * @route PATCH /bars/:barId/reorder
 * @desc Reorder the queue for a bar
 * @access Private (admin/bar owner)
 * @rateLimit 200 requests per 15 minutes
 */
router.patch('/bars/:barId/reorder',
  adminRateLimit,
  authenticateToken,
  reorderQueueValidation,
  validateRequest,
  QueueController.reorderQueue
);

/**
 * @route DELETE /bars/:barId/clear
 * @desc Clear songs from a bar's queue
 * @access Private (admin/bar owner)
 * @rateLimit 200 requests per 15 minutes
 */
router.delete('/bars/:barId/clear',
  adminRateLimit,
  authenticateToken,
  clearQueueValidation,
  validateRequest,
  QueueController.clearQueue
);

/**
 * @route GET /bars/:barId/stats
 * @desc Get queue statistics for a bar
 * @access Private (admin/bar owner)
 * @rateLimit 200 requests per 15 minutes
 */
router.get('/bars/:barId/stats',
  adminRateLimit,
  authenticateToken,
  statsQueryValidation,
  validateRequest,
  QueueController.getQueueStats
);

/**
 * @route PATCH /bars/:barId/skip
 * @desc Skip the current song and move to next
 * @access Private (admin/bar owner)
 * @rateLimit 200 requests per 15 minutes
 */
router.patch('/bars/:barId/skip',
  adminRateLimit,
  authenticateToken,
  skipSongValidation,
  validateRequest,
  QueueController.skipCurrentSong
);

/**
 * @route PATCH /bars/:barId/next
 * @desc Mark current song as played and start next song
 * @access Private (admin/bar owner)
 * @rateLimit 200 requests per 15 minutes
 */
router.patch('/bars/:barId/next',
  adminRateLimit,
  authenticateToken,
  barIdValidation,
  validateRequest,
  QueueController.playNextSong
);

export default router;