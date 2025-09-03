import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Song validation
export const validateSongSearch = [
  query('q').notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  handleValidationErrors
];

export const validateSongId = [
  param('songId').notEmpty().withMessage('Song ID is required'),
  handleValidationErrors
];

// Queue validation
export const validateBarId = [
  param('barId').isUUID().withMessage('Valid bar ID is required'),
  handleValidationErrors
];

export const validateQueueAdd = [
  param('barId').isUUID().withMessage('Valid bar ID is required'),
  body('songId').notEmpty().withMessage('Song ID is required'),
  body('platform').isIn(['spotify', 'youtube']).withMessage('Platform must be spotify or youtube'),
  handleValidationErrors
];

export const validateQueueUpdate = [
  param('barId').isUUID().withMessage('Valid bar ID is required'),
  param('queueId').isUUID().withMessage('Valid queue ID is required'),
  body('status').isIn(['playing', 'paused', 'completed', 'skipped']).withMessage('Invalid status'),
  handleValidationErrors
];

// Recommendation validation
export const validateRecommendationParams = [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('barId').optional().isUUID().withMessage('Valid bar ID is required'),
  handleValidationErrors
];

export const validateTimeframe = [
  param('timeframe').optional().isIn(['day', 'week', 'month']).withMessage('Timeframe must be day, week, or month'),
  handleValidationErrors
];