import Redis from 'ioredis';
import { config } from '../config';
import { logInfo, logError, logWarn } from './logger';
import { memoryCache, MemoryCache } from './memory-cache';

// Cliente Redis singleton
let redisClient: Redis | null = null;
let usingMemoryCache = false;

// Configuración de Redis
const REDIS_CONFIG = {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000
};

// Inicializar cliente Redis
export const initRedis = async (): Promise<Redis | MemoryCache> => {
  if (redisClient) {
    return redisClient;
  }

  if (usingMemoryCache) {
    return memoryCache;
  }

  try {
    // Si no hay URL de Redis configurada, usar caché en memoria directamente
    if (!config.redis?.url) {
      usingMemoryCache = true;
      logWarn('REDIS_URL not set, using in-memory cache');
      return memoryCache;
    }

    redisClient = new Redis(config.redis.url, REDIS_CONFIG);

    redisClient.on('connect', () => {
      logInfo('Redis connected successfully');
    });

    redisClient.on('error', (error) => {
      logError('Redis connection error', error);
    });

    redisClient.on('close', () => {
      logWarn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logInfo('Redis reconnecting...');
    });

    // Verificar conexión
    await redisClient.ping();
    logInfo('Redis client initialized successfully');

    return redisClient;
  } catch (error) {
    logError('Failed to initialize Redis client, falling back to memory cache', error as Error);
    usingMemoryCache = true;
    logWarn('Using in-memory cache as Redis fallback');
    return memoryCache;
  }
};

// Obtener cliente Redis
export const getRedisClient = (): Redis | MemoryCache => {
  if (usingMemoryCache) {
    return memoryCache;
  }
  if (!redisClient) {
    // Fallback gracefully to memory cache if Redis not initialized yet
    usingMemoryCache = true;
    logWarn('Redis client not initialized; using in-memory cache temporarily');
    return memoryCache;
  }
  return redisClient;
};

// Cerrar conexión Redis
export const closeRedis = async (): Promise<void> => {
  if (usingMemoryCache) {
    await memoryCache.quit();
    usingMemoryCache = false;
    logInfo('Memory cache cleared');
  } else if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logInfo('Redis connection closed');
  }
};

// Utilidades de caché
export class CacheService {
  private client: Redis | MemoryCache;
  private defaultTTL: number = 3600; // 1 hora por defecto

  constructor(client?: Redis | MemoryCache) {
    this.client = client || getRedisClient();
  }

  // Obtener valor del caché
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return typeof value === 'string' ? JSON.parse(value) as T : value as T;
    } catch (error) {
      logError(`Cache get error for key: ${key}`, error as Error);
      return null;
    }
  }

  // Establecer valor en caché
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const expiration = ttl || this.defaultTTL;
      
      if ('setex' in this.client) {
        // Redis client
        const serializedValue = JSON.stringify(value);
        await (this.client as Redis).setex(key, expiration, serializedValue);
      } else {
        // Memory cache
        await (this.client as MemoryCache).set(key, value, expiration);
      }
      return true;
    } catch (error) {
      logError(`Cache set error for key: ${key}`, error as Error);
      return false;
    }
  }

  // Eliminar valor del caché
  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return typeof result === 'number' ? result > 0 : result;
    } catch (error) {
      logError(`Cache delete error for key: ${key}`, error as Error);
      return false;
    }
  }

  // Verificar si existe una clave
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return typeof result === 'number' ? result === 1 : result;
    } catch (error) {
      logError(`Cache exists error for key: ${key}`, error as Error);
      return false;
    }
  }

  // Obtener múltiples valores
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(keys);
      return values.map(value => {
        if (!value) return null;
        return typeof value === 'string' ? JSON.parse(value) : value;
      });
    } catch (error) {
      logError(`Cache mget error for keys: ${keys.join(', ')}`, error as Error);
      return keys.map(() => null);
    }
  }

  // Establecer múltiples valores
  async mset(keyValuePairs: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      const expiration = ttl || this.defaultTTL;

      if ('pipeline' in this.client) {
        // Redis client
        const pipeline = this.client.pipeline();
        for (const [key, value] of Object.entries(keyValuePairs)) {
          const serializedValue = JSON.stringify(value);
          pipeline.setex(key, expiration, serializedValue);
        }
        await pipeline.exec();
      } else {
        // Memory cache
        await this.client.mset(keyValuePairs, expiration);
      }
      return true;
    } catch (error) {
      logError('Cache mset error', error as Error);
      return false;
    }
  }

  // Incrementar contador
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      if ('incr' in this.client && typeof this.client.incr === 'function') {
        // Redis client
        const result = await (this.client as Redis).incr(key);
        if (ttl && result === 1) {
          await (this.client as Redis).expire(key, ttl);
        }
        return result;
      } else {
        // Memory cache
        return await (this.client as MemoryCache).incr(key, ttl);
      }
    } catch (error) {
      logError(`Cache incr error for key: ${key}`, error as Error);
      return 0;
    }
  }

  // Obtener claves por patrón
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logError(`Cache keys error for pattern: ${pattern}`, error as Error);
      return [];
    }
  }

  // Limpiar caché por patrón
  async clearByPattern(pattern: string): Promise<number> {
    try {
      if ('del' in this.client && !('clearByPattern' in this.client)) {
        // Redis client
        const keys = await this.keys(pattern);
        if (keys.length === 0) return 0;
        return await (this.client as Redis).del(...keys);
      } else {
        // Memory cache
        return await (this.client as MemoryCache).clearByPattern(pattern);
      }
    } catch (error) {
      logError(`Cache clear by pattern error: ${pattern}`, error as Error);
      return 0;
    }
  }

  // Obtener TTL de una clave
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logError(`Cache TTL error for key: ${key}`, error as Error);
      return -1;
    }
  }

  // Renovar TTL de una clave
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if ('expire' in this.client) {
        const result = await (this.client as Redis).expire(key, ttl);
        return result === 1;
      } else {
        // Memory cache
        return (await (this.client as MemoryCache).expire(key, ttl)) === 1;
      }
    } catch (error) {
      logError(`Cache expire error for key: ${key}`, error as Error);
      return false;
    }
  }
}

// Utilidades para sesiones
export class SessionService {
  private cache: CacheService;
  private sessionTTL: number = 86400; // 24 horas

  constructor(redis?: Redis) {
    this.cache = new CacheService(redis);
  }

  // Crear sesión
  async createSession(sessionId: string, data: any, ttl?: number): Promise<boolean> {
    const key = `session:${sessionId}`;
    return await this.cache.set(key, data, ttl || this.sessionTTL);
  }

  // Obtener sesión
  async getSession<T>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return await this.cache.get<T>(key);
  }

  // Actualizar sesión
  async updateSession(sessionId: string, data: any, ttl?: number): Promise<boolean> {
    const key = `session:${sessionId}`;
    return await this.cache.set(key, data, ttl || this.sessionTTL);
  }

  // Eliminar sesión
  async deleteSession(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`;
    return await this.cache.del(key);
  }

  // Renovar sesión
  async renewSession(sessionId: string, ttl?: number): Promise<boolean> {
    const key = `session:${sessionId}`;
    return await this.cache.expire(key, ttl || this.sessionTTL);
  }

  // Obtener todas las sesiones de un usuario
  async getUserSessions(userId: string): Promise<string[]> {
    const pattern = `session:*`;
    const keys = await this.cache.keys(pattern);
    const sessions: string[] = [];

    for (const key of keys) {
      const sessionData = await this.cache.get<any>(key);
      if (sessionData && sessionData.userId === userId) {
        sessions.push(key.replace('session:', ''));
      }
    }

    return sessions;
  }

  // Limpiar sesiones expiradas
  async cleanExpiredSessions(): Promise<number> {
    const pattern = `session:*`;
    const keys = await this.cache.keys(pattern);
    let cleaned = 0;

    for (const key of keys) {
      const ttl = await this.cache.ttl(key);
      if (ttl === -2) { // Clave expirada
        await this.cache.del(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Utilidades para rate limiting
export class RateLimitService {
  private cache: CacheService;

  constructor(redis?: Redis) {
    this.cache = new CacheService(redis);
  }

  // Verificar y actualizar rate limit
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const windowSeconds = Math.floor(windowMs / 1000);
    
    try {
      const current = await this.cache.incr(key, windowSeconds);
      const ttl = await this.cache.ttl(key);
      
      const allowed = current <= maxRequests;
      const remaining = Math.max(0, maxRequests - current);
      const resetTime = Date.now() + (ttl * 1000);
      
      return { allowed, remaining, resetTime };
    } catch (error) {
      logError(`Rate limit check error for: ${identifier}`, error as Error);
      // En caso de error, permitir la solicitud
      return { allowed: true, remaining: maxRequests - 1, resetTime: Date.now() + windowMs };
    }
  }

  // Limpiar rate limit para un identificador
  async clearRateLimit(identifier: string): Promise<boolean> {
    const key = `rate_limit:${identifier}`;
    return await this.cache.del(key);
  }
}

// Instancias globales (se inicializan después de Redis)
let cacheService: CacheService | null = null;
let sessionService: SessionService | null = null;
let rateLimitService: RateLimitService | null = null;

// Función para obtener instancias de servicios
export const getCacheService = (): CacheService => {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
};

export const getSessionService = (): SessionService => {
  if (!sessionService) {
    sessionService = new SessionService();
  }
  return sessionService;
};

export const getRateLimitService = (): RateLimitService => {
  if (!rateLimitService) {
    rateLimitService = new RateLimitService();
  }
  return rateLimitService;
};

// Función de utilidad para generar claves de caché
export const generateCacheKey = (...parts: (string | number)[]): string => {
  return parts.join(':');
};

// Función para limpiar caché relacionado con un bar
export const clearBarCache = async (barId: string): Promise<void> => {
  const patterns = [
    `bar:${barId}:*`,
    `menu:${barId}:*`,
    `queue:${barId}:*`,
    `analytics:${barId}:*`
  ];

  const cache = getCacheService();
  for (const pattern of patterns) {
    await cache.clearByPattern(pattern);
  }
};

// Función para limpiar caché relacionado con un usuario
export const clearUserCache = async (userId: string): Promise<void> => {
  const patterns = [
    `user:${userId}:*`,
    `points:${userId}:*`
  ];

  const cache = getCacheService();
  for (const pattern of patterns) {
    await cache.clearByPattern(pattern);
  }
};