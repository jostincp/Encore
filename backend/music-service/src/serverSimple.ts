import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import youtubeSimpleRoutes from './routes/youtubeSimple';
import logger from '../../../shared/utils/logger';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Routes
app.use('/api/youtube', youtubeSimpleRoutes);

// Health check principal
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'music-service-simple',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      youtube: '/api/youtube/*',
      health: '/health'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Encore Music Service (Simple)',
    status: 'running',
    message: '🎵 YouTube Music Search API is ready!',
    endpoints: {
      search: '/api/youtube/search?q={query}',
      video: '/api/youtube/video/{videoId}',
      trending: '/api/youtube/trending?regionCode={code}',
      health: '/health'
    }
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Express error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      '/api/youtube/search?q={query}',
      '/api/youtube/video/{videoId}',
      '/api/youtube/trending',
      '/health'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🎵 Music Service (Simple) started on port ${PORT}`);
  logger.info(`🔗 YouTube API Key: ${process.env.YOUTUBE_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  logger.info(`🌐 Server: http://localhost:${PORT}`);
  logger.info(`📚 Health: http://localhost:${PORT}/health`);
  logger.info(`🔍 Search: http://localhost:${PORT}/api/youtube/search?q=queen`);
});

export default app;
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'music-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    youtube_configured: !!config.youtube.apiKey
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found' 
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close Redis connection
    if (redisClient) {
      await redisClient.quit();
      console.log('Redis connection closed');
    }
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const startServer = async () => {
  try {
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🎵 Music Service running on port ${PORT}`);
      console.log(`Environment: ${config.server.env || 'development'}`);
      console.log(`YouTube API configured: ${!!config.youtube.apiKey}`);
      console.log(`🔗 YouTube search endpoint: http://localhost:${PORT}/api/music/youtube/search?q=thriller`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
