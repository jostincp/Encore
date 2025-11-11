import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { QueueController } from '../controllers/queueController';
import { NextTrackController } from '../controllers/nextTrackController';
import { EnhancedQueueController } from '../controllers/enhancedQueueController';
import { authenticateToken as authenticateTokenFn } from '../../../shared/utils/jwt';
import { rateLimitMiddleware } from '../../../shared/middleware/rateLimit';

const router = Router();

// Wrap shared authenticate to avoid type conflicts across duplicated @types/express
const authenticateToken = (req: any, res: any, next: any) => (authenticateTokenFn as any)(req, res, next);
// Normalize req.user to include id alias expected by controllers
const normalizeUser = (req: any, res: any, next: any) => {
  if (req.user && req.user.userId && !req.user.id) {
    req.user.id = req.user.userId;
  }
  next();
};
// Handle express-validator errors
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Rate limiting configurations
const queueRateLimit: any = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many queue requests, please try again later'
});

const addSongRateLimit: any = rateLimitMiddleware({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 song additions per window
  message: 'Too many song additions, please try again later'
});

const adminRateLimit: any = rateLimitMiddleware({
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
/**
 * @route POST /add
 * @desc Add a song to a bar's queue
 * @access Private (authenticated users)
 * @rateLimit 10 requests per 5 minutes
 */
router.post('/add',
  addSongRateLimit,
  authenticateToken,
  normalizeUser,
  addToQueueValidation,
  validateRequest,
  QueueController.addToQueue as any
);

/**
 * @route POST /api/queue/enhanced-add
 * @desc Add song to queue with enhanced validation (points, duplicates, limits)
 * @access Private
 * @rateLimit 10 requests per 5 minutes
 */
router.post('/enhanced-add',
  addSongRateLimit,
  authenticateToken,
  normalizeUser,
  addToQueueValidation,
  validateRequest,
  EnhancedQueueController.addToQueue as any
);

/**
 * @route GET /api/queue/bars/:barId/check-limit
 * @desc Check if user can add more songs to queue
 * @access Private
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/check-limit',
  queueRateLimit,
  authenticateToken,
  normalizeUser,
  barIdValidation,
  validateRequest,
  EnhancedQueueController.checkUserLimit as any
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
  normalizeUser,
  barIdValidation,
  query('status').optional(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validateRequest,
  QueueController.getUserQueue as any
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
  normalizeUser,
  barIdValidation,
  validateRequest,
  QueueController.getUserQueuePosition as any
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
  normalizeUser,
  queueIdValidation,
  validateRequest,
  QueueController.removeFromQueue as any
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
  QueueController.getQueue as any
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
  QueueController.getCurrentlyPlaying as any
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
  QueueController.getNextInQueue as any
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
  normalizeUser,
  updateQueueValidation,
  validateRequest,
  QueueController.updateQueueEntry as any
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
  normalizeUser,
  queueIdValidation,
  validateRequest,
  QueueController.removeFromQueue as any
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
  normalizeUser,
  reorderQueueValidation,
  validateRequest,
  QueueController.reorderQueue as any
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
  normalizeUser,
  clearQueueValidation,
  validateRequest,
  QueueController.clearQueue as any
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
  normalizeUser,
  statsQueryValidation,
  validateRequest,
  QueueController.getQueueStats as any
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
  normalizeUser,
  skipSongValidation,
  validateRequest,
  QueueController.skipCurrentSong as any
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
  normalizeUser,
  barIdValidation,
  validateRequest,
  QueueController.playNextSong as any
);

/**
 * @route GET /bars/:barId/state
 * @desc Get current queue state (current, priority, standard queues)
 * @access Public
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/state',
  queueRateLimit,
  barIdValidation,
  validateRequest,
  NextTrackController.getQueueState as any
);

/**
 * @route GET /bars/:barId/next-track
 * @desc Get next track using the priority algorithm
 * @access Public
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/next-track',
  queueRateLimit,
  barIdValidation,
  validateRequest,
  NextTrackController.getNextTrack as any
);

/**
 * @route PATCH /bars/:barId/skip-track
 * @desc Skip current track and get next (admin only)
 * @access Private (admin/bar owner)
 * @rateLimit 200 requests per 15 minutes
 */
router.patch('/bars/:barId/skip-track',
  adminRateLimit,
  authenticateToken,
  normalizeUser,
  skipSongValidation,
  validateRequest,
  NextTrackController.skipTrack as any
);

/**
 * @route GET /bars/:barId/queue-stats
 * @desc Get queue statistics
 * @access Public
 * @rateLimit 100 requests per 15 minutes
 */
router.get('/bars/:barId/queue-stats',
  queueRateLimit,
  barIdValidation,
  validateRequest,
  NextTrackController.getQueueStats as any
);

export default router;