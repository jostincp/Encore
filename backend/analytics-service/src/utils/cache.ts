/**
 * =============================================================================
 * MusicBar Analytics Service - Cache Utilities
 * =============================================================================
 * Description: Redis cache utilities and helpers
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import Redis from 'ioredis';
import logger from '../config/logger';
import { CacheError } from './errors';

// =============================================================================
// Cache Configuration
// =============================================================================
export interface CacheConfig {
  defaultTTL: number; // seconds
  keyPrefix: string;
  serializer: {
    serialize: (value: any) => string;
    deserialize: (value: string) => any;
  };
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 3600, // 1 hour
  keyPrefix: 'encore:analytics:',
  serializer: {
    serialize: JSON.stringify,
    deserialize: JSON.parse
  }
};

// =============================================================================
// Cache Manager Class
// =============================================================================
export class CacheManager {
  private redis: Redis;
  private config: CacheConfig;

  constructor(redis: Redis, config: Partial<CacheConfig> = {}) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Basic Operations
  // ===========================================================================
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.get(fullKey);
      
      if (value === null) {
        return null;
      }
      
      return this.config.serializer.deserialize(value) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error: error.message });
      throw new CacheError(`Failed to get cache key: ${key}`, { key, error });
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValue = this.config.serializer.serialize(value);
      const cacheTTL = ttl || this.config.defaultTTL;
      
      await this.redis.setex(fullKey, cacheTTL, serializedValue);
    } catch (error) {
      logger.error('Cache set error:', { key, ttl, error: error.message });
      throw new CacheError(`Failed to set cache key: ${key}`, { key, ttl, error });
    }
  }

  async del(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.redis.del(fullKey);
    } catch (error) {
      logger.error('Cache delete error:', { key, error: error.message });
      throw new CacheError(`Failed to delete cache key: ${key}`, { key, error });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error: error.message });
      throw new CacheError(`Failed to check cache key existence: ${key}`, { key, error });
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.redis.expire(fullKey, ttl);
    } catch (error) {
      logger.error('Cache expire error:', { key, ttl, error: error.message });
      throw new CacheError(`Failed to set expiration for cache key: ${key}`, { key, ttl, error });
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      logger.error('Cache TTL error:', { key, error: error.message });
      throw new CacheError(`Failed to get TTL for cache key: ${key}`, { key, error });
    }
  }

  // ===========================================================================
  // Pattern Operations
  // ===========================================================================
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error:', { pattern, error: error.message });
      throw new CacheError(`Failed to delete cache pattern: ${pattern}`, { pattern, error });
    }
  }

  async getKeys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      // Remove prefix from keys
      return keys.map(key => key.replace(this.config.keyPrefix, ''));
    } catch (error) {
      logger.error('Cache get keys error:', { pattern, error: error.message });
      throw new CacheError(`Failed to get cache keys for pattern: ${pattern}`, { pattern, error });
    }
  }

  // ===========================================================================
  // Hash Operations
  // ===========================================================================
  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.hget(fullKey, field);
      
      if (value === null) {
        return null;
      }
      
      return this.config.serializer.deserialize(value) as T;
    } catch (error) {
      logger.error('Cache hget error:', { key, field, error: error.message });
      throw new CacheError(`Failed to get hash field: ${key}.${field}`, { key, field, error });
    }
  }

  async hset<T>(key: string, field: string, value: T): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValue = this.config.serializer.serialize(value);
      
      await this.redis.hset(fullKey, field, serializedValue);
    } catch (error) {
      logger.error('Cache hset error:', { key, field, error: error.message });
      throw new CacheError(`Failed to set hash field: ${key}.${field}`, { key, field, error });
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.redis.hdel(fullKey, field);
    } catch (error) {
      logger.error('Cache hdel error:', { key, field, error: error.message });
      throw new CacheError(`Failed to delete hash field: ${key}.${field}`, { key, field, error });
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      const fullKey = this.getFullKey(key);
      const hash = await this.redis.hgetall(fullKey);
      
      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = this.config.serializer.deserialize(value) as T;
      }
      
      return result;
    } catch (error) {
      logger.error('Cache hgetall error:', { key, error: error.message });
      throw new CacheError(`Failed to get all hash fields: ${key}`, { key, error });
    }
  }

  // ===========================================================================
  // List Operations
  // ===========================================================================
  async lpush<T>(key: string, ...values: T[]): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValues = values.map(v => this.config.serializer.serialize(v));
      
      return await this.redis.lpush(fullKey, ...serializedValues);
    } catch (error) {
      logger.error('Cache lpush error:', { key, error: error.message });
      throw new CacheError(`Failed to push to list: ${key}`, { key, error });
    }
  }

  async rpop<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.rpop(fullKey);
      
      if (value === null) {
        return null;
      }
      
      return this.config.serializer.deserialize(value) as T;
    } catch (error) {
      logger.error('Cache rpop error:', { key, error: error.message });
      throw new CacheError(`Failed to pop from list: ${key}`, { key, error });
    }
  }

  async llen(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.llen(fullKey);
    } catch (error) {
      logger.error('Cache llen error:', { key, error: error.message });
      throw new CacheError(`Failed to get list length: ${key}`, { key, error });
    }
  }

  // ===========================================================================
  // Set Operations
  // ===========================================================================
  async sadd<T>(key: string, ...members: T[]): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedMembers = members.map(m => this.config.serializer.serialize(m));
      
      return await this.redis.sadd(fullKey, ...serializedMembers);
    } catch (error) {
      logger.error('Cache sadd error:', { key, error: error.message });
      throw new CacheError(`Failed to add to set: ${key}`, { key, error });
    }
  }

  async srem<T>(key: string, ...members: T[]): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedMembers = members.map(m => this.config.serializer.serialize(m));
      
      return await this.redis.srem(fullKey, ...serializedMembers);
    } catch (error) {
      logger.error('Cache srem error:', { key, error: error.message });
      throw new CacheError(`Failed to remove from set: ${key}`, { key, error });
    }
  }

  async smembers<T>(key: string): Promise<T[]> {
    try {
      const fullKey = this.getFullKey(key);
      const members = await this.redis.smembers(fullKey);
      
      return members.map(m => this.config.serializer.deserialize(m) as T);
    } catch (error) {
      logger.error('Cache smembers error:', { key, error: error.message });
      throw new CacheError(`Failed to get set members: ${key}`, { key, error });
    }
  }

  async sismember(key: string, member: any): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedMember = this.config.serializer.serialize(member);
      
      const result = await this.redis.sismember(fullKey, serializedMember);
      return result === 1;
    } catch (error) {
      logger.error('Cache sismember error:', { key, error: error.message });
      throw new CacheError(`Failed to check set member: ${key}`, { key, error });
    }
  }

  // ===========================================================================
  // Sorted Set Operations
  // ===========================================================================
  async zadd(key: string, score: number, member: any): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedMember = this.config.serializer.serialize(member);
      
      return await this.redis.zadd(fullKey, score, serializedMember);
    } catch (error) {
      logger.error('Cache zadd error:', { key, score, error: error.message });
      throw new CacheError(`Failed to add to sorted set: ${key}`, { key, score, error });
    }
  }

  async zrem(key: string, member: any): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedMember = this.config.serializer.serialize(member);
      
      return await this.redis.zrem(fullKey, serializedMember);
    } catch (error) {
      logger.error('Cache zrem error:', { key, error: error.message });
      throw new CacheError(`Failed to remove from sorted set: ${key}`, { key, error });
    }
  }

  async zrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    try {
      const fullKey = this.getFullKey(key);
      const members = await this.redis.zrange(fullKey, start, stop);
      
      return members.map(m => this.config.serializer.deserialize(m) as T);
    } catch (error) {
      logger.error('Cache zrange error:', { key, start, stop, error: error.message });
      throw new CacheError(`Failed to get sorted set range: ${key}`, { key, start, stop, error });
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================
  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Cache ping error:', { error: error.message });
      return false;
    }
  }

  async flushdb(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      logger.error('Cache flush error:', { error: error.message });
      throw new CacheError('Failed to flush cache database', { error });
    }
  }

  async info(): Promise<string> {
    try {
      return await this.redis.info();
    } catch (error) {
      logger.error('Cache info error:', { error: error.message });
      throw new CacheError('Failed to get cache info', { error });
    }
  }
}

// =============================================================================
// Cache Key Builders
// =============================================================================
export class CacheKeyBuilder {
  static event(eventId: string): string {
    return `event:${eventId}`;
  }

  static events(filters: Record<string, any> = {}): string {
    const filterStr = Object.entries(filters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    return `events:${filterStr || 'all'}`;
  }

  static analytics(analyticsId: string): string {
    return `analytics:${analyticsId}`;
  }

  static analyticsQuery(filters: Record<string, any> = {}): string {
    const filterStr = Object.entries(filters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    return `analytics:query:${filterStr || 'all'}`;
  }

  static report(reportId: string): string {
    return `report:${reportId}`;
  }

  static reports(filters: Record<string, any> = {}): string {
    const filterStr = Object.entries(filters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    return `reports:${filterStr || 'all'}`;
  }

  static dashboard(barId?: string, period?: string): string {
    const parts = ['dashboard'];
    if (barId) parts.push(`bar:${barId}`);
    if (period) parts.push(`period:${period}`);
    return parts.join(':');
  }

  static metrics(type: string, barId?: string, period?: string): string {
    const parts = ['metrics', `type:${type}`];
    if (barId) parts.push(`bar:${barId}`);
    if (period) parts.push(`period:${period}`);
    return parts.join(':');
  }

  static statistics(type: string): string {
    return `stats:${type}`;
  }

  static queue(queueName: string): string {
    return `queue:${queueName}`;
  }

  static lock(resource: string): string {
    return `lock:${resource}`;
  }
}

// =============================================================================
// Cache Decorators
// =============================================================================
export function cached(ttl: number = 3600) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      const cache = this.cache as CacheManager;
      
      if (cache) {
        try {
          const cachedResult = await cache.get(cacheKey);
          if (cachedResult !== null) {
            return cachedResult;
          }
        } catch (error) {
          logger.warn('Cache get failed, proceeding with method execution:', { error: error.message });
        }
      }
      
      const result = await method.apply(this, args);
      
      if (cache && result !== null && result !== undefined) {
        try {
          await cache.set(cacheKey, result, ttl);
        } catch (error) {
          logger.warn('Cache set failed:', { error: error.message });
        }
      }
      
      return result;
    };
  };
}

// =============================================================================
// Export All
// =============================================================================
export { CacheManager as RedisManager };

export default {
  CacheManager,
  CacheKeyBuilder,
  cached
};