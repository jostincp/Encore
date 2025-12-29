import { getRedisClient } from '@shared/utils/redis';
import logger from '@shared/utils/logger';

/**
 * Cache Optimization Service
 * Implements stratified caching strategy for maximum efficiency
 * Target: 70% cache hit rate
 */

interface CacheStats {
    hits: number;
    misses: number;
    totalRequests: number;
    hitRate: number;
}

interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
    tier: 'popular' | 'recent' | 'trending';
}

export class CacheOptimizationService {
    private redis = getRedisClient();
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        totalRequests: 0,
        hitRate: 0
    };

    // Cache TTL strategy (in seconds)
    private readonly CACHE_TIERS = {
        popular: 24 * 60 * 60,    // 24 hours for popular queries
        recent: 60 * 60,           // 1 hour for recent queries
        trending: 12 * 60 * 60     // 12 hours for trending queries
    };

    // Trending queries (pre-defined, will be updated from analytics)
    private trendingQueries = [
        'reggaeton 2025',
        'salsa romantica',
        'vallenato clasico',
        'bad bunny',
        'karol g',
        'maluma',
        'feid',
        'shakira',
        'j balvin',
        'daddy yankee'
    ];

    /**
     * Get from cache with automatic tier detection
     */
    async get(key: string): Promise<any | null> {
        try {
            this.stats.totalRequests++;

            const cacheKey = this.getCacheKey(key);
            const cached = await this.redis.get(cacheKey);

            if (cached) {
                this.stats.hits++;
                this.updateHitRate();

                logger.debug(`Cache HIT for key: ${key}`, {
                    hitRate: this.stats.hitRate.toFixed(2) + '%'
                });

                return JSON.parse(cached as string);
            }

            this.stats.misses++;
            this.updateHitRate();

            logger.debug(`Cache MISS for key: ${key}`, {
                hitRate: this.stats.hitRate.toFixed(2) + '%'
            });

            return null;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Set cache with intelligent TTL based on query type
     */
    async set(key: string, data: any, customTTL?: number): Promise<void> {
        try {
            const tier = this.determineTier(key);
            const ttl = customTTL || this.CACHE_TIERS[tier];
            const cacheKey = this.getCacheKey(key);

            const entry: CacheEntry = {
                data,
                timestamp: Date.now(),
                ttl,
                tier
            };

            await this.redis.setex(cacheKey, ttl, JSON.stringify(entry.data));

            logger.debug(`Cache SET for key: ${key}`, {
                tier,
                ttl: `${ttl}s`,
                expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
            });

            // Track popular queries
            await this.incrementQueryCount(key);
        } catch (error) {
            logger.error('Cache set error:', error);
        }
    }

    /**
     * Determine cache tier based on query characteristics
     */
    private determineTier(query: string): 'popular' | 'recent' | 'trending' {
        const normalizedQuery = query.toLowerCase().trim();

        // Check if it's a trending query
        if (this.trendingQueries.some(tq => normalizedQuery.includes(tq.toLowerCase()))) {
            return 'trending';
        }

        // Check if it's a popular query (will be determined by analytics)
        // For now, use simple heuristics
        if (this.isPopularQuery(normalizedQuery)) {
            return 'popular';
        }

        return 'recent';
    }

    /**
     * Check if query is popular based on historical data
     */
    private async isPopularQuery(query: string): Promise<boolean> {
        try {
            const countKey = `query:count:${query}`;
            const count = await this.redis.get(countKey);

            // Consider popular if queried more than 10 times
            return count ? parseInt(count as string) > 10 : false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Increment query count for popularity tracking
     */
    private async incrementQueryCount(query: string): Promise<void> {
        try {
            const countKey = `query:count:${query.toLowerCase().trim()}`;
            await this.redis.incr(countKey);
            // Expire count after 7 days
            await this.redis.expire(countKey, 7 * 24 * 60 * 60);
        } catch (error) {
            logger.error('Error incrementing query count:', error);
        }
    }

    /**
     * Get top queries from last N hours
     */
    async getTopQueries(hours: number = 24, limit: number = 20): Promise<string[]> {
        try {
            // Get all query count keys
            const keys = await this.redis.keys('query:count:*');

            if (keys.length === 0) {
                return [];
            }

            // Get counts for all keys
            const counts = await Promise.all(
                keys.map(async (key) => {
                    const count = await this.redis.get(key);
                    const query = key.replace('query:count:', '');
                    return {
                        query,
                        count: parseInt(count as string || '0')
                    };
                })
            );

            // Sort by count and return top queries
            return counts
                .sort((a, b) => b.count - a.count)
                .slice(0, limit)
                .map(item => item.query);
        } catch (error) {
            logger.error('Error getting top queries:', error);
            return [];
        }
    }

    /**
     * Clean stale cache entries older than specified seconds
     */
    async cleanStale(olderThanSeconds: number): Promise<number> {
        try {
            const pattern = 'youtube:search:*';
            const keys = await this.redis.keys(pattern);

            let deletedCount = 0;
            const cutoffTime = Date.now() - (olderThanSeconds * 1000);

            for (const key of keys) {
                const ttl = await this.redis.ttl(key);

                // If TTL is very low or negative, delete
                if (ttl < 60) {
                    await this.redis.del(key);
                    deletedCount++;
                }
            }

            logger.info(`Cleaned ${deletedCount} stale cache entries`);
            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning stale cache:', error);
            return 0;
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Reset cache statistics
     */
    resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            totalRequests: 0,
            hitRate: 0
        };
    }

    /**
     * Update hit rate calculation
     */
    private updateHitRate(): void {
        if (this.stats.totalRequests > 0) {
            this.stats.hitRate = (this.stats.hits / this.stats.totalRequests) * 100;
        }
    }

    /**
     * Generate cache key with prefix
     */
    private getCacheKey(key: string): string {
        return `youtube:search:${key.toLowerCase().trim()}`;
    }

    /**
     * Pre-cache trending queries (called by nightly job)
     */
    async preCacheTrendingQueries(queries: string[]): Promise<number> {
        let cachedCount = 0;

        for (const query of queries) {
            const existing = await this.get(query);
            if (!existing) {
                // This will be called by the nightly job with actual search results
                logger.info(`Pre-cache slot available for: ${query}`);
                cachedCount++;
            }
        }

        return cachedCount;
    }

    /**
     * Get cache health metrics
     */
    async getHealthMetrics(): Promise<{
        hitRate: number;
        totalKeys: number;
        memoryUsage: string;
        uptime: number;
    }> {
        try {
            const info = await this.redis.info('stats');
            const keys = await this.redis.keys('youtube:search:*');

            return {
                hitRate: this.stats.hitRate,
                totalKeys: keys.length,
                memoryUsage: 'N/A', // Would need Redis INFO memory
                uptime: 0 // Would need Redis INFO server
            };
        } catch (error) {
            logger.error('Error getting cache health metrics:', error);
            return {
                hitRate: this.stats.hitRate,
                totalKeys: 0,
                memoryUsage: 'N/A',
                uptime: 0
            };
        }
    }
}

// Export singleton instance
export const cacheOptimizationService = new CacheOptimizationService();
