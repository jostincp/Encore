import { redisHelpers } from '../config/redis';
import logger from '@shared/utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Compress large objects
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: string;
}

export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly COMPRESSION_THRESHOLD = 1024; // 1KB
  private static readonly TAG_PREFIX = 'tag:';
  private static readonly STATS_KEY = 'cache:stats';

  /**
   * Enhanced get with automatic decompression and stats tracking
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const startTime = Date.now();
      const cached = await redisHelpers.get(key);
      
      if (cached === null) {
        await this.incrementStat('misses');
        return null;
      }

      await this.incrementStat('hits');
      
      // Check if data is compressed
      if (typeof cached === 'string' && cached.startsWith('COMPRESSED:')) {
        const compressed = cached.substring(11);
        const decompressed = await this.decompress(compressed);
        return JSON.parse(decompressed);
      }

      const duration = Date.now() - startTime;
      if (duration > 100) {
        logger.warn(`Slow cache get for key: ${key}`, { duration });
      }

      return cached;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Enhanced set with compression, tagging, and TTL management
   */
  static async set<T>(
    key: string, 
    value: T, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const { ttl = this.DEFAULT_TTL, tags = [], compress = true } = options;
      
      let dataToStore: any = value;
      const serialized = JSON.stringify(value);
      
      // Compress large objects
      if (compress && serialized.length > this.COMPRESSION_THRESHOLD) {
        const compressed = await this.compress(serialized);
        dataToStore = `COMPRESSED:${compressed}`;
      }

      // Store the main data
      const success = await redisHelpers.set(key, dataToStore, ttl);
      
      if (success && tags.length > 0) {
        // Associate with tags for invalidation
        await this.associateWithTags(key, tags, ttl);
      }

      return success;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  /**
   * Delete a single key
   */
  static async delete(key: string): Promise<boolean> {
    try {
      const result = await redisHelpers.delete(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  static async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let totalInvalidated = 0;
      
      for (const tag of tags) {
        const tagKey = `${this.TAG_PREFIX}${tag}`;
        const keys = await redisHelpers.getSetMembers(tagKey);
        
        if (keys && keys.length > 0) {
          // Delete all keys associated with this tag
          const deleted = await redisHelpers.deleteMultiple(keys);
          totalInvalidated += deleted;
          
          // Clean up the tag set
          await redisHelpers.delete(tagKey);
        }
      }
      
      logger.info('Cache invalidated by tags', { tags, totalInvalidated });
      return totalInvalidated;
    } catch (error) {
      logger.error('Cache invalidation error:', { tags, error });
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await redisHelpers.getKeysByPattern(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const deleted = await redisHelpers.deleteMultiple(keys);
      logger.info('Cache invalidated by pattern', { pattern, deleted });
      
      return deleted;
    } catch (error) {
      logger.error('Cache pattern invalidation error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  static async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fetchFunction();
      await this.set(key, result, options);
      
      return result;
    } catch (error) {
      logger.error('Cache getOrSet error:', { key, error });
      throw error;
    }
  }

  /**
   * Warm up cache with predefined data
   */
  static async warmUp(barId: string): Promise<void> {
    try {
      logger.info('Starting cache warm-up', { barId });
      
      // Warm up popular songs
      const popularKey = `popular:${barId}:20:week`;
      if (!(await this.get(popularKey))) {
        // This would trigger the actual data fetch
        logger.info('Warming up popular songs cache', { barId });
      }
      
      // Warm up recent songs
      const recentKey = `recent:${barId}:20`;
      if (!(await this.get(recentKey))) {
        logger.info('Warming up recent songs cache', { barId });
      }
      
      logger.info('Cache warm-up completed', { barId });
    } catch (error) {
      logger.error('Cache warm-up error:', { barId, error });
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<CacheStats> {
    try {
      const stats = await redisHelpers.get(this.STATS_KEY) || { hits: 0, misses: 0 };
      const totalRequests = stats.hits + stats.misses;
      const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;
      
      // Get Redis info
      const info = await redisHelpers.getInfo();
      const totalKeys = info.keyspace?.db0?.keys || 0;
      const memoryUsage = info.memory?.used_memory_human || '0B';
      
      return {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys,
        memoryUsage
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: '0B'
      };
    }
  }

  /**
   * Clear all cache
   */
  static async clear(): Promise<boolean> {
    try {
      await redisHelpers.flushAll();
      logger.info('Cache cleared completely');
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Health check for cache service
   */
  static async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const testKey = 'health:check';
      const testValue = { timestamp: Date.now() };
      
      // Test write
      const writeSuccess = await this.set(testKey, testValue, { ttl: 60 });
      if (!writeSuccess) {
        throw new Error('Failed to write to cache');
      }
      
      // Test read
      const readValue = await this.get(testKey);
      if (!readValue || readValue.timestamp !== testValue.timestamp) {
        throw new Error('Failed to read from cache');
      }
      
      // Test delete
      const deleteSuccess = await this.delete(testKey);
      if (!deleteSuccess) {
        throw new Error('Failed to delete from cache');
      }
      
      const stats = await this.getStats();
      
      return {
        status: 'healthy',
        details: {
          connection: 'ok',
          operations: 'ok',
          stats
        }
      };
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Private helper methods
  
  private static async compress(data: string): Promise<string> {
    // Simple base64 encoding for now - in production use proper compression
    return Buffer.from(data).toString('base64');
  }
  
  private static async decompress(data: string): Promise<string> {
    return Buffer.from(data, 'base64').toString('utf-8');
  }
  
  private static async associateWithTags(key: string, tags: string[], ttl: number): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.TAG_PREFIX}${tag}`;
      await redisHelpers.addToSet(tagKey, key);
      await redisHelpers.expire(tagKey, ttl + 300); // Tag expires 5 minutes after data
    }
  }
  
  private static async incrementStat(stat: 'hits' | 'misses'): Promise<void> {
    try {
      const current = await redisHelpers.get(this.STATS_KEY) || { hits: 0, misses: 0 };
      current[stat]++;
      await redisHelpers.set(this.STATS_KEY, current, 86400); // 24 hours
    } catch (error) {
      // Don't throw on stats errors
      logger.warn('Failed to update cache stats:', error);
    }
  }
}

// Cache key generators for consistency
export class CacheKeys {
  static song(songId: string, barId?: string): string {
    return barId ? `song:${songId}:${barId}` : `song:${songId}`;
  }

  static search(query: string, filters: any = {}): string {
    const filterStr = Object.keys(filters).length > 0 ? `:${JSON.stringify(filters)}` : '';
    return `search:${Buffer.from(query).toString('base64')}${filterStr}`;
  }

  static popular(barId: string, limit: number, timeframe: string): string {
    return `popular:${barId}:${limit}:${timeframe}`;
  }

  static recent(barId: string, limit: number): string {
    return `recent:${barId}:${limit}`;
  }

  static trending(limit: number, source: string): string {
    return `trending:${limit}:${source}`;
  }

  // Queue-related cache keys
  static queueByBar(barId: string, filters: any, limit: number, offset: number, includeDetails: boolean): string {
    const filterStr = Object.keys(filters).length > 0 ? `:${JSON.stringify(filters)}` : '';
    return `queue:bar:${barId}:${limit}:${offset}:${includeDetails}${filterStr}`;
  }

  static currentlyPlaying(barId: string): string {
    return `queue:playing:${barId}`;
  }

  static nextInQueue(barId: string): string {
    return `queue:next:${barId}`;
  }

  static queueStats(barId: string, dateFrom?: Date, dateTo?: Date): string {
    const dateStr = dateFrom && dateTo ? `:${dateFrom.toISOString()}:${dateTo.toISOString()}` : '';
    return `queue:stats:${barId}${dateStr}`;
  }

  static popularFromQueue(barId: string, limit: number, timeframe: string): string {
    return `queue:popular:${barId}:${limit}:${timeframe}`;
  }

  static recentFromQueue(barId: string, limit: number): string {
    return `queue:recent:${barId}:${limit}`;
  }
}

// Cache tags for invalidation
export class CacheTags {
  static song(songId: string): string {
    return `song:${songId}`;
  }
  
  static bar(barId: string): string {
    return `bar:${barId}`;
  }
  
  static user(userId: string): string {
    return `user:${userId}`;
  }
  
  static queue(barId: string): string {
    return `queue:${barId}`;
  }
  
  static search(): string {
    return 'search';
  }
  
  static popular(): string {
    return 'popular';
  }
  
  static trending(): string {
    return 'trending';
  }
}