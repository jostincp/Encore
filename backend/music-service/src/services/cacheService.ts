
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

/**
 * 🛠️ Simple LRU Cache Implementation
 * Elimina dependencia externa problemática y asegura compatibilidad 100% CJS/TS.
 */
class SimpleLRUCache<V> {
  private max: number;
  private ttl: number; // ms
  private cache: Map<string, { value: V; expires: number }>;

  constructor(options: { max: number; ttl: number;[key: string]: any }) {
    this.max = options.max;
    this.ttl = options.ttl;
    this.cache = new Map();
  }

  get(key: string): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check expiration
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU (delete and re-add)
    this.cache.delete(key);
    this.cache.set(key, item);

    // Refresh TTL (updateAgeOnGet equivalent)
    item.expires = Date.now() + this.ttl;

    return item.value;
  }

  set(key: string, value: V, options?: { ttl?: number }): void {
    const ttl = options?.ttl || this.ttl;

    // Evitar crecimiento infinito
    if (this.cache.size >= this.max) {
      // Eliminar el primero (oldest)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.delete(key); // Mover al final
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Configuración de LRU Cache (Memoria)
const memoryCache = new SimpleLRUCache<any>({
  max: 500, // Máximo 500 items
  ttl: 1000 * 60 * 60, // 1 hora por defecto
});

export const CacheKeys = {
  SEARCH_PREFIX: 'yt:search:',
  VIDEO_PREFIX: 'yt:video:',
  LYRICS_PREFIX: 'lyrics:',
  QUEUE_PREFIX: 'queue:',
  BAR_SETTINGS: 'bar:settings:',
};

export class CacheService {
  private static redis: Redis | null = null;
  private static isRedisHealthy = false;

  private static stats = {
    redisHits: 0,
    redisMisses: 0,
    memoryHits: 0,
    memoryMisses: 0,
    errors: 0
  };

  static async initialize() {
    try {
      console.log('🔌 Connecting to Redis at', REDIS_URL);
      this.redis = new Redis(REDIS_URL, {
        retryStrategy(times) {
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
        this.isRedisHealthy = true;
        memoryCache.clear();
      });

      this.redis.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.isRedisHealthy = false;
      });

      this.redis.on('close', () => {
        console.warn('⚠️ Redis connection closed');
        this.isRedisHealthy = false;
      });

    } catch (error) {
      console.error('❌ Failed to initialize Redis client:', error);
      this.isRedisHealthy = false;
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    if (this.isRedisHealthy && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          this.stats.redisHits++;
          return JSON.parse(data) as T;
        }
        this.stats.redisMisses++;
      } catch (error) {
        console.warn(`⚠️ Redis get failed for ${key}, falling back to memory`);
        this.stats.errors++;
      }
    }

    const cached = memoryCache.get(key);
    if (cached) {
      this.stats.memoryHits++;
      return cached as T;
    }

    this.stats.memoryMisses++;
    return null;
  }

  static async set(key: string, value: any, ttlOrOptions?: number | any): Promise<void> {
    let ttl = 3600; // segundos

    if (typeof ttlOrOptions === 'number') {
      ttl = ttlOrOptions;
    } else if (typeof ttlOrOptions === 'object' && ttlOrOptions.ttl) {
      ttl = ttlOrOptions.ttl;
    }

    // Memoria usa ms
    memoryCache.set(key, value, { ttl: ttl * 1000 });

    if (this.isRedisHealthy && this.redis) {
      try {
        await this.redis.setex(key, ttl, JSON.stringify(value));
      } catch (error) {
        console.error(`❌ Redis set failed for ${key}`);
        this.stats.errors++;
      }
    }
  }

  static async del(key: string): Promise<void> {
    memoryCache.delete(key);
    if (this.isRedisHealthy && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error(`❌ Redis delete failed for ${key}`);
      }
    }
  }

  static flushLocal(): void {
    memoryCache.clear();
    console.log('🧹 Local memory cache flushed');
  }

  static clear(): void {
    this.flushLocal();
  }

  static async healthCheck(): Promise<boolean> {
    if (!this.isRedisHealthy || !this.redis) return false;
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  static getStats() {
    const totalOps = this.stats.redisHits + this.stats.redisMisses + this.stats.memoryHits + this.stats.memoryMisses;
    return {
      healthy: this.isRedisHealthy,
      memoryItems: memoryCache.size,
      memoryBytes: 'Unknown (SimpleLRU)',
      metrics: {
        ...this.stats,
        totalOps
      },
      hits: this.stats.redisHits + this.stats.memoryHits,
      misses: this.stats.redisMisses + this.stats.memoryMisses,
      savedBytes: 0
    };
  }
}

CacheService.initialize();