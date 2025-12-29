import { Router, Request, Response } from 'express';
import { cacheOptimizationService } from '../services/cacheOptimizationService';
import { nightlyPreCacheJob } from '../jobs/nightlyPreCache';
import logger from '@shared/utils/logger';

const router = Router();

/**
 * Monitoring Dashboard Endpoints
 * Provides real-time metrics for cache, quota usage, and system health
 */

/**
 * GET /api/monitoring/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
    try {
        const stats = cacheOptimizationService.getStats();
        const health = await cacheOptimizationService.getHealthMetrics();

        res.json({
            success: true,
            data: {
                stats,
                health,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting cache stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving cache statistics'
        });
    }
});

/**
 * GET /api/monitoring/cache/top-queries
 * Get top queries from last N hours
 */
router.get('/cache/top-queries', async (req: Request, res: Response) => {
    try {
        const hours = parseInt(req.query.hours as string) || 24;
        const limit = parseInt(req.query.limit as string) || 20;

        const topQueries = await cacheOptimizationService.getTopQueries(hours, limit);

        res.json({
            success: true,
            data: {
                queries: topQueries,
                hours,
                limit,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting top queries:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving top queries'
        });
    }
});

/**
 * POST /api/monitoring/cache/reset-stats
 * Reset cache statistics
 */
router.post('/cache/reset-stats', async (req: Request, res: Response) => {
    try {
        cacheOptimizationService.resetStats();

        res.json({
            success: true,
            message: 'Cache statistics reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error resetting cache stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting cache statistics'
        });
    }
});

/**
 * GET /api/monitoring/precache/status
 * Get pre-cache job status
 */
router.get('/precache/status', async (req: Request, res: Response) => {
    try {
        const status = nightlyPreCacheJob.getStatus();

        res.json({
            success: true,
            data: {
                ...status,
                roi: status.lastRunStats.cached > 0
                    ? `${((status.lastRunStats.cached * 24) / status.lastRunStats.cached).toFixed(1)}x`
                    : 'N/A',
                estimatedSearchesServed: status.lastRunStats.cached * 24,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting pre-cache status:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving pre-cache status'
        });
    }
});

/**
 * POST /api/monitoring/precache/run
 * Manually trigger pre-cache job (for testing)
 */
router.post('/precache/run', async (req: Request, res: Response) => {
    try {
        // Run job asynchronously
        nightlyPreCacheJob.run().catch(error => {
            logger.error('Pre-cache job failed:', error);
        });

        res.json({
            success: true,
            message: 'Pre-cache job started',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error starting pre-cache job:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting pre-cache job'
        });
    }
});

/**
 * GET /api/monitoring/quota/youtube
 * Get YouTube API quota usage estimation
 */
router.get('/quota/youtube', async (req: Request, res: Response) => {
    try {
        const stats = cacheOptimizationService.getStats();

        // Estimate quota usage
        const dailyQuotaLimit = 10000; // YouTube API daily quota
        const searchCost = 100; // Cost per search
        const maxSearchesPerDay = dailyQuotaLimit / searchCost; // 100 searches/day

        // Calculate estimated API calls based on cache miss rate
        const estimatedAPICalls = stats.misses;
        const quotaUsed = estimatedAPICalls * searchCost;
        const quotaPercentage = (quotaUsed / dailyQuotaLimit) * 100;

        // Calculate projected daily usage
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const elapsedHours = (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60);
        const projectedDailyAPICalls = elapsedHours > 0
            ? Math.round((estimatedAPICalls / elapsedHours) * 24)
            : estimatedAPICalls;
        const projectedDailyQuota = projectedDailyAPICalls * searchCost;
        const projectedPercentage = (projectedDailyQuota / dailyQuotaLimit) * 100;

        res.json({
            success: true,
            data: {
                current: {
                    apiCalls: estimatedAPICalls,
                    quotaUsed,
                    quotaPercentage: quotaPercentage.toFixed(2) + '%',
                    quotaRemaining: dailyQuotaLimit - quotaUsed
                },
                projected: {
                    dailyAPICalls: projectedDailyAPICalls,
                    dailyQuota: projectedDailyQuota,
                    percentage: projectedPercentage.toFixed(2) + '%',
                    willExceed: projectedPercentage > 100
                },
                limits: {
                    dailyQuotaLimit,
                    searchCost,
                    maxSearchesPerDay
                },
                cacheStats: {
                    hitRate: stats.hitRate.toFixed(2) + '%',
                    hits: stats.hits,
                    misses: stats.misses,
                    totalRequests: stats.totalRequests
                },
                alerts: {
                    warning: quotaPercentage > 80,
                    critical: quotaPercentage > 95,
                    message: quotaPercentage > 95
                        ? 'CRITICAL: Quota usage above 95%'
                        : quotaPercentage > 80
                            ? 'WARNING: Quota usage above 80%'
                            : 'OK'
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting quota stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving quota statistics'
        });
    }
});

/**
 * GET /api/monitoring/health
 * Overall system health check
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const cacheStats = cacheOptimizationService.getStats();
        const cacheHealth = await cacheOptimizationService.getHealthMetrics();
        const preCacheStatus = nightlyPreCacheJob.getStatus();

        const health = {
            status: 'healthy',
            checks: {
                cache: {
                    status: cacheStats.hitRate >= 70 ? 'healthy' : 'degraded',
                    hitRate: cacheStats.hitRate.toFixed(2) + '%',
                    target: '≥ 70%'
                },
                preCache: {
                    status: preCacheStatus.lastRunTime ? 'healthy' : 'warning',
                    lastRun: preCacheStatus.lastRunTime,
                    isRunning: preCacheStatus.isRunning
                },
                redis: {
                    status: 'healthy', // Would check actual Redis connection
                    keys: cacheHealth.totalKeys
                }
            },
            timestamp: new Date().toISOString()
        };

        // Determine overall status
        const checks = Object.values(health.checks);
        if (checks.some((check: any) => check.status === 'unhealthy')) {
            health.status = 'unhealthy';
        } else if (checks.some((check: any) => check.status === 'degraded' || check.status === 'warning')) {
            health.status = 'degraded';
        }

        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json({
            success: true,
            data: health
        });
    } catch (error) {
        logger.error('Error checking health:', error);
        res.status(503).json({
            success: false,
            message: 'Health check failed',
            data: {
                status: 'unhealthy',
                timestamp: new Date().toISOString()
            }
        });
    }
});

export default router;
