import Redis from 'ioredis';
import { config } from '../config';
import { logInfo, logError, logWarn } from './logger';

// Cliente Redis singleton
let redisClient: Redis | null = null;

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
export const initRedis = async (): Promise<Redis> => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis(config.redisUrl, REDIS_CONFIG);

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
    logError('Failed to initialize Redis client', error as Error);
    throw error;
  }
};

// Obtener cliente Redis
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
};

// Cerrar conexión Redis
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logInfo('Redis connection closed');
  }
};

// Utilidades de caché
export class CacheService {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 hora por defecto

  constructor(redis?: Redis) {
    this.redis = redis || getRedisClient();
  }

  // Obtener valor del caché
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logError(`Cache get error for key: ${key}`, error as Error);
      return null;
    }
  }

  // Establecer valor en caché
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      const expiration = ttl || this.defaultTTL;
      
      await this.redis.setex(key, expiration, serializedValue);
      return true;
    } catch (error) {
      logError(`Cache set error for key: ${key}`, error as Error);
      return false;
    }
  }

  // Eliminar valor del caché
  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logError(`Cache delete error for key: ${key}`, error as Error);
      return false;
    }
  }

  // Verificar si existe una clave
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logError(`Cache exists error for key: ${key}`, error as Error);
      return false;
    }
  }

  // Obtener múltiples valores
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logError(`Cache mget error for keys: ${keys.join(', ')}`, error as Error);
      return keys.map(() => null);
    }
  }

  // Establecer múltiples valores
  async mset(keyValuePairs: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      const expiration = ttl || this.defaultTTL;

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        pipeline.setex(key, expiration, serializedValue);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logError('Cache mset error', error as Error);
      return false;
    }
  }

  // Incrementar contador
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const result = await this.redis.incr(key);
      
      if (ttl && result === 1) {
        await this.redis.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      logError(`Cache incr error for key: ${key}`, error as Error);
      return 0;
    }
  }

  // Obtener claves por patrón
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      logError(`Cache keys error for pattern: ${pattern}`, error as Error);
      return [];
    }
  }

  // Limpiar caché por patrón
  async clearByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.redis.del(...keys);
    } catch (error) {
      logError(`Cache clear by pattern error: ${pattern}`, error as Error);
      return 0;
    }
  }

  // Obtener TTL de una clave
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logError(`Cache TTL error for key: ${key}`, error as Error);
      return -1;
    }
  }

  // Renovar TTL de una clave
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
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

// Instancias globales
export const cacheService = new CacheService();
export const sessionService = new SessionService();
export const rateLimitService = new RateLimitService();

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

  for (const pattern of patterns) {
    await cacheService.clearByPattern(pattern);
  }
};

// Función para limpiar caché relacionado con un usuario
export const clearUserCache = async (userId: string): Promise<void> => {
  const patterns = [
    `user:${userId}:*`,
    `points:${userId}:*`
  ];

  for (const pattern of patterns) {
    await cacheService.clearByPattern(pattern);
  }
};