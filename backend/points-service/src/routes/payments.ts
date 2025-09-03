import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { PaymentController } from '../controllers/paymentController';
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

const paymentLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many payment requests, please try again later.',
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

const webhookLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: 'Too many webhook requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const barIdValidation = [
  param('barId')
    .isUUID()
    .withMessage('Invalid bar ID format')
];

const paymentIdValidation = [
  param('paymentId')
    .isUUID()
    .withMessage('Invalid payment ID format')
];

const createPaymentValidation = [
  body('bar_id')
    .isUUID()
    .withMessage('Invalid bar ID format'),
  body('points_amount')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Points amount must be between 1 and 100,000'),
  body('payment_method_types')
    .optional()
    .isArray()
    .withMessage('Payment method types must be an array'),
  body('payment_method_types.*')
    .optional()
    .isIn(['card', 'us_bank_account', 'sepa_debit'])
    .withMessage('Invalid payment method type')
];

const refundValidation = [
  body('reason')
    .optional()
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be at least $0.01')
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

const paymentFiltersValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'succeeded', 'failed', 'canceled', 'refunded'])
    .withMessage('Invalid payment status'),
  query('user_id')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID format'),
  query('bar_id')
    .optional()
    .isUUID()
    .withMessage('Invalid bar ID format')
];

// Public Routes

/**
 * @route GET /api/payments/packages
 * @desc Get available points packages and pricing
 * @access Public
 */
router.get(
  '/packages',
  generalLimit,
  PaymentController.getPointsPackages
);

/**
 * @route POST /api/payments/webhook
 * @desc Handle Stripe webhooks
 * @access Public (Stripe only)
 */
router.post(
  '/webhook',
  webhookLimit,
  PaymentController.handleStripeWebhook
);

// User Routes - Payment operations for regular users

/**
 * @route POST /api/payments/intent
 * @desc Create payment intent for points purchase
 * @access Private
 */
router.post(
  '/intent',
  paymentLimit,
  authenticateToken,
  createPaymentValidation,
  validateRequest,
  PaymentController.createPaymentIntent
);

/**
 * @route GET /api/payments/:paymentId
 * @desc Get payment details
 * @access Private
 */
router.get(
  '/:paymentId',
  generalLimit,
  authenticateToken,
  paymentIdValidation,
  validateRequest,
  PaymentController.getPayment
);

/**
 * @route GET /api/payments/user/history
 * @desc Get user's payment history
 * @access Private
 */
router.get(
  '/user/history',
  generalLimit,
  authenticateToken,
  [
    ...paginationValidation,
    ...dateRangeValidation,
    ...paymentFiltersValidation
  ],
  validateRequest,
  PaymentController.getUserPayments
);

/**
 * @route GET /api/payments/user/summary
 * @desc Get user's payment summary
 * @access Private
 */
router.get(
  '/user/summary',
  generalLimit,
  authenticateToken,
  PaymentController.getUserPaymentSummary
);

/**
 * @route GET /api/payments/user/methods
 * @desc Get user's saved payment methods
 * @access Private
 */
router.get(
  '/user/methods',
  generalLimit,
  authenticateToken,
  PaymentController.getPaymentMethods
);

// Admin Routes - Payment management for bar owners and admins

/**
 * @route GET /api/payments/bars/:barId/history
 * @desc Get payment history for a bar (admin only)
 * @access Private (Admin/Bar Owner)
 */
router.get(
  '/bars/:barId/history',
  adminLimit,
  authenticateToken,
  [
    ...barIdValidation,
    ...paginationValidation,
    ...dateRangeValidation,
    ...paymentFiltersValidation
  ],
  validateRequest,
  PaymentController.getBarPayments
);

/**
 * @route GET /api/payments/bars/:barId/stats
 * @desc Get payment statistics for a bar (admin only)
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
  PaymentController.getPaymentStats
);

/**
 * @route POST /api/payments/:paymentId/refund
 * @desc Refund a payment (admin only)
 * @access Private (Admin/Bar Owner)
 */
router.post(
  '/:paymentId/refund',
  adminLimit,
  authenticateToken,
  [
    ...paymentIdValidation,
    ...refundValidation
  ],
  validateRequest,
  PaymentController.refundPayment
);

export default router;