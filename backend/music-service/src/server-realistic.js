const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

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

// Base de datos realista de canciones populares - CORREGIDA CON THUMBNAILS REALES
const realisticSongs = [
  {
    id: 'kJQP7kiw5F4',
    title: 'Waka Waka (This Time for Africa)',
    artist: 'Shakira',
    duration: '3:31',
    thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5F4/mqdefault.jpg',
    channelTitle: 'Shakira',
    publishedAt: '2010-06-04T21:00:00Z'
  },
  {
    id: 'weYI6I4tSWQ',
    title: 'Hips Don\'t Lie',
    artist: 'Shakira',
    duration: '4:28',
    thumbnail: 'https://i.ytimg.com/vi/weYI6I4tSWQ/mqdefault.jpg',
    channelTitle: 'Shakira',
    publishedAt: '2009-10-13T07:35:00Z'
  },
  {
    id: 'pRpeEdMmmQ0',
    title: 'Tití Me Preguntó',
    artist: 'Bad Bunny',
    duration: '4:23',
    thumbnail: 'https://i.ytimg.com/vi/pRpeEdMmmQ0/mqdefault.jpg',
    channelTitle: 'Bad Bunny',
    publishedAt: '2022-05-06T12:00:00Z'
  },
  {
    id: 'BQ_0QMz9PaU',
    title: 'Me Porto Bonito',
    artist: 'Bad Bunny',
    duration: '3:40',
    thumbnail: 'https://i.ytimg.com/vi/BQ_0QMz9PaU/mqdefault.jpg',
    channelTitle: 'Bad Bunny',
    publishedAt: '2022-05-06T12:00:00Z'
  },
  {
    id: 'hYcw3czG2w8',
    title: 'Gasolina',
    artist: 'Daddy Yankee',
    duration: '3:14',
    thumbnail: 'https://i.ytimg.com/vi/hYcw3czG2w8/mqdefault.jpg',
    channelTitle: 'DaddyYankeeVEVO',
    publishedAt: '2009-06-16T18:58:00Z'
  },
  {
    id: 'kSaz3nEmo68',
    title: 'Bailando',
    artist: 'Enrique Iglesias',
    duration: '4:03',
    thumbnail: 'https://i.ytimg.com/vi/kSaz3nEmo68/mqdefault.jpg',
    channelTitle: 'EnriqueIglesiasVEVO',
    publishedAt: '2014-04-11T07:00:00Z'
  },
  {
    id: '09R8_2nJtjg',
    title: 'Mi Gente',
    artist: 'J Balvin',
    duration: '3:05',
    thumbnail: 'https://i.ytimg.com/vi/09R8_2nJtjg/mqdefault.jpg',
    channelTitle: 'JBalvinVEVO',
    publishedAt: '2017-06-30T16:00:00Z'
  },
  {
    id: 'ykCXj3A_9dE',
    title: 'CON ALTURA',
    artist: 'Rosalía',
    duration: '3:18',
    thumbnail: 'https://i.ytimg.com/vi/ykCXj3A_9dE/mqdefault.jpg',
    channelTitle: 'Rosalía',
    publishedAt: '2019-03-28T05:00:00Z'
  },
  {
    id: 'lG2aXfUk8sU',
    title: 'Te Boté',
    artist: 'Ozuna',
    duration: '5:12',
    thumbnail: 'https://i.ytimg.com/vi/lG2aXfUk8sU/mqdefault.jpg',
    channelTitle: 'Ozuna',
    publishedAt: '2018-04-05T17:00:00Z'
  },
  {
    id: 'qmEi3i2hI9U',
    title: 'Hawái',
    artist: 'Maluma',
    duration: '3:27',
    thumbnail: 'https://i.ytimg.com/vi/qmEi3i2hI9U/mqdefault.jpg',
    channelTitle: 'MalumaVEVO',
    publishedAt: '2020-07-23T04:00:00Z'
  }
];

// Función para buscar canciones realistas
function searchRealisticSongs(query, maxResults = 25) {
  const searchQuery = query.toLowerCase();
  
  // Filtrar canciones que coincidan con la búsqueda
  const filteredSongs = realisticSongs.filter(song => 
    song.title.toLowerCase().includes(searchQuery) ||
    song.artist.toLowerCase().includes(searchQuery)
  );
  
  // Si no hay coincidencias, devolver canciones populares como sugerencia
  const results = filteredSongs.length > 0 ? filteredSongs : realisticSongs.slice(0, 5);
  
  // Limitar número de resultados
  const limitedResults = results.slice(0, Math.min(maxResults, results.length));
  
  return {
    success: true,
    data: {
      videos: limitedResults,
      totalResults: filteredSongs.length,
      query: query,
      searchType: filteredSongs.length > 0 ? 'exact_match' : 'suggestions'
    }
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'music-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    search_type: 'realistic_mock_data',
    total_songs: realisticSongs.length,
    endpoints: {
      search: '/api/youtube/search',
      health: '/health'
    }
  });
});

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

    logger.info(`Searching realistic songs for: ${query}`);
    
    const results = searchRealisticSongs(query, parseInt(maxResults));
    res.json(results);
    
  } catch (error) {
    logger.error('Error searching songs:', error);
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

    logger.info(`Searching realistic songs for: ${query}`);
    
    const results = searchRealisticSongs(query, parseInt(maxResults));
    res.json(results);
    
  } catch (error) {
    logger.error('Error searching songs:', error);
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
  logger.info(`Service: music-service-realistic`);
  logger.info(`Database: ${realisticSongs.length} realistic songs loaded`);
});

module.exports = app;
