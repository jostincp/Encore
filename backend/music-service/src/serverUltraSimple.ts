import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';

// Cargar variables de entorno desde backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.MUSIC_SERVICE_PORT || process.env.PORT || 3002;

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
const log = (message: string, data?: any) => {
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

    // Si no hay API key, usar datos mock para desarrollo
    if (!YOUTUBE_API_KEY || process.env.YOUTUBE_USE_MOCK === 'true') {
      log('⚠️  Using mock data (YouTube API key not configured)', { query: q });

      const mockVideos = [
        {
          id: 'fJ9rUzIMcZQ',
          title: 'Queen - Bohemian Rhapsody (Official Video Remastered)',
          artist: 'Queen',
          thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
          channel: 'Queen Official',
          publishedAt: '2008-08-01T07:00:09Z',
          description: 'Bohemian Rhapsody',
          source: 'youtube'
        },
        {
          id: 'HgzGwKwLmgM',
          title: 'Queen - Don\'t Stop Me Now (Official Video)',
          artist: 'Queen',
          thumbnail: 'https://i.ytimg.com/vi/HgzGwKwLmgM/mqdefault.jpg',
          channel: 'Queen Official',
          publishedAt: '2008-08-01T07:00:09Z',
          description: 'Don\'t Stop Me Now',
          source: 'youtube'
        },
        {
          id: '2ZBtPf7FOoM',
          title: 'Queen - We Will Rock You (Official Video)',
          artist: 'Queen',
          thumbnail: 'https://i.ytimg.com/vi/2ZBtPf7FOoM/mqdefault.jpg',
          channel: 'Queen Official',
          publishedAt: '2008-08-01T07:00:09Z',
          description: 'We Will Rock You',
          source: 'youtube'
        },
        {
          id: 'f4Mc-NYPHaQ',
          title: 'Queen - We Are The Champions (Official Video)',
          artist: 'Queen',
          thumbnail: 'https://i.ytimg.com/vi/f4Mc-NYPHaQ/mqdefault.jpg',
          channel: 'Queen Official',
          publishedAt: '2008-08-01T07:00:09Z',
          description: 'We Are The Champions',
          source: 'youtube'
        },
        {
          id: 'A_MjCqQoLLA',
          title: 'Queen - Somebody To Love (Official Video)',
          artist: 'Queen',
          thumbnail: 'https://i.ytimg.com/vi/A_MjCqQoLLA/mqdefault.jpg',
          channel: 'Queen Official',
          publishedAt: '2008-08-01T07:00:09Z',
          description: 'Somebody To Love',
          source: 'youtube'
        }
      ];

      // Filtrar por query (simple búsqueda en título)
      const query = q.toString().toLowerCase();
      const filteredVideos = mockVideos.filter(v =>
        v.title.toLowerCase().includes(query) ||
        v.artist.toLowerCase().includes(query)
      );

      return res.json({
        success: true,
        data: {
          videos: filteredVideos.slice(0, parseInt(maxResults.toString())),
          totalResults: filteredVideos.length,
          nextPageToken: null,
          regionCode: 'US'
        },
        query: { q, maxResults, type },
        _mock: true,
        _message: 'Using mock data. Configure YOUTUBE_API_KEY for real results.'
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

    const videos = response.data.items.map((item: any) => ({
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

  } catch (error: any) {
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

  } catch (error: any) {
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

    const videos = response.data.items.map((item: any) => ({
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

  } catch (error: any) {
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
function extractArtistFromTitle(title: string): string {
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

/**
 * 🎵 Sistema de Cola (In-Memory para desarrollo)
 */
const devQueue: Record<string, any[]> = {};
const devPoints: Record<string, Record<string, number>> = {};

function ensurePoints(barId: string, table: string) {
  if (!devPoints[barId]) devPoints[barId] = {};
  if (!devPoints[barId][table]) devPoints[barId][table] = 100;
}

/**
 * POST /api/queue/:barId/add
 * Añadir canción a la cola
 */
app.post('/api/queue/:barId/add', (req, res) => {
  const barId = req.params.barId;
  const { song_id, bar_id, priority_play = false, points_used = 0, table = '1', cost } = req.body || {};

  if (!song_id || typeof song_id !== 'string') {
    return res.status(400).json({ success: false, message: 'song_id is required' });
  }

  if (!devQueue[barId]) devQueue[barId] = [];

  // Prevenir duplicados
  const exists = devQueue[barId].some(e => e.song_id === song_id && e.status === 'pending');
  if (exists) {
    return res.status(409).json({ success: false, message: 'Song already in queue' });
  }

  // Manejo de puntos
  ensurePoints(barId, table);
  const toCharge = Number(cost || points_used || (priority_play ? 100 : 50));

  if (devPoints[barId][table] < toCharge) {
    return res.status(402).json({ success: false, message: 'Insufficient points' });
  }

  devPoints[barId][table] -= toCharge;

  const entry = {
    id: String(Date.now()),
    bar_id: barId,
    song_id,
    priority_play: !!priority_play,
    points_used: toCharge,
    status: 'pending',
    requested_at: new Date().toISOString(),
    table
  };

  // Si es priority, insertar al inicio de la cola
  if (priority_play) {
    const idx = devQueue[barId].findIndex(e => e.status === 'pending');
    if (idx === -1) {
      devQueue[barId].push(entry);
    } else {
      devQueue[barId].splice(idx, 0, entry);
    }
  } else {
    devQueue[barId].push(entry);
  }

  log('✅ Song added to queue', { barId, song_id, priority_play, table });

  return res.status(201).json({ success: true, data: entry });
});

/**
 * GET /api/queue/:barId
 * Obtener cola de un bar
 */
app.get('/api/queue/:barId', (req, res) => {
  const barId = req.params.barId;
  const items = devQueue[barId] || [];

  return res.json({
    success: true,
    data: items,
    total: items.length
  });
});

/**
 * GET /api/queue/bars/:barId (alias)
 */
app.get('/api/queue/bars/:barId', (req, res) => {
  const barId = req.params.barId;
  const items = devQueue[barId] || [];

  return res.json({
    success: true,
    data: items,
    total: items.length
  });
});

/**
 * GET /api/points/:barId/:table
 * Obtener puntos de una mesa
 */
app.get('/api/points/:barId/:table', (req, res) => {
  const { barId, table } = req.params;
  ensurePoints(barId, table);

  return res.json({
    success: true,
    data: { points: devPoints[barId][table] }
  });
});

/**
 * POST /api/player/:barId/skip
 * Saltar canción actual
 */
app.post('/api/player/:barId/skip', (req, res) => {
  const { barId } = req.params;
  const q = devQueue[barId] || [];
  const playing = q.find(e => e.status === 'playing');

  if (!playing) {
    return res.status(400).json({ success: false, message: 'No song playing' });
  }

  playing.status = 'completed';
  log('⏭️  Song skipped', { barId, song_id: playing.song_id });

  return res.json({ success: true });
});

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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export { };
