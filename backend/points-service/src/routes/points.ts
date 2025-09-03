import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { PointsController } from '../controllers/pointsController';
import { authenticateToken } from '../../../shared/utils/jwt';
import { validateRequest } from '../../../shared/middleware/validation';
import rateLimit from 'express-rate-limit';

const router: Router = Router();

// Rate limiting configurations
const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const transactionLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many transaction requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const barIdValidation = [
  param('barId')
    .isUUID()
    .withMessage('Invalid bar ID format')
];

const transactionValidation = [
  body('user_id')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('bar_id')
    .isUUID()
    .withMessage('Invalid bar ID format'),
  body('type')
    .isIn(['earn', 'spend', 'refund', 'bonus', 'penalty'])
    .withMessage('Invalid transaction type'),
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer'),
  body('description')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters'),
  body('reference_id')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Reference ID must be less than 255 characters'),
  body('reference_type')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Reference type must be less than 100 characters'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const transferValidation = [
  body('from_user_id')
    .isUUID()
    .withMessage('Invalid from_user_id format'),
  body('to_user_id')
    .isUUID()
    .withMessage('Invalid to_user_id format'),
  body('bar_id')
    .isUUID()
    .withMessage('Invalid bar ID format'),
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer'),
  body('description')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters')
];

const bulkPointsValidation = [
  body('bar_id')
    .isUUID()
    .withMessage('Invalid bar ID format'),
  body('users')
    .isArray({ min: 1, max: 100 })
    .withMessage('Users array must contain 1-100 user IDs'),
  body('users.*')
    .isUUID()
    .withMessage('Each user ID must be a valid UUID'),
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer'),
  body('description')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters'),
  body('reference_type')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Reference type must be less than 100 characters')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const dateRangeValidation = [
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Invalid date_from format'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Invalid date_to format')
];

const leaderboardValidation = [
  query('type')
    .optional()
    .isIn(['earned', 'spent', 'balance'])
    .withMessage('Type must be: earned, spent, or balance'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// User Routes - Points operations for regular users

/**
 * @route GET /api/points/bars/:barId/balance
 * @desc Get user's points balance for a specific bar
 * @access Private
 */
router.get(
  '/bars/:barId/balance',
  generalLimit,
  authenticateToken,
  barIdValidation,
  validateRequest,
  PointsController.getUserBalance
);

/**
 * @route GET /api/points/bars/:barId/transactions
 * @desc Get user's points transactions for a specific bar
 * @access Private
 */
router.get(
  '/bars/:barId/transactions',
  generalLimit,
  authenticateToken,
  [
    ...barIdValidation,
    ...paginationValidation,
    ...dateRangeValidation,
    query('type')
      .optional()
      .isIn(['earn', 'spend', 'refund', 'bonus', 'penalty'])
      .withMessage('Invalid transaction type'),
    query('reference_type')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('Reference type must be less than 100 characters')
  ],
  validateRequest,
  PointsController.getUserTransactions
);

/**
 * @route GET /api/points/summary
 * @desc Get user's points summary across all bars
 * @access Private
 */
router.get(
  '/summary',
  generalLimit,
  authenticateToken,
  PointsController.getUserPointsSummary
);

/**
 * @route GET /api/points/bars/:barId/leaderboard
 * @desc Get leaderboard for a bar
 * @access Private
 */
router.get(
  '/bars/:barId/leaderboard',
  generalLimit,
  authenticateToken,
  [
    ...barIdValidation,
    ...leaderboardValidation
  ],
  validateRequest,
  PointsController.getLeaderboard
);

// Admin Routes - Points management for bar owners and admins

/**
 * @route POST /api/points/transaction
 * @desc Add points transaction (admin only)
 * @access Private (Admin/Bar Owner)
 */
router.post(
  '/transaction',
  transactionLimit,
  authenticateToken,
  transactionValidation,
  validateRequest,
  PointsController.addTransaction
);

/**
 * @route POST /api/points/transfer
 * @desc Transfer points between users (admin only)
 * @access Private (Admin/Bar Owner)
 */
router.post(
  '/transfer',
  adminLimit,
  authenticateToken,
  transferValidation,
  validateRequest,
  PointsController.transferPoints
);

/**
 * @route POST /api/points/bulk
 * @desc Bulk add points to multiple users (admin only)
 * @access Private (Admin/Bar Owner)
 */
router.post(
  '/bulk',
  adminLimit,
  authenticateToken,
  bulkPointsValidation,
  validateRequest,
  PointsController.bulkAddPoints
);

/**
 * @route GET /api/points/bars/:barId/stats
 * @desc Get points statistics for a bar (admin only)
 * @access Private (Admin/Bar Owner)
 */
router.get(
  '/bars/:barId/stats',
  adminLimit,
  authenticateToken,
  [
    ...barIdValidation,
    ...dateRangeValidation
  ],
  validateRequest,
  PointsController.getBarPointsStats
);

/**
 * @route GET /api/points/bars/:barId/transactions
 * @desc Get all transactions for a bar (admin only)
 * @access Private (Admin/Bar Owner)
 */
router.get(
  '/bars/:barId/admin/transactions',
  adminLimit,
  authenticateToken,
  [
    ...barIdValidation,
    ...paginationValidation,
    ...dateRangeValidation,
    query('user_id')
      .optional()
      .isUUID()
      .withMessage('Invalid user ID format'),
    query('type')
      .optional()
      .isIn(['earn', 'spend', 'refund', 'bonus', 'penalty'])
      .withMessage('Invalid transaction type'),
    query('reference_type')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('Reference type must be less than 100 characters')
  ],
  validateRequest,
  PointsController.getBarTransactions
);

export default router;