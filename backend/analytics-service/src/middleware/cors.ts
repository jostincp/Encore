import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * CORS Middleware
 * Handles Cross-Origin Resource Sharing for the analytics service
 */

interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

/**
 * Default CORS configuration
 */
const defaultCorsOptions: CorsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-API-Key',
    'X-User-ID',
    'X-Bar-ID',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'Content-Disposition'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
};

/**
 * Environment-specific CORS origins
 */
const getAllowedOrigins = (): string[] => {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return [
        'https://encore.app',
    'https://www.encore.app',
    'https://admin.encore.app',
    'https://dashboard.encore.app'
      ];
    
    case 'staging':
      return [
        'https://staging.encore.app',
    'https://staging-admin.encore.app',
    'https://staging-dashboard.encore.app'
      ];
    
    case 'development':
    default:
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080'
      ];
  }
};

/**
 * Check if origin is allowed
 */
const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) {
    return true;
  }
  
  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Check for wildcard patterns in development
  if (process.env.NODE_ENV === 'development') {
    // Allow localhost with any port
    if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/)) {
      return true;
    }
  }
  
  return false;
};

/**
 * CORS middleware function
 */
export const corsMiddleware = (options: CorsOptions = {}) => {
  const corsOptions = { ...defaultCorsOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    
    try {
      // Handle origin
      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin(origin, (err, allow) => {
          if (err) {
            logger.error('CORS origin check error:', err);
            return next(err);
          }
          
          if (allow) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
          }
        });
      } else if (corsOptions.origin === true) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      } else if (corsOptions.origin === false) {
        // Don't set Access-Control-Allow-Origin header
      } else if (typeof corsOptions.origin === 'string') {
        res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
      } else if (Array.isArray(corsOptions.origin)) {
        if (origin && corsOptions.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else {
        // Use custom origin validation
        if (isOriginAllowed(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
        }
      }
      
      // Handle credentials
      if (corsOptions.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      
      // Handle exposed headers
      if (corsOptions.exposedHeaders) {
        const headers = Array.isArray(corsOptions.exposedHeaders)
          ? corsOptions.exposedHeaders.join(', ')
          : corsOptions.exposedHeaders;
        res.setHeader('Access-Control-Expose-Headers', headers);
      }
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        // Handle methods
        if (corsOptions.methods) {
          const methods = Array.isArray(corsOptions.methods)
            ? corsOptions.methods.join(', ')
            : corsOptions.methods;
          res.setHeader('Access-Control-Allow-Methods', methods);
        }
        
        // Handle allowed headers
        if (corsOptions.allowedHeaders) {
          const headers = Array.isArray(corsOptions.allowedHeaders)
            ? corsOptions.allowedHeaders.join(', ')
            : corsOptions.allowedHeaders;
          res.setHeader('Access-Control-Allow-Headers', headers);
        } else {
          // Echo the request headers
          const requestHeaders = req.headers['access-control-request-headers'];
          if (requestHeaders) {
            res.setHeader('Access-Control-Allow-Headers', requestHeaders);
          }
        }
        
        // Handle max age
        if (corsOptions.maxAge) {
          res.setHeader('Access-Control-Max-Age', corsOptions.maxAge.toString());
        }
        
        // Handle preflight continue
        if (corsOptions.preflightContinue) {
          return next();
        }
        
        // Send preflight response
        res.status(corsOptions.optionsSuccessStatus || 204);
        res.setHeader('Content-Length', '0');
        res.end();
        return;
      }
      
      // Log CORS requests in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('CORS request:', {
          method: req.method,
          origin: origin,
          path: req.path,
          allowed: isOriginAllowed(origin)
        });
      }
      
      next();
      
    } catch (error) {
      logger.error('CORS middleware error:', error);
      next(error);
    }
  };
};

/**
 * Strict CORS middleware for admin endpoints
 */
export const strictCorsMiddleware = corsMiddleware({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins().filter(url => 
      url.includes('admin') || url.includes('dashboard')
    );
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  maxAge: 3600 // 1 hour
});

/**
 * Permissive CORS middleware for public endpoints
 */
export const publicCorsMiddleware = corsMiddleware({
  origin: '*',
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  maxAge: 86400 // 24 hours
});

/**
 * Development CORS middleware (very permissive)
 */
export const developmentCorsMiddleware = corsMiddleware({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-API-Key',
    'X-User-ID',
    'X-Bar-ID',
    'X-Request-ID',
    '*'
  ],
  maxAge: 86400
});

/**
 * Get appropriate CORS middleware based on environment
 */
export const getCorsMiddleware = () => {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return corsMiddleware();
    case 'staging':
      return corsMiddleware();
    case 'development':
    default:
      return developmentCorsMiddleware;
  }
};

// Export default CORS middleware
export default corsMiddleware();