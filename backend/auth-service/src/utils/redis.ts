import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

/**
 * Redis client instance
 */
let redisClient: Redis | null = null;

/**
 * Initialize Redis connection
 */
export const initRedis = async (): Promise<Redis> => {
  try {
    const redisConfig: any = {
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };
    
    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }
    
    redisClient = new Redis(redisConfig);

    // Event listeners
    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Test connection
    await redisClient.connect();
    await redisClient.ping();
    
    logger.info('Redis initialized successfully');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

/**
 * Redis utility functions
 */
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = getRedisClient();
  }

  /**
   * Set a key-value pair with optional TTL
   */
  async set(key: string, value: string | object, ttlSeconds?: number): Promise<void> {
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * Get and parse JSON value by key
   */
  async getJSON<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Failed to parse JSON for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  /**
   * Increment by a specific amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    return await this.client.incrby(key, increment);
  }

  /**
   * Add to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sadd(key, ...members);
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  /**
   * Remove from set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return await this.client.srem(key, ...members);
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return 0;
    
    return await this.client.del(...keys);
  }

  /**
   * Flush all data from current database
   */
  async flushdb(): Promise<void> {
    await this.client.flushdb();
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Session management utilities
export const SessionManager = {
  /**
   * Store user session
   */
  async storeSession(userId: string, sessionData: object, ttlSeconds: number = config.redis.ttl): Promise<void> {
    const key = `session:${userId}`;
    await redisService.set(key, sessionData, ttlSeconds);
  },

  /**
   * Get user session
   */
  async getSession<T = any>(userId: string): Promise<T | null> {
    const key = `session:${userId}`;
    return await redisService.getJSON<T>(key);
  },

  /**
   * Delete user session
   */
  async deleteSession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await redisService.del(key);
  },

  /**
   * Store refresh token
   */
  async storeRefreshToken(userId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await redisService.set(key, 'valid', ttlSeconds);
  },

  /**
   * Validate refresh token
   */
  async validateRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const key = `refresh_token:${userId}:${tokenId}`;
    return await redisService.exists(key);
  },

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await redisService.del(key);
  },

  /**
   * Revoke all refresh tokens for user
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;
    await redisService.deletePattern(pattern);
  },
};