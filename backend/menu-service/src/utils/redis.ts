import Redis from 'ioredis';
import { config } from './config';
import { logInfo, logError, logDebug } from '../types/shared';

// Redis client instance
let redis: Redis | null = null;

// Redis configuration
const redisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
  family: 4, // IPv4
};

// Use REDIS_URL if provided (for production environments)
if (config.REDIS_URL) {
  Object.assign(redisConfig, {
    // Parse Redis URL
    ...parseRedisUrl(config.REDIS_URL)
  });
}

// Parse Redis URL helper
function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) || 0 : 0
    };
  } catch (error) {
    logError('Invalid Redis URL format', { url, error });
    return {};
  }
}

// Connect to Redis
export const connectRedis = async (): Promise<Redis> => {
  try {
    if (redis && redis.status === 'ready') {
      return redis;
    }
    
    redis = new Redis(redisConfig);
    
    // Event handlers
    redis.on('connect', () => {
      logInfo('Redis connecting...');
    });
    
    redis.on('ready', () => {
      logInfo('Redis connected successfully', {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        db: config.REDIS_DB
      });
    });
    
    redis.on('error', (error) => {
      logError('Redis connection error', { error });
    });
    
    redis.on('close', () => {
      logError('Redis connection closed');
    });
    
    redis.on('reconnecting', (delay: number) => {
      logInfo('Redis reconnecting...', { delay });
    });
    
    redis.on('end', () => {
      logInfo('Redis connection ended');
    });
    
    // Connect to Redis
    await redis.connect();
    
    // Test connection
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    return redis;
    
  } catch (error) {
    logError('Failed to connect to Redis', { error });
    throw error;
  }
};

// Get Redis client
export const getRedis = (): Redis => {
  if (!redis || redis.status !== 'ready') {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
};

// Cache operations with logging
export const cache = {
  // Get value from cache
  get: async <T = any>(key: string): Promise<T | null> => {
    try {
      const client = getRedis();
      const value = await client.get(key);
      
      if (value) {
        // Cache hit
        return JSON.parse(value);
      } else {
        // Cache miss
        return null;
      }
    } catch (error) {
      logError('Cache get error', { key, error });
      return null;
    }
  },
  
  // Set value in cache
  set: async (key: string, value: any, ttl?: number): Promise<boolean> => {
    try {
      const client = getRedis();
      const serialized = JSON.stringify(value);
      const cacheTtl = ttl || config.CACHE_DEFAULT_TTL;
      
      await client.setex(key, cacheTtl, serialized);
      // Cache set
      
      return true;
    } catch (error) {
      logError('Cache set error', { key, error });
      return false;
    }
  },
  
  // Delete value from cache
  del: async (key: string): Promise<boolean> => {
    try {
      const client = getRedis();
      const result = await client.del(key);
      
      // Cache delete
      
      return result > 0;
    } catch (error) {
      logError('Cache delete error', { key, error });
      return false;
    }
  },
  
  // Delete multiple keys
  delPattern: async (pattern: string): Promise<number> => {
    try {
      const client = getRedis();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await client.del(...keys);
      
      logDebug('Cache pattern delete', { pattern, keysDeleted: result });
      
      return result;
    } catch (error) {
      logError('Cache pattern delete error', { pattern, error });
      return 0;
    }
  },
  
  // Check if key exists
  exists: async (key: string): Promise<boolean> => {
    try {
      const client = getRedis();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logError('Cache exists error', { key, error });
      return false;
    }
  },
  
  // Get TTL of a key
  ttl: async (key: string): Promise<number> => {
    try {
      const client = getRedis();
      return await client.ttl(key);
    } catch (error) {
      logError('Cache TTL error', { key, error });
      return -1;
    }
  },
  
  // Increment counter
  incr: async (key: string, ttl?: number): Promise<number> => {
    try {
      const client = getRedis();
      const result = await client.incr(key);
      
      if (ttl && result === 1) {
        await client.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      logError('Cache increment error', { key, error });
      return 0;
    }
  },
  
  // Set with expiration
  setex: async (key: string, ttl: number, value: any): Promise<boolean> => {
    try {
      const client = getRedis();
      const serialized = JSON.stringify(value);
      
      await client.setex(key, ttl, serialized);
      // Cache setex
      
      return true;
    } catch (error) {
      logError('Cache setex error', { key, ttl, error });
      return false;
    }
  },
  
  // Hash operations
  hget: async <T = any>(key: string, field: string): Promise<T | null> => {
    try {
      const client = getRedis();
      const value = await client.hget(key, field);
      
      if (value) {
        return JSON.parse(value);
      }
      
      return null;
    } catch (error) {
      logError('Cache hget error', { key, field, error });
      return null;
    }
  },
  
  hset: async (key: string, field: string, value: any, ttl?: number): Promise<boolean> => {
    try {
      const client = getRedis();
      const serialized = JSON.stringify(value);
      
      await client.hset(key, field, serialized);
      
      if (ttl) {
        await client.expire(key, ttl);
      }
      
      return true;
    } catch (error) {
      logError('Cache hset error', { key, field, error });
      return false;
    }
  },
  
  // List operations
  lpush: async (key: string, value: any, ttl?: number): Promise<number> => {
    try {
      const client = getRedis();
      const serialized = JSON.stringify(value);
      
      const result = await client.lpush(key, serialized);
      
      if (ttl) {
        await client.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      logError('Cache lpush error', { key, error });
      return 0;
    }
  },
  
  lrange: async <T = any>(key: string, start: number, stop: number): Promise<T[]> => {
    try {
      const client = getRedis();
      const values = await client.lrange(key, start, stop);
      
      return values.map(value => JSON.parse(value));
    } catch (error) {
      logError('Cache lrange error', { key, start, stop, error });
      return [];
    }
  }
};

// Menu-specific cache helpers
export const menuCache = {
  // Cache keys
  keys: {
    menuItems: (barId: string, filters?: string) => `menu:${barId}:items${filters ? `:${filters}` : ''}`,
    menuItem: (barId: string, itemId: string) => `menu:${barId}:item:${itemId}`,
    categories: (barId: string) => `menu:${barId}:categories`,
    category: (barId: string, categoryId: string) => `menu:${barId}:category:${categoryId}`,
    menuStats: (barId: string) => `menu:${barId}:stats`,
    popularItems: (barId: string) => `menu:${barId}:popular`,
    featuredItems: (barId: string) => `menu:${barId}:featured`
  },
  
  // Clear all menu cache for a bar
  clearBarCache: async (barId: string): Promise<number> => {
    const pattern = `menu:${barId}:*`;
    return await cache.delPattern(pattern);
  },
  
  // Clear specific menu item cache
  clearItemCache: async (barId: string, itemId: string): Promise<boolean> => {
    const key = menuCache.keys.menuItem(barId, itemId);
    return await cache.del(key);
  },
  
  // Clear menu items list cache
  clearItemsCache: async (barId: string): Promise<number> => {
    const pattern = `menu:${barId}:items*`;
    return await cache.delPattern(pattern);
  },
  
  // Clear categories cache
  clearCategoriesCache: async (barId: string): Promise<boolean> => {
    const key = menuCache.keys.categories(barId);
    return await cache.del(key);
  }
};

// Close Redis connection
export const closeRedis = async (): Promise<void> => {
  if (redis) {
    try {
      await redis.quit();
      redis = null;
      logInfo('Redis connection closed');
    } catch (error) {
      logError('Error closing Redis connection', { error });
      throw error;
    }
  }
};

// Health check
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> => {
  try {
    if (!redis || redis.status !== 'ready') {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          status: redis?.status || 'disconnected'
        }
      };
    }
    
    const start = Date.now();
    const pong = await redis.ping();
    const duration = Date.now() - start;
    
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    const info = await redis.info('memory');
    const memoryInfo = info.split('\r\n')
      .filter(line => line.includes('used_memory_human'))
      .map(line => line.split(':'))
      .reduce((acc, [key, value]) => ({ ...acc, [key as string]: value }), {} as Record<string, any>);
    
    return {
      status: 'healthy',
      details: {
        connected: true,
        status: redis.status,
        responseTime: `${duration}ms`,
        memory: memoryInfo
      }
    };
    
  } catch (error) {
    logError('Redis health check failed', { error });
    
    return {
      status: 'unhealthy',
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export default {
  connectRedis,
  getRedis,
  cache,
  menuCache,
  closeRedis,
  healthCheck
};