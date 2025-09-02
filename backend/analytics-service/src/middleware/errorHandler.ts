/**
 * =============================================================================
 * MusicBar Analytics Service - Error Handler Middleware
 * =============================================================================
 * Description: Global error handling middleware with structured error responses
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BaseError, ValidationError, NotFoundError, AuthenticationError, AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { sendError, sendValidationError, sendNotFound, sendUnauthorized, sendForbidden } from '../utils/response';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  barId?: string;
  method: string;
  path: string;
  query?: any;
  body?: any;
  userAgent?: string;
  ip: string;
  timestamp: string;
}

export interface ErrorHandlerOptions {
  includeStackTrace?: boolean;
  logErrors?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
  sanitizeErrors?: boolean;
  maxErrorLength?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_OPTIONS: ErrorHandlerOptions = {
  includeStackTrace: process.env.NODE_ENV === 'development',
  logErrors: true,
  logLevel: 'error',
  sanitizeErrors: true,
  maxErrorLength: 1000
};

// =============================================================================
// Main Error Handler Middleware
// =============================================================================

/**
 * Global error handling middleware
 */
export const errorHandler = (options: Partial<ErrorHandlerOptions> = {}) => {
  const config: ErrorHandlerOptions = { ...DEFAULT_OPTIONS, ...options };

  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(error);
    }

    // Create error context
    const context = createErrorContext(req, error);

    // Log error if enabled
    if (config.logErrors) {
      logError(error, context, config);
    }

    // Handle different error types
    handleErrorByType(error, req, res, config);
  };
};

// =============================================================================
// Error Type Handlers
// =============================================================================

/**
 * Handle errors based on their type
 */
const handleErrorByType = (
  error: any,
  req: Request,
  res: Response,
  config: ErrorHandlerOptions
): void => {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.issues.map(err => ({
      field: err.path.join('.') || 'root',
      message: err.message,
      code: err.code
    }));
    sendValidationError(res, 'Validation failed', validationErrors);
    return;
  }

  // Handle custom validation errors
  if (error instanceof ValidationError) {
    sendValidationError(res, error.message, error.context);
    return;
  }

  // Handle not found errors
  if (error instanceof NotFoundError) {
    sendNotFound(res, error.message);
    return;
  }

  // Handle unauthorized errors
  if (error instanceof AuthenticationError) {
    sendUnauthorized(res, error.message);
    return;
  }

  // Handle forbidden errors
  if (error instanceof AuthorizationError) {
    sendForbidden(res, error.message);
    return;
  }

  // Handle custom base errors
  if (error instanceof BaseError) {
    sendError(res, error);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    sendUnauthorized(res, 'Invalid token');
    return;
  }

  if (error.name === 'TokenExpiredError') {
    sendUnauthorized(res, 'Token expired');
    return;
  }

  // Handle MongoDB/Database errors
  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    handleDatabaseError(error, res);
    return;
  }

  // Handle Redis errors
  if (error.name === 'RedisError' || error.name === 'ReplyError') {
    handleRedisError(error, res);
    return;
  }

  // Handle syntax errors
  if (error instanceof SyntaxError && 'body' in error) {
    sendValidationError(res, 'Invalid JSON in request body');
    return;
  }

  // Handle rate limit errors
  if (error.name === 'RateLimitError') {
    res.status(429).json({
      success: false,
      message: 'Too many requests',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
    return;
  }

  // Handle unexpected errors
  handleUnexpectedError(error, req, res, config);
};

// =============================================================================
// Specialized Error Handlers
// =============================================================================

/**
 * Handle database-related errors
 */
const handleDatabaseError = (error: any, res: Response): void => {
  logger.error('Database error', { error: error.message, code: error.code });

  // Handle duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    sendValidationError(res, `Duplicate value for ${field}`);
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      code: 'validation_error'
    }));
    sendValidationError(res, 'Database validation failed', validationErrors);
    return;
  }

  // Generic database error
  sendError(res, {
    name: 'DatabaseError',
    message: 'Database operation failed',
    statusCode: 500
  });
  return;
};

/**
 * Handle Redis-related errors
 */
const handleRedisError = (error: any, res: Response): void => {
  logger.error('Redis error', { error: error.message, command: error.command });

  sendError(res, {
    name: 'CacheError',
    message: 'Cache operation failed',
    statusCode: 500
  });
  return;
};

/**
 * Handle unexpected/unknown errors
 */
const handleUnexpectedError = (
  error: any,
  req: Request,
  res: Response,
  config: ErrorHandlerOptions
): void => {
  // Log the full error for debugging
  logger.error('Unexpected error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    requestId: req.requestId,
    method: req.method,
    path: req.path
  });

  // Send generic error response
  const errorResponse: any = {
    success: false,
    message: 'Internal server error',
    error: {
      code: 'INTERNAL_ERROR',
      message: config.sanitizeErrors ? 'An unexpected error occurred' : error.message
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  };

  // Include stack trace in development
  if (config.includeStackTrace && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  res.status(500).json(errorResponse);
  return;
};

// =============================================================================
// Error Context and Logging
// =============================================================================

/**
 * Create error context from request
 */
const createErrorContext = (req: Request, error: any): ErrorContext => {
  return {
    requestId: req.requestId,
    userId: (req as any).user?.id,
    barId: (req as any).user?.bar_id,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.body && Object.keys(req.body).length > 0 ? sanitizeBody(req.body) : undefined,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    timestamp: new Date().toISOString()
  };
};

/**
 * Log error with context
 */
const logError = (error: any, context: ErrorContext, config: ErrorHandlerOptions): void => {
  const logData = {
    error: {
      name: error.name,
      message: truncateString(error.message, config.maxErrorLength!),
      stack: config.includeStackTrace ? error.stack : undefined,
      statusCode: error.statusCode || 500
    },
    context,
    severity: getSeverity(error)
  };

  // Log based on configured level
  logger[config.logLevel!]('Error occurred', logData);

  // Also log critical errors as alerts
  if (logData.severity === 'critical') {
    logger.error('Critical error alert', {
      error: error.message,
      requestId: context.requestId,
      path: context.path
    });
  }
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sanitize request body for logging
 */
const sanitizeBody = (body: any): any => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized: any = {};

  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Truncate string to maximum length
 */
const truncateString = (str: string, maxLength: number): string => {
  if (!str || str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
};

/**
 * Determine error severity
 */
const getSeverity = (error: any): 'low' | 'medium' | 'high' | 'critical' => {
  if (error instanceof ValidationError || error.statusCode === 400) {
    return 'low';
  }
  if (error instanceof AuthenticationError || error.statusCode === 401) {
    return 'medium';
  }
  if (error instanceof AuthorizationError || error.statusCode === 403) {
    return 'medium';
  }
  if (error instanceof NotFoundError || error.statusCode === 404) {
    return 'low';
  }
  if (error.statusCode >= 500) {
    return 'critical';
  }
  return 'medium';
};

// =============================================================================
// Specialized Error Middlewares
// =============================================================================

/**
 * Development error handler with full details
 */
export const developmentErrorHandler = errorHandler({
  includeStackTrace: true,
  logErrors: true,
  logLevel: 'error',
  sanitizeErrors: false
});

/**
 * Production error handler with minimal details
 */
export const productionErrorHandler = errorHandler({
  includeStackTrace: false,
  logErrors: true,
  logLevel: 'error',
  sanitizeErrors: true
});

/**
 * API error handler for API endpoints
 */
export const apiErrorHandler = errorHandler({
  includeStackTrace: process.env.NODE_ENV === 'development',
  logErrors: true,
  logLevel: 'error',
  sanitizeErrors: true,
  maxErrorLength: 500
});

// =============================================================================
// 404 Handler
// =============================================================================

/**
 * Handle 404 Not Found errors
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

// =============================================================================
// Async Error Handler
// =============================================================================

/**
 * Wrapper for async route handlers to catch errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// =============================================================================
// Error Recovery
// =============================================================================

/**
 * Graceful shutdown handler for uncaught errors
 */
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

// =============================================================================
// Export Default
// =============================================================================

export default {
  errorHandler,
  developmentErrorHandler,
  productionErrorHandler,
  apiErrorHandler,
  notFoundHandler,
  asyncHandler,
  setupGlobalErrorHandlers
};