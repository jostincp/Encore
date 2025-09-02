import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

// Custom error class for application-specific errors
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Database error class
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: any) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    
    if (originalError) {
      logger.error('Database error details:', originalError);
    }
  }
}

// Validation error class
export class ValidationError extends AppError {
  public errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// Not found error class
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// Unauthorized error class
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// Forbidden error class
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// Conflict error class
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// Rate limit error class
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

// Middleware to handle express-validator errors
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));

    logger.warn('Validation errors:', {
      path: req.path,
      method: req.method,
      errors: formattedErrors,
      body: req.body,
      params: req.params,
      query: req.query
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
    return;
  }
  
  next();
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Main error handling middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let err = { ...error };
  err.message = error.message;

  // Log error details
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: (req as any).user?.id,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (error.name === 'CastError') {
    const message = 'Invalid ID format';
    err = new ValidationError(message);
  }

  if (error.code === '23505') { // PostgreSQL unique violation
    const message = 'Duplicate entry detected';
    err = new ConflictError(message);
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    const message = 'Referenced resource does not exist';
    err = new ValidationError(message);
  }

  if (error.code === '23502') { // PostgreSQL not null violation
    const message = 'Required field is missing';
    err = new ValidationError(message);
  }

  if (error.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    err = new UnauthorizedError(message);
  }

  if (error.name === 'TokenExpiredError') {
    const message = 'Token expired';
    err = new UnauthorizedError(message);
  }

  if (error.code === 'ECONNREFUSED') {
    const message = 'Database connection failed';
    err = new DatabaseError(message);
  }

  if (error.type === 'entity.parse.failed') {
    const message = 'Invalid JSON format';
    err = new ValidationError(message);
  }

  if (error.type === 'entity.too.large') {
    const message = 'Request payload too large';
    err = new ValidationError(message);
  }

  // Handle Stripe errors
  if (error.type && error.type.startsWith('Stripe')) {
    const message = 'Payment processing error';
    err = new AppError(message, 402, 'PAYMENT_ERROR');
  }

  // Handle Redis errors
  if (error.code === 'ECONNREFUSED' && error.address) {
    const message = 'Cache service unavailable';
    err = new AppError(message, 503, 'CACHE_ERROR');
  }

  // Send error response
  sendErrorResponse(err, req, res);
};

// Function to send formatted error response
const sendErrorResponse = (err: any, req: Request, res: Response): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // Ensure status code is valid
  if (statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  // Base error response
  const errorResponse: any = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add validation errors if present
  if (err.errors && Array.isArray(err.errors)) {
    errorResponse.errors = err.errors;
  }

  // Add stack trace in development
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      isOperational: err.isOperational
    };
  }

  // Add request ID if available
  if (req.headers['x-request-id']) {
    errorResponse.requestId = req.headers['x-request-id'];
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Graceful error handling for unhandled promise rejections
export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise
    });
    
    // Don't exit the process in production, just log the error
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });
};

// Graceful error handling for uncaught exceptions
export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack
    });
    
    // Exit the process as the application is in an undefined state
    process.exit(1);
  });
};

// Helper function to create standardized API errors
export const createError = {
  badRequest: (message: string, errors?: any[]) => new ValidationError(message, errors),
  unauthorized: (message?: string) => new UnauthorizedError(message),
  forbidden: (message?: string) => new ForbiddenError(message),
  notFound: (resource: string) => new NotFoundError(resource),
  conflict: (message: string) => new ConflictError(message),
  internal: (message: string, code?: string) => new AppError(message, 500, code),
  database: (message: string, originalError?: any) => new DatabaseError(message, originalError),
  rateLimit: (message?: string) => new RateLimitError(message)
};

// Middleware to add request ID for tracking
export const addRequestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

// Error reporting middleware (for external services like Sentry)
export const reportError = (error: any, req: Request): void => {
  // Only report operational errors in production
  if (process.env.NODE_ENV === 'production' && error.isOperational) {
    // Here you would integrate with error reporting services
    // Example: Sentry.captureException(error, { req });
    logger.error('Error reported to external service:', {
      message: error.message,
      code: error.code,
      path: req.path,
      method: req.method,
      user: (req as any).user?.id
    });
  }
};