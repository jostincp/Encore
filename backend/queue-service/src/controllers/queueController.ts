import { Request, Response } from 'express';
import { QueueModel, CreateQueueData, UpdateQueueData, QueueFilters } from '../models/Queue';
import { SongModel } from '../../../shared/models/Song';
import { BarModel } from '../../../shared/models/Bar';
import { UserModel } from '../../../shared/models/User';
import { logger } from '../../../shared/utils/logger';
import { validateRequired, validateUUID, validateEnum } from '../../../shared/utils/validation';
import { QueueEventEmitter } from '../events/queueEvents';
import { emitToBar, emitToUser } from '../websocket/socketHandler';
import { redisClient } from '../../../shared/cache';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    barId?: string;
  };
}

export class QueueController {
  // Add song to queue
  static async addToQueue(req: AuthenticatedRequest, res: Response) {
    try {
      const { bar_id, song_id, priority_play = false, points_used, notes } = req.body;
      const userId = req.user!.id;
      
      // Validate required fields
      validateRequired(bar_id, 'bar_id');
      validateRequired(song_id, 'song_id');
      validateUUID(bar_id, 'bar_id');
      validateUUID(song_id, 'song_id');
      
      // Check if bar exists and is active
      const bar = await BarModel.findById(bar_id);
      if (!bar) {
        return res.status(404).json({
          success: false,
          message: 'Bar not found'
        });
      }
      
      if (!bar.is_active) {
        return res.status(400).json({
          success: false,
          message: 'Bar is currently inactive'
        });
      }
      
      // Check if song exists and is available
      const song = await SongModel.findById(song_id);
      if (!song) {
        return res.status(404).json({
          success: false,
          message: 'Song not found'
        });
      }
      
      if (!song.is_available) {
        return res.status(400).json({
          success: false,
          message: 'Song is currently unavailable'
        });
      }
      
      // Check user song limits
      const maxSongsPerUser = parseInt(process.env.MAX_SONGS_PER_USER || '3');
      const canAddSong = await QueueModel.canUserAddSong(bar_id, userId, maxSongsPerUser);
      if (!canAddSong) {
        return res.status(400).json({
          success: false,
          message: `You can only have ${maxSongsPerUser} songs in the queue at once`
        });
      }
      
      // Check cooldown for the same song
      const cooldownMinutes = parseInt(process.env.SONG_COOLDOWN_MINUTES || '30');
      const cooldownKey = `cooldown:${bar_id}:${song_id}`;
      const lastRequest = await redisClient.get(cooldownKey);
      
      if (lastRequest) {
        return res.status(400).json({
          success: false,
          message: `This song was recently played. Please wait ${cooldownMinutes} minutes before requesting it again.`
        });
      }
      
      // Validate priority play and points
      if (priority_play) {
        if (!points_used || points_used < parseInt(process.env.PRIORITY_PLAY_COST || '10')) {
          return res.status(400).json({
            success: false,
            message: `Priority play requires at least ${process.env.PRIORITY_PLAY_COST || '10'} points`
          });
        }
        
        // Check user's point balance
        const user = await UserModel.findById(userId);
        if (!user || user.points < points_used) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient points for priority play'
          });
        }
        
        // Deduct points from user
        await UserModel.updatePoints(userId, -points_used);
        
        // Emit points updated event
        QueueEventEmitter.emitUserPointsUpdated({
          barId: bar_id,
          userId,
          newBalance: user.points - points_used,
          pointsUsed: points_used,
          timestamp: new Date().toISOString()
        });
      }
      
      // Create queue entry
      const createData: CreateQueueData = {
        bar_id,
        song_id,
        user_id: userId,
        priority_play,
        points_used,
        notes
      };
      
      const queueEntry = await QueueModel.create(createData);
      
      // Set cooldown for this song
      await redisClient.setex(cooldownKey, cooldownMinutes * 60, new Date().toISOString());
      
      // Get detailed queue entry for response
      const detailedEntry = await QueueModel.findById(queueEntry.id, true);
      
      logger.info(`Song added to queue: ${queueEntry.id} by user ${userId}`);
      
      res.status(201).json({
        success: true,
        message: 'Song added to queue successfully',
        data: detailedEntry
      });
      
    } catch (error) {
      logger.error('Error adding song to queue:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Get queue for a bar
  static async getQueue(req: Request, res: Response) {
    try {
      const { barId } = req.params;
      const {
        status,
        user_id,
        priority_play,
        date_from,
        date_to,
        page = 1,
        limit = 50,
        include_details = 'true'
      } = req.query;
      
      validateUUID(barId, 'barId');
      
      // Build filters
      const filters: QueueFilters = {
        includeDetails: include_details === 'true'
      };
      
      if (status) {
        filters.status = Array.isArray(status) ? status as string[] : [status as string];
      }
      
      if (user_id) {
        validateUUID(user_id as string, 'user_id');
        filters.user_id = user_id as string;
      }
      
      if (priority_play !== undefined) {
        filters.priority_play = priority_play === 'true';
      }
      
      if (date_from) {
        filters.date_from = new Date(date_from as string);
      }
      
      if (date_to) {
        filters.date_to = new Date(date_to as string);
      }
      
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
      
      const result = await QueueModel.findByBarId(barId, filters, pageNum, limitNum);
      
      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
      
    } catch (error) {
      logger.error('Error getting queue:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Get currently playing song
  static async getCurrentlyPlaying(req: Request, res: Response) {
    try {
      const { barId } = req.params;
      validateUUID(barId, 'barId');
      
      const currentSong = await QueueModel.getCurrentlyPlaying(barId);
      
      res.json({
        success: true,
        data: currentSong
      });
      
    } catch (error) {
      logger.error('Error getting currently playing song:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Get next song in queue
  static async getNextInQueue(req: Request, res: Response) {
    try {
      const { barId } = req.params;
      validateUUID(barId, 'barId');
      
      const nextSong = await QueueModel.getNextInQueue(barId);
      
      res.json({
        success: true,
        data: nextSong
      });
      
    } catch (error) {
      logger.error('Error getting next song in queue:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Update queue entry (admin/bar owner only)
  static async updateQueueEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status, position, notes, rejection_reason } = req.body;
      const userRole = req.user!.role;
      
      validateUUID(id, 'id');
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // Get current entry to check bar ownership
      const currentEntry = await QueueModel.findById(id);
      if (!currentEntry) {
        return res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
      }
      
      // For bar owners, check if they own the bar
      if (userRole === 'bar_owner' && req.user!.barId !== currentEntry.bar_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own bar.'
        });
      }
      
      const updateData: UpdateQueueData = {};
      
      if (status !== undefined) {
        validateEnum(status, ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'], 'status');
        updateData.status = status;
        
        if (status === 'played' || status === 'skipped') {
          updateData.played_at = new Date();
        }
      }
      
      if (position !== undefined) {
        updateData.position = parseInt(position);
      }
      
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      
      if (rejection_reason !== undefined) {
        updateData.rejection_reason = rejection_reason;
      }
      
      const updatedEntry = await QueueModel.update(id, updateData);
      
      // Get detailed entry for response
      const detailedEntry = await QueueModel.findById(id, true);
      
      logger.info(`Queue entry updated: ${id} by user ${req.user!.id}`);
      
      res.json({
        success: true,
        message: 'Queue entry updated successfully',
        data: detailedEntry
      });
      
    } catch (error) {
      logger.error('Error updating queue entry:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Remove song from queue
  static async removeFromQueue(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      validateUUID(id, 'id');
      
      // Get queue entry
      const queueEntry = await QueueModel.findById(id);
      if (!queueEntry) {
        return res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
      }
      
      // Check permissions
      const canRemove = 
        userRole === 'admin' ||
        (userRole === 'bar_owner' && req.user!.barId === queueEntry.bar_id) ||
        (queueEntry.user_id === userId && queueEntry.status === 'pending');
      
      if (!canRemove) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only remove your own pending songs.'
        });
      }
      
      const deleted = await QueueModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
      }
      
      logger.info(`Queue entry removed: ${id} by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Song removed from queue successfully'
      });
      
    } catch (error) {
      logger.error('Error removing song from queue:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Reorder queue (admin/bar owner only)
  static async reorderQueue(req: AuthenticatedRequest, res: Response) {
    try {
      const { barId } = req.params;
      const { queue_ids } = req.body;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      validateRequired(queue_ids, 'queue_ids');
      
      if (!Array.isArray(queue_ids)) {
        return res.status(400).json({
          success: false,
          message: 'queue_ids must be an array'
        });
      }
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if (userRole === 'bar_owner' && req.user!.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own bar.'
        });
      }
      
      const success = await QueueModel.reorderQueue(barId, queue_ids);
      
      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to reorder queue'
        });
      }
      
      logger.info(`Queue reordered for bar ${barId} by user ${req.user!.id}`);
      
      res.json({
        success: true,
        message: 'Queue reordered successfully'
      });
      
    } catch (error) {
      logger.error('Error reordering queue:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Clear queue (admin/bar owner only)
  static async clearQueue(req: AuthenticatedRequest, res: Response) {
    try {
      const { barId } = req.params;
      const { status } = req.body;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if (userRole === 'bar_owner' && req.user!.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own bar.'
        });
      }
      
      const clearedCount = await QueueModel.clearQueue(barId, status);
      
      logger.info(`Queue cleared for bar ${barId} by user ${req.user!.id}, ${clearedCount} entries removed`);
      
      res.json({
        success: true,
        message: `Queue cleared successfully. ${clearedCount} entries removed.`,
        data: { clearedCount }
      });
      
    } catch (error) {
      logger.error('Error clearing queue:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Get queue statistics (admin/bar owner only)
  static async getQueueStats(req: AuthenticatedRequest, res: Response) {
    try {
      const { barId } = req.params;
      const { date_from, date_to } = req.query;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if (userRole === 'bar_owner' && req.user!.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own bar statistics.'
        });
      }
      
      const dateFrom = date_from ? new Date(date_from as string) : undefined;
      const dateTo = date_to ? new Date(date_to as string) : undefined;
      
      const stats = await QueueModel.getQueueStats(barId, dateFrom, dateTo);
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Get user's queue position
  static async getUserQueuePosition(req: AuthenticatedRequest, res: Response) {
    try {
      const { barId } = req.params;
      const userId = req.user!.id;
      
      validateUUID(barId, 'barId');
      
      const position = await QueueModel.getUserQueuePosition(barId, userId);
      
      res.json({
        success: true,
        data: {
          position,
          barId,
          userId
        }
      });
      
    } catch (error) {
      logger.error('Error getting user queue position:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Get user's queue entries for a bar
  static async getUserQueue(req: AuthenticatedRequest, res: Response) {
    try {
      const { barId } = req.params;
      const { status, page = 1, limit = 20 } = req.query;
      const userId = req.user!.id;
      
      validateUUID(barId, 'barId');
      
      const filters: QueueFilters = {
        user_id: userId,
        includeDetails: true
      };
      
      if (status) {
        filters.status = Array.isArray(status) ? status as string[] : [status as string];
      }
      
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
      
      const result = await QueueModel.findByBarId(barId, filters, pageNum, limitNum);
      
      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
      
    } catch (error) {
      logger.error('Error getting user queue:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Skip current song (admin/bar owner only)
  static async skipCurrentSong(req: AuthenticatedRequest, res: Response) {
    try {
      const { barId } = req.params;
      const { reason } = req.body;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if (userRole === 'bar_owner' && req.user!.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own bar.'
        });
      }
      
      // Get currently playing song
      const currentSong = await QueueModel.getCurrentlyPlaying(barId);
      if (!currentSong) {
        return res.status(404).json({
          success: false,
          message: 'No song is currently playing'
        });
      }
      
      // Mark current song as skipped
      await QueueModel.update(currentSong.id, {
        status: 'skipped',
        played_at: new Date(),
        notes: reason
      });
      
      // Get next song and start playing it
      const nextSong = await QueueModel.getNextInQueue(barId);
      if (nextSong) {
        await QueueModel.update(nextSong.id, {
          status: 'playing'
        });
      }
      
      // Emit current song changed event
      QueueEventEmitter.emitCurrentSongChanged({
        barId,
        previousSongId: currentSong.song_id,
        currentSongId: nextSong?.song_id,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Current song skipped for bar ${barId} by user ${req.user!.id}`);
      
      res.json({
        success: true,
        message: 'Current song skipped successfully',
        data: {
          skippedSong: currentSong,
          nextSong
        }
      });
      
    } catch (error) {
      logger.error('Error skipping current song:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Play next song (admin/bar owner only)
  static async playNextSong(req: AuthenticatedRequest, res: Response) {
    try {
      const { barId } = req.params;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if (userRole === 'bar_owner' && req.user!.barId !== barId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own bar.'
        });
      }
      
      // Get currently playing song and mark as played
      const currentSong = await QueueModel.getCurrentlyPlaying(barId);
      if (currentSong) {
        await QueueModel.update(currentSong.id, {
          status: 'played',
          played_at: new Date()
        });
      }
      
      // Get next song and start playing it
      const nextSong = await QueueModel.getNextInQueue(barId);
      if (nextSong) {
        await QueueModel.update(nextSong.id, {
          status: 'playing'
        });
      }
      
      // Emit current song changed event
      QueueEventEmitter.emitCurrentSongChanged({
        barId,
        previousSongId: currentSong?.song_id,
        currentSongId: nextSong?.song_id,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Next song started for bar ${barId} by user ${req.user!.id}`);
      
      res.json({
        success: true,
        message: 'Next song started successfully',
        data: {
          previousSong: currentSong,
          currentSong: nextSong
        }
      });
      
    } catch (error) {
      logger.error('Error playing next song:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}