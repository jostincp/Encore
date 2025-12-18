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

// Legacy alias for clients expecting /api/music/youtube/search
app.get('/api/music/youtube/search', async (req, res) => {
  try {
    const { q: query, maxResults = 25 } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query parameter is required' });
    }
    const results = await searchYouTube(String(query), parseInt(maxResults));
    return res.json(results);
  } catch (error) {
    logger.error('Error searching YouTube (legacy path):', error);
    return res.status(500).json({ success: false, message: 'Error searching for songs' });
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

app.get('/api/youtube/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
      params: {
        key: YOUTUBE_API_KEY,
        part: 'snippet,contentDetails',
        id: videoId
      }
    });

    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const video = response.data.items[0];
    const details = {
      id: video.id,
      title: video.snippet.title,
      artist: extractArtist(video.snippet.title),
      thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      duration: video.contentDetails?.duration,
      durationSeconds: parseYouTubeDuration(video.contentDetails?.duration)
    };

    return res.json({ success: true, data: details });
  } catch (error) {
    logger.error('Error getting video details:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Failed to get video details' });
  }
});

// In-memory queue (development fallback)
const devQueue = {};
const devPoints = {}; // { [barId]: { [table]: number } }
const devSSE = {}; // { [barId]: Set<res> }
const devPlayer = {}; // { [barId]: { currentId, timer } }

function ensurePoints(barId, table) {
  if (!devPoints[barId]) devPoints[barId] = {};
  if (!devPoints[barId][table]) devPoints[barId][table] = 100;
}

function broadcast(barId, event, data) {
  const clients = devSSE[barId];
  if (!clients) return;
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

function parseYouTubeDuration(iso) {
  try {
    const m = iso?.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
    const minutes = Number(m?.[1] || 0);
    const seconds = Number(m?.[2] || 0);
    return minutes * 60 + seconds || 180;
  } catch { return 180; }
}

app.post('/api/queue/:barId/add', (req, res) => {
  const barId = req.params.barId;
  const { song_id, priority_play = false, points_used = 0, table = '1', cost } = req.body || {};
  if (!song_id || typeof song_id !== 'string') {
    return res.status(400).json({ success: false, message: 'song_id is required' });
  }
  if (!devQueue[barId]) devQueue[barId] = [];
  // Duplicate prevention: pending entry with same song_id
  const exists = devQueue[barId].some(e => e.song_id === song_id && e.status === 'pending');
  if (exists) {
    return res.status(409).json({ success: false, message: 'Song already in queue' });
  }
  // Points handling
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
    points_used: Number(points_used) || 0,
    status: 'pending',
    requested_at: new Date().toISOString()
  };
  if (priority_play) {
    const idx = devQueue[barId].findIndex(e => e.status === 'pending');
    if (idx === -1) devQueue[barId].push(entry); else devQueue[barId].splice(idx, 0, entry);
  } else {
    devQueue[barId].push(entry);
  }
  broadcast(barId, 'queueUpdate', { data: devQueue[barId] });
  broadcast(barId, 'pointsUpdate', { table, points: devPoints[barId][table] });
  return res.status(201).json({ success: true, data: entry });
});

app.get('/api/queue/bars/:barId', (req, res) => {
  const barId = req.params.barId;
  const items = devQueue[barId] || [];
  return res.json({ success: true, data: items, total: items.length });
});

// Legacy alias for clients expecting /api/music/queue/:barId
app.get('/api/music/queue/:barId', (req, res) => {
  const barId = req.params.barId;
  const items = devQueue[barId] || [];
  return res.json({ success: true, data: items, total: items.length });
});

// SSE events per bar
app.get('/events/:barId', (req, res) => {
  const barId = req.params.barId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (!devSSE[barId]) devSSE[barId] = new Set();
  devSSE[barId].add(res);
  req.on('close', () => { try { devSSE[barId].delete(res); } catch {} });
  broadcast(barId, 'queueUpdate', { data: devQueue[barId] || [] });
});

// Points endpoints
app.get('/api/points/:barId/:table', (req, res) => {
  const { barId, table } = req.params;
  ensurePoints(barId, table);
  return res.json({ success: true, data: { points: devPoints[barId][table] } });
});

// Player controls (guest)
app.post('/api/player/:barId/skip', async (req, res) => {
  const { barId } = req.params;
  const q = devQueue[barId] || [];
  const playing = q.find(e => e.status === 'playing');
  if (!playing) return res.status(400).json({ success: false, message: 'No song playing' });
  playing.status = 'completed';
  broadcast(barId, 'songCompleted', { entry: playing });
  broadcast(barId, 'queueUpdate', { data: devQueue[barId] });
  await (async () => { const next = q.find(e => e.status === 'pending'); if (next) next.status = 'pending'; })();
  return res.json({ success: true });
});

// Guest testing endpoints
const TEST_BARS = new Set(['test-bar', 'bar-demo']);

app.get('/guest/:barId', (req, res) => {
  const barId = req.params.barId;
  if (!TEST_BARS.has(barId)) {
    return res.status(404).json({ success: false, message: 'Bar not enabled for guest testing' });
  }
  return res.json({
    success: true,
    barId,
    endpoints: {
      search: '/api/youtube/search?q={query}',
      request_get: `/guest/${barId}/request?videoId={youtubeVideoId}`,
      request_post: `/api/queue/${barId}/add`,
      queue_list: `/api/queue/bars/${barId}`
    }
  });
});

app.get('/guest/:barId/request', (req, res) => {
  const barId = req.params.barId;
  if (!TEST_BARS.has(barId)) {
    return res.status(404).json({ success: false, message: 'Bar not enabled for guest testing' });
  }
  const videoId = (req.query.videoId || '').toString();
  if (!videoId) {
    return res.status(400).json({ success: false, message: 'videoId is required' });
  }
  if (!devQueue[barId]) devQueue[barId] = [];
  const exists = devQueue[barId].some(e => e.song_id === videoId && e.status === 'pending');
  if (exists) {
    return res.status(409).json({ success: false, message: 'Song already in queue' });
  }
  const entry = {
    id: String(Date.now()),
    bar_id: barId,
    song_id: videoId,
    priority_play: false,
    points_used: 0,
    status: 'pending',
    requested_at: new Date().toISOString()
  };
  devQueue[barId].push(entry);
  return res.status(201).json({ success: true, data: entry });
});

app.get('/guest/:barId/find-and-request', async (req, res) => {
  const barId = req.params.barId;
  if (!TEST_BARS.has(barId)) {
    return res.status(404).json({ success: false, message: 'Bar not enabled for guest testing' });
  }
  const q = (req.query.q || '').toString();
  const maxResults = parseInt((req.query.maxResults || '5').toString());
  if (!q) {
    return res.status(400).json({ success: false, message: 'q is required' });
  }
  try {
    const searchRes = await searchYouTube(q, maxResults);
    const first = searchRes?.data?.videos?.[0];
    if (!first || !first.id) {
      return res.status(404).json({ success: false, message: 'No results' });
    }
    if (!devQueue[barId]) devQueue[barId] = [];
    const exists = devQueue[barId].some(e => e.song_id === first.id && e.status === 'pending');
    if (exists) {
      return res.status(409).json({ success: false, message: 'Song already in queue', data: { selected: first, query: q } });
    }
    const entry = {
      id: String(Date.now()),
      bar_id: barId,
      song_id: first.id,
      priority_play: false,
      points_used: 0,
      status: 'pending',
      requested_at: new Date().toISOString()
    };
    devQueue[barId].push(entry);
    broadcast(barId, 'queueUpdate', { data: devQueue[barId] });
    return res.status(201).json({ success: true, data: { queued: entry, selected: first, query: q } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to find and request' });
  }
});

app.get('/guest/:barId/ui', (req, res) => {
  const barId = req.params.barId;
  if (!TEST_BARS.has(barId)) {
    return res.status(404).json({ success: false, message: 'Bar not enabled for guest testing' });
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Guest ${barId}</title><style>body{font-family:system-ui,Segoe UI,Arial;padding:24px;background:#0b0b0b;color:#eaeaea}a,button{background:#1f2937;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none;margin-right:8px;border:none;cursor:pointer}input{padding:8px;border-radius:6px;border:1px solid #374151;background:#111827;color:#eaeaea}section{margin-bottom:20px}code{background:#111827;padding:4px 6px;border-radius:4px}</style></head><body><h1>Guest bar: ${barId}</h1><section><h2>Acciones rápidas</h2><div><a href="/api/youtube/search?q=queen&maxResults=3" target="_blank">Buscar: queen</a><a href="/guest/${barId}/request?videoId=fJ9rUzIMcZQ" target="_blank">Pedir: Bohemian Rhapsody</a><a href="/api/queue/bars/${barId}" target="_blank">Ver cola</a></div></section><section><h2>Buscar y pedir</h2><form action="/guest/${barId}/find-and-request" method="get" target="_blank"><input type="text" name="q" placeholder="consulta (ej: queen)" required /><input type="number" name="maxResults" value="5" min="1" max="50" /><button type="submit">Buscar y pedir primera</button></form></section><section><h2>Pedir por ID de YouTube</h2><form action="/guest/${barId}/request" method="get" target="_blank"><input type="text" name="videoId" placeholder="videoId (ej: HgzGwKwLmgM)" required /><button type="submit">Pedir canción</button></form></section><section><h2>Endpoints</h2><div><code>GET /api/youtube/search?q={query}</code></div><div><code>GET /guest/${barId}/request?videoId={youtubeVideoId}</code></div><div><code>GET /guest/${barId}/find-and-request?q={query}&maxResults=5</code></div><div><code>GET /api/queue/bars/${barId}</code></div></section></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
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
