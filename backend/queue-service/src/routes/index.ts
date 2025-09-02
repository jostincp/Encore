import { Router } from 'express';
import queueRoutes from './queue';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Queue Service is running',
    timestamp: new Date().toISOString(),
    service: 'queue-service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
router.get('/info', (req, res) => {
  res.json({
    success: true,
    service: 'Encore Queue Service',
    description: 'Real-time queue management service with WebSocket support',
    version: process.env.npm_package_version || '1.0.0',
    features: [
      'Real-time queue management',
      'WebSocket notifications',
      'Priority play system',
      'Queue statistics and analytics',
      'User queue position tracking',
      'Admin queue controls',
      'Song cooldown management',
      'Points-based priority system'
    ],
    websocket_events: {
      client_to_server: [
        'join_bar - Join a bar room for real-time updates',
        'leave_bar - Leave a bar room',
        'get_queue_position - Get current position in queue',
        'get_queue_stats - Get queue statistics (admin/bar owner only)'
      ],
      server_to_client: [
        'queue_updated - Queue state changed',
        'song_added - New song added to queue',
        'song_status_changed - Song status updated',
        'queue_reordered - Queue order changed',
        'current_song_changed - Currently playing song changed',
        'queue_cleared - Queue was cleared',
        'user_points_updated - User points balance changed',
        'queue_stats_updated - Queue statistics updated',
        'queue_position_updated - User position in queue changed',
        'error - Error occurred'
      ]
    },
    endpoints: {
      user_routes: {
        'POST /add': 'Add a song to queue',
        'GET /bars/:barId/user': 'Get user queue entries for a bar',
        'GET /bars/:barId/user/position': 'Get user position in queue',
        'DELETE /:id/user': 'Remove own pending song from queue'
      },
      public_routes: {
        'GET /bars/:barId': 'Get current queue for a bar',
        'GET /bars/:barId/current': 'Get currently playing song',
        'GET /bars/:barId/next': 'Get next song in queue'
      },
      admin_routes: {
        'PUT /:id': 'Update queue entry (admin/bar owner)',
        'DELETE /:id': 'Remove song from queue (admin/bar owner)',
        'PATCH /bars/:barId/reorder': 'Reorder queue (admin/bar owner)',
        'DELETE /bars/:barId/clear': 'Clear queue (admin/bar owner)',
        'GET /bars/:barId/stats': 'Get queue statistics (admin/bar owner)',
        'PATCH /bars/:barId/skip': 'Skip current song (admin/bar owner)',
        'PATCH /bars/:barId/next': 'Play next song (admin/bar owner)'
      }
    },
    queue_features: {
      priority_system: {
        description: 'Users can spend points for priority placement',
        cost: process.env.PRIORITY_PLAY_COST || '10 points',
        benefits: 'Songs are placed higher in the queue'
      },
      cooldown_system: {
        description: 'Prevents the same song from being requested too frequently',
        duration: `${process.env.SONG_COOLDOWN_MINUTES || '30'} minutes`,
        scope: 'Per bar, per song'
      },
      user_limits: {
        max_songs_per_user: process.env.MAX_SONGS_PER_USER || '3',
        description: 'Maximum number of songs a user can have in queue simultaneously'
      },
      queue_management: {
        auto_approve: process.env.AUTO_APPROVE_SONGS === 'true',
        max_queue_size: process.env.MAX_QUEUE_SIZE || '100',
        description: 'Automatic song approval and queue size limits'
      }
    },
    rate_limits: {
      general: '100 requests per 15 minutes',
      song_addition: '10 requests per 5 minutes',
      admin_operations: '200 requests per 15 minutes'
    },
    authentication: {
      required_for: [
        'Adding songs to queue',
        'Viewing user-specific queue data',
        'Admin operations',
        'WebSocket connections'
      ],
      token_type: 'JWT Bearer Token',
      header: 'Authorization: Bearer <token>'
    },
    websocket: {
      endpoint: '/socket.io',
      authentication: 'JWT token required',
      rooms: 'Users automatically join bar-specific rooms',
      events: 'Real-time queue updates and notifications'
    },
    caching: {
      redis_keys: [
        'queue:bar:{barId}',
        'queue:current:{barId}',
        'queue:stats:{barId}',
        'cooldown:{barId}:{songId}',
        'queue:position:{barId}:{userId}'
      ],
      ttl: {
        queue_data: '5 minutes',
        current_song: '1 minute',
        stats: '10 minutes',
        cooldown: 'Variable (based on cooldown period)'
      }
    }
  });
});

// Mount queue routes
router.use('/', queueRoutes);

// 404 handler for unknown routes
router.use('*', (req, res) => {
  logger.warn(`Queue Service - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    service: 'queue-service',
    available_endpoints: {
      health: 'GET /health',
      info: 'GET /info',
      queue: 'See /info for detailed queue endpoints'
    }
  });
});

export default router;