/**
 * =============================================================================
 * MusicBar Analytics Service - Error Classes
 * =============================================================================
 * Description: Custom error classes for the analytics service
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

// =============================================================================
// Base Error Class
// =============================================================================
export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }
}

// =============================================================================
// Validation Error (400)
// =============================================================================
export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, true, context);
  }
}

// =============================================================================
// Authentication Error (401)
// =============================================================================
export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(message, 401, true, context);
  }
}

// =============================================================================
// Authorization Error (403)
// =============================================================================
export class AuthorizationError extends BaseError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, any>) {
    super(message, 403, true, context);
  }
}

// =============================================================================
// Not Found Error (404)
// =============================================================================
export class NotFoundError extends BaseError {
  constructor(message: string = 'Resource not found', context?: Record<string, any>) {
    super(message, 404, true, context);
  }
}

// =============================================================================
// Conflict Error (409)
// =============================================================================
export class ConflictError extends BaseError {
  constructor(message: string = 'Resource conflict', context?: Record<string, any>) {
    super(message, 409, true, context);
  }
}

// =============================================================================
// Rate Limit Error (429)
// =============================================================================
export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', context?: Record<string, any>) {
    super(message, 429, true, context);
  }
}

// =============================================================================
// Database Error (500)
// =============================================================================
export class DatabaseError extends BaseError {
  constructor(message: string = 'Database operation failed', context?: Record<string, any>) {
    super(message, 500, true, context);
  }
}

// =============================================================================
// External Service Error (502)
// =============================================================================
export class ExternalServiceError extends BaseError {
  constructor(message: string = 'External service unavailable', context?: Record<string, any>) {
    super(message, 502, true, context);
  }
}

// =============================================================================
// Service Unavailable Error (503)
// =============================================================================
export class ServiceUnavailableError extends BaseError {
  constructor(message: string = 'Service temporarily unavailable', context?: Record<string, any>) {
    super(message, 503, true, context);
  }
}

// =============================================================================
// Cache Error
// =============================================================================
export class CacheError extends BaseError {
  constructor(message: string = 'Cache operation failed', context?: Record<string, any>) {
    super(message, 500, true, context);
  }
}

// =============================================================================
// Queue Error
// =============================================================================
export class QueueError extends BaseError {
  constructor(message: string = 'Queue operation failed', context?: Record<string, any>) {
    super(message, 500, true, context);
  }
}

// =============================================================================
// File System Error
// =============================================================================
export class FileSystemError extends BaseError {
  constructor(message: string = 'File system operation failed', context?: Record<string, any>) {
    super(message, 500, true, context);
  }
}

// =============================================================================
// Report Generation Error
// =============================================================================
export class ReportGenerationError extends BaseError {
  constructor(message: string = 'Report generation failed', context?: Record<string, any>) {
    super(message, 500, true, context);
  }
}

// =============================================================================
// Event Processing Error
// =============================================================================
export class EventProcessingError extends BaseError {
  constructor(message: string = 'Event processing failed', context?: Record<string, any>) {
    super(message, 500, true, context);
  }
}

// =============================================================================
// Analytics Processing Error
// =============================================================================
export class AnalyticsProcessingError extends BaseError {
  constructor(message: string = 'Analytics processing failed', context?: Record<string, any>) {
    super(message, 500, true, context);
  }
}

// =============================================================================
// Error Type Guards
// =============================================================================
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

export function isValidationError(error: Error): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: Error): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isDatabaseError(error: Error): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isCacheError(error: Error): error is CacheError {
  return error instanceof CacheError;
}

export function isQueueError(error: Error): error is QueueError {
  return error instanceof QueueError;
}

// =============================================================================
// Error Factory Functions
// =============================================================================
export function createValidationError(field: string, value: any, expected?: string): ValidationError {
  const message = expected 
    ? `Invalid ${field}: expected ${expected}, got ${typeof value}`
    : `Invalid ${field}: ${value}`;
  
  return new ValidationError(message, { field, value, expected });
}

export function createNotFoundError(resource: string, identifier: string): NotFoundError {
  return new NotFoundError(`${resource} not found: ${identifier}`, { resource, identifier });
}

export function createDatabaseError(operation: string, table?: string, error?: Error): DatabaseError {
  const message = table 
    ? `Database ${operation} failed on table ${table}`
    : `Database ${operation} failed`;
  
  return new DatabaseError(message, { operation, table, originalError: error?.message });
}

export function createCacheError(operation: string, key?: string, error?: Error): CacheError {
  const message = key 
    ? `Cache ${operation} failed for key ${key}`
    : `Cache ${operation} failed`;
  
  return new CacheError(message, { operation, key, originalError: error?.message });
}

export function createQueueError(operation: string, queue?: string, error?: Error): QueueError {
  const message = queue 
    ? `Queue ${operation} failed on queue ${queue}`
    : `Queue ${operation} failed`;
  
  return new QueueError(message, { operation, queue, originalError: error?.message });
}

// =============================================================================
// Error Handler Utility
// =============================================================================
export function handleError(error: Error, context?: Record<string, any>): BaseError {
  if (error instanceof BaseError) {
    // Add additional context if provided
    if (context) {
      // Create a new error with merged context since context is readonly
      return new BaseError(
        error.message,
        error.statusCode,
        error.isOperational,
        { ...error.context, ...context }
      );
    }
    return error;
  }

  // Convert unknown errors to BaseError
  return new BaseError(
    error.message || 'An unexpected error occurred',
    500,
    false,
    { originalError: error.name, ...context }
  );
}

// =============================================================================
// Error Response Formatter
// =============================================================================
export interface ErrorResponse {
  success: false;
  error: {
    name: string;
    message: string;
    statusCode: number;
    timestamp: string;
    context?: Record<string, any>;
    stack?: string;
  };
}

export function formatErrorResponse(error: BaseError, includeStack: boolean = false): ErrorResponse {
  return {
    success: false,
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: error.timestamp.toISOString(),
      context: error.context,
      ...(includeStack && { stack: error.stack })
    }
  };
}

// =============================================================================
// Export All
// =============================================================================
export default {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  ServiceUnavailableError,
  CacheError,
  QueueError,
  FileSystemError,
  ReportGenerationError,
  EventProcessingError,
  AnalyticsProcessingError,
  isOperationalError,
  isValidationError,
  isNotFoundError,
  isDatabaseError,
  isCacheError,
  isQueueError,
  createValidationError,
  createNotFoundError,
  createDatabaseError,
  createCacheError,
  createQueueError,
  handleError,
  formatErrorResponse
};