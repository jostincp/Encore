import { Router } from 'express';
import songRoutes from './songs';
import queueRoutes from './queue';
import recommendationRoutes from './recommendations';
import musicRoutes from './music';
import { Request, Response } from 'express';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'music-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API info endpoint
router.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'music-service',
    description: 'Encore Music Service - Handles song management, external API integrations, and queue management',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      songs: {
        base: '/api/songs',
        description: 'Song management and external API integration',
        routes: {
          'GET /search': 'Search songs with filters',
          'GET /:id': 'Get song by ID',
          'GET /popular/list': 'Get popular songs',
          'GET /recent/list': 'Get recently added songs',
          'GET /external/youtube/search': 'Search YouTube (auth required)',
          'GET /external/youtube/:videoId': 'Get YouTube video details (auth required)',
          'GET /external/youtube/trending/music': 'Get trending YouTube music (auth required)',
          'GET /external/spotify/search': 'Search Spotify (auth required)',
          'GET /external/spotify/:trackId': 'Get Spotify track details (auth required)',
          'GET /external/spotify/featured/playlists': 'Get Spotify featured playlists (auth required)',
          'GET /external/spotify/new-releases': 'Get Spotify new releases (auth required)',
          'POST /': 'Create song (admin only)',
          'PUT /:id': 'Update song (admin only)',
          'DELETE /:id': 'Delete song (admin only)',
          'POST /import': 'Import song from external service (auth required)',
          'PATCH /:id/unavailable': 'Mark song as unavailable (auth required)',
          'PATCH /:id/available': 'Mark song as available (auth required)'
        }
      },
      queue: {
        base: '/api/queue',
        description: 'Music queue management for bars',
        routes: {
          'POST /add': 'Add song to queue (auth required)',
          'GET /bars/:barId': 'Get queue for bar (public)',
          'GET /bars/:barId/current': 'Get currently playing song (public)',
          'GET /bars/:barId/next': 'Get next song in queue (public)',
          'GET /bars/:barId/user': 'Get user\'s queue entries (auth required)',
          'GET /bars/:barId/user/position': 'Get user\'s position in queue (auth required)',
          'PUT /:id': 'Update queue entry (admin/bar_owner)',
          'DELETE /:id': 'Remove song from queue (auth required)',
          'DELETE /:id/user': 'Remove user\'s own song (auth required)',
          'PATCH /bars/:barId/reorder': 'Reorder queue (admin/bar_owner)',
          'DELETE /bars/:barId/clear': 'Clear queue (admin/bar_owner)',
          'GET /bars/:barId/stats': 'Get queue statistics (admin/bar_owner)',
          'PATCH /bars/:barId/skip': 'Skip current song (admin/bar_owner)',
          'PATCH /bars/:barId/next': 'Play next song (admin/bar_owner)'
        }
      },
      recommendations: {
        base: '/api/recommendations',
        description: 'AI-powered music recommendation system',
        routes: {
          'GET /personalized': 'Get personalized recommendations (auth required)',
          'GET /popular/:barId': 'Get popular recommendations for bar (public)',
          'GET /similar/:songId': 'Get similar songs (public)',
          'GET /trending': 'Get trending music recommendations (public)',
          'GET /genres': 'Get available genres (public)',
          'POST /refresh': 'Clear recommendation cache (auth required)'
        }
      },
      health: {
        base: '/api/health',
        description: 'Service health check'
      },
      info: {
        base: '/api/info',
        description: 'Service information and available endpoints'
      }
    },
    external_integrations: {
      youtube: {
        description: 'YouTube Data API v3 integration',
        features: ['Search videos', 'Get video details', 'Get trending music', 'Validate video IDs']
      },
      spotify: {
        description: 'Spotify Web API integration',
        features: ['Search tracks', 'Get track details', 'Get artist details', 'Get playlists', 'Get new releases', 'Get recommendations']
      }
    },
    features: {
      song_management: {
        description: 'Complete song lifecycle management',
        capabilities: ['CRUD operations', 'Search and filtering', 'Popularity tracking', 'Availability management']
      },
      queue_management: {
        description: 'Real-time music queue management',
        capabilities: ['Add to queue', 'Priority play', 'Queue reordering', 'Status tracking', 'Statistics']
      },
      external_apis: {
        description: 'Integration with music streaming services',
        capabilities: ['YouTube search and details', 'Spotify search and details', 'Trending music', 'Import songs']
      },
      caching: {
        description: 'Redis-based caching for external API responses',
        capabilities: ['Response caching', 'Rate limit optimization', 'Performance improvement']
      },
      recommendations: {
        description: 'AI-powered music recommendation engine',
        capabilities: ['Personalized recommendations', 'Popular songs by bar', 'Similar song discovery', 'Trending music', 'User preference analysis']
      }
    },
    rate_limits: {
      general: '200 requests per 15 minutes',
      search: '100 requests per 15 minutes',
      external_api: '50 requests per 15 minutes',
      queue_add: '10 requests per minute',
      queue_remove: '20 requests per minute',
      queue_admin: '100 requests per hour',
      create: '20 requests per hour',
      update: '50 requests per hour',
      delete: '10 requests per hour',
      import: '30 requests per hour'
    }
  });
});

// Mount route modules
router.use('/songs', songRoutes);
router.use('/queue', queueRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/music', musicRoutes);

export default router;