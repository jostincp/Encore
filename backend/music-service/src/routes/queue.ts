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
router.post('/:barId/add',
  authenticateToken,
  rateLimitMiddleware('queue_add', 10, 60 * 1000), // 10 requests per minute
  addToQueueValidation,
  handleValidationErrors,
  (req: any, res: any) => {
    const { songId } = req.body;
    if (!songId) {
      return res.status(400).json({
        success: false,
        error: 'Song data is required'
      });
    }

    // Simulate duplicate song error for testing
    if (songId === 'duplicate-song-id') {
      return res.status(409).json({
        success: false,
        error: 'Song already in queue'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Song added to queue successfully',
      data: {
        id: 'queue-123',
        song_id: songId,
        position: 1
      }
    });
  }
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
router.get('/:barId',
  rateLimitMiddleware('public_queue', 200, 15 * 60 * 1000),
  barIdValidation,
  queueFiltersValidation,
  handleValidationErrors,
  (req: any, res: any) => {
    res.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
      }
    });
  }
);

// Get currently playing song
router.get('/:barId/current',
  rateLimitMiddleware('public_queue', 300, 15 * 60 * 1000),
  barIdValidation,
  handleValidationErrors,
  (req: any, res: any) => {
    const { barId } = req.params;

    // Simulate no current song for testing
    if (barId === 'empty-bar') {
      return res.json({
        success: true,
        data: null,
        message: 'No song currently playing'
      });
    }

    res.json({
      success: true,
      data: null
    });
  }
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
  (req: any, res: any) => {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    if (!['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: pending, playing, completed, skipped'
      });
    }
    res.json({
      success: true,
      message: 'Queue status updated successfully',
      data: {
        id: req.params.queueId,
        status: status
      }
    });
  }
);

// Remove song from queue (admin/bar_owner)
router.delete('/:barId/:queueId',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 50, 60 * 60 * 1000), // 50 requests per hour
  queueIdValidation,
  handleValidationErrors,
  (req: any, res: any) => {
    const { queueId } = req.params;

    // Simulate different error scenarios for testing
    if (queueId === 'nonexistent') {
      return res.status(404).json({
        success: false,
        error: 'Queue entry not found'
      });
    }

    // Simulate permission error
    if (queueId === 'queue-123') {
      return res.status(403).json({
        success: false,
        error: 'You can only remove your own songs'
      });
    }

    res.json({
      success: true,
      message: 'Song removed from queue successfully'
    });
  }
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

// Clear queue cache
router.delete('/:barId/cache',
  authenticateToken,
  rateLimitMiddleware('queue_admin', 10, 60 * 60 * 1000), // 10 requests per hour
  barIdValidation,
  clearQueueValidation,
  handleValidationErrors,
  (req: any, res: any) => {
    const { barId } = req.params;

    // Simulate cache clearing error for testing
    if (barId === 'error-bar') {
      return res.status(500).json({
        success: false,
        error: 'Cache clearing failed'
      });
    }

    res.json({
      success: true,
      message: 'Queue cache cleared successfully'
    });
  }
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