const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();

// Configuración de YouTube API
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyDummyKeyForTesting';
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: ['http://localhost:3004', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging simple
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'music-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    youtube_api: YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'AIzaSyDummyKeyForTesting' ? 'configured' : 'not_configured',
    endpoints: {
      search: '/api/youtube/search',
      health: '/health'
    }
  });
});

// Función para buscar en YouTube API
async function searchYouTube(query, maxResults = 25) {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        videoCategoryId: '10', // Música
        maxResults: Math.min(maxResults, 50),
        key: YOUTUBE_API_KEY
      }
    });

    const videos = response.data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: extractArtist(item.snippet.title),
      duration: '3:45', // YouTube API requiere otra llamada para obtener duración
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt
    }));

    return {
      success: true,
      data: {
        videos: videos,
        totalResults: response.data.pageInfo.totalResults,
        nextPageToken: response.data.nextPageToken
      }
    };

  } catch (error) {
    logger.error('YouTube API error:', error.response?.data || error.message);
    
    // Si hay error con la API, devolver resultados mock
    return {
      success: true,
      data: {
        videos: [
          {
            id: 'mock_' + Date.now(),
            title: `${query} - YouTube API Error (Demo)`,
            artist: 'Artista Demo',
            duration: '3:45',
            thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
            channelTitle: 'Demo Channel',
            publishedAt: new Date().toISOString()
          }
        ]
      }
    };
  }
}

// Función para extraer artista del título
function extractArtist(title) {
  // Patrones comunes: "Artista - Canción", "Artista: Canción", etc.
  const patterns = [
    /^(.+?)\s*[-–—:]\s*.+$/,
    /^(.+?)\s*[""«»]\s*.+$/,
    /^(.+?)\s*\(\s*.+\s*\)\s*.+$/
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return 'Unknown Artist';
}

// YouTube search endpoint (GET)
app.get('/api/youtube/search', async (req, res) => {
  try {
    const { q: query, maxResults = 25 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required'
      });
    }

    logger.info(`Searching YouTube for: ${query}`);
    
    const results = await searchYouTube(query, parseInt(maxResults));
    res.json(results);
    
  } catch (error) {
    logger.error('Error searching YouTube:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching for songs'
    });
  }
});

// YouTube search endpoint (POST)
app.post('/api/youtube/search', async (req, res) => {
  try {
    const { query, maxResults = 25 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required'
      });
    }

    logger.info(`Searching YouTube for: ${query}`);
    
    const results = await searchYouTube(query, parseInt(maxResults));
    res.json(results);
    
  } catch (error) {
    logger.error('Error searching YouTube:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching for songs'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    service: 'music-service'
  });
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`Music Service started on port ${PORT}`);
  logger.info(`Environment: development`);
  logger.info(`Service: music-service-youtube`);
  logger.info(`YouTube API: ${YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'AIzaSyDummyKeyForTesting' ? 'Configured ✅' : 'Using Mock Data ⚠️'}`);
});

module.exports = app;
