
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
import { normalizeQuery } from './utils/queryNormalizer';
import cron from 'node-cron';

// Importar cron jobs al iniciar el servidor
import './jobs/precacheSearches';

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

    // Normalizar query usando nueva función
    const normalizedQuery = normalizeQuery(q);
    const cacheKey = `search:${normalizedQuery}`;

    // 1. Intentar leer desde caché Redis
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      log(`✅ Cache HIT: '${q}'`);

      // Incrementar contador de hits
      await redisClient.incr('cache:hits');
      quotaSavedToday += 100;

      AnalyticsService.track({
        barId,
        searchQuery: normalizedQuery,
        resultsCount: data.results?.length || 0,
        cacheHit: true
      });

      // Asegurar que los resultados tengan el formato correcto con 'id'
      const videos = (data.results || []).map((item: any) => ({
        id: item.videoId || item.id,  // Compatibilidad con ambos formatos
        title: item.title,
        artist: item.artist,
        thumbnail: item.thumbnail,
        channel: item.channel,
        publishedAt: item.publishedAt,
        description: item.description || '',
        source: 'youtube'
      }));

      return res.json({
        success: true,
        data: {
          videos,
          totalResults: videos.length
        },
        source: 'cache',
        cachedAt: data.cachedAt
      });
    }

    // 2. Cache MISS - Incrementar contador
    log(`❌ Cache MISS: '${q}' - Calling YouTube API`);
    await redisClient.incr('cache:misses');

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
    const videos = sortByOfficialChannel(
      (data.items || []).map((item: any) => ({
        id: item.id?.videoId || item.id,
        title: item.snippet?.title,
        artist: extractArtistFromTitle(item.snippet?.title || ''),
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
        channel: item.snippet?.channelTitle,
        publishedAt: item.snippet?.publishedAt,
        description: item.snippet?.description,
        source: 'youtube'
      })).filter((v: any) => v.id) // Filtrar resultados sin ID
    );

    const responseData = {
      videos, // Array de videos
      totalResults: data.pageInfo?.totalResults || videos.length,
      nextPageToken: data.nextPageToken
    };

    // 3. Guardar en Redis con TTL de 10 días
    await redisClient.setex(
      cacheKey,
      864000, // 10 días
      JSON.stringify({
        query: q,
        results: videos,
        cachedAt: new Date().toISOString(),
        ttl: 864000
      })
    );

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
 * 🏆 Prioriza canales oficiales sobre re-uploads de fans.
 * VEVO > YouTube Music Topic > resto.
 */
function getOfficialScore(channel: string): number {
  if (!channel) return 0;
  const ch = channel.toLowerCase();
  if (ch.includes('vevo')) return 3;
  if (ch.endsWith('- topic') || ch.endsWith(' topic')) return 2;
  return 0;
}

function sortByOfficialChannel(videos: any[]): any[] {
  return [...videos].sort((a, b) => {
    return getOfficialScore(b.channel) - getOfficialScore(a.channel);
  });
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

// Override: GET /api/queue/:barId/now-playing - Proxy to get currently playing song
app.get('/api/queue/:barId/now-playing', async (req, res) => {
  try {
    const { barId } = req.params;
    log('🔄 Proxying now-playing request to queue-service', { barId });
    const response = await axios.get(`${QUEUE_SERVICE_URL}/api/queue/${barId}/now-playing`, {
      timeout: 10000
    });
    return res.json(response.data);
  } catch (error: any) {
    log('❌ Now-playing proxy error:', error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: true, data: null, message: 'No song currently playing' }
    );
  }
});

// Override: POST /api/queue/:barId/pop - Proxy skip/next to queue-service
app.post('/api/queue/:barId/pop', async (req, res) => {
  try {
    const { barId } = req.params;
    log('🔄 Proxying pop/skip request to queue-service', { barId });
    const response = await axios.post(`${QUEUE_SERVICE_URL}/api/queue/${barId}/pop`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return res.json(response.data);
  } catch (error: any) {
    log('❌ Pop/skip proxy error:', error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: 'Queue service unavailable' }
    );
  }
});

// Override: POST /api/player/:barId/skip - Alias for pop (admin compatibility)
app.post('/api/player/:barId/skip', async (req, res) => {
  try {
    const { barId } = req.params;
    log('🔄 Proxying player skip to queue-service pop', { barId });
    const response = await axios.post(`${QUEUE_SERVICE_URL}/api/queue/${barId}/pop`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return res.json(response.data);
  } catch (error: any) {
    log('❌ Player skip proxy error:', error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: 'Queue service unavailable' }
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


/**
 * 📊 Endpoint de Estadísticas de Caché
 */
app.get('/api/cache/stats', async (req, res) => {
  try {
    const hits = parseInt(await redisClient.get('cache:hits') || '0');
    const misses = parseInt(await redisClient.get('cache:misses') || '0');
    const cronCost = parseInt(await redisClient.get('cron:last_cost') || '0');
    const cronLastRun = await redisClient.get('cron:last_run') || 'Never';

    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;

    // Quota real: (misses × 100) + costo del cron ejecutado
    const quotaUsed = (misses * 100) + cronCost;

    res.json({
      success: true,
      today: {
        hits,
        misses,
        total,
        hitRate: parseFloat(hitRate.toFixed(1)),
        quotaUsed,
        quotaLimit: 10000,
        quotaRemaining: 10000 - quotaUsed,
        cronLastRun,
        cronCost
      }
    });
  } catch (error: any) {
    log('❌ Error getting cache stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error retrieving cache statistics'
    });
  }
});

/**
 * 🔄 Cron: Reset diario de contadores (23:59)
 */
cron.schedule('59 23 * * *', async () => {
  try {
    await redisClient.set('cache:hits', '0');
    await redisClient.set('cache:misses', '0');
    log('📊 Contadores de caché reseteados');
  } catch (error: any) {
    log('❌ Error resetting cache counters:', error.message);
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
