import { Request, Response, NextFunction } from 'express';
import { enhancedSpotifyService, SpotifyError, SpotifyRateLimitError, SpotifyAuthError } from '../services/enhancedSpotifyService';
import { getSpotifyRateLimitStats } from '../middleware/spotifyRateLimiter';
import logger from '../../../shared/utils/logger';

export class SpotifyController {
  /**
   * Buscar tracks en Spotify
   */
  static async searchTracks(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, limit = 20, offset = 0, market = 'US' } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }

      const tracks = await enhancedSpotifyService.searchTracks(q, {
        limit: Math.min(parseInt(limit as string) || 20, 50),
        offset: parseInt(offset as string) || 0,
        market: market as string
      });

      res.json({
        success: true,
        data: tracks,
        meta: {
          query: q,
          total: tracks.length,
          limit: parseInt(limit as string) || 20,
          offset: parseInt(offset as string) || 0
        }
      });
    } catch (error) {
      logger.error('Spotify search error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query.q,
        service: 'music-service'
      });

      if (error instanceof SpotifyRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof SpotifyAuthError) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed with Spotify'
        });
      }

      if (error instanceof SpotifyError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener detalles de un track de Spotify
   */
  static async getTrackDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { trackId } = req.params;

      if (!trackId) {
        return res.status(400).json({
          success: false,
          error: 'Track ID is required'
        });
      }

      const track = await enhancedSpotifyService.getTrackDetails(trackId);

      res.json({
        success: true,
        data: track
      });
    } catch (error) {
      logger.error('Spotify track details error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        trackId: req.params.trackId,
        service: 'music-service'
      });

      if (error instanceof SpotifyRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof SpotifyAuthError) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed with Spotify'
        });
      }

      if (error instanceof SpotifyError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener recomendaciones de Spotify
   */
  static async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        seed_tracks,
        seed_artists,
        seed_genres,
        limit = 20,
        ...audioFeatures
      } = req.query;

      // Convertir audio features a números
      const convertedAudioFeatures: Record<string, number> = {};
      Object.entries(audioFeatures).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            convertedAudioFeatures[key] = numValue;
          }
        }
      });

      const recommendations = await enhancedSpotifyService.getRecommendations(
        seed_tracks ? (seed_tracks as string).split(',') : undefined,
        seed_artists ? (seed_artists as string).split(',') : undefined,
        seed_genres ? (seed_genres as string).split(',') : undefined,
        Object.keys(convertedAudioFeatures).length > 0 ? convertedAudioFeatures : undefined,
        Math.min(parseInt(limit as string) || 20, 50)
      );

      res.json({
        success: true,
        data: recommendations,
        meta: {
          seed_tracks: seed_tracks,
          seed_artists: seed_artists,
          seed_genres: seed_genres,
          limit: parseInt(limit as string) || 20
        }
      });
    } catch (error) {
      logger.error('Spotify recommendations error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
      });

      if (error instanceof SpotifyRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof SpotifyAuthError) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed with Spotify'
        });
      }

      if (error instanceof SpotifyError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener playlists destacadas de Spotify
   */
  static async getFeaturedPlaylists(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 20, country = 'US' } = req.query;

      const playlists = await enhancedSpotifyService.getFeaturedPlaylists(
        Math.min(parseInt(limit as string) || 20, 50),
        country as string
      );

      res.json({
        success: true,
        data: playlists,
        meta: {
          country: country,
          limit: parseInt(limit as string) || 20
        }
      });
    } catch (error) {
      logger.error('Spotify featured playlists error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
      });

      if (error instanceof SpotifyRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof SpotifyAuthError) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed with Spotify'
        });
      }

      if (error instanceof SpotifyError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener nuevos lanzamientos de Spotify
   */
  static async getNewReleases(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 20, country = 'US' } = req.query;

      const albums = await enhancedSpotifyService.getNewReleases(
        Math.min(parseInt(limit as string) || 20, 50),
        country as string
      );

      res.json({
        success: true,
        data: albums,
        meta: {
          country: country,
          limit: parseInt(limit as string) || 20
        }
      });
    } catch (error) {
      logger.error('Spotify new releases error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
      });

      if (error instanceof SpotifyRateLimitError) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.retryAfter
        });
      }

      if (error instanceof SpotifyAuthError) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed with Spotify'
        });
      }

      if (error instanceof SpotifyError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Obtener estadísticas del servicio de Spotify
   */
  static async getServiceStats(req: Request, res: Response, next: NextFunction) {
    try {
      const spotifyStats = enhancedSpotifyService.getMetrics();
      const rateLimitStats = getSpotifyRateLimitStats();

      res.json({
        success: true,
        data: {
          spotify: spotifyStats,
          rateLimiting: rateLimitStats
        }
      });
    } catch (error) {
      logger.error('Error getting Spotify service stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
      });
      next(error);
    }
  }

  /**
   * Invalidar caché de Spotify
   */
  static async invalidateCache(req: Request, res: Response, next: NextFunction) {
    try {
      const { pattern = '*' } = req.query;

      await enhancedSpotifyService.invalidateCache(pattern as string);

      res.json({
        success: true,
        message: `Cache invalidated for pattern: ${pattern}`
      });
    } catch (error) {
      logger.error('Error invalidating Spotify cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pattern: req.query.pattern,
        service: 'music-service'
      });
      next(error);
    }
  }
}

export default SpotifyController;