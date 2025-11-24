import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger from '@shared/utils/logger';
import { initializeDatabase, closeDatabase, runMigrations } from '@shared/database';
import { initRedis, getRedisClient, closeRedis } from '@shared/utils/redis';
import { errorHandler, notFoundHandler } from '@shared/utils/errors';
import {
  requestLoggingMiddleware,
  healthCheckMiddleware,
  corsMiddleware,
  basicRateLimit,
  securityMiddleware
} from '@shared/middleware';
import routes from './routes';
import youtubeSimpleRoutes from './routes/youtubeSimple';
import { setupSwagger } from './swagger/swagger.config';
import { 
  performanceMonitoring, 
  errorTracking, 
  detailedHealthCheck, 
  getMetrics 
} from './middleware/monitoring';

const app = express();
const PORT = config.server.port;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/music', routes);

// Error handling middleware (simplified)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    await closeDatabase();
    logger.info('Database connections closed');
    
    // Close Redis connection
    await closeRedis();
    logger.info('Redis connection closed');
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const startServer = async () => {
  try {
    const skipInfra = process.env.SKIP_INFRA === '1';
    if (!skipInfra) {
      await initializeDatabase();
      logger.info('Database initialized successfully');
      await runMigrations();
      logger.info('Database migrations completed');
      await initRedis();
      logger.info('Redis connected successfully');
    } else {
      logger.warn('Skipping database and Redis initialization (SKIP_INFRA=1)');
      app.use('/api/music/youtube', youtubeSimpleRoutes);
      const devQueue: Record<string, any[]> = {};
      app.post('/api/music/queue/:barId/add', (req, res) => {
        const { barId } = req.params as { barId: string };
        const { song_id, priority_play = false, points_used = 0 } = req.body || {};
        if (!song_id || typeof song_id !== 'string') {
          return res.status(400).json({ success: false, message: 'song_id requerido' });
        }
        if (!devQueue[barId]) devQueue[barId] = [];
        const entry = {
          id: `${Date.now()}`,
          bar_id: barId,
          song_id,
          priority_play: !!priority_play,
          points_used: Number(points_used) || 0,
          status: 'pending',
          requested_at: new Date().toISOString()
        };
        devQueue[barId].push(entry);
        return res.status(201).json({ success: true, data: entry });
      });
      app.get('/api/music/queue/bars/:barId', (req, res) => {
        const { barId } = req.params as { barId: string };
        const items = devQueue[barId] || [];
        return res.json({ success: true, data: items, total: items.length });
      });
    }
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🎵 Music Service running on port ${PORT}`);
      logger.info(`Environment: ${config.server.env || 'development'}`);
      logger.info(`YouTube API configured: ${!!config.youtube.apiKey}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
