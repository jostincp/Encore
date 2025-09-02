/**
 * =============================================================================
 * MusicBar Analytics Service - Rate Limiting Middleware
 * =============================================================================
 * Description: Redis-based rate limiting middleware
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../utils/errors';
import { logger } from '../utils/logger';
import { CacheManager } from '../utils/cache';
import { AuthenticatedRequest } from './auth';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string; // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  onLimitReached?: (req: Request, res: Response) => void; // Callback when limit is reached
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later'
};

// =============================================================================
// Cache Manager Instance
// =============================================================================

// Use a simple in-memory cache for now (Redis integration pending)
const cacheManager = {
  cache: new Map<string, { value: string; expiry: number }>(),
  
  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  },
  
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Date.now() + (24 * 60 * 60 * 1000);
    this.cache.set(key, { value, expiry });
  },
  
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  },
  
  async ttl(key: string): Promise<number> {
    const item = this.cache.get(key);
    if (!item) return -1;
    const remaining = Math.max(0, item.expiry - Date.now());
    return Math.ceil(remaining / 1000);
  }
};

// =============================================================================
// Rate Limiting Middleware Factory
// =============================================================================

/**
 * Create rate limiting middleware with custom configuration
 */
export const rateLimitMiddleware = (config: Partial<RateLimitConfig> = {}) => {
  const finalConfig: RateLimitConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Generate rate limit key
      const key = finalConfig.keyGenerator ? 
        finalConfig.keyGenerator(req) : 
        generateDefaultKey(req);

      // Get current request count
      const rateLimitInfo = await getRateLimitInfo(key, finalConfig.windowMs);

      // Set rate limit headers
      setRateLimitHeaders(res, rateLimitInfo, finalConfig.max);

      // Check if limit is exceeded
      if (rateLimitInfo.current >= finalConfig.max) {
        logger.warn('Rate limit exceeded', {
          key,
          current: rateLimitInfo.current,
          limit: finalConfig.max,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        // Call onLimitReached callback if provided
        if (finalConfig.onLimitReached) {
          finalConfig.onLimitReached(req, res);
        }

        throw new RateLimitError(finalConfig.message || DEFAULT_CONFIG.message!);
      }

      // Increment request count
      await incrementRequestCount(key, finalConfig.windowMs);

      // Update headers with new count
      const updatedInfo = await getRateLimitInfo(key, finalConfig.windowMs);
      setRateLimitHeaders(res, updatedInfo, finalConfig.max);

      next();
    } catch (error) {
      if (error.name === 'RateLimitError') {
        return next(error);
      }

      logger.error('Rate limiting error', {
        error: {
          code: 'RATE_LIMIT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        ip: req.ip
      });

      // If rate limiting fails, allow the request to continue
      next();
    }
  };
};

// =============================================================================
// Key Generation Functions
// =============================================================================

/**
 * Generate default rate limit key based on IP and user
 */
const generateDefaultKey = (req: Request): string => {
  const authReq = req as AuthenticatedRequest;
  
  // Use user ID if authenticated, otherwise use IP
  if (authReq.user?.id) {
    return `rate_limit:user:${authReq.user.id}`;
  }
  
  return `rate_limit:ip:${req.ip}`;
};

/**
 * Generate IP-based rate limit key
 */
export const generateIPKey = (req: Request): string => {
  return `rate_limit:ip:${req.ip}`;
};

/**
 * Generate user-based rate limit key
 */
export const generateUserKey = (req: Request): string => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user?.id) {
    return generateIPKey(req);
  }
  return `rate_limit:user:${authReq.user.id}`;
};

/**
 * Generate endpoint-specific rate limit key
 */
export const generateEndpointKey = (req: Request): string => {
  const baseKey = generateDefaultKey(req);
  const endpoint = `${req.method}:${req.route?.path || req.path}`;
  return `${baseKey}:${endpoint}`;
};

// =============================================================================
// Rate Limit Operations
// =============================================================================

/**
 * Get current rate limit information
 */
const getRateLimitInfo = async (key: string, windowMs: number): Promise<RateLimitInfo> => {
  const current = await cacheManager.get(key);
  const currentCount = current ? parseInt(current as string, 10) : 0;
  const ttl = await cacheManager.ttl(key);
  
  const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowMs));
  
  return {
    limit: 0, // Will be set by caller
    current: currentCount,
    remaining: 0, // Will be calculated by caller
    resetTime
  };
};

/**
 * Increment request count
 */
const incrementRequestCount = async (key: string, windowMs: number): Promise<number> => {
  const current = await cacheManager.get(key);
  const newCount = current ? parseInt(current as string, 10) + 1 : 1;
  
  // Set with expiration if it's a new key
  if (!current) {
    await cacheManager.set(key, newCount.toString(), Math.ceil(windowMs / 1000));
  } else {
    await cacheManager.set(key, newCount.toString());
  }
  
  return newCount;
};

/**
 * Set rate limit headers
 */
const setRateLimitHeaders = (res: Response, info: RateLimitInfo, limit: number): void => {
  const remaining = Math.max(0, limit - info.current);
  
  res.set({
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(info.resetTime.getTime() / 1000).toString(),
    'X-RateLimit-Used': info.current.toString()
  });
};

// =============================================================================
// Predefined Rate Limiters
// =============================================================================

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests for this operation, please try again later'
});

/**
 * Standard rate limiter for general API usage
 */
export const standardRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Lenient rate limiter for public endpoints
 */
export const lenientRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Report generation rate limiter (very restrictive)
 */
export const reportRateLimit = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reports per hour
  message: 'Too many report generation requests, please try again later',
  keyGenerator: generateUserKey
});

/**
 * Analytics query rate limiter
 */
export const analyticsRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: 'Too many analytics requests, please try again later',
  keyGenerator: generateUserKey
});

/**
 * Event creation rate limiter
 */
export const eventRateLimit = rateLimitMiddleware({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // 500 events per window
  message: 'Too many events created, please slow down',
  keyGenerator: generateUserKey
});

// =============================================================================
// Rate Limit Utilities
// =============================================================================

/**
 * Get rate limit status for a key
 */
export const getRateLimitStatus = async (key: string, windowMs: number, max: number): Promise<RateLimitInfo> => {
  const info = await getRateLimitInfo(key, windowMs);
  return {
    ...info,
    limit: max,
    remaining: Math.max(0, max - info.current)
  };
};

/**
 * Reset rate limit for a key
 */
export const resetRateLimit = async (key: string): Promise<void> => {
  await cacheManager.del(key);
  logger.info('Rate limit reset', { key });
};

/**
 * Get all rate limit keys (for monitoring)
 */
export const getRateLimitKeys = async (pattern: string = 'rate_limit:*'): Promise<string[]> => {
  // Note: keys method may not be available in all cache implementations
  // This is a placeholder implementation
  return [];
};

// =============================================================================
// Export Default
// =============================================================================

export default {
  rateLimitMiddleware,
  strictRateLimit,
  standardRateLimit,
  lenientRateLimit,
  reportRateLimit,
  analyticsRateLimit,
  eventRateLimit,
  generateIPKey,
  generateUserKey,
  generateEndpointKey,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimitKeys
};