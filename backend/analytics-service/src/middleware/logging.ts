/**
 * =============================================================================
 * MusicBar Analytics Service - Logging Middleware
 * =============================================================================
 * Description: HTTP request logging middleware with structured logging
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface LoggingOptions {
  includeBody?: boolean;
  includeQuery?: boolean;
  includeHeaders?: boolean;
  excludeHeaders?: string[];
  excludePaths?: string[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxBodySize?: number;
  sensitiveFields?: string[];
}

export interface RequestLog {
  requestId: string;
  method: string;
  url: string;
  path: string;
  query?: any;
  body?: any;
  headers?: any;
  userAgent?: string;
  ip: string;
  userId?: string;
  barId?: string;
  timestamp: string;
}

export interface ResponseLog {
  requestId: string;
  statusCode: number;
  responseTime: number;
  contentLength?: number;
  timestamp: string;
}

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_OPTIONS: LoggingOptions = {
  includeBody: true,
  includeQuery: true,
  includeHeaders: false,
  excludeHeaders: ['authorization', 'cookie', 'x-api-key'],
  excludePaths: ['/health', '/status', '/favicon.ico'],
  logLevel: 'info',
  maxBodySize: 1024, // 1KB
  sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization']
};

// =============================================================================
// Main Logging Middleware
// =============================================================================

/**
 * Create HTTP request logging middleware
 */
export const loggingMiddleware = (options: Partial<LoggingOptions> = {}) => {
  const config: LoggingOptions = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip logging for excluded paths
    if (config.excludePaths?.includes(req.path)) {
      return next();
    }

    // Generate unique request ID
    req.requestId = uuidv4();
    req.startTime = Date.now();

    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.requestId);

    // Log incoming request
    logRequest(req, config);

    // Capture original res.end to log response
    const originalEnd = res.end.bind(res);
    res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: (() => void)): Response {
      // Log response
      logResponse(req, res);
      
      // Call original end method with proper typing
      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding as (() => void));
      } else {
        return originalEnd(chunk, encoding as BufferEncoding, cb);
      }
    };

    next();
  };
};

// =============================================================================
// Request Logging
// =============================================================================

/**
 * Log incoming HTTP request
 */
const logRequest = (req: Request, config: LoggingOptions): void => {
  try {
    const requestLog: RequestLog = {
      requestId: req.requestId!,
      method: req.method,
      url: req.url,
      path: req.path,
      ip: getClientIP(req),
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Add query parameters if enabled
    if (config.includeQuery && Object.keys(req.query).length > 0) {
      requestLog.query = sanitizeData(req.query, config.sensitiveFields!);
    }

    // Add request body if enabled
    if (config.includeBody && req.body && Object.keys(req.body).length > 0) {
      const bodyString = JSON.stringify(req.body);
      if (bodyString.length <= config.maxBodySize!) {
        requestLog.body = sanitizeData(req.body, config.sensitiveFields!);
      } else {
        requestLog.body = { _truncated: true, size: bodyString.length };
      }
    }

    // Add headers if enabled
    if (config.includeHeaders) {
      requestLog.headers = filterHeaders(req.headers, config.excludeHeaders!);
    }

    // Add user context if available
    if ((req as any).user) {
      requestLog.userId = (req as any).user.id;
      requestLog.barId = (req as any).user.bar_id;
    }

    logger.info('HTTP Request', requestLog);
  } catch (error) {
    logger.error('Error logging request', { error: error.message, requestId: req.requestId });
  }
};

// =============================================================================
// Response Logging
// =============================================================================

/**
 * Log HTTP response
 */
const logResponse = (req: Request, res: Response): void => {
  try {
    const responseTime = req.startTime ? Date.now() - req.startTime : 0;
    
    const responseLog: ResponseLog = {
      requestId: req.requestId!,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined,
      timestamp: new Date().toISOString()
    };

    // Determine log level based on status code
    const logLevel = getLogLevel(res.statusCode);
    
    logger[logLevel]('HTTP Response', responseLog);

    // Log slow requests as warnings
    if (responseTime > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        responseTime,
        statusCode: res.statusCode
      });
    }
  } catch (error) {
    logger.error('Error logging response', { error: error.message, requestId: req.requestId });
  }
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get client IP address from request
 */
const getClientIP = (req: Request): string => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    req.get('X-Real-IP') ||
    'unknown'
  );
};

/**
 * Filter out sensitive headers
 */
const filterHeaders = (headers: any, excludeHeaders: string[]): any => {
  const filtered: any = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (!excludeHeaders.includes(key.toLowerCase())) {
      filtered[key] = value;
    }
  }
  
  return filtered;
};

/**
 * Sanitize sensitive data from objects
 */
const sanitizeData = (data: any, sensitiveFields: string[]): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, sensitiveFields));
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Determine log level based on HTTP status code
 */
const getLogLevel = (statusCode: number): 'info' | 'warn' | 'error' => {
  if (statusCode >= 500) {
    return 'error';
  } else if (statusCode >= 400) {
    return 'warn';
  } else {
    return 'info';
  }
};

// =============================================================================
// Specialized Logging Middlewares
// =============================================================================

/**
 * Basic logging middleware with minimal configuration
 */
export const basicLogging = loggingMiddleware({
  includeBody: false,
  includeQuery: true,
  includeHeaders: false
});

/**
 * Detailed logging middleware for debugging
 */
export const detailedLogging = loggingMiddleware({
  includeBody: true,
  includeQuery: true,
  includeHeaders: true,
  logLevel: 'debug',
  maxBodySize: 2048
});

/**
 * Production logging middleware with security focus
 */
export const productionLogging = loggingMiddleware({
  includeBody: false,
  includeQuery: false,
  includeHeaders: false,
  excludePaths: ['/health', '/status', '/metrics', '/favicon.ico']
});

/**
 * API logging middleware for API endpoints
 */
export const apiLogging = loggingMiddleware({
  includeBody: true,
  includeQuery: true,
  includeHeaders: false,
  maxBodySize: 1024,
  sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization', 'api_key']
});

// =============================================================================
// Request ID Middleware
// =============================================================================

/**
 * Simple middleware to add request ID without full logging
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = req.get('X-Request-ID') || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// =============================================================================
// Error Logging Middleware
// =============================================================================

/**
 * Middleware to log errors with request context
 */
export const errorLoggingMiddleware = (error: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error('HTTP Error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    userId: (req as any).user?.id,
    barId: (req as any).user?.bar_id,
    timestamp: new Date().toISOString()
  });

  next(error);
};

// =============================================================================
// Performance Monitoring
// =============================================================================

/**
 * Middleware to track performance metrics
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    logger.info('Performance Metric', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
};

// =============================================================================
// Export Default
// =============================================================================

export default {
  loggingMiddleware,
  basicLogging,
  detailedLogging,
  productionLogging,
  apiLogging,
  requestIdMiddleware,
  errorLoggingMiddleware,
  performanceMiddleware
};