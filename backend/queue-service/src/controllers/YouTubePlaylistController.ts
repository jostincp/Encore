import { Request, Response } from 'express';
import { YouTubePlaylistService } from '../services/YouTubePlaylistService';
import logger from '../../../shared/utils/logger';
import { validateRequired, validateUUID } from '../../../shared/utils/validation';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    barId?: string;
  };
}

export class YouTubePlaylistController {
  private playlistService = YouTubePlaylistService.getInstance();

  /**
   * Crear una nueva playlist de YouTube
   */
  async createPlaylist(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, description, isPublic = true } = req.body;
      const userId = req.user!.id;
      const barId = req.user!.barId;

      if (!barId) {
        return res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
      }

      validateRequired(name, 'name');

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Playlist name must be less than 100 characters'
        });
      }

      const playlist = await this.playlistService.createPlaylist(
        barId,
        name,
        userId,
        description,
        isPublic
      );

      logger.info(`YouTube playlist created: ${playlist.id} by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'YouTube playlist created successfully',
        data: playlist
      });
    } catch (error) {
      logger.error('Error creating YouTube playlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Obtener todas las playlists de un bar
   */
  async getBarPlaylists(req: AuthenticatedRequest, res: Response) {
    try {
      const barId = req.user!.barId;

      if (!barId) {
        return res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
      }

      const playlists = await this.playlistService.getBarPlaylists(barId);

      res.json({
        success: true,
        data: playlists,
        meta: {
          total: playlists.length,
          barId
        }
      });
    } catch (error) {
      logger.error('Error getting bar playlists:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Obtener una playlist específica
   */
  async getPlaylist(req: AuthenticatedRequest, res: Response) {
    try {
      const { playlistId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const playlist = await this.playlistService.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }

      // Verificar que el usuario tenga acceso a esta playlist
      const barId = req.user!.barId;
      if (playlist.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this playlist'
        });
      }

      // Obtener items con paginación
      const items = await this.playlistService.getPlaylistItems(
        playlistId,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: {
          ...playlist,
          items: items.items
        },
        pagination: {
          page: items.page,
          limit: parseInt(limit as string),
          total: items.total,
          totalPages: items.totalPages
        }
      });
    } catch (error) {
      logger.error('Error getting playlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Agregar un video de YouTube a la playlist
   */
  async addVideoToPlaylist(req: AuthenticatedRequest, res: Response) {
    try {
      const { playlistId } = req.params;
      const { videoId, title, channelTitle, duration, thumbnailUrl } = req.body;
      const userId = req.user!.id;

      validateRequired(videoId, 'videoId');
      validateRequired(title, 'title');
      validateRequired(channelTitle, 'channelTitle');
      validateRequired(duration, 'duration');
      validateRequired(thumbnailUrl, 'thumbnailUrl');

      // Verificar que la playlist existe y pertenece al bar del usuario
      const playlist = await this.playlistService.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }

      const barId = req.user!.barId;
      if (playlist.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this playlist'
        });
      }

      // Verificar si el video ya está en la playlist
      const exists = await this.playlistService.isVideoInPlaylist(playlistId, videoId);
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Video already exists in playlist'
        });
      }

      const playlistItem = await this.playlistService.addVideoToPlaylist(playlistId, {
        videoId,
        title,
        channelTitle,
        duration,
        thumbnailUrl,
        addedBy: userId
      });

      logger.info(`Video ${videoId} added to playlist ${playlistId} by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Video added to playlist successfully',
        data: playlistItem
      });
    } catch (error) {
      logger.error('Error adding video to playlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Eliminar un video de la playlist
   */
  async removeVideoFromPlaylist(req: AuthenticatedRequest, res: Response) {
    try {
      const { playlistId, itemId } = req.params;

      // Verificar que la playlist existe y pertenece al bar del usuario
      const playlist = await this.playlistService.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }

      const barId = req.user!.barId;
      if (playlist.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this playlist'
        });
      }

      const success = await this.playlistService.removeVideoFromPlaylist(playlistId, itemId);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Video not found in playlist'
        });
      }

      logger.info(`Video item ${itemId} removed from playlist ${playlistId}`);

      res.json({
        success: true,
        message: 'Video removed from playlist successfully'
      });
    } catch (error) {
      logger.error('Error removing video from playlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Reordenar videos en la playlist
   */
  async reorderPlaylistItems(req: AuthenticatedRequest, res: Response) {
    try {
      const { playlistId } = req.params;
      const { itemIds } = req.body;

      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'itemIds must be a non-empty array'
        });
      }

      // Verificar que la playlist existe y pertenece al bar del usuario
      const playlist = await this.playlistService.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }

      const barId = req.user!.barId;
      if (playlist.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this playlist'
        });
      }

      const success = await this.playlistService.reorderPlaylistItems(playlistId, itemIds);
      
      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to reorder playlist items'
        });
      }

      logger.info(`Playlist ${playlistId} reordered`);

      res.json({
        success: true,
        message: 'Playlist reordered successfully'
      });
    } catch (error) {
      logger.error('Error reordering playlist items:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Actualizar información de la playlist
   */
  async updatePlaylist(req: AuthenticatedRequest, res: Response) {
    try {
      const { playlistId } = req.params;
      const { name, description, isPublic } = req.body;

      // Verificar que la playlist existe y pertenece al bar del usuario
      const playlist = await this.playlistService.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }

      const barId = req.user!.barId;
      if (playlist.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this playlist'
        });
      }

      // Solo el creador puede actualizar la playlist
      if (playlist.createdBy !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'Only the playlist creator can update it'
        });
      }

      const updatedPlaylist = await this.playlistService.updatePlaylist(playlistId, {
        name,
        description,
        isPublic
      });

      logger.info(`Playlist ${playlistId} updated`);

      res.json({
        success: true,
        message: 'Playlist updated successfully',
        data: updatedPlaylist
      });
    } catch (error) {
      logger.error('Error updating playlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Eliminar una playlist
   */
  async deletePlaylist(req: AuthenticatedRequest, res: Response) {
    try {
      const { playlistId } = req.params;

      // Verificar que la playlist existe y pertenece al bar del usuario
      const playlist = await this.playlistService.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }

      const barId = req.user!.barId;
      if (playlist.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this playlist'
        });
      }

      // Solo el creador puede eliminar la playlist
      if (playlist.createdBy !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'Only the playlist creator can delete it'
        });
      }

      const success = await this.playlistService.deletePlaylist(playlistId);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Failed to delete playlist'
        });
      }

      logger.info(`Playlist ${playlistId} deleted by user ${req.user!.id}`);

      res.json({
        success: true,
        message: 'Playlist deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting playlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default new YouTubePlaylistController();