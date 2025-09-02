import Redis from 'ioredis';
export declare const initRedis: () => Promise<Redis>;
export declare const getRedisClient: () => Redis;
export declare const closeRedis: () => Promise<void>;
export declare class CacheService {
    private redis;
    private defaultTTL;
    constructor(redis?: Redis);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttl?: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    mget<T>(keys: string[]): Promise<(T | null)[]>;
    mset(keyValuePairs: Record<string, any>, ttl?: number): Promise<boolean>;
    incr(key: string, ttl?: number): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    clearByPattern(pattern: string): Promise<number>;
    ttl(key: string): Promise<number>;
    expire(key: string, ttl: number): Promise<boolean>;
}
export declare class SessionService {
    private cache;
    private sessionTTL;
    constructor(redis?: Redis);
    createSession(sessionId: string, data: any, ttl?: number): Promise<boolean>;
    getSession<T>(sessionId: string): Promise<T | null>;
    updateSession(sessionId: string, data: any, ttl?: number): Promise<boolean>;
    deleteSession(sessionId: string): Promise<boolean>;
    renewSession(sessionId: string, ttl?: number): Promise<boolean>;
    getUserSessions(userId: string): Promise<string[]>;
    cleanExpiredSessions(): Promise<number>;
}
export declare class RateLimitService {
    private cache;
    constructor(redis?: Redis);
    checkRateLimit(identifier: string, maxRequests: number, windowMs: number): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    clearRateLimit(identifier: string): Promise<boolean>;
}
export declare const cacheService: CacheService;
export declare const sessionService: SessionService;
export declare const rateLimitService: RateLimitService;
export declare const generateCacheKey: (...parts: (string | number)[]) => string;
export declare const clearBarCache: (barId: string) => Promise<void>;
export declare const clearUserCache: (userId: string) => Promise<void>;
//# sourceMappingURL=redis.d.ts.map