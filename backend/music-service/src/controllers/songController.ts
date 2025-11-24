import { Request, Response } from 'express';
import { SongModel, CreateSongData, UpdateSongData, SongSearchFilters } from '../models/Song';
import { YouTubeService } from '../services/youtubeService';
import { SpotifyService } from '../services/spotifyService';
import { enhancedYouTubeService } from '../services/enhancedYouTubeService';
import { asyncHandler } from '@shared/utils/errors';
import logger from '@shared/utils/logger';
import { validatePaginationParams } from '@shared/utils/validation';
import { AuthenticatedRequest } from '@shared/types/auth';

export class SongController {
  private static sanitizeString(value: string): string {
    return value.trim().replace(/[<>]/g, '');
  }

  private static isValidText(value: string, maxLength: number = 500): boolean {
    const v = value.trim();
    return v.length > 0 && v.length <= maxLength;
  }

  private static isValidId(value: string): boolean {
    return /^[a-fA-F0-9]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
  // Create a new song
  static async createSong(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const songData: CreateSongData = req.body;
      
      // Sanitizar y validar datos de entrada
      if (songData.title) {
        songData.title = SongController.sanitizeString(songData.title);
        if (!SongController.isValidText(songData.title)) {
          res.status(400).json({
            success: false,
            message: 'Título de canción inválido'
          });
          return;
        }
      }
      
      if (songData.artist) {
        songData.artist = SongController.sanitizeString(songData.artist);
        if (!SongController.isValidText(songData.artist)) {
          res.status(400).json({
            success: false,
            message: 'Nombre de artista inválido'
          });
          return;
        }
      }
      
      if (songData.genre) {
        songData.genre = SongController.sanitizeString(songData.genre);
      }
      
      // Validate external IDs if provided
      if (songData.youtube_id) {
        songData.youtube_id = SongController.sanitizeString(songData.youtube_id);
        
        const isValidYouTube = await YouTubeService.validateVideoId(songData.youtube_id);
        if (!isValidYouTube) {
          res.status(400).json({
            success: false,
            message: 'Video de YouTube no encontrado o inválido'
          });
          return;
        }
      }
      
      if (songData.spotify_id) {
        songData.spotify_id = SongController.sanitizeString(songData.spotify_id);
        
        const isValidSpotify = await SpotifyService.validateTrackId(songData.spotify_id);
        if (!isValidSpotify) {
          res.status(400).json({
            success: false,
            message: 'Track de Spotify no encontrado o inválido'
          });
          return;
        }
      }
      
      const song = await SongModel.create(songData);
      
      logger.info('Song created via API', {
        songId: song.id,
        title: song.title,
        userId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(201).json({
        success: true,
        data: song
      });
    } catch (error) {
      logger.error('Failed to create song', { error, userId: req.user?.userId, ip: req.ip });
      res.status(500).json({
        success: false,
        message: 'Failed to create song'
      });
    }
  }
  
  // Get song by ID
  static async getSongById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Validar y sanitizar ID
      const sanitizedId = SongController.sanitizeString(id);
      if (!SongController.isValidId(sanitizedId)) {
        res.status(400).json({
          success: false,
          message: 'ID de canción inválido'
        });
        return;
      }
      
      const song = await SongModel.findById(sanitizedId);
      
      if (!song) {
        logger.warn('Song not found', { songId: sanitizedId, ip: req.ip });
        res.status(404).json({
          success: false,
          message: 'Canción no encontrada'
        });
        return;
      }
      
      res.json({
        success: true,
        data: song
      });
    } catch (error) {
      logger.error('Failed to get song', { error, songId: req.params.id, ip: req.ip });
      res.status(500).json({
        success: false,
        message: 'Error al obtener la canción'
      });
    }
  }
  
  // Search songs
  static async searchSongs(req: Request, res: Response): Promise<void> {
    try {
      const {
        q: query,
        source,
        genre,
        duration_min,
        duration_max,
        available_only,
        sort_by,
        sort_order,
        page = 1,
        limit = 25
      } = req.query;
      
      const { offset, validatedLimit } = validatePaginationParams(
        parseInt(page as string),
        parseInt(limit as string)
      );
      
      const filters: SongSearchFilters = {};
      
      // Sanitizar y validar parámetros de búsqueda
      if (query) {
        const sanitizedQuery = SongController.sanitizeString(query as string);
        if (!SongController.isValidText(sanitizedQuery)) {
          res.status(400).json({
            success: false,
            message: 'Término de búsqueda inválido'
          });
          return;
        }
        filters.query = sanitizedQuery;
      }
      
      if (source) {
        const sanitizedSource = SongController.sanitizeString(source as string);
        if (!['youtube', 'spotify', 'both'].includes(sanitizedSource)) {
          res.status(400).json({
            success: false,
            message: 'Fuente de búsqueda inválida'
          });
          return;
        }
        filters.source = sanitizedSource as 'youtube' | 'spotify' | 'both';
      }
      
      if (genre) {
        const sanitizedGenre = SongController.sanitizeString(genre as string);
        if (SongController.isValidText(sanitizedGenre)) {
          filters.genre = sanitizedGenre;
        }
      }
      
      if (duration_min) {
        const durationMin = parseInt(duration_min as string);
        if (!isNaN(durationMin) && durationMin >= 0) {
          filters.duration_min = durationMin;
        }
      }
      
      if (duration_max) {
        const durationMax = parseInt(duration_max as string);
        if (!isNaN(durationMax) && durationMax > 0) {
          filters.duration_max = durationMax;
        }
      }
      
      if (available_only) filters.available_only = available_only === 'true';
      
      if (sort_by) {
        const validSortFields = ['popularity', 'title', 'artist', 'duration', 'created_at'];
        if (validSortFields.includes(sort_by as string)) {
          filters.sort_by = sort_by as 'popularity' | 'title' | 'artist' | 'duration' | 'created_at';
        }
      }
      
      if (sort_order) {
        if (['asc', 'desc'].includes(sort_order as string)) {
          filters.sort_order = sort_order as 'asc' | 'desc';
        }
      }
      
      const result = await SongModel.search(filters, validatedLimit, offset);
      
      logger.info('Song search performed', {
        query: filters.query,
        source: filters.source,
        resultsCount: result.items.length,
        ip: req.ip
      });
      
      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: parseInt(page as string),
          limit: validatedLimit,
          total: result.total,
          pages: Math.ceil(result.total / validatedLimit)
        }
      });
    } catch (error) {
      logger.error('Failed to search songs', { error, ip: req.ip });
      res.status(500).json({
        success: false,
        message: 'Error al buscar canciones'
      });
    }
  }
  
  // Update song
  static async updateSong(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateSongData = req.body;
      
      // Validate external IDs if provided
      if (updateData.youtube_id) {
        const isValidYouTube = await YouTubeService.validateVideoId(updateData.youtube_id);
        if (!isValidYouTube) {
          res.status(400).json({
            success: false,
            message: 'Invalid YouTube video ID'
          });
          return;
        }
      }
      
      if (updateData.spotify_id) {
        const isValidSpotify = await SpotifyService.validateTrackId(updateData.spotify_id);
        if (!isValidSpotify) {
          res.status(400).json({
            success: false,
            message: 'Invalid Spotify track ID'
          });
          return;
        }
      }
      
      const song = await SongModel.update(id, updateData);
      
      if (!song) {
        res.status(404).json({
          success: false,
          message: 'Song not found'
        });
        return;
      }
      
      logger.info('Song updated via API', {
        songId: id,
        updatedFields: Object.keys(updateData),
        userId: req.user?.userId
        });
      
      res.json({
        success: true,
        data: song
      });
    } catch (error) {
      logger.error('Failed to update song', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update song'
      });
    }
  }
  
  // Delete song
  static async deleteSong(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const deleted = await SongModel.delete(id);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Song not found'
        });
        return;
      }
      
      logger.info('Song deleted via API', {
        songId: id,
        userId: req.user?.userId
      });
      
      res.json({
        success: true,
        message: 'Song deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete song', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete song'
      });
    }
  }
  
  // Get popular songs
  static async getPopularSongs(req: Request, res: Response): Promise<void> {
    try {
      const {
        genre,
        days = 30,
        page = 1,
        limit = 25
      } = req.query;
      
      const { offset, validatedLimit } = validatePaginationParams(
        parseInt(page as string),
        parseInt(limit as string)
      );
      
      const songs = await SongModel.getPopularSongs(
        parseInt(days as string),
        genre as string,
        validatedLimit,
        offset
      );
      
      res.json({
        success: true,
        data: songs
      });
    } catch (error) {
      logger.error('Failed to get popular songs', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get popular songs'
      });
    }
  }
  
  // Get recent songs
  static async getRecentSongs(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25
      } = req.query;
      
      const { offset, validatedLimit } = validatePaginationParams(
        parseInt(page as string),
        parseInt(limit as string)
      );
      
      const songs = await SongModel.getRecentSongs(validatedLimit, offset);
      
      res.json({
        success: true,
        data: songs
      });
    } catch (error) {
      logger.error('Failed to get recent songs', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recent songs'
      });
    }
  }
  
  // Search YouTube
  static async searchYouTube(req: Request, res: Response): Promise<void> {
    try {
      const {
        q: query,
        maxResults = 25,
        regionCode = 'US'
      } = req.query;

      if (!query) {
        res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
        return;
      }

      const results = await enhancedYouTubeService.searchSongs(
        query as string,
        {
          maxResults: Math.min(parseInt(maxResults as string), 50),
          regionCode: regionCode as string
        }
      );

      res.json({
        success: true,
        data: results.songs,
        meta: {
          query: query,
          total: results.total,
          maxResults: parseInt(maxResults as string),
          regionCode: regionCode
        }
      });
    } catch (error) {
      logger.error('Failed to search YouTube', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search YouTube'
      });
    }
  }
  
  // Search Spotify
  static async searchSpotify(req: Request, res: Response): Promise<void> {
    try {
      const {
        q: query,
        page = 1,
        limit = 25
      } = req.query;
      
      if (!query) {
        res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
        return;
      }
      
      const { offset, validatedLimit } = validatePaginationParams(
          parseInt(page as string),
          parseInt(limit as string)
        );
      
      const results = await SpotifyService.searchTracks(
        query as string,
        validatedLimit,
        offset
      );
      
      res.json({
        success: true,
        data: results.tracks,
        pagination: {
          page: parseInt(page as string),
          limit: validatedLimit,
          total: results.total,
          pages: Math.ceil(results.total / validatedLimit)
        }
      });
    } catch (error) {
      logger.error('Failed to search Spotify', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search Spotify'
      });
    }
  }
  
  // Get YouTube video details
  static async getYouTubeDetails(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      
      const details = await YouTubeService.getVideoDetails(videoId);
      
      if (!details) {
        res.status(404).json({
          success: false,
          message: 'YouTube video not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      logger.error('Failed to get YouTube video details', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get YouTube video details'
      });
    }
  }
  
  // Get Spotify track details
  static async getSpotifyDetails(req: Request, res: Response): Promise<void> {
    try {
      const { trackId } = req.params;
      
      const details = await SpotifyService.getTrackDetails(trackId);
      
      if (!details) {
        res.status(404).json({
          success: false,
          message: 'Spotify track not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      logger.error('Failed to get Spotify track details', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Spotify track details'
      });
    }
  }
  
  // Get trending music from YouTube
  static async getTrendingYouTube(req: Request, res: Response): Promise<void> {
    try {
      const {
        region = 'US',
        page = 1,
        limit = 25
      } = req.query;
      
      const { offset, validatedLimit } = validatePaginationParams(
        parseInt(page as string),
        parseInt(limit as string),
        50
      );
      
      const results = await YouTubeService.getTrendingMusic(
        region as string,
        validatedLimit,
        offset
      );
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to get trending YouTube music', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trending YouTube music'
      });
    }
  }
  
  // Get Spotify featured playlists
  static async getSpotifyFeatured(req: Request, res: Response): Promise<void> {
    try {
      const {
        country = 'US',
        page = 1,
        limit = 20
      } = req.query;
      
      const { offset, validatedLimit } = validatePaginationParams(
          parseInt(page as string),
          parseInt(limit as string),
          50
        );
        
        const results = await SpotifyService.getFeaturedPlaylists(
        validatedLimit,
        offset,
        country as string
      );
      
      res.json({
        success: true,
        data: results.playlists,
        pagination: {
          page: parseInt(page as string),
          limit: validatedLimit,
          total: results.total,
          pages: Math.ceil(results.total / validatedLimit)
        }
      });
    } catch (error) {
      logger.error('Failed to get Spotify featured playlists', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Spotify featured playlists'
      });
    }
  }
  
  // Get Spotify new releases
  static async getSpotifyNewReleases(req: Request, res: Response): Promise<void> {
    try {
      const {
        country = 'US',
        page = 1,
        limit = 20
      } = req.query;
      
      const { offset, validatedLimit } = validatePaginationParams(
        parseInt(page as string),
        parseInt(limit as string)
      );
      
      const results = await SpotifyService.getNewReleases(
        validatedLimit,
        offset,
        country as string
      );
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to get Spotify new releases', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Spotify new releases'
      });
    }
  }
  
  // Import song from external service
  static async importSong(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { source, external_id } = req.body;
      
      if (!source || !external_id) {
        res.status(400).json({
          success: false,
          message: 'Source and external_id are required'
        });
        return;
      }
      
      let songData: CreateSongData;
      
      if (source === 'youtube') {
        const details = await YouTubeService.getVideoDetails(external_id);
        if (!details) {
          res.status(404).json({
            success: false,
            message: 'YouTube video not found'
          });
          return;
        }
        
        songData = {
          title: details.title,
          artist: details.artist,
          duration: details.duration,
          youtube_id: details.id,
          thumbnail_url: details.thumbnail_url,
          genre: 'Unknown' // Could be enhanced with genre detection
        };
      } else if (source === 'spotify') {
        const details = await SpotifyService.getTrackDetails(external_id);
        if (!details) {
          res.status(404).json({
            success: false,
            message: 'Spotify track not found'
          });
          return;
        }
        
        songData = {
          title: details.title,
          artist: details.artist,
          duration: details.duration,
          spotify_id: details.id,
          thumbnail_url: details.thumbnail_url,
          genre: details.genres[0] || 'Unknown'
        };
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid source. Must be "youtube" or "spotify"'
        });
        return;
      }
      
      // Check if song already exists
      let existingSong = null;
      if (source === 'youtube') {
        existingSong = await SongModel.findByYouTubeId(external_id);
      } else if (source === 'spotify') {
        existingSong = await SongModel.findBySpotifyId(external_id);
      }
      
      if (existingSong) {
        res.json({
          success: true,
          data: existingSong,
          message: 'Song already exists in database'
        });
        return;
      }
      
      const song = await SongModel.create(songData);
      
      logger.info('Song imported via API', {
        songId: song.id,
        source,
        external_id,
        title: song.title,
        userId: req.user?.userId
      });
      
      res.status(201).json({
        success: true,
        data: song,
        message: 'Song imported successfully'
      });
    } catch (error) {
      logger.error('Failed to import song', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import song'
      });
    }
  }
  
  // Mark song as unavailable
  static async markUnavailable(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const song = await SongModel.markAsUnavailable(id, reason);
      
      if (!song) {
        res.status(404).json({
          success: false,
          message: 'Song not found'
        });
        return;
      }
      
      logger.info('Song marked as unavailable via API', {
        songId: id,
        reason,
        userId: req.user?.userId
      });
      
      res.json({
        success: true,
        data: song,
        message: 'Song marked as unavailable'
      });
    } catch (error) {
      logger.error('Failed to mark song as unavailable', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark song as unavailable'
      });
    }
  }
  
  // Mark song as available
  static async markAvailable(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const song = await SongModel.markAsAvailable(id);
      
      if (!song) {
        res.status(404).json({
          success: false,
          message: 'Song not found'
        });
        return;
      }
      
      logger.info('Song marked as available via API', {
        songId: id,
        userId: req.user?.userId
      });
      
      res.json({
        success: true,
        data: song,
        message: 'Song marked as available'
      });
    } catch (error) {
      logger.error('Failed to mark song as available', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark song as available'
      });
    }
  }
}
