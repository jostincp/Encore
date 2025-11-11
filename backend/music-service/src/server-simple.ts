import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import axios from 'axios';

const app = express();
const server = createServer(app);

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
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`)
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'music-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      search: '/api/youtube/search',
      health: '/health'
    }
  });
});

// YouTube search endpoint
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
    
    // Mock response for now - replace with real YouTube API call
    const mockResults = {
      success: true,
      data: {
        videos: [
          {
            id: 'mock_' + Date.now(),
            title: `${query} - Resultado 1`,
            artist: 'Artista Demo',
            duration: '3:45',
            thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
          },
          {
            id: 'mock_' + Date.now() + '_2',
            title: `${query} - Resultado 2`,
            artist: 'Otro Artista',
            duration: '4:20',
            thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
          }
        ]
      }
    };
    
    res.json(mockResults);
    
  } catch (error) {
    logger.error('Error searching YouTube:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching for songs'
    });
  }
});

// GET endpoint for compatibility
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
    
    // Mock response for now
    const mockResults = {
      success: true,
      data: {
        videos: [
          {
            id: 'mock_' + Date.now(),
            title: `${query} - Resultado 1`,
            artist: 'Artista Demo',
            duration: '3:45',
            thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
          },
          {
            id: 'mock_' + Date.now() + '_2',
            title: `${query} - Resultado 2`,
            artist: 'Otro Artista',
            duration: '4:20',
            thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
          }
        ]
      }
    };
    
    res.json(mockResults);
    
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
server.listen(PORT, () => {
  logger.info(`Music Service started on port ${PORT}`);
  logger.info(`Environment: development`);
  logger.info(`Service: music-service-simple`);
});

export default app;
