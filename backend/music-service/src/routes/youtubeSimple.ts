import express from 'express';
import axios from 'axios';
import logger from '@shared/utils/logger';

const router = express.Router();

// Configuración desde variables de entorno
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Verificar que la API key esté configurada
if (!YOUTUBE_API_KEY) {
  logger.error('YouTube API key not configured in environment variables');
}

/**
 * 🔍 Búsqueda simple de YouTube
 * GET /api/youtube/search?q={query}&maxResults={number}
 */
router.get('/search', async (req, res) => {
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

    logger.info('🎵 Searching YouTube', { query: q, maxResults, type });

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

    logger.info('✅ YouTube search completed', { 
      query: q, 
      results: videos.length,
      totalResults: response.data.pageInfo?.totalResults 
    });

    res.json({
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
    logger.error('❌ YouTube search error:', error);
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'YouTube API quota exceeded or invalid API key'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to search YouTube',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🎵 Obtener detalles de un video específico
 * GET /api/youtube/video/{videoId}
 */
router.get('/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    logger.info('🎵 Getting YouTube video details', { videoId });

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

    logger.info('✅ YouTube video details retrieved', { videoId, title: videoDetails.title });

    res.json({
      success: true,
      data: videoDetails
    });

  } catch (error) {
    logger.error('❌ YouTube video details error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get video details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🎵 Tendencias de música por región
 * GET /api/youtube/trending?regionCode={code}
 */
router.get('/trending', async (req, res) => {
  try {
    const { regionCode = 'US' } = req.query;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    logger.info('🎵 Getting YouTube trending music', { regionCode });

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

    logger.info('✅ YouTube trending music retrieved', { 
      regionCode, 
      results: videos.length 
    });

    res.json({
      success: true,
      data: {
        videos,
        regionCode,
        totalResults: response.data.pageInfo?.totalResults || 0
      }
    });

  } catch (error) {
    logger.error('❌ YouTube trending error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get trending music',
      error: error instanceof Error ? error.message : 'Unknown error'
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
 * Health check del servicio YouTube
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'youtube-simple',
    status: 'healthy',
    apiKey: YOUTUBE_API_KEY ? 'configured' : 'missing',
    timestamp: new Date().toISOString()
  });
});

export default router;
