"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearUserCache = exports.clearBarCache = exports.generateCacheKey = exports.rateLimitService = exports.sessionService = exports.cacheService = exports.RateLimitService = exports.SessionService = exports.CacheService = exports.closeRedis = exports.getRedisClient = exports.initRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const logger_1 = require("./logger");
let redisClient = null;
const REDIS_CONFIG = {
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000
};
const initRedis = async () => {
    if (redisClient) {
        return redisClient;
    }
    try {
        redisClient = new ioredis_1.default(config_1.config.redisUrl, REDIS_CONFIG);
        redisClient.on('connect', () => {
            (0, logger_1.logInfo)('Redis connected successfully');
        });
        redisClient.on('error', (error) => {
            (0, logger_1.logError)('Redis connection error', error);
        });
        redisClient.on('close', () => {
            (0, logger_1.logWarn)('Redis connection closed');
        });
        redisClient.on('reconnecting', () => {
            (0, logger_1.logInfo)('Redis reconnecting...');
        });
        await redisClient.ping();
        (0, logger_1.logInfo)('Redis client initialized successfully');
        return redisClient;
    }
    catch (error) {
        (0, logger_1.logError)('Failed to initialize Redis client', error);
        throw error;
    }
};
exports.initRedis = initRedis;
const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call initRedis() first.');
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const closeRedis = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        (0, logger_1.logInfo)('Redis connection closed');
    }
};
exports.closeRedis = closeRedis;
class CacheService {
    constructor(redis) {
        this.defaultTTL = 3600;
        this.redis = redis || (0, exports.getRedisClient)();
    }
    async get(key) {
        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {
            (0, logger_1.logError)(`Cache get error for key: ${key}`, error);
            return null;
        }
    }
    async set(key, value, ttl) {
        try {
            const serializedValue = JSON.stringify(value);
            const expiration = ttl || this.defaultTTL;
            await this.redis.setex(key, expiration, serializedValue);
            return true;
        }
        catch (error) {
            (0, logger_1.logError)(`Cache set error for key: ${key}`, error);
            return false;
        }
    }
    async del(key) {
        try {
            const result = await this.redis.del(key);
            return result > 0;
        }
        catch (error) {
            (0, logger_1.logError)(`Cache delete error for key: ${key}`, error);
            return false;
        }
    }
    async exists(key) {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        }
        catch (error) {
            (0, logger_1.logError)(`Cache exists error for key: ${key}`, error);
            return false;
        }
    }
    async mget(keys) {
        try {
            const values = await this.redis.mget(...keys);
            return values.map(value => value ? JSON.parse(value) : null);
        }
        catch (error) {
            (0, logger_1.logError)(`Cache mget error for keys: ${keys.join(', ')}`, error);
            return keys.map(() => null);
        }
    }
    async mset(keyValuePairs, ttl) {
        try {
            const pipeline = this.redis.pipeline();
            const expiration = ttl || this.defaultTTL;
            for (const [key, value] of Object.entries(keyValuePairs)) {
                const serializedValue = JSON.stringify(value);
                pipeline.setex(key, expiration, serializedValue);
            }
            await pipeline.exec();
            return true;
        }
        catch (error) {
            (0, logger_1.logError)('Cache mset error', error);
            return false;
        }
    }
    async incr(key, ttl) {
        try {
            const result = await this.redis.incr(key);
            if (ttl && result === 1) {
                await this.redis.expire(key, ttl);
            }
            return result;
        }
        catch (error) {
            (0, logger_1.logError)(`Cache incr error for key: ${key}`, error);
            return 0;
        }
    }
    async keys(pattern) {
        try {
            return await this.redis.keys(pattern);
        }
        catch (error) {
            (0, logger_1.logError)(`Cache keys error for pattern: ${pattern}`, error);
            return [];
        }
    }
    async clearByPattern(pattern) {
        try {
            const keys = await this.keys(pattern);
            if (keys.length === 0)
                return 0;
            return await this.redis.del(...keys);
        }
        catch (error) {
            (0, logger_1.logError)(`Cache clear by pattern error: ${pattern}`, error);
            return 0;
        }
    }
    async ttl(key) {
        try {
            return await this.redis.ttl(key);
        }
        catch (error) {
            (0, logger_1.logError)(`Cache TTL error for key: ${key}`, error);
            return -1;
        }
    }
    async expire(key, ttl) {
        try {
            const result = await this.redis.expire(key, ttl);
            return result === 1;
        }
        catch (error) {
            (0, logger_1.logError)(`Cache expire error for key: ${key}`, error);
            return false;
        }
    }
}
exports.CacheService = CacheService;
class SessionService {
    constructor(redis) {
        this.sessionTTL = 86400;
        this.cache = new CacheService(redis);
    }
    async createSession(sessionId, data, ttl) {
        const key = `session:${sessionId}`;
        return await this.cache.set(key, data, ttl || this.sessionTTL);
    }
    async getSession(sessionId) {
        const key = `session:${sessionId}`;
        return await this.cache.get(key);
    }
    async updateSession(sessionId, data, ttl) {
        const key = `session:${sessionId}`;
        return await this.cache.set(key, data, ttl || this.sessionTTL);
    }
    async deleteSession(sessionId) {
        const key = `session:${sessionId}`;
        return await this.cache.del(key);
    }
    async renewSession(sessionId, ttl) {
        const key = `session:${sessionId}`;
        return await this.cache.expire(key, ttl || this.sessionTTL);
    }
    async getUserSessions(userId) {
        const pattern = `session:*`;
        const keys = await this.cache.keys(pattern);
        const sessions = [];
        for (const key of keys) {
            const sessionData = await this.cache.get(key);
            if (sessionData && sessionData.userId === userId) {
                sessions.push(key.replace('session:', ''));
            }
        }
        return sessions;
    }
    async cleanExpiredSessions() {
        const pattern = `session:*`;
        const keys = await this.cache.keys(pattern);
        let cleaned = 0;
        for (const key of keys) {
            const ttl = await this.cache.ttl(key);
            if (ttl === -2) {
                await this.cache.del(key);
                cleaned++;
            }
        }
        return cleaned;
    }
}
exports.SessionService = SessionService;
class RateLimitService {
    constructor(redis) {
        this.cache = new CacheService(redis);
    }
    async checkRateLimit(identifier, maxRequests, windowMs) {
        const key = `rate_limit:${identifier}`;
        const windowSeconds = Math.floor(windowMs / 1000);
        try {
            const current = await this.cache.incr(key, windowSeconds);
            const ttl = await this.cache.ttl(key);
            const allowed = current <= maxRequests;
            const remaining = Math.max(0, maxRequests - current);
            const resetTime = Date.now() + (ttl * 1000);
            return { allowed, remaining, resetTime };
        }
        catch (error) {
            (0, logger_1.logError)(`Rate limit check error for: ${identifier}`, error);
            return { allowed: true, remaining: maxRequests - 1, resetTime: Date.now() + windowMs };
        }
    }
    async clearRateLimit(identifier) {
        const key = `rate_limit:${identifier}`;
        return await this.cache.del(key);
    }
}
exports.RateLimitService = RateLimitService;
exports.cacheService = new CacheService();
exports.sessionService = new SessionService();
exports.rateLimitService = new RateLimitService();
const generateCacheKey = (...parts) => {
    return parts.join(':');
};
exports.generateCacheKey = generateCacheKey;
const clearBarCache = async (barId) => {
    const patterns = [
        `bar:${barId}:*`,
        `menu:${barId}:*`,
        `queue:${barId}:*`,
        `analytics:${barId}:*`
    ];
    for (const pattern of patterns) {
        await exports.cacheService.clearByPattern(pattern);
    }
};
exports.clearBarCache = clearBarCache;
const clearUserCache = async (userId) => {
    const patterns = [
        `user:${userId}:*`,
        `points:${userId}:*`
    ];
    for (const pattern of patterns) {
        await exports.cacheService.clearByPattern(pattern);
    }
};
exports.clearUserCache = clearUserCache;
//# sourceMappingURL=redis.js.map