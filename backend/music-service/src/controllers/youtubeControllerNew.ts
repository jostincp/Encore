import { Request, Response } from 'express';
import { youtubeService } from '../services/youtubeServiceNew';
import logger from '../../../shared/utils/logger';

export class YouTubeController {
  /**
   * Search YouTube videos
   * GET /api/music/youtube/search?q=query
   */
  static async search(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;

      // Validate query parameter
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Query parameter "q" is required and must be a string'
        });
        return;
      }

      // Validate query length
      if (q.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Query parameter cannot be empty'
        });
        return;
      }

      if (q.length > 100) {
        res.status(400).json({
          success: false,
          message: 'Query parameter is too long (max 100 characters)'
        });
        return;
      }

      logger.info(`🔍 YouTube search request: "${q}"`);

      // Search videos using YouTube service
      const videos = await youtubeService.searchVideos(q);

      // Return successful response
      res.json({
        success: true,
        data: {
          query: q,
          results: videos.length,
          videos
        },
        message: `Found ${videos.length} videos for "${q}"`
      });

    } catch (error) {
      logger.error('❌ YouTube search controller error:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('quota exceeded')) {
          res.status(503).json({
            success: false,
            message: 'YouTube API quota exceeded. Please try again later.',
            error_code: 'QUOTA_EXCEEDED'
          });
          return;
        }

        if (error.message.includes('Invalid YouTube API key')) {
          res.status(500).json({
            success: false,
            message: 'Service configuration error. Please contact administrator.',
            error_code: 'INVALID_API_KEY'
          });
          return;
        }

        if (error.message.includes('Failed to search YouTube videos')) {
          res.status(502).json({
            success: false,
            message: 'Unable to connect to YouTube service. Please try again later.',
            error_code: 'YOUTUBE_SERVICE_ERROR'
          });
          return;
        }
      }

      // Generic error response
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred while searching videos',
        error_code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get video details by ID
   * GET /api/music/youtube/video/:id
   */
  static async getVideoDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate video ID
      if (!id || typeof id !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Video ID is required'
        });
        return;
      }

      logger.info(`🎥 YouTube video details request: ${id}`);

      // Get video details
      const video = await youtubeService.getVideoDetails(id);

      if (!video) {
        res.status(404).json({
          success: false,
          message: 'Video not found',
          error_code: 'VIDEO_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: video,
        message: 'Video details retrieved successfully'
      });

    } catch (error) {
      logger.error(`❌ YouTube video details controller error for ${req.params.id}:`, error);

      res.status(500).json({
        success: false,
        message: 'Failed to get video details',
        error_code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get trending music videos
   * GET /api/music/youtube/trending?region=US
   */
  static async getTrending(req: Request, res: Response): Promise<void> {
    try {
      const { region } = req.query;

      // Validate region parameter
      if (region && typeof region !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Region parameter must be a string'
        });
        return;
      }

      logger.info(`🔥 YouTube trending request for region: ${region || 'default'}`);

      // Get trending videos
      const videos = await youtubeService.getTrendingMusic(region as string);

      res.json({
        success: true,
        data: {
          region: region || 'US',
          results: videos.length,
          videos
        },
        message: `Retrieved ${videos.length} trending videos`
      });

    } catch (error) {
      logger.error('❌ YouTube trending controller error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to get trending videos',
        error_code: 'INTERNAL_ERROR'
      });
    }
  }
}

export default YouTubeController;
