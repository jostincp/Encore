import cron from 'node-cron';
import { enhancedYouTubeService } from '../services/enhancedYouTubeService';
import { cacheOptimizationService } from '../services/cacheOptimizationService';
import logger from '@shared/utils/logger';

/**
 * Nightly Pre-Caching Job
 * Runs at 3 AM to cache popular queries before peak hours
 * Target: 360 searches served/day without touching API
 * Cost: 15 API searches/night = 15% of daily quota
 * ROI: 24x (360 served / 15 consumed)
 */

export class NightlyPreCacheJob {
    private isRunning = false;
    private lastRunTime: Date | null = null;
    private lastRunStats = {
        cached: 0,
        skipped: 0,
        failed: 0,
        duration: 0
    };

    /**
     * Start the cron job (runs at 3 AM daily)
     */
    start(): void {
        // Schedule: 0 3 * * * = Every day at 3:00 AM
        cron.schedule('0 3 * * *', async () => {
            await this.run();
        });

        logger.info('📅 Nightly pre-cache job scheduled for 3:00 AM daily');
    }

    /**
     * Run the pre-caching job manually (for testing)
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Pre-cache job already running, skipping...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('🌙 Starting nightly pre-cache job...');

            // Reset stats
            this.lastRunStats = {
                cached: 0,
                skipped: 0,
                failed: 0,
                duration: 0
            };

            // Step 1: Get popular queries from last 24 hours
            const popularQueries = await cacheOptimizationService.getTopQueries(24, 20);
            logger.info(`Found ${popularQueries.length} popular queries from last 24h`);

            // Step 2: Get predefined trending queries
            const trendingQueries = this.getTrendingQueries();
            logger.info(`Using ${trendingQueries.length} predefined trending queries`);

            // Step 3: Combine and deduplicate
            const allQueries = [...new Set([...popularQueries, ...trendingQueries])];
            logger.info(`Total unique queries to process: ${allQueries.length}`);

            // Step 4: Cache max 15 queries (protection against quota exhaustion)
            const queriesToCache = allQueries.slice(0, 15);
            logger.info(`Will cache ${queriesToCache.length} queries (max 15 for quota protection)`);

            // Step 5: Process each query
            for (const query of queriesToCache) {
                await this.cacheQuery(query);

                // Wait 3 seconds between searches to avoid rate limiting
                await this.sleep(3000);
            }

            // Step 6: Clean stale cache (older than 48 hours)
            const deletedCount = await cacheOptimizationService.cleanStale(48 * 60 * 60);
            logger.info(`Cleaned ${deletedCount} stale cache entries (>48h old)`);

            // Calculate duration
            this.lastRunStats.duration = Date.now() - startTime;
            this.lastRunTime = new Date();

            // Log summary
            logger.info('✅ Nightly pre-cache job completed', {
                cached: this.lastRunStats.cached,
                skipped: this.lastRunStats.skipped,
                failed: this.lastRunStats.failed,
                duration: `${(this.lastRunStats.duration / 1000).toFixed(2)}s`,
                estimatedSearchesServed: this.lastRunStats.cached * 24, // 24h TTL
                roi: `${((this.lastRunStats.cached * 24) / this.lastRunStats.cached).toFixed(1)}x`
            });

        } catch (error) {
            logger.error('❌ Nightly pre-cache job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Cache a single query
     */
    private async cacheQuery(query: string): Promise<void> {
        try {
            // Check if already in cache
            const existing = await cacheOptimizationService.get(query);

            if (existing) {
                this.lastRunStats.skipped++;
                logger.debug(`Skipped (already cached): ${query}`);
                return;
            }

            // Search and cache
            logger.debug(`Caching query: ${query}`);
            const results = await enhancedYouTubeService.searchVideos(query, {
                maxResults: 20,
                order: 'relevance'
            });

            // Cache with 24h TTL (popular tier)
            await cacheOptimizationService.set(query, results, 24 * 60 * 60);

            this.lastRunStats.cached++;
            logger.info(`✓ Cached: ${query} (${results.length} results)`);

        } catch (error) {
            this.lastRunStats.failed++;
            logger.error(`✗ Failed to cache: ${query}`, error);
        }
    }

    /**
     * Get predefined trending queries
     * These are manually curated based on popular genres and artists
     */
    private getTrendingQueries(): string[] {
        return [
            // Genres
            'reggaeton 2025',
            'salsa romantica',
            'vallenato clasico',
            'bachata',
            'cumbia',
            'merengue',

            // Popular artists (Latin America)
            'bad bunny',
            'karol g',
            'maluma',
            'feid',
            'shakira',
            'j balvin',
            'daddy yankee',
            'ozuna',
            'anuel aa',
            'rauw alejandro',

            // Classic hits
            'musica para bailar',
            'musica romantica',
            'exitos del momento'
        ];
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get job status
     */
    getStatus(): {
        isRunning: boolean;
        lastRunTime: Date | null;
        lastRunStats: typeof this.lastRunStats;
    } {
        return {
            isRunning: this.isRunning,
            lastRunTime: this.lastRunTime,
            lastRunStats: { ...this.lastRunStats }
        };
    }
}

// Export singleton instance
export const nightlyPreCacheJob = new NightlyPreCacheJob();

// Auto-start if in production
if (process.env.NODE_ENV === 'production') {
    nightlyPreCacheJob.start();
    logger.info('🚀 Nightly pre-cache job started in production mode');
}
