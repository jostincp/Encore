const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');
const Redis = require('ioredis');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.MUSIC_PORT || 3002;

// Validate YouTube API key
if (!process.env.YOUTUBE_API_KEY) {
  console.error('❌ YOUTUBE_API_KEY is required but not found in environment variables');
  process.exit(1);
}

// Initialize Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000
});

// Redis helper functions
const redisHelpers = {
  async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  },

  async set(key, value, ttl) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }
};

// Initialize YouTube API
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Configuration
const config = {
  youtube: {
    maxResults: parseInt(process.env.YOUTUBE_MAX_RESULTS || '20'),
    regionCode: process.env.YOUTUBE_REGION_CODE || 'US',
    searchCacheTTL: parseInt(process.env.YOUTUBE_SEARCH_CACHE_TTL || '172800'), // 48 hours
    videoCategoryId: '10' // Music category
  }
};

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200 // limit each IP to 200 requests per windowMs
});
app.use(limiter);

// Helper functions
function normalizeQuery(query) {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function cleanYouTubeResponse(response) {
  if (!response.items || response.items.length === 0) {
    return [];
  }

  return response.items
    .filter(item => item.id && item.id.videoId && item.snippet)
    .map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle || 'Unknown Channel',
      thumbnail: getBestThumbnail(item.snippet.thumbnails)
    }));
}

function getBestThumbnail(thumbnails) {
  return thumbnails?.high?.url || 
         thumbnails?.medium?.url || 
         thumbnails?.default?.url || 
         '';
}

function isQuotaExceededError(error) {
  return error?.code === 429 || 
         error?.errors?.[0]?.reason === 'quotaExceeded' ||
         error?.message?.includes('quota');
}

function isInvalidApiKeyError(error) {
  return error?.code === 403 || 
         error?.errors?.[0]?.reason === 'keyInvalid' ||
         error?.message?.includes('API key');
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test Redis connection
    const redisStatus = redis.status === 'ready' ? 'connected' : 'disconnected';
    
    res.json({
      success: true,
      service: 'music-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      youtube_configured: !!process.env.YOUTUBE_API_KEY,
      redis_status: redisStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'music-service',
      status: 'unhealthy',
      error: error.message
    });
  }
});

// YouTube search endpoint with caching
app.get('/api/music/youtube/search', async (req, res) => {
  try {
    const { q } = req.query;

    // Validate query parameter
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required and must be a string'
      });
    }

    if (q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter cannot be empty'
      });
    }

    if (q.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is too long (max 100 characters)'
      });
    }

    console.log(`🔍 YouTube search request: "${q}"`);

    // 1. Normalize Query
    const normalizedQuery = normalizeQuery(q);
    
    // 2. Check Redis Cache First
    const cacheKey = `music:search:yt:${normalizedQuery}`;
    const cachedResults = await redisHelpers.get(cacheKey);
    
    if (cachedResults) {
      console.log(`⚡ Cache HIT for YouTube search: "${normalizedQuery}"`);
      return res.json({
        success: true,
        data: {
          query: q,
          results: cachedResults.length,
          videos: cachedResults,
          cached: true
        },
        message: `Found ${cachedResults.length} videos for "${q}" (from cache)`
      });
    }

    // 3. Cache Miss - Call YouTube API
    console.log(`🌐 Cache MISS - Calling YouTube API for: "${normalizedQuery}"`);
    
    const response = await youtube.search.list({
      part: 'snippet',
      type: 'video',
      videoCategoryId: config.youtube.videoCategoryId, // Music category
      maxResults: config.youtube.maxResults,
      regionCode: config.youtube.regionCode,
      q: normalizedQuery
    });

    // 4. Process and Clean Results
    const cleanedVideos = cleanYouTubeResponse(response.data);
    
    // 5. Save to Cache with TTL (48 hours)
    await redisHelpers.set(cacheKey, cleanedVideos, config.youtube.searchCacheTTL);
    console.log(`💾 Cached YouTube search results for: "${normalizedQuery}" (${cleanedVideos.length} videos)`);

    res.json({
      success: true,
      data: {
        query: q,
        results: cleanedVideos.length,
        videos: cleanedVideos,
        cached: false
      },
      message: `Found ${cleanedVideos.length} videos for "${q}"`
    });

  } catch (error) {
    console.error('❌ YouTube search error:', error);
    
    // Handle specific error cases
    if (isQuotaExceededError(error)) {
      return res.status(503).json({
        success: false,
        message: 'YouTube API quota exceeded. Please try again later.',
        error_code: 'QUOTA_EXCEEDED'
      });
    }
    
    if (isInvalidApiKeyError(error)) {
      return res.status(500).json({
        success: false,
        message: 'Service configuration error. Please contact administrator.',
        error_code: 'INVALID_API_KEY'
      });
    }
    
    // Generic error response
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while searching videos',
      error_code: 'INTERNAL_ERROR'
    });
  }
});

// Get video details by ID
app.get('/api/music/youtube/video/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate video ID
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required'
      });
    }

    console.log(`🎥 YouTube video details request: ${id}`);

    const cacheKey = `music:video:yt:${id}`;
    const cachedVideo = await redisHelpers.get(cacheKey);
    
    if (cachedVideo) {
      console.log(`⚡ Cache HIT for YouTube video: ${id}`);
      return res.json({
        success: true,
        data: cachedVideo,
        cached: true,
        message: 'Video details retrieved successfully (from cache)'
      });
    }

    console.log(`🌐 Cache MISS - Calling YouTube API for video: ${id}`);
    
    const response = await youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: id
    });

    if (response.data.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
        error_code: 'VIDEO_NOT_FOUND'
      });
    }

    const video = response.data.items[0];
    const cleanedVideo = {
      id: video.id,
      title: video.snippet.title,
      channel: video.snippet.channelTitle || 'Unknown Channel',
      thumbnail: getBestThumbnail(video.snippet.thumbnails),
      duration: video.contentDetails?.duration,
      viewCount: parseInt(video.statistics?.viewCount || '0')
    };

    await redisHelpers.set(cacheKey, cleanedVideo, config.youtube.searchCacheTTL);
    console.log(`💾 Cached YouTube video details: ${id}`);

    res.json({
      success: true,
      data: cleanedVideo,
      cached: false,
      message: 'Video details retrieved successfully'
    });

  } catch (error) {
    console.error(`❌ YouTube video details error for ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video details',
      error_code: 'INTERNAL_ERROR'
    });
  }
});

// Get trending music videos
app.get('/api/music/youtube/trending', async (req, res) => {
  try {
    const { region } = req.query;

    // Validate region parameter
    if (region && typeof region !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Region parameter must be a string'
      });
    }

    const regionCode = region || config.youtube.regionCode;
    const cacheKey = `music:trending:yt:${regionCode}`;
    
    const cachedResults = await redisHelpers.get(cacheKey);
    if (cachedResults) {
      console.log(`⚡ Cache HIT for YouTube trending: ${regionCode}`);
      return res.json({
        success: true,
        data: {
          region: regionCode,
          results: cachedResults.length,
          videos: cachedResults,
          cached: true
        },
        message: `Retrieved ${cachedResults.length} trending videos (from cache)`
      });
    }

    console.log(`🌐 Cache MISS - Calling YouTube API for trending: ${regionCode}`);
    
    const response = await youtube.videos.list({
      part: 'snippet',
      chart: 'mostPopular',
      videoCategoryId: config.youtube.videoCategoryId, // Music category
      maxResults: config.youtube.maxResults,
      regionCode: regionCode
    });

    const cleanedVideos = cleanYouTubeResponse(response.data);
    
    await redisHelpers.set(cacheKey, cleanedVideos, config.youtube.searchCacheTTL);
    console.log(`💾 Cached YouTube trending results: ${regionCode} (${cleanedVideos.length} videos)`);

    res.json({
      success: true,
      data: {
        region: regionCode,
        results: cleanedVideos.length,
        videos: cleanedVideos,
        cached: false
      },
      message: `Retrieved ${cleanedVideos.length} trending videos`
    });

  } catch (error) {
    console.error('❌ YouTube trending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending videos',
      error_code: 'INTERNAL_ERROR'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error' 
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close Redis connection
    if (redis) {
      await redis.quit();
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

// Start server
const startServer = async () => {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('✅ Redis connected successfully');
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🎵 Music Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`YouTube API configured: ${!!process.env.YOUTUBE_API_KEY}`);
      console.log(`🔗 Test endpoints:`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   YouTube Search: http://localhost:${PORT}/api/music/youtube/search?q=thriller`);
      console.log(`   Video Details: http://localhost:${PORT}/api/music/youtube/video/dQw4w9WgXcQ`);
      console.log(`   Trending: http://localhost:${PORT}/api/music/youtube/trending`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
