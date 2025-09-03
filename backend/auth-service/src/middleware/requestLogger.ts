import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { RequestWithUser } from '../types';

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request | RequestWithUser, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Log request start
  logger.info('Request started', {
    method,
    url,
    ip,
    userAgent,
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Log request completion
    logger.info('Request completed', {
      method,
      url,
      ip,
      statusCode,
      duration: `${duration}ms`,
      userAgent,
      timestamp: new Date().toISOString()
    });

    // Call original end method and return its result
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method,
    url,
    ip,
    userAgent,
    timestamp: new Date().toISOString()
  });

  next(error);
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
};

/**
 * CORS middleware
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
};