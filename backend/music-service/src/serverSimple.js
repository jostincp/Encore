const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Configuración YouTube
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging simple
const log = (message, data) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

/**
 * 🔍 Búsqueda simple de YouTube
 */
app.get('/api/youtube/search', async (req, res) => {
  try {
    const { q, maxResults = 10, type = 'video' } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required'
      });
    }

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    log('🎵 Searching YouTube', { query: q, maxResults, type });

    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
      params: {
        key: YOUTUBE_API_KEY,
        part: 'snippet',
        q: q.toString(),
        type: type.toString(),
        maxResults: parseInt(maxResults.toString()),
        videoCategoryId: '10', // Música
      },
      timeout: 10000
    });

    const videos = response.data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: extractArtistFromTitle(item.snippet.title),
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      source: 'youtube'
    }));

    log('✅ YouTube search completed', { 
      query: q, 
      results: videos.length,
      totalResults: response.data.pageInfo?.totalResults 
    });

    return res.json({
      success: true,
      data: {
        videos,
        totalResults: response.data.pageInfo?.totalResults || 0,
        nextPageToken: response.data.nextPageToken,
        regionCode: response.data.regionCode
      },
      query: {
        q,
        maxResults,
        type
      }
    });

  } catch (error) {
    log('❌ YouTube search error:', error);
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'YouTube API quota exceeded or invalid API key'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to search YouTube',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * 🎵 Obtener detalles de un video específico
 */
app.get('/api/youtube/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    log('🎵 Getting YouTube video details', { videoId });

    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
      params: {
        key: YOUTUBE_API_KEY,
        part: 'snippet,contentDetails',
        id: videoId
      },
      timeout: 10000
    });

    if (response.data.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    const video = response.data.items[0];
    const videoDetails = {
      id: video.id,
      title: video.snippet.title,
      artist: extractArtistFromTitle(video.snippet.title),
      thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
      channel: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      description: video.snippet.description,
      duration: video.contentDetails?.duration,
      source: 'youtube'
    };

    log('✅ YouTube video details retrieved', { videoId, title: videoDetails.title });

    return res.json({
      success: true,
      data: videoDetails
    });

  } catch (error) {
    log('❌ YouTube video details error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get video details',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * 🎵 Tendencias de música por región
 */
app.get('/api/youtube/trending', async (req, res) => {
  try {
    const { regionCode = 'US' } = req.query;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    log('🎵 Getting YouTube trending music', { regionCode });

    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
      params: {
        key: YOUTUBE_API_KEY,
        part: 'snippet',
        chart: 'mostPopular',
        videoCategoryId: '10', // Música
        regionCode: regionCode.toString(),
        maxResults: 20
      },
      timeout: 10000
    });

    const videos = response.data.items.map((item) => ({
      id: item.id,
      title: item.snippet.title,
      artist: extractArtistFromTitle(item.snippet.title),
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      source: 'youtube'
    }));

    log('✅ YouTube trending music retrieved', { 
      regionCode, 
      results: videos.length 
    });

    return res.json({
      success: true,
      data: {
        videos,
        regionCode,
        totalResults: response.data.pageInfo?.totalResults || 0
      }
    });

  } catch (error) {
    log('❌ YouTube trending error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get trending music',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * 🔧 Función auxiliar para extraer artista del título
 */
function extractArtistFromTitle(title) {
  // Patrones comunes: "Artist - Song", "Artist: Song", "Song | Artist"
  const patterns = [
    /^(.+?)\s*[-–—:]\s*(.+)$/,    // "Artist - Song"
    /^(.+?)\s*\|\s*(.+)$/,       // "Song | Artist"
    /^(.+?)\s*[""'""](.+?)[""'""]$/, // "Artist" Song"
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      // Determinar cuál es el artista (usualmente la primera parte)
      return match[1].trim();
    }
  }

  // Si no se puede determinar, devolver título completo
  return title.trim();
}

// Health check principal
app.get('/health', (req, res) => {
  return res.json({
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
  return res.json({
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
app.use((err, req, res, next) => {
  log('Express error:', err);
  
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
  log(`🎵 Music Service (Simple) started on port ${PORT}`);
  log(`🔗 YouTube API Key: ${YOUTUBE_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  log(`🌐 Server: http://localhost:${PORT}`);
  log(`📚 Health: http://localhost:${PORT}/health`);
  log(`🔍 Search: http://localhost:${PORT}/api/youtube/search?q=queen`);
});

module.exports = app;
