import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Handle validation errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Custom validation middleware for testing
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  // For testing purposes, just pass through
  next();
};

// Rate limiting middleware (mock for testing)
export const rateLimit = (options: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
};