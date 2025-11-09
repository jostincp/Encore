import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

/**
 * Redis client instance
 */
let redisClient: Redis | null = null;
let usingMemoryFallback = false;

// Minimal in-memory Redis-like client for development fallback
class MemoryRedisClient {
  private store: Map<string, { value: string; expireAt?: number }>; 

  constructor() {
    this.store = new Map();
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  private getEntry(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt && entry.expireAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key: string, value: string) {
    this.store.set(key, { value });
    return 'OK' as any;
  }

  async setex(key: string, ttlSeconds: number, value: string) {
    this.store.set(key, { value, expireAt: this.now() + ttlSeconds });
    return 'OK' as any;
  }

  async get(key: string) {
    const entry = this.getEntry(key);
    return entry ? entry.value : null;
  }

  async del(...keys: string[]) {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count as any;
  }

  async exists(key: string) {
    return this.getEntry(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number) {
    const entry = this.getEntry(key);
    if (!entry) return 0 as any;
    entry.expireAt = this.now() + seconds;
    this.store.set(key, entry);
    return 1 as any;
  }

  async ttl(key: string) {
    const entry = this.getEntry(key);
    if (!entry) return -2 as any; // key does not exist
    if (!entry.expireAt) return -1 as any; // no expire
    const remaining = entry.expireAt - this.now();
    return Math.max(remaining, 0) as any;
  }

  async incr(key: string) {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) || 0 : 0;
    const next = (num + 1).toString();
    await this.set(key, next);
    return parseInt(next, 10) as any;
  }

  async incrby(key: string, increment: number) {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) || 0 : 0;
    const next = (num + increment).toString();
    await this.set(key, next);
    return parseInt(next, 10) as any;
  }

  async sadd(key: string, ...members: string[]) {
    // Basic set: store JSON array of unique members
    const current = await this.get(key);
    const set = new Set<string>(current ? JSON.parse(current) : []);
    members.forEach(m => set.add(m));
    await this.set(key, JSON.stringify(Array.from(set)));
    return set.size as any;
  }

  async smembers(key: string) {
    const current = await this.get(key);
    return current ? JSON.parse(current) : [];
  }

  async sismember(key: string, member: string) {
    const members: string[] = await this.smembers(key);
    return (members.includes(member) ? 1 : 0) as any;
  }

  async srem(key: string, ...members: string[]) {
    const current = await this.get(key);
    const set = new Set<string>(current ? JSON.parse(current) : []);
    let removed = 0;
    members.forEach(m => { if (set.delete(m)) removed++; });
    await this.set(key, JSON.stringify(Array.from(set)));
    return removed as any;
  }

  async keys(pattern: string) {
    // Very naive pattern handling: prefix only
    const prefix = pattern.replace(/\*.*$/, '');
    const keys: string[] = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  }

  async quit() {
    this.store.clear();
  }
}

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
    logger.warn('Failed to initialize Redis, falling back to in-memory cache:', error as Error);
    usingMemoryFallback = true;
    // Return a dummy object to satisfy type contract, but getRedisClient will serve memory client
    // @ts-ignore
    redisClient = null;
    return (undefined as unknown) as Redis;
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): Redis => {
  if (redisClient) {
    return redisClient;
  }
  if (usingMemoryFallback) {
    // @ts-ignore - satisfy Redis type in our wrapper
    return new MemoryRedisClient() as unknown as Redis;
  }
  throw new Error('Redis client not initialized. Call initRedis() first.');
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

// Export singleton instance - will be created after Redis initialization
let redisServiceInstance: RedisService | null = null;

export const getRedisService = (): RedisService => {
  if (!redisServiceInstance) {
    redisServiceInstance = new RedisService();
  }
  return redisServiceInstance;
};

// Session management utilities
export const SessionManager = {
  /**
   * Store user session
   */
  async storeSession(userId: string, sessionData: object, ttlSeconds: number = 3600): Promise<void> {
    const key = `session:${userId}`;
    await getRedisService().set(key, sessionData, ttlSeconds);
  },

  /**
   * Get user session
   */
  async getSession<T = any>(userId: string): Promise<T | null> {
    const key = `session:${userId}`;
    return await getRedisService().getJSON<T>(key);
  },

  /**
   * Delete user session
   */
  async deleteSession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await getRedisService().del(key);
  },

  /**
   * Store refresh token
   */
  async storeRefreshToken(userId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await getRedisService().set(key, 'valid', ttlSeconds);
  },

  /**
   * Validate refresh token
   */
  async validateRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const key = `refresh_token:${userId}:${tokenId}`;
    return await getRedisService().exists(key);
  },

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await getRedisService().del(key);
  },

  /**
   * Revoke all refresh tokens for user
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;
    await getRedisService().deletePattern(pattern);
  },
};