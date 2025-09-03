import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';

// Mock controller and rate limiting
const QueueController = {
  addToQueue: (req: any, res: any) => res.json({ success: true, message: 'Song added to queue' }),
  getUserQueue: (req: any, res: any) => res.json({ success: true, data: [] }),
  getUserQueuePosition: (req: any, res: any) => res.json({ success: true, position: 1 }),
  removeFromQueue: (req: any, res: any) => res.json({ success: true, message: 'Song removed from queue' }),
  getQueue: (req: any, res: any) => res.json({ success: true, data: [] }),
  getCurrentlyPlaying: (req: any, res: any) => res.json({ success: true, data: null }),
  getNextInQueue: (req: any, res: any) => res.json({ success: true, data: null }),
  updateQueueEntry: (req: any, res: any) => res.json({ success: true, message: 'Queue entry updated' }),
  reorderQueue: (req: any, res: any) => res.json({ success: true, message: 'Queue reordered' }),
  clearQueue: (req: any, res: any) => res.json({ success: true, message: 'Queue cleared' }),
  getQueueStats: (req: any, res: any) => res.json({ success: true, data: {} }),
  skipCurrentSong: (req: any, res: any) => res.json({ success: true, message: 'Song skipped' }),
  playNextSong: (req: any, res: any) => res.json({ success: true, message: 'Playing next song' })
};

const rateLimitMiddleware = (type: string, limit: number, window: number) => (req: any, res: any, next: any) => next();

const router = Router();

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
router.post('/add',
  authenticateToken,
  rateLimitMiddleware('queue_add', 10, 60 * 1000), // 10 requests per minute
  addToQueueValidation,
  handleValidationErrors,
  QueueController.addToQueue
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
  QueueController.getUserQueue
);

// Get user's position in queue
router.get('/bars/:barId/user/position',
  authenticateToken,
  rateLimitMiddleware('general', 200, 15 * 60 * 1000),
  barIdValidation,
  handleValidationErrors,
  QueueController.getUserQueuePosition
);

// Remove user's own song from queue (if pending)
router.delete('/:id/user',
  authenticateToken,
  rateLimitMiddleware('queue_remove', 20, 60 * 1000), // 20 requests per minute
  queueIdValidation,
  handleValidationErrors,
  QueueController.removeFromQueue
);

// Public routes (no authentication required)

// Get current queue for a bar (public view)
router.get('/bars/:barId',
  rateLimitMiddleware('public_queue', 200, 15 * 60 * 1000),
  barIdValidation,
  queueFiltersValidation,
  handleValidationErrors,
  QueueController.getQueue
);

// Get currently playing song
router.get('/bars/:barId/current',
  rateLimitMiddleware('public_queue', 300, 15 * 60 * 1000),
  barIdValidation,
  handleValidationErrors,
  QueueController.getCurrentlyPlaying
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
router.put('/:id',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 100, 60 * 60 * 1000), // 100 requests per hour
  queueIdValidation,
  updateQueueValidation,
  handleValidationErrors,
  QueueController.updateQueueEntry
);

// Remove song from queue (admin/bar_owner)
router.delete('/:id',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 50, 60 * 60 * 1000), // 50 requests per hour
  queueIdValidation,
  handleValidationErrors,
  QueueController.removeFromQueue
);

// Reorder queue
router.patch('/bars/:barId/reorder',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 20, 60 * 60 * 1000), // 20 requests per hour
  barIdValidation,
  reorderQueueValidation,
  handleValidationErrors,
  QueueController.reorderQueue
);

// Clear queue
router.delete('/bars/:barId/clear',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 10, 60 * 60 * 1000), // 10 requests per hour
  barIdValidation,
  clearQueueValidation,
  handleValidationErrors,
  QueueController.clearQueue
);

// Get queue statistics
router.get('/bars/:barId/stats',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 50, 60 * 60 * 1000),
  barIdValidation,
  statsDateValidation,
  handleValidationErrors,
  QueueController.getQueueStats
);

// Skip current song
router.patch('/bars/:barId/skip',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 30, 60 * 60 * 1000), // 30 requests per hour
  barIdValidation,
  handleValidationErrors,
  QueueController.skipCurrentSong
);

// Play next song
router.patch('/bars/:barId/next',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 100, 60 * 60 * 1000), // 100 requests per hour
  barIdValidation,
  handleValidationErrors,
  QueueController.playNextSong
);

export default router;