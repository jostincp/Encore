import { Request, Response, NextFunction } from 'express';
import { enhancedYouTubeService, YouTubeError, YouTubeRateLimitError, YouTubeQuotaExceededError } from '../services/enhancedYouTubeService';
import logger from '@shared/utils/logger';

export class YouTubeController {
  /**
   * Buscar videos en YouTube
   */
  static async searchVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, maxResults = 25, order = 'relevance', regionCode = 'US' } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }

      const videos = await enhancedYouTubeService.searchVideos(q, {
        maxResults: Math.min(parseInt(maxResults as string) || 25, 50),
        order: order as 'relevance' | 'date' | 'rating' | 'title' | 'videoCount' | 'viewCount',
        regionCode: regionCode as string
      });

      res.json({
        success: true,
        data: videos,
        meta: {
          query: q,
          total: videos.length,
          maxResults: parseInt(maxResults as string) || 25,
          order: order,
          regionCode: regionCode
        }
      });
    } catch (error) {
      logger.error('YouTube search error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query.q,
        service: 'music-service'
      });

      if (error instanceof YouTubeRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof YouTubeQuotaExceededError) {
        return res.status(403).json({
          success: false,
          error: 'YouTube API quota exceeded'
        });
      }

      if (error instanceof YouTubeError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener detalles de un video de YouTube
   */
  static async getVideoDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { videoId } = req.params;

      if (!videoId) {
        return res.status(400).json({
          success: false,
          error: 'Video ID is required'
        });
      }

      const video = await enhancedYouTubeService.getVideoDetails(videoId);

      res.json({
        success: true,
        data: video
      });
    } catch (error) {
      logger.error('YouTube video details error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId: req.params.videoId,
        service: 'music-service'
      });

      if (error instanceof YouTubeRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof YouTubeQuotaExceededError) {
        return res.status(403).json({
          success: false,
          error: 'YouTube API quota exceeded'
        });
      }

      if (error instanceof YouTubeError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener videos trending de YouTube
   */
  static async getTrendingVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const { regionCode = 'US', maxResults = 25 } = req.query;

      const videos = await enhancedYouTubeService.getTrendingMusic(
        regionCode as string,
        Math.min(parseInt(maxResults as string) || 25, 50)
      );

      res.json({
        success: true,
        data: videos,
        meta: {
          regionCode: regionCode,
          maxResults: parseInt(maxResults as string) || 25
        }
      });
    } catch (error) {
      logger.error('YouTube trending videos error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        regionCode: req.query.regionCode,
        service: 'music-service'
      });

      if (error instanceof YouTubeRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof YouTubeQuotaExceededError) {
        return res.status(403).json({
          success: false,
          error: 'YouTube API quota exceeded'
        });
      }

      if (error instanceof YouTubeError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener videos de un canal específico
   */
  static async getChannelVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const { channelId } = req.params;
      const { maxResults = 25 } = req.query;

      if (!channelId) {
        return res.status(400).json({
          success: false,
          error: 'Channel ID is required'
        });
      }

      const videos = await enhancedYouTubeService.getChannelVideos(
        channelId,
        Math.min(parseInt(maxResults as string) || 25, 50)
      );

      res.json({
        success: true,
        data: videos,
        meta: {
          channelId: channelId,
          maxResults: parseInt(maxResults as string) || 25
        }
      });
    } catch (error) {
      logger.error('YouTube channel videos error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channelId: req.params.channelId,
        service: 'music-service'
      });

      if (error instanceof YouTubeRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof YouTubeQuotaExceededError) {
        return res.status(403).json({
          success: false,
          error: 'YouTube API quota exceeded'
        });
      }

      if (error instanceof YouTubeError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener estadísticas del servicio de YouTube
   */
  static async getServiceStats(req: Request, res: Response, next: NextFunction) {
    try {
      const youtubeStats = enhancedYouTubeService.getMetrics();

      res.json({
        success: true,
        data: youtubeStats
      });
    } catch (error) {
      logger.error('Error getting YouTube service stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
      });
      next(error);
    }
  }

  /**
   * Invalidar caché de YouTube
   */
  static async invalidateCache(req: Request, res: Response, next: NextFunction) {
    try {
      const { pattern = '*' } = req.query;

      await enhancedYouTubeService.invalidateCache(pattern as string);

      res.json({
        success: true,
        message: `Cache invalidated for pattern: ${pattern}`
      });
    } catch (error) {
      logger.error('Error invalidating YouTube cache', {
        pattern: req.query.pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
      });
      next(error);
    }
  }
}

export default YouTubeController;