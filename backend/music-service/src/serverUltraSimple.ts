
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { CacheService, CacheKeys } from './services/cacheService';
import { AnalyticsService } from './services/analyticsService';
import { barRateLimiter, ipRateLimiter } from './middleware/rateLimiter';
import { circuitBreakerMiddleware, executeProtectedCall } from './middleware/circuitBreaker';
import { redisClient } from './config/redis';

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

// Protección global
app.use(ipRateLimiter);
app.use('/api/youtube', circuitBreakerMiddleware);

// Logging simple
const log = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Contador de cuota ahorrada (en memoria)
let quotaSavedToday = 0;

/**
 * 🔄 Queue Service Configuration
 */
const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'http://localhost:3003';

/**
 * 🔍 Búsqueda simple de YouTube
 */
app.get('/api/youtube/search', barRateLimiter, async (req, res) => {
  try {
    const q = req.query.q as string;
    const maxResults = Number(req.query.maxResults) || 10;
    const type = (req.query.type as string) || 'video';
    const barId = (req.query.barId as string) || 'unknown';

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required'
      });
    }

    // Normalizar query
    const normalizedQuery = q.toString().toLowerCase().trim();
    // V2 prefix para invalidar caché antiguo con formato incorrecto
    const cacheKey = `yt:search:v2:${normalizedQuery}`;

    // 1. Intentar Cache
    const cachedResult = await CacheService.get<any>(cacheKey);
    if (cachedResult) {
      log('🧠 Cache HIT for query:', q);
      quotaSavedToday += 100;

      const resultVideos = cachedResult.videos || [];

      AnalyticsService.track({
        barId,
        searchQuery: normalizedQuery,
        resultsCount: resultVideos.length,
        cacheHit: true
      });

      return res.json({
        success: true,
        data: cachedResult, // Ya tiene estructura { videos: [...] }
        source: 'cache'
      });
    }

    // Si no hay API key, usar datos mock
    if (!YOUTUBE_API_KEY || process.env.YOUTUBE_USE_MOCK === 'true') {
      log('⚠️  Using mock data', { query: q });
      const mockVideos = [
        {
          id: 'mock1',
          title: `Result for ${q}`,
          artist: 'Mock Artist',
          thumbnail: 'https://via.placeholder.com/120',
          channel: 'Mock Channel',
          publishedAt: new Date().toISOString(),
          source: 'mock'
        },
        {
          id: 'mock2',
          title: `Another Hit for ${q}`,
          artist: 'Top Artist',
          thumbnail: 'https://via.placeholder.com/120',
          channel: 'Top Channel',
          publishedAt: new Date().toISOString(),
          source: 'mock'
        }
      ];
      return res.json({
        success: true,
        data: { videos: mockVideos }, // Formato correcto
        source: 'mock'
      });
    }

    // 2. Llamada a YouTube API Protegida
    const response = await executeProtectedCall(async () => {
      return await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
        params: {
          part: 'snippet',
          q: normalizedQuery,
          maxResults: maxResults,
          type: type,
          key: YOUTUBE_API_KEY,
          videoCategoryId: '10' // Music category
        }
      });
    });

    const data = response.data;

    // Transformar items a formato simplificado para el frontend (Videos Array)
    const videos = (data.items || []).map((item: any) => ({
      id: item.id?.videoId || item.id,
      title: item.snippet?.title,
      artist: extractArtistFromTitle(item.snippet?.title || ''),
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      channel: item.snippet?.channelTitle,
      publishedAt: item.snippet?.publishedAt,
      description: item.snippet?.description,
      source: 'youtube'
    })).filter((v: any) => v.id); // Filtrar resultados sin ID

    const responseData = {
      videos, // Array de videos
      totalResults: data.pageInfo?.totalResults || videos.length,
      nextPageToken: data.nextPageToken
    };

    // Guardar en Cache DATA TRANSFORMADA (TTL 24 horas)
    await CacheService.set(cacheKey, responseData, 86400);

    // Track Analytics
    AnalyticsService.track({
      barId,
      searchQuery: normalizedQuery,
      resultsCount: videos.length,
      cacheHit: false
    });

    log('✅ YouTube API Call successful', { query: q, results: videos.length });
    return res.json({
      success: true,
      data: responseData,
      source: 'api'
    });

  } catch (error: any) {
    log('❌ Error in search:', error.message);

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Daily quota exceeded. Please try again later.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during search',
      error: error.message
    });
  }
});


/**
 * 🔧 Función auxiliar para extraer artista del título
 */
function extractArtistFromTitle(title: string): string {
  if (!title) return 'Unknown Artist';
  const patterns = [
    /^(.+?)\s*[-–—:]\s*(.+)$/,    // "Artist - Song"
    /^(.+?)\s*\|\s*(.+)$/,       // "Song | Artist"
    /^(.+?)\s*[""'""](.+?)[""'""]$/, // "Artist" Song"
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return title.trim();
}

/**
 * 🎵 Sistema de Cola - Legacy variables (still used by skip endpoint)
 */
const devQueue: Record<string, any[]> = {};
const devPoints: Record<string, Record<string, number>> = {};

function ensurePoints(barId: string, table: string) {
  if (!devPoints[barId]) devPoints[barId] = {};
  if (!devPoints[barId][table]) devPoints[barId][table] = 100;
}

/**
 * 🔄 Queue Service Proxy Endpoints
 * Forward requests to queue-service (port 3003) which stores full metadata in Redis
 */

// Override: POST /api/queue/:barId/add - Proxy to real queue-service
app.post('/api/queue/:barId/add', async (req, res) => {
  try {
    log('🔄 Proxying queue add request (barId route) to queue-service', { barId: req.params.barId, body: req.body });
    const response = await axios.post(`${QUEUE_SERVICE_URL}/api/queue/add`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    log('❌ Queue add proxy error (barId route):', error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: 'Queue service unavailable' }
    );
  }
});

// Override: GET /api/queue/:barId - Proxy to real queue-service  
app.get('/api/queue/:barId', async (req, res) => {
  try {
    const { barId } = req.params;
    log('🔄 Proxying queue get request to queue-service', { barId });
    const response = await axios.get(`${QUEUE_SERVICE_URL}/api/queue/${barId}`, {
      timeout: 10000
    });
    return res.json(response.data);
  } catch (error: any) {
    log('❌ Queue get proxy error:', error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: 'Queue service unavailable', data: { queue: [] } }
    );
  }
});

// Override: POST /api/queue/add - Proxy to real queue-service (Generic fallback)
app.post('/api/queue/add', async (req, res) => {
  try {
    log('🔄 Proxying queue add request to queue-service', { body: req.body });
    const response = await axios.post(`${QUEUE_SERVICE_URL}/api/queue/add`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    log('❌ Queue add proxy error:', error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: 'Queue service unavailable' }
    );
  }
});

app.get('/api/points/:barId/:table', (req, res) => {
  const { barId, table } = req.params;
  ensurePoints(barId, table);
  return res.json({ success: true, data: { points: devPoints[barId][table] } });
});

/**
 * ⏭️ Skip Track Proxy
 * Forwards skip request to queue-service's POP endpoint
 */
app.post('/api/player/:barId/skip', async (req, res) => {
  try {
    const { barId } = req.params;
    log('⏭️ Proxying skip request to queue-service', { barId });

    // Call POP endpoint on queue-service
    const response = await axios.post(`${QUEUE_SERVICE_URL}/api/queue/${barId}/pop`, {}, {
      timeout: 10000
    });

    // Publish event for realtime updates (optional, queue-service might do it too)
    redisClient.publish('queue:events', JSON.stringify({
      barId,
      eventType: 'queue_updated',
      data: { type: 'song_skipped', skippedSong: response.data.data }
    })).catch(err => log('❌ Redis publish error:', err));

    return res.json({
      success: true,
      skippedSong: response.data.data.id,
      message: 'Song skipped successfully'
    });

  } catch (error: any) {
    log('❌ Queue skip proxy error:', error.message);
    // If queue is empty (404), return success but with message
    if (error.response?.status === 404) {
      return res.status(400).json({ success: false, message: 'No hay canciones en la cola' });
    }
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: 'Queue service unavailable' }
    );
  }

});

/**
 * 🗑️ Proxy DELETE /api/queue/:barId/:songId -> QUEUE SERVICE
 */
app.delete('/api/queue/:barId/:songId', async (req, res) => {
  try {
    const { barId, songId } = req.params;
    log(`🗑️ Proxying DELETE queue request for bar ${barId}, song ${songId}`);

    const response = await axios.delete(`${QUEUE_SERVICE_URL}/api/queue/${barId}/${songId}`);
    return res.json(response.data);

  } catch (error: any) {
    log('❌ Queue delete proxy error:', error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: 'Queue service unavailable' }
    );
  }
});






app.get('/health', (req, res) => {
  return res.json({
    success: true,
    service: 'music-service-simple',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = CacheService.getStats();
    res.json({ success: true, data: { ...stats, quotaSavedToday } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🎵 Music Service running on port ${PORT}`);
  log('🚀 Server started');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
