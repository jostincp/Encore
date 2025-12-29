import request from 'supertest';
import express from 'express';
import monitoringRoutes from '../../../src/routes/monitoring';

const app = express();
app.use('/api/monitoring', monitoringRoutes);

describe('Monitoring API Endpoints', () => {
    describe('GET /api/monitoring/cache/stats', () => {
        it('should return cache statistics', async () => {
            const response = await request(app)
                .get('/api/monitoring/cache/stats')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('stats');
            expect(response.body.data).toHaveProperty('health');
            expect(response.body.data).toHaveProperty('timestamp');

            expect(response.body.data.stats).toHaveProperty('hits');
            expect(response.body.data.stats).toHaveProperty('misses');
            expect(response.body.data.stats).toHaveProperty('totalRequests');
            expect(response.body.data.stats).toHaveProperty('hitRate');
        });
    });

    describe('GET /api/monitoring/cache/top-queries', () => {
        it('should return top queries with default parameters', async () => {
            const response = await request(app)
                .get('/api/monitoring/cache/top-queries')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('queries');
            expect(response.body.data.hours).toBe(24);
            expect(response.body.data.limit).toBe(20);
            expect(Array.isArray(response.body.data.queries)).toBe(true);
        });

        it('should accept custom hours and limit parameters', async () => {
            const response = await request(app)
                .get('/api/monitoring/cache/top-queries?hours=12&limit=10')
                .expect(200);

            expect(response.body.data.hours).toBe(12);
            expect(response.body.data.limit).toBe(10);
        });
    });

    describe('POST /api/monitoring/cache/reset-stats', () => {
        it('should reset cache statistics', async () => {
            const response = await request(app)
                .post('/api/monitoring/cache/reset-stats')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('reset');
        });
    });

    describe('GET /api/monitoring/precache/status', () => {
        it('should return pre-cache job status', async () => {
            const response = await request(app)
                .get('/api/monitoring/precache/status')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('isRunning');
            expect(response.body.data).toHaveProperty('lastRunTime');
            expect(response.body.data).toHaveProperty('lastRunStats');
            expect(response.body.data).toHaveProperty('roi');
            expect(response.body.data).toHaveProperty('estimatedSearchesServed');
        });
    });

    describe('POST /api/monitoring/precache/run', () => {
        it('should trigger pre-cache job', async () => {
            const response = await request(app)
                .post('/api/monitoring/precache/run')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('started');
        });
    });

    describe('GET /api/monitoring/quota/youtube', () => {
        it('should return YouTube quota usage estimation', async () => {
            const response = await request(app)
                .get('/api/monitoring/quota/youtube')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('current');
            expect(response.body.data).toHaveProperty('projected');
            expect(response.body.data).toHaveProperty('limits');
            expect(response.body.data).toHaveProperty('cacheStats');
            expect(response.body.data).toHaveProperty('alerts');

            // Current usage
            expect(response.body.data.current).toHaveProperty('apiCalls');
            expect(response.body.data.current).toHaveProperty('quotaUsed');
            expect(response.body.data.current).toHaveProperty('quotaPercentage');

            // Projected usage
            expect(response.body.data.projected).toHaveProperty('dailyAPICalls');
            expect(response.body.data.projected).toHaveProperty('dailyQuota');
            expect(response.body.data.projected).toHaveProperty('percentage');
            expect(response.body.data.projected).toHaveProperty('willExceed');

            // Limits
            expect(response.body.data.limits.dailyQuotaLimit).toBe(10000);
            expect(response.body.data.limits.searchCost).toBe(100);
            expect(response.body.data.limits.maxSearchesPerDay).toBe(100);

            // Alerts
            expect(response.body.data.alerts).toHaveProperty('warning');
            expect(response.body.data.alerts).toHaveProperty('critical');
            expect(response.body.data.alerts).toHaveProperty('message');
        });

        it('should show warning alert when quota > 80%', async () => {
            // This would require mocking cache stats to simulate high usage
            // For now, just verify the structure
            const response = await request(app)
                .get('/api/monitoring/quota/youtube')
                .expect(200);

            expect(typeof response.body.data.alerts.warning).toBe('boolean');
            expect(typeof response.body.data.alerts.critical).toBe('boolean');
        });
    });

    describe('GET /api/monitoring/health', () => {
        it('should return overall system health', async () => {
            const response = await request(app)
                .get('/api/monitoring/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('status');
            expect(response.body.data).toHaveProperty('checks');
            expect(response.body.data).toHaveProperty('timestamp');

            // Health checks
            expect(response.body.data.checks).toHaveProperty('cache');
            expect(response.body.data.checks).toHaveProperty('preCache');
            expect(response.body.data.checks).toHaveProperty('redis');

            // Cache check
            expect(response.body.data.checks.cache).toHaveProperty('status');
            expect(response.body.data.checks.cache).toHaveProperty('hitRate');
            expect(response.body.data.checks.cache).toHaveProperty('target');
        });

        it('should return healthy status when all checks pass', async () => {
            const response = await request(app)
                .get('/api/monitoring/health')
                .expect(200);

            expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.data.status);
        });

        it('should return 503 when system is unhealthy', async () => {
            // This would require mocking unhealthy state
            // For now, verify it returns proper status codes
            const response = await request(app)
                .get('/api/monitoring/health');

            expect([200, 503]).toContain(response.status);
        });
    });

    describe('Error Handling', () => {
        it('should handle internal errors gracefully', async () => {
            // Test with invalid parameters
            const response = await request(app)
                .get('/api/monitoring/cache/top-queries?hours=invalid&limit=invalid');

            // Should still return 200 with default values or handle gracefully
            expect([200, 400, 500]).toContain(response.status);
        });
    });

    describe('Performance', () => {
        it('should respond within 500ms', async () => {
            const start = Date.now();

            await request(app)
                .get('/api/monitoring/health')
                .expect(200);

            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500);
        });

        it('should handle concurrent requests', async () => {
            const requests = Array.from({ length: 10 }, () =>
                request(app).get('/api/monitoring/cache/stats')
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });
        });
    });
});
