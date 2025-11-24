import { Request, Response } from 'express';
import { enhancedYouTubeService, YouTubeSearchResult } from '../services/enhancedYouTubeService';
import logger from '@shared/utils/logger';

export class MusicController {
  /**
   * Buscar música en YouTube
   */
  static async searchMusic(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, barId } = req.query;
      const {
        maxResults = 20,
        order = 'relevance',
        safeSearch = 'moderate'
      } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Query parameter "q" is required'
        });
        return;
      }

      if (!barId || typeof barId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'barId parameter is required'
        });
        return;
      }

      logger.info(`Searching YouTube for: "${query}" in bar ${barId}`);

      const results = await enhancedYouTubeService.searchVideos(query, {
        maxResults: parseInt(maxResults as string) || 20,
        order: order as 'relevance' | 'date' | 'rating' | 'title' | 'videoCount' | 'viewCount',
        safeSearch: safeSearch as 'moderate' | 'none' | 'strict',
        barId
      });

      // Formatear respuesta según especificación
      const formattedResults = results.map(result => ({
        videoId: result.videoId,
        title: result.title,
        thumbnail: result.thumbnail,
        duration: result.duration,
        isPremium: result.isPremium || false
      }));

      res.json({
        success: true,
        data: formattedResults,
        meta: {
          query,
          barId,
          totalResults: formattedResults.length,
          cached: false // TODO: implementar indicador de caché
        }
      });

    } catch (error) {
      logger.error('Error searching music:', error);
      res.status(500).json({
        success: false,
        message: 'Error searching music'
      });
    }
  }

  /**
   * Obtener detalles de un video específico
   */
  static async getVideoDetails(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;

      if (!videoId) {
        res.status(400).json({
          success: false,
          message: 'videoId parameter is required'
        });
        return;
      }

      const details = await enhancedYouTubeService.getVideoDetails([videoId]);

      if (details.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Video not found'
        });
        return;
      }

      const video = details[0];

      res.json({
        success: true,
        data: {
          videoId: video.videoId,
          title: video.title,
          thumbnail: video.thumbnail,
          duration: video.duration,
          channelTitle: video.channelTitle,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          publishedAt: video.publishedAt,
          isPremium: false // TODO: implementar lógica de premium
        }
      });

    } catch (error) {
      logger.error('Error getting video details:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting video details'
      });
    }
  }

  /**
   * Verificar disponibilidad de un video
   */
  static async checkVideoAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;

      if (!videoId) {
        res.status(400).json({
          success: false,
          message: 'videoId parameter is required'
        });
        return;
      }

      const available = await enhancedYouTubeService.isVideoAvailable(videoId);

      res.json({
        success: true,
        data: {
          videoId,
          available
        }
      });

    } catch (error) {
      logger.error('Error checking video availability:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking video availability'
      });
    }
  }

  /**
   * Obtener sugerencias de búsqueda
   */
  static async getSearchSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { q: query } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Query parameter "q" is required'
        });
        return;
      }

      const suggestions = await enhancedYouTubeService.getSearchSuggestions(query);

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      logger.error('Error getting search suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting search suggestions'
      });
    }
  }

  /**
   * Limpiar caché de búsquedas
   */
  static async clearSearchCache(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;

      await enhancedYouTubeService.clearSearchCache(query as string);

      res.json({
        success: true,
        message: 'Search cache cleared successfully'
      });

    } catch (error) {
      logger.error('Error clearing search cache:', error);
      res.status(500).json({
        success: false,
        message: 'Error clearing search cache'
      });
    }
  }

  /**
   * Obtener estadísticas de la API de YouTube
   */
  static async getApiStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await enhancedYouTubeService.getApiStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting API stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting API stats'
      });
    }
  }
}