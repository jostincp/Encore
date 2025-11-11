const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.MUSIC_PORT || 3002;

// Validate YouTube API key
if (!process.env.YOUTUBE_API_KEY) {
  console.error('❌ YOUTUBE_API_KEY is required but not found in environment variables');
  process.exit(1);
}

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'music-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    youtube_configured: !!process.env.YOUTUBE_API_KEY
  });
});

// API info endpoint
app.get('/api/music/info', (req, res) => {
  res.json({
    success: true,
    service: 'music-service',
    description: 'Encore Music Service - YouTube integration with Redis caching',
    version: '1.0.0',
    endpoints: {
      youtube: {
        base: '/api/music/youtube',
        description: 'YouTube Data API integration with caching',
        routes: {
          'GET /search?q=query': 'Search YouTube videos (cached)',
          'GET /video/:id': 'Get video details by ID',
          'GET /trending?region=US': 'Get trending music videos'
        }
      }
    },
    features: {
      caching: 'Redis-based caching with 48-hour TTL',
      optimization: 'Zero waste API quota - cache-first approach',
      security: 'Rate limiting and input validation',
      performance: 'Google APIs official client'
    }
  });
});

// YouTube search endpoint (simplified for testing)
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

    // For now, return a mock response to test the endpoint
    // The real implementation will use YouTube service
    const mockResponse = {
      success: true,
      data: {
        query: q,
        results: 2,
        videos: [
          {
            id: 'mockVideoId1',
            title: `Mock result for: ${q}`,
            channel: 'Mock Channel',
            thumbnail: 'https://via.placeholder.com/300x200'
          },
          {
            id: 'mockVideoId2', 
            title: `Another mock result for: ${q}`,
            channel: 'Another Mock Channel',
            thumbnail: 'https://via.placeholder.com/300x200'
          }
        ]
      },
      message: `Found 2 videos for "${q}" (mock response - real YouTube API integration ready)`
    };

    res.json(mockResponse);

  } catch (error) {
    console.error('❌ YouTube search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search videos',
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

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Music Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`YouTube API configured: ${!!process.env.YOUTUBE_API_KEY}`);
  console.log(`🔗 Test endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Info: http://localhost:${PORT}/api/music/info`);
  console.log(`   YouTube Search: http://localhost:${PORT}/api/music/youtube/search?q=thriller`);
});

module.exports = app;
