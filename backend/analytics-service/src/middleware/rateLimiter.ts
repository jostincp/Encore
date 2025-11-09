import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response, RequestHandler } from 'express';
import { logger } from '../utils/logger';
import config from '../utils/config';
import { CacheManager } from '../utils/cache';

/**
 * Rate limiter configuration interface
 */
interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

/**
 * Create rate limiter with Redis store if available
 */
const createRateLimiter = (config: RateLimiterConfig) => {
  const limiterConfig: any = {
    ...config,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        user_agent: req.get('User-Agent'),
        user_id: (req as any).user?.id
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: config.message,
        retry_after: Math.ceil(config.windowMs / 1000)
      });
    }
  };

  // For now, use memory store (Redis integration will be added later)
  logger.warn('Rate limiter using memory store (Redis integration pending)');

  return rateLimit(limiterConfig);
};

/**
 * Generate key for rate limiting based on user or IP
 */
const generateKey = (req: Request): string => {
  const user = (req as any).user;
  if (user && user.id) {
    return `user:${user.id}`;
  }
  return `ip:${req.ip}`;
};

/**
 * Skip rate limiting for certain conditions
 */
const skipLimiting = (req: Request): boolean => {
  // Skip for health checks
  if (req.path === '/health' || req.path.endsWith('/health')) {
    return true;
  }
  
  // Skip for service-to-service communication
  if ((req as any).service) {
    return true;
  }
  
  // Skip for admin users
  const user = (req as any).user;
  if (user && user.role === 'admin') {
    return true;
  }
  
  return false;
};

/**
 * Events rate limiter - 100 requests per minute
 */
export const eventsLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many event requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: skipLimiting
});

/**
 * Analytics rate limiter - 200 requests per minute
 */
export const analyticsLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_BURST_MAX,
  message: 'Too many analytics requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: skipLimiting
});

/**
 * Reports rate limiter - 50 requests per minute
 */
export const reportsLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_STRICT_MAX,
  message: 'Too many report requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: skipLimiting
});

/**
 * General API rate limiter - 500 requests per minute
 */
export const generalLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: skipLimiting
});

/**
 * Strict rate limiter for sensitive operations - 10 requests per minute
 */
export const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many sensitive operation requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: (req: Request) => {
    // Only skip for admin
    const user = (req as any).user;
    return user && user.role === 'admin';
  }
});

/**
 * Burst rate limiter for high-frequency operations - 1000 requests per minute
 */
export const burstLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: 'Too many burst requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: skipLimiting,
  skipSuccessfulRequests: true // Only count failed requests
});

/**
 * Create custom rate limiter
 */
export const createCustomLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessful?: boolean;
  skipFailed?: boolean;
}) => {
  return createRateLimiter({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipLimiting,
    skipSuccessfulRequests: options.skipSuccessful,
    skipFailedRequests: options.skipFailed
  });
};

/**
 * Rate limiter for different endpoints
 */
type RateLimiterHandlers = {
  events: RequestHandler;
  analytics: RequestHandler;
  reports: RequestHandler;
  general: RequestHandler;
  strict: RequestHandler;
  burst: RequestHandler;
  custom: (options: {
    windowMs: number;
    max: number;
    message?: string;
    skipSuccessful?: boolean;
    skipFailed?: boolean;
  }) => RequestHandler;
};

export const rateLimiter: RateLimiterHandlers = {
  events: eventsLimiter as unknown as RequestHandler,
  analytics: analyticsLimiter as unknown as RequestHandler,
  reports: reportsLimiter as unknown as RequestHandler,
  general: generalLimiter as unknown as RequestHandler,
  strict: strictLimiter as unknown as RequestHandler,
  burst: burstLimiter as unknown as RequestHandler,
  custom: ((options) => createCustomLimiter(options)) as unknown as RateLimiterHandlers['custom']
};

/**
 * Get rate limit status for a key
 */
export const getRateLimitStatus = async (key: string): Promise<{
  remaining: number;
  reset: Date;
  total: number;
} | null> => {
  try {
    // Redis integration pending - return null for now
    logger.warn('Rate limit status check not available without Redis');
    return null;
  } catch (error) {
    logger.error('Error getting rate limit status', { error, key });
    return null;
  }
};

/**
 * Reset rate limit for a key
 */
export const resetRateLimit = async (key: string): Promise<boolean> => {
  try {
    // Redis integration pending - return false for now
    logger.warn('Rate limit reset not available without Redis', { key });
    return false;
  } catch (error) {
    logger.error('Error resetting rate limit', { error, key });
    return false;
  }
};

/**
 * Get rate limit statistics
 */
export const getRateLimitStats = async (): Promise<{
  total_keys: number;
  active_limits: number;
  top_limited_keys: Array<{ key: string; hits: number }>;
} | null> => {
  try {
    // Redis integration pending - return null for now
    logger.warn('Rate limit stats not available without Redis');
    return null;
  } catch (error) {
    logger.error('Error getting rate limit stats', { error });
    return null;
  }
};