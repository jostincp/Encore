import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { QueueController } from '../controllers/queueController';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting middleware factory
const rateLimitMiddleware = (type: string, limit: number, windowMs: number) => rateLimit({
  windowMs,
  max: limit,
  message: {
    success: false,
    error: 'Too many requests',
    retryAfter: Math.ceil(windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
}) as any;

// Validation schemas
const addToQueueValidation = [
  body('bar_id')
    .isUUID()
    .withMessage('Invalid bar ID format'),
  body('song_id')
    .isUUID()
    .withMessage('Invalid song ID format'),
  body('priority_play')
    .optional()
    .isBoolean()
    .withMessage('priority_play must be a boolean'),
  body('points_used')
    .optional()
    .isInt({ min: 0 })
    .withMessage('points_used must be a non-negative integer')
];

const updateQueueValidation = [
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'])
    .withMessage('Invalid status'),
  body('admin_notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Admin notes must be less than 500 characters'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Rejection reason must be less than 500 characters'),
  body('priority_play')
    .optional()
    .isBoolean()
    .withMessage('priority_play must be a boolean')
];

const barIdValidation = [
  param('barId')
    .isUUID()
    .withMessage('Invalid bar ID format')
];

const queueIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid queue entry ID format')
];

const queueFiltersValidation = [
  query('status')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const statuses = value.split(',');
        const validStatuses = ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'];
        return statuses.every(status => validStatuses.includes(status.trim()));
      }
      return ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'].includes(value);
    })
    .withMessage('Invalid status filter'),
  query('user_id')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID format'),
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
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const reorderQueueValidation = [
  body('queue_ids')
    .isArray({ min: 1 })
    .withMessage('queue_ids must be a non-empty array'),
  body('queue_ids.*')
    .isUUID()
    .withMessage('Each queue ID must be a valid UUID')
];

const clearQueueValidation = [
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'])
    .withMessage('Invalid status')
];

const statsDateValidation = [
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('date_from must be a valid ISO 8601 date'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('date_to must be a valid ISO 8601 date')
];

// User routes (require authentication)

// Add song to queue
router.post('/:barId/add',
  authenticateToken,
  rateLimitMiddleware('queue_add', 10, 60 * 1000), // 10 requests per minute
  addToQueueValidation,
  handleValidationErrors,
  QueueController.addToQueue as any
);

// Get user's queue entries for a bar
router.get('/bars/:barId/user',
  authenticateToken,
  rateLimitMiddleware('general', 100, 15 * 60 * 1000),
  barIdValidation,
  query('status').optional().custom((value) => {
    if (typeof value === 'string') {
      const statuses = value.split(',');
      const validStatuses = ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'];
      return statuses.every(status => validStatuses.includes(status.trim()));
    }
    return ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'].includes(value);
  }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  QueueController.getUserQueue as any
);

// Get user's position in queue
router.get('/bars/:barId/user/position',
  authenticateToken,
  rateLimitMiddleware('general', 200, 15 * 60 * 1000),
  barIdValidation,
  handleValidationErrors,
  QueueController.getUserQueuePosition as any
);

// Remove user's own song from queue (if pending)
router.delete('/:id/user',
  authenticateToken,
  rateLimitMiddleware('queue_remove', 20, 60 * 1000), // 20 requests per minute
  queueIdValidation,
  handleValidationErrors,
  QueueController.removeFromQueue as any
);

// Public routes (no authentication required)

// Get current queue for a bar (public view)
router.get('/:barId',
  rateLimitMiddleware('public_queue', 200, 15 * 60 * 1000),
  barIdValidation,
  queueFiltersValidation,
  handleValidationErrors,
  QueueController.getQueue as any
);

// Get currently playing song
router.get('/:barId/current',
  rateLimitMiddleware('public_queue', 300, 15 * 60 * 1000),
  barIdValidation,
  handleValidationErrors,
  QueueController.getCurrentlyPlaying as any
);

// Get user queue history
router.get('/:barId/history',
  authenticateToken,
  rateLimitMiddleware('general', 100, 15 * 60 * 1000),
  barIdValidation,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  (req: any, res: any) => {
    const { barId } = req.params;
    const { page, limit } = req.query;

    res.json({
      success: true,
      data: [],
      pagination: {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        total: 0,
        totalPages: 0
      },
      meta: {
        barId,
        userId: req.user?.id
      }
    });
  }
);

// Get next song in queue
router.get('/bars/:barId/next',
  rateLimitMiddleware('public_queue', 300, 15 * 60 * 1000),
  barIdValidation,
  handleValidationErrors,
  QueueController.getNextInQueue
);

// Admin/Bar Owner routes (require authentication and proper permissions)

// Update queue entry (approve/reject/modify)
router.patch('/:barId/:queueId/status',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 100, 60 * 60 * 1000), // 100 requests per hour
  queueIdValidation,
  updateQueueValidation,
  handleValidationErrors,
  QueueController.updateQueueEntry as any
);

// Remove song from queue (admin/bar_owner)
router.delete('/:barId/:queueId',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 50, 60 * 60 * 1000), // 50 requests per hour
  queueIdValidation,
  handleValidationErrors,
  QueueController.removeFromQueue as any
);

// Reorder queue
router.patch('/bars/:barId/reorder',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 20, 60 * 60 * 1000), // 20 requests per hour
  barIdValidation,
  reorderQueueValidation,
  handleValidationErrors,
  QueueController.reorderQueue as any
);

// Clear queue
router.delete('/:barId/clear',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 10, 60 * 60 * 1000), // 10 requests per hour
  barIdValidation,
  clearQueueValidation,
  handleValidationErrors,
  QueueController.clearQueue as any
);

// Get queue statistics
router.get('/bars/:barId/stats',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 50, 60 * 60 * 1000),
  barIdValidation,
  statsDateValidation,
  handleValidationErrors,
  QueueController.getQueueStats as any
);

// Skip current song
router.patch('/bars/:barId/skip',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 30, 60 * 60 * 1000), // 30 requests per hour
  barIdValidation,
  handleValidationErrors,
  QueueController.skipCurrentSong as any
);

// Play next song
router.patch('/bars/:barId/next',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 100, 60 * 60 * 1000), // 100 requests per hour
  barIdValidation,
  handleValidationErrors,
  QueueController.playNextSong as any
);

// Handle song finished (called by player)
router.post('/song-finished',
  rateLimitMiddleware('player', 1000, 60 * 1000), // 1000 requests per minute for player
  body('queueId')
    .isUUID()
    .withMessage('Invalid queue ID format'),
  handleValidationErrors,
  QueueController.songFinished as any
);

export default router;