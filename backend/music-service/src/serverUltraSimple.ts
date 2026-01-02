
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
 * 🎵 Sistema de Cola (In-Memory legacy para dev)
 */
const devQueue: Record<string, any[]> = {};
const devPoints: Record<string, Record<string, number>> = {};

function ensurePoints(barId: string, table: string) {
  if (!devPoints[barId]) devPoints[barId] = {};
  if (!devPoints[barId][table]) devPoints[barId][table] = 100;
}

app.post('/api/queue/:barId/add', (req, res) => {
  const barId = req.params.barId;
  const { song_id, priority_play = false, points_used = 0, table = '1', cost } = req.body || {};

  if (!song_id) return res.status(400).json({ success: false, message: 'song_id is required' });

  if (!devQueue[barId]) devQueue[barId] = [];

  const exists = devQueue[barId].some(e => e.song_id === song_id && e.status === 'pending');
  if (exists) return res.status(409).json({ success: false, message: 'Song already in queue' });

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

  if (priority_play) {
    const idx = devQueue[barId].findIndex(e => e.status === 'pending');
    if (idx === -1) devQueue[barId].push(entry);
    else devQueue[barId].splice(idx, 0, entry);
  } else {
    devQueue[barId].push(entry);
  }

  log('✅ Song added to queue', { barId, song_id });

  redisClient.publish('queue:events', JSON.stringify({
    barId,
    eventType: 'queue_updated',
    data: { type: 'song_added', entry, queueLength: devQueue[barId].length }
  })).catch(err => log('❌ Redis publish error:', err));

  return res.status(201).json({ success: true, data: entry });
});

app.get('/api/queue/:barId', (req, res) => {
  const barId = req.params.barId;
  const items = devQueue[barId] || [];
  return res.json({ success: true, data: items, total: items.length });
});

app.get('/api/queue/bars/:barId', (req, res) => {
  const barId = req.params.barId;
  const items = devQueue[barId] || [];
  return res.json({ success: true, data: items, total: items.length });
});

app.get('/api/points/:barId/:table', (req, res) => {
  const { barId, table } = req.params;
  ensurePoints(barId, table);
  return res.json({ success: true, data: { points: devPoints[barId][table] } });
});

app.post('/api/player/:barId/skip', (req, res) => {
  const { barId } = req.params;
  const q = devQueue[barId] || [];
  const currentSong = q.find(e => e.status === 'playing') || q.find(e => e.status === 'pending');

  if (!currentSong) return res.status(400).json({ success: false, message: 'No hay canciones en la cola' });

  currentSong.status = 'completed';
  const index = devQueue[barId].indexOf(currentSong);
  if (index > -1) devQueue[barId].splice(index, 1);

  log('⏭️  Song skipped', { barId, songId: currentSong.song_id });

  redisClient.publish('queue:events', JSON.stringify({
    barId,
    eventType: 'queue_updated',
    data: { type: 'song_skipped', skippedSongId: currentSong.song_id, queueLength: devQueue[barId].length }
  })).catch(err => log('❌ Redis publish error:', err));

  return res.json({ success: true, skippedSong: currentSong.song_id, remainingInQueue: devQueue[barId].length });
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
