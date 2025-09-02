/**
 * =============================================================================
 * MusicBar Analytics Service - Reports Routes
 * =============================================================================
 * Description: Routes for report generation and management endpoints
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Router } from 'express';
import { ReportsController } from '../controllers/reportsController';
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
const reportsController = new ReportsController();

// =============================================================================
// Validation Rules
// =============================================================================

const createReportValidation = [
  body('bar_id')
    .isString()
    .notEmpty()
    .withMessage('bar_id is required and must be a string'),
  body('name')
    .isString()
    .notEmpty()
    .isLength({ min: 1, max: 255 })
    .withMessage('name is required and must be between 1 and 255 characters'),
  body('type')
    .isString()
    .isIn(['analytics', 'events', 'dashboard', 'custom'])
    .withMessage('type must be one of: analytics, events, dashboard, custom'),
  body('format')
    .isString()
    .isIn(['json', 'csv', 'xlsx', 'pdf'])
    .withMessage('format must be one of: json, csv, xlsx, pdf'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('description must be a string with max 1000 characters'),
  body('parameters')
    .optional()
    .isObject()
    .withMessage('parameters must be an object'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('filters must be an object'),
  body('schedule')
    .optional()
    .isObject()
    .withMessage('schedule must be an object'),
  body('schedule.enabled')
    .optional()
    .isBoolean()
    .withMessage('schedule.enabled must be a boolean'),
  body('schedule.frequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('schedule.frequency must be one of: daily, weekly, monthly, quarterly, yearly'),
  body('schedule.time')
    .optional()
    .matches(new RegExp('^([01]?[0-9]|2[0-3]):[0-5][0-9]$'))
    .withMessage('schedule.time must be in HH:MM format'),
  body('schedule.timezone')
    .optional()
    .isString()
    .withMessage('schedule.timezone must be a string'),
  body('recipients')
    .optional()
    .isArray()
    .withMessage('recipients must be an array'),
  body('recipients.*')
    .optional()
    .isEmail()
    .withMessage('Each recipient must be a valid email address'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('tags must be an array'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public must be a boolean')
];

const queryValidation = [
  query('bar_id')
    .optional()
    .isString()
    .withMessage('bar_id must be a string'),
  query('type')
    .optional()
    .isIn(['analytics', 'events', 'dashboard', 'custom'])
    .withMessage('type must be one of: analytics, events, dashboard, custom'),
  query('format')
    .optional()
    .isIn(['json', 'csv', 'xlsx', 'pdf'])
    .withMessage('format must be one of: json, csv, xlsx, pdf'),
  query('status')
    .optional()
    .isIn(['pending', 'generating', 'completed', 'failed', 'cancelled', 'expired'])
    .withMessage('status must be one of: pending, generating, completed, failed, cancelled, expired'),
  query('created_by')
    .optional()
    .isString()
    .withMessage('created_by must be a string'),
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
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
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
  query('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public must be a boolean'),
  query('scheduled')
    .optional()
    .isBoolean()
    .withMessage('scheduled must be a boolean')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid report ID format')
];

const generateValidation = [
  body('force_regenerate')
    .optional()
    .isBoolean()
    .withMessage('force_regenerate must be a boolean'),
  body('notify_recipients')
    .optional()
    .isBoolean()
    .withMessage('notify_recipients must be a boolean'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('priority must be one of: low, medium, high, urgent')
];

const validateParametersValidation = [
  body('type')
    .isString()
    .isIn(['analytics', 'events', 'dashboard', 'custom'])
    .withMessage('type must be one of: analytics, events, dashboard, custom'),
  body('parameters')
    .isObject()
    .withMessage('parameters must be an object'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('filters must be an object')
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
    .withMessage('dry_run must be a boolean'),
  body('delete_files')
    .optional()
    .isBoolean()
    .withMessage('delete_files must be a boolean')
];

// =============================================================================
// Routes - CRUD Operations
// =============================================================================

// Create new report
router.post('/',
  createReportValidation,
  validateRequest,
  reportsController.createReport.bind(reportsController)
);

// Get reports with filtering and pagination
router.get('/',
  queryValidation,
  validateRequest,
  reportsController.getReports.bind(reportsController)
);

// Get report by ID
router.get('/:id',
  idValidation,
  validateRequest,
  reportsController.getReportById.bind(reportsController)
);

// Update report
router.put('/:id',
  idValidation,
  createReportValidation,
  validateRequest,
  reportsController.updateReport.bind(reportsController)
);

// Delete report
router.delete('/:id',
  idValidation,
  validateRequest,
  reportsController.deleteReport.bind(reportsController)
);

// =============================================================================
// Routes - Report Generation
// =============================================================================

// Generate report
router.post('/:id/generate',
  idValidation,
  generateValidation,
  validateRequest,
  reportsController.generateReport.bind(reportsController)
);

// Cancel report generation
router.post('/:id/cancel',
  idValidation,
  validateRequest,
  reportsController.cancelReportGeneration.bind(reportsController)
);

// Retry failed report
router.post('/:id/retry',
  idValidation,
  generateValidation,
  validateRequest,
  reportsController.retryReport.bind(reportsController)
);

// =============================================================================
// Routes - Report Download and Access
// =============================================================================

// Download report file
router.get('/:id/download',
  idValidation,
  validateRequest,
  reportsController.downloadReport.bind(reportsController)
);

// Get download URL for report
router.get('/:id/download-url',
  idValidation,
  query('expires_in').optional().isInt({ min: 60, max: 86400 }).withMessage('expires_in must be between 60 and 86400 seconds'),
  validateRequest,
  reportsController.getDownloadUrl.bind(reportsController)
);

// =============================================================================
// Routes - Scheduled Reports
// =============================================================================

// Get scheduled reports
router.get('/scheduled/list',
  query('bar_id').optional().isString().withMessage('bar_id must be a string'),
  query('due_before').optional().isISO8601().withMessage('due_before must be a valid ISO 8601 date'),
  validateRequest,
  reportsController.getScheduledReports.bind(reportsController)
);

// Process scheduled reports
router.post('/scheduled/process',
  rateLimitMiddleware({ windowMs: 300000, max: 10 }), // 10 requests per 5 minutes
  body('batch_size').optional().isInt({ min: 1, max: 50 }).withMessage('batch_size must be between 1 and 50'),
  body('force_process').optional().isBoolean().withMessage('force_process must be a boolean'),
  validateRequest,
  reportsController.processScheduledReports.bind(reportsController)
);

// =============================================================================
// Routes - Report Types and Validation
// =============================================================================

// Get supported report types
router.get('/types/supported',
  reportsController.getSupportedReportTypes.bind(reportsController)
);

// Validate report parameters
router.post('/validate/parameters',
  validateParametersValidation,
  validateRequest,
  reportsController.validateReportParameters.bind(reportsController)
);

// =============================================================================
// Routes - Statistics and Monitoring
// =============================================================================

// Get report statistics
router.get('/statistics/overview',
  query('bar_id').optional().isString().withMessage('bar_id must be a string'),
  query('start_date').optional().isISO8601().withMessage('start_date must be a valid ISO 8601 date'),
  query('end_date').optional().isISO8601().withMessage('end_date must be a valid ISO 8601 date'),
  validateRequest,
  reportsController.getReportStatistics.bind(reportsController)
);

// =============================================================================
// Routes - Maintenance and Cleanup
// =============================================================================

// Clean up expired reports
router.delete('/cleanup/expired',
  cleanupValidation,
  validateRequest,
  reportsController.cleanupExpiredReports.bind(reportsController)
);

// =============================================================================
// Routes - Health and Status
// =============================================================================

// Reports service health check
router.get('/health/check',
  reportsController.healthCheck.bind(reportsController)
);

// =============================================================================
// Routes - Report Type Specific
// =============================================================================

// Analytics reports
router.get('/analytics/list',
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.type = 'analytics';
    next();
  },
  reportsController.getReports.bind(reportsController)
);

// Events reports
router.get('/events/list',
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.type = 'events';
    next();
  },
  reportsController.getReports.bind(reportsController)
);

// Dashboard reports
router.get('/dashboard/list',
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.type = 'dashboard';
    next();
  },
  reportsController.getReports.bind(reportsController)
);

// Custom reports
router.get('/custom/list',
  queryValidation,
  validateRequest,
  (req, res, next) => {
    req.query.type = 'custom';
    next();
  },
  reportsController.getReports.bind(reportsController)
);

// =============================================================================
// Routes - Quick Report Generation
// =============================================================================

// Generate quick analytics report
router.post('/quick/analytics',
  body('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  body('format').optional().isIn(['json', 'csv']).withMessage('format must be json or csv'),
  body('date_range').optional().isObject().withMessage('date_range must be an object'),
  body('metrics').optional().isArray().withMessage('metrics must be an array'),
  validateRequest,
  reportsController.generateQuickReport.bind(reportsController)
);

// Generate quick events report
router.post('/quick/events',
  body('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  body('format').optional().isIn(['json', 'csv']).withMessage('format must be json or csv'),
  body('event_type').optional().isIn(['music', 'menu', 'user', 'queue', 'payment', 'system']).withMessage('Invalid event_type'),
  body('date_range').optional().isObject().withMessage('date_range must be an object'),
  validateRequest,
  reportsController.generateQuickReport.bind(reportsController)
);

// Generate quick dashboard report
router.post('/quick/dashboard',
  body('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  body('format').optional().isIn(['json', 'csv', 'pdf']).withMessage('format must be json, csv, or pdf'),
  body('components').optional().isArray().withMessage('components must be an array'),
  validateRequest,
  reportsController.generateQuickReport.bind(reportsController)
);

// =============================================================================
// Routes - Report Templates
// =============================================================================

// Get report templates
router.get('/templates/list',
  query('type').optional().isIn(['analytics', 'events', 'dashboard', 'custom']).withMessage('Invalid type'),
  query('category').optional().isString().withMessage('category must be a string'),
  validateRequest,
  reportsController.getReportTemplates.bind(reportsController)
);

// Create report from template
router.post('/templates/:templateId/create',
  param('templateId').isString().notEmpty().withMessage('templateId is required'),
  body('bar_id').isString().notEmpty().withMessage('bar_id is required'),
  body('name').isString().notEmpty().withMessage('name is required'),
  body('parameters').optional().isObject().withMessage('parameters must be an object'),
  validateRequest,
  reportsController.createReportFromTemplate.bind(reportsController)
);

// =============================================================================
// Routes - Bulk Operations
// =============================================================================

// Bulk generate reports
router.post('/bulk/generate',
  rateLimitMiddleware({ windowMs: 300000, max: 5 }), // 5 requests per 5 minutes
  body('report_ids').isArray({ min: 1, max: 20 }).withMessage('report_ids must be an array with 1-20 items'),
  body('force_regenerate').optional().isBoolean().withMessage('force_regenerate must be a boolean'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  validateRequest,
  reportsController.bulkGenerateReports.bind(reportsController)
);

// Bulk delete reports
router.delete('/bulk/delete',
  rateLimitMiddleware({ windowMs: 300000, max: 10 }), // 10 requests per 5 minutes
  body('report_ids').isArray({ min: 1, max: 50 }).withMessage('report_ids must be an array with 1-50 items'),
  body('delete_files').optional().isBoolean().withMessage('delete_files must be a boolean'),
  validateRequest,
  reportsController.bulkDeleteReports.bind(reportsController)
);

// =============================================================================
// Routes - Report Sharing and Permissions
// =============================================================================

// Share report
router.post('/:id/share',
  idValidation,
  body('recipients').isArray({ min: 1 }).withMessage('recipients must be a non-empty array'),
  body('recipients.*').isEmail().withMessage('Each recipient must be a valid email'),
  body('message').optional().isString().isLength({ max: 500 }).withMessage('message must be a string with max 500 characters'),
  body('expires_in').optional().isInt({ min: 3600, max: 2592000 }).withMessage('expires_in must be between 1 hour and 30 days'),
  validateRequest,
  reportsController.shareReport.bind(reportsController)
);

// Get report permissions
router.get('/:id/permissions',
  idValidation,
  validateRequest,
  reportsController.getReportPermissions.bind(reportsController)
);

// Update report permissions
router.put('/:id/permissions',
  idValidation,
  body('is_public').optional().isBoolean().withMessage('is_public must be a boolean'),
  body('allowed_users').optional().isArray().withMessage('allowed_users must be an array'),
  body('allowed_roles').optional().isArray().withMessage('allowed_roles must be an array'),
  validateRequest,
  reportsController.updateReportPermissions.bind(reportsController)
);

// =============================================================================
// Routes - Report History and Versions
// =============================================================================

// Get report generation history
router.get('/:id/history',
  idValidation,
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  validateRequest,
  reportsController.getReportHistory.bind(reportsController)
);

// Get report versions
router.get('/:id/versions',
  idValidation,
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
  validateRequest,
  reportsController.getReportVersions.bind(reportsController)
);

// =============================================================================
// Export
// =============================================================================

export default router;