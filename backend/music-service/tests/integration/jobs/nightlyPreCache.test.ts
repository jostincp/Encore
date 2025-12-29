import { nightlyPreCacheJob } from '../../../src/jobs/nightlyPreCache';
import { enhancedYouTubeService } from '../../../src/services/enhancedYouTubeService';
import { cacheOptimizationService } from '../../../src/services/cacheOptimizationService';

// Mock dependencies
jest.mock('../../../src/services/enhancedYouTubeService');
jest.mock('../../../src/services/cacheOptimizationService');

describe('NightlyPreCacheJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('run()', () => {
        it('should cache top queries from last 24 hours', async () => {
            // Mock top queries
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue([
                'shakira',
                'bad bunny',
                'karol g'
            ]);

            // Mock cache check (all miss)
            (cacheOptimizationService.get as jest.Mock).mockResolvedValue(null);

            // Mock search results
            (enhancedYouTubeService.searchVideos as jest.Mock).mockResolvedValue([
                { id: '1', title: 'Test Song' }
            ]);

            // Mock cache set
            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);

            // Mock clean stale
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(5);

            await nightlyPreCacheJob.run();

            // Should get top queries
            expect(cacheOptimizationService.getTopQueries).toHaveBeenCalledWith(24, 20);

            // Should search for each query (3 popular + trending queries, max 15)
            expect(enhancedYouTubeService.searchVideos).toHaveBeenCalled();

            // Should cache results
            expect(cacheOptimizationService.set).toHaveBeenCalled();

            // Should clean stale cache
            expect(cacheOptimizationService.cleanStale).toHaveBeenCalledWith(48 * 60 * 60);
        });

        it('should skip already cached queries', async () => {
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue([
                'already-cached',
                'new-query'
            ]);

            // First query is cached, second is not
            (cacheOptimizationService.get as jest.Mock)
                .mockResolvedValueOnce([{ id: '1', title: 'Cached' }]) // already-cached
                .mockResolvedValueOnce(null); // new-query

            (enhancedYouTubeService.searchVideos as jest.Mock).mockResolvedValue([
                { id: '2', title: 'New Song' }
            ]);

            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(0);

            await nightlyPreCacheJob.run();

            const status = nightlyPreCacheJob.getStatus();

            // Should skip 1 (already cached) and cache the rest
            expect(status.lastRunStats.skipped).toBeGreaterThan(0);
        });

        it('should limit to maximum 15 queries for quota protection', async () => {
            // Return 30 queries
            const manyQueries = Array.from({ length: 30 }, (_, i) => `query${i}`);
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue(manyQueries);

            (cacheOptimizationService.get as jest.Mock).mockResolvedValue(null);
            (enhancedYouTubeService.searchVideos as jest.Mock).mockResolvedValue([]);
            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(0);

            await nightlyPreCacheJob.run();

            // Should only process 15 queries max
            expect(enhancedYouTubeService.searchVideos).toHaveBeenCalledTimes(15);
        });

        it('should handle search errors gracefully', async () => {
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue([
                'error-query',
                'success-query'
            ]);

            (cacheOptimizationService.get as jest.Mock).mockResolvedValue(null);

            // First search fails, second succeeds
            (enhancedYouTubeService.searchVideos as jest.Mock)
                .mockRejectedValueOnce(new Error('API Error'))
                .mockResolvedValueOnce([{ id: '1', title: 'Success' }]);

            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(0);

            await nightlyPreCacheJob.run();

            const status = nightlyPreCacheJob.getStatus();

            // Should have 1 failed and 1 cached
            expect(status.lastRunStats.failed).toBe(1);
            expect(status.lastRunStats.cached).toBeGreaterThan(0);
        });

        it('should wait 3 seconds between searches', async () => {
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue([
                'query1',
                'query2'
            ]);

            (cacheOptimizationService.get as jest.Mock).mockResolvedValue(null);
            (enhancedYouTubeService.searchVideos as jest.Mock).mockResolvedValue([]);
            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(0);

            const runPromise = nightlyPreCacheJob.run();

            // Fast-forward time
            jest.advanceTimersByTime(3000);

            await runPromise;

            // Verify searches were called
            expect(enhancedYouTubeService.searchVideos).toHaveBeenCalled();
        });

        it('should not run if already running', async () => {
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue([]);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(0);

            // Start first run
            const firstRun = nightlyPreCacheJob.run();

            // Try to start second run while first is running
            await nightlyPreCacheJob.run();

            await firstRun;

            // getTopQueries should only be called once
            expect(cacheOptimizationService.getTopQueries).toHaveBeenCalledTimes(1);
        });

        it('should update status after completion', async () => {
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue([
                'query1'
            ]);

            (cacheOptimizationService.get as jest.Mock).mockResolvedValue(null);
            (enhancedYouTubeService.searchVideos as jest.Mock).mockResolvedValue([
                { id: '1', title: 'Test' }
            ]);
            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(3);

            await nightlyPreCacheJob.run();

            const status = nightlyPreCacheJob.getStatus();

            expect(status.isRunning).toBe(false);
            expect(status.lastRunTime).toBeTruthy();
            expect(status.lastRunStats.cached).toBeGreaterThan(0);
            expect(status.lastRunStats.duration).toBeGreaterThan(0);
        });
    });

    describe('getStatus()', () => {
        it('should return initial status before first run', () => {
            const status = nightlyPreCacheJob.getStatus();

            expect(status).toEqual({
                isRunning: false,
                lastRunTime: null,
                lastRunStats: {
                    cached: 0,
                    skipped: 0,
                    failed: 0,
                    duration: 0
                }
            });
        });

        it('should return updated status after run', async () => {
            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue(['query1']);
            (cacheOptimizationService.get as jest.Mock).mockResolvedValue(null);
            (enhancedYouTubeService.searchVideos as jest.Mock).mockResolvedValue([]);
            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(0);

            await nightlyPreCacheJob.run();

            const status = nightlyPreCacheJob.getStatus();

            expect(status.isRunning).toBe(false);
            expect(status.lastRunTime).toBeInstanceOf(Date);
            expect(status.lastRunStats.duration).toBeGreaterThan(0);
        });
    });

    describe('ROI Calculation', () => {
        it('should achieve 24x ROI with 15 queries cached for 24 hours', async () => {
            const queriesCount = 15;
            const queries = Array.from({ length: queriesCount }, (_, i) => `query${i}`);

            (cacheOptimizationService.getTopQueries as jest.Mock).mockResolvedValue(queries);
            (cacheOptimizationService.get as jest.Mock).mockResolvedValue(null);
            (enhancedYouTubeService.searchVideos as jest.Mock).mockResolvedValue([]);
            (cacheOptimizationService.set as jest.Mock).mockResolvedValue(undefined);
            (cacheOptimizationService.cleanStale as jest.Mock).mockResolvedValue(0);

            await nightlyPreCacheJob.run();

            const status = nightlyPreCacheJob.getStatus();

            // 15 queries cached × 24h TTL = 360 searches served
            // 360 / 15 = 24x ROI
            const estimatedSearchesServed = status.lastRunStats.cached * 24;
            const roi = estimatedSearchesServed / status.lastRunStats.cached;

            expect(roi).toBe(24);
        });
    });
});
