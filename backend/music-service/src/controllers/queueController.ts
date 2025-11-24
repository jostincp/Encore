import { Request, Response } from 'express';
import { QueueModel, CreateQueueData, UpdateQueueData, QueueFilters } from '../models/Queue';
import { SongModel } from '../models/Song';
import { asyncHandler } from '@shared/utils/errors';
import logger from '@shared/utils/logger';
import { validatePaginationParams } from '@shared/utils/validation';
import { AuthenticatedRequest } from '@shared/types/auth';
import { BarModel } from '@shared/models/Bar';
import { BarService } from '../services/barService';
import { queueEventService } from '../services/queueEventService';

export class QueueController {
  // Add song to queue
  static async addToQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bar_id, song_id, priority_play, points_used } = req.body;
      const user_id = req.user!.userId;

      // Validate bar exists and is active
      const bar = await BarService.findById(bar_id);
      if (!bar) {
        res.status(404).json({
          success: false,
          message: 'Bar not found'
        });
        return;
      }

      if (!bar.isActive) {
        res.status(400).json({
          success: false,
          message: 'Bar is not active'
        });
        return;
      }

      // Validate song exists and is available
      const song = await SongModel.findById(song_id);
      if (!song) {
        res.status(404).json({
          success: false,
          message: 'Song not found'
        });
        return;
      }

      if (!song.is_available) {
        res.status(400).json({
          success: false,
          message: 'Song is not available'
        });
        return;
      }

      // Get bar settings to check limits
      const barSettings = await BarService.getSettings(bar_id);
      const maxSongsPerUser = barSettings?.max_songs_per_user || 3;

      // Check if user can add more songs
      const canAddResult = await QueueModel.canUserAddSong(bar_id, user_id, maxSongsPerUser);
      if (!canAddResult.canAdd) {
        res.status(400).json({
          success: false,
          message: canAddResult.reason
        });
        return;
      }

      // Check cooldown if applicable
      if (barSettings?.song_request_cooldown && barSettings.song_request_cooldown > 0) {
        const lastRequest = await QueueModel.findByBarId(
          bar_id,
          { user_id },
          1,
          0,
          false
        );

        if (lastRequest.items.length > 0) {
          const lastRequestTime = new Date(lastRequest.items[0].requested_at);
          const cooldownEnd = new Date(lastRequestTime.getTime() + (barSettings.song_request_cooldown * 1000));

          if (new Date() < cooldownEnd) {
            const remainingSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
            res.status(400).json({
              success: false,
              message: `Please wait ${remainingSeconds} seconds before requesting another song`
            });
            return;
          }
        }
      }

      const queueData: CreateQueueData = {
        bar_id,
        song_id,
        user_id,
        priority_play: priority_play || false,
        points_used: points_used || 0
      };

      const queueEntry = await QueueModel.create(queueData);

      // Get full queue entry with song and user details
      const fullQueueEntry = await QueueModel.findById(queueEntry.id, true);

      // Emit event for real-time updates
      await queueEventService.songAdded(bar_id, fullQueueEntry);

      logger.info('Song added to queue via API', {
        queueId: queueEntry.id,
        barId: bar_id,
        songId: song_id,
        userId: user_id,
        priorityPlay: priority_play
      });

      res.status(201).json({
        success: true,
        data: fullQueueEntry
      });
    } catch (error) {
      logger.error('Failed to add song to queue', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add song to queue'
      });
    }
  }

  // Get queue for a bar
  static async getQueue(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const {
        status,
        user_id,
        priority_play,
        date_from,
        date_to,
        page = 1,
        limit = 50
      } = req.query;

      const { offset, validatedLimit } = validatePaginationParams(
        parseInt(page as string),
        parseInt(limit as string),
        100 // Max limit for queue
      );

      const filters: QueueFilters = {};

      if (status) {
        if (typeof status === 'string' && status.includes(',')) {
          filters.status = status.split(',');
        } else {
          filters.status = status as string;
        }
      }

      if (user_id) filters.user_id = user_id as string;
      if (priority_play !== undefined) filters.priority_play = priority_play === 'true';
      if (date_from) filters.date_from = new Date(date_from as string);
      if (date_to) filters.date_to = new Date(date_to as string);

      const result = await QueueModel.findByBarId(
        barId,
        filters,
        validatedLimit,
        offset,
        true
      );

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
      logger.error('Failed to get queue', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get queue'
      });
    }
  }

  // Get currently playing song
  static async getCurrentlyPlaying(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;

      const currentSong = await QueueModel.getCurrentlyPlaying(barId);

      res.json({
        success: true,
        data: currentSong
      });
    } catch (error) {
      logger.error('Failed to get currently playing song', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get currently playing song'
      });
    }
  }

  // Get next song in queue
  static async getNextInQueue(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;

      const nextSong = await QueueModel.getNextInQueue(barId);

      res.json({
        success: true,
        data: nextSong
      });
    } catch (error) {
      logger.error('Failed to get next song in queue', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get next song in queue'
      });
    }
  }

  // Update queue entry (admin/bar_owner only)
  static async updateQueueEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateQueueData = req.body;

      // Get queue entry to check permissions
      const queueEntry = await QueueModel.findById(id);
      if (!queueEntry) {
        res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
        return;
      }

      // Check if user has permission to update this queue entry
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole !== 'admin') {
        // Check if user is bar owner
        const bar = await BarModel.findById(queueEntry.bar_id);
        if (!bar || bar.ownerId !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      const updatedEntry = await QueueModel.update(id, updateData);

      if (!updatedEntry) {
        res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
        return;
      }

      // Get full updated entry with details
      const fullUpdatedEntry = await QueueModel.findById(id, true);

      // Emit event for real-time updates
      if (updateData.status) {
        await queueEventService.songStatusUpdated(queueEntry.bar_id, fullUpdatedEntry, queueEntry.status, updateData.status);
      }

      logger.info('Queue entry updated via API', {
        queueId: id,
        updatedFields: Object.keys(updateData),
        userId
      });

      res.json({
        success: true,
        data: fullUpdatedEntry
      });
    } catch (error) {
      logger.error('Failed to update queue entry', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update queue entry'
      });
    }
  }

  // Remove song from queue
  static async removeFromQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get queue entry to check permissions
      const queueEntry = await QueueModel.findById(id);
      if (!queueEntry) {
        res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
        return;
      }

      // Check permissions
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole !== 'admin') {
        // Users can remove their own songs if they're pending
        if (queueEntry.user_id === userId && queueEntry.status === 'pending') {
          // Allow
        } else {
          // Check if user is bar owner
          const bar = await BarModel.findById(queueEntry.bar_id);
          if (!bar || bar.ownerId !== userId) {
            res.status(403).json({
              success: false,
              message: 'Insufficient permissions'
            });
            return;
          }
        }
      }

      const deleted = await QueueModel.delete(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
        return;
      }

      // Emit event for real-time updates
      await queueEventService.songRemoved(queueEntry.bar_id, id);

      logger.info('Song removed from queue via API', {
        queueId: id,
        userId
      });

      res.json({
        success: true,
        message: 'Song removed from queue'
      });
    } catch (error) {
      logger.error('Failed to remove song from queue', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove song from queue'
      });
    }
  }

  // Reorder queue (admin/bar_owner only)
  static async reorderQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { queue_ids } = req.body;

      if (!Array.isArray(queue_ids)) {
        res.status(400).json({
          success: false,
          message: 'queue_ids must be an array'
        });
        return;
      }

      // Check permissions
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole !== 'admin') {
        // Check if user is bar owner
        const bar = await BarModel.findById(barId);
        if (!bar || bar.ownerId !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      await QueueModel.reorderQueue(barId, queue_ids);

      // Emit event for real-time updates
      await queueEventService.queueReordered(barId, queue_ids);

      logger.info('Queue reordered via API', {
        barId,
        queueCount: queue_ids.length,
        userId
      });

      res.json({
        success: true,
        message: 'Queue reordered successfully'
      });
    } catch (error) {
      logger.error('Failed to reorder queue', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reorder queue'
      });
    }
  }

  // Clear queue (admin/bar_owner only)
  static async clearQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { status } = req.body;

      // Check permissions
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole !== 'admin') {
        // Check if user is bar owner
        const bar = await BarModel.findById(barId);
        if (!bar || bar.ownerId !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      const deletedCount = await QueueModel.clearQueue(barId, status);

      // Emit event for real-time updates
      await queueEventService.queueCleared(barId, deletedCount);

      logger.info('Queue cleared via API', {
        barId,
        deletedCount,
        status,
        userId
      });

      res.json({
        success: true,
        message: `${deletedCount} songs removed from queue`
      });
    } catch (error) {
      logger.error('Failed to clear queue', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear queue'
      });
    }
  }

  // Get queue statistics
  static async getQueueStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { date_from, date_to } = req.query;

      // Check permissions
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole !== 'admin') {
        // Check if user is bar owner
        const bar = await BarModel.findById(barId);
        if (!bar || bar.ownerId !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      const dateFrom = date_from ? new Date(date_from as string) : undefined;
      const dateTo = date_to ? new Date(date_to as string) : undefined;

      const stats = await QueueModel.getQueueStats(barId, dateFrom, dateTo);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get queue statistics', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get queue statistics'
      });
    }
  }

  // Get user's position in queue
  static async getUserQueuePosition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = req.user!.userId;

      const position = await QueueModel.getUserQueuePosition(barId, userId);

      res.json({
        success: true,
        data: {
          position,
          has_song_in_queue: position !== null
        }
      });
    } catch (error) {
      logger.error('Failed to get user queue position', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user queue position'
      });
    }
  }

  // Get user's queue entries
  static async getUserQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = req.user!.userId;
      const {
        status,
        page = 1,
        limit = 25
      } = req.query;

      const { offset, validatedLimit } = validatePaginationParams(
        parseInt(page as string),
        parseInt(limit as string)
      );

      const filters: QueueFilters = {
        user_id: userId
      };

      if (status) {
        if (typeof status === 'string' && status.includes(',')) {
          filters.status = status.split(',');
        } else {
          filters.status = status as string;
        }
      }

      const result = await QueueModel.findByBarId(
        barId,
        filters,
        validatedLimit,
        offset,
        true
      );

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
      logger.error('Failed to get user queue', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user queue'
      });
    }
  }

  // Skip current song (admin/bar_owner only)
  static async skipCurrentSong(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;

      // Check permissions
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole !== 'admin') {
        // Check if user is bar owner
        const bar = await BarModel.findById(barId);
        if (!bar || bar.ownerId !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      // Get currently playing song
      const currentSong = await QueueModel.getCurrentlyPlaying(barId);

      if (!currentSong) {
        res.status(404).json({
          success: false,
          message: 'No song currently playing'
        });
        return;
      }

      // Mark current song as skipped
      await QueueModel.update(currentSong.id, {
        status: 'skipped',
        played_at: new Date()
      });

      // Get next song and mark as playing
      const nextSong = await QueueModel.getNextInQueue(barId);

      if (nextSong) {
        await QueueModel.update(nextSong.id, {
          status: 'playing'
        });
      }

      logger.info('Song skipped via API', {
        barId,
        skippedSongId: currentSong.id,
        nextSongId: nextSong?.id,
        userId
      });

      res.json({
        success: true,
        message: 'Song skipped successfully',
        data: {
          skipped_song: currentSong,
          next_song: nextSong
        }
      });
    } catch (error) {
      logger.error('Failed to skip current song', error);
      res.status(500).json({
        success: false,
        message: 'Failed to skip current song'
      });
    }
  }

  // Play next song (admin/bar_owner only)
  static async playNextSong(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;

      // Check permissions
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole !== 'admin') {
        // Check if user is bar owner
        const bar = await BarModel.findById(barId);
        if (!bar || bar.ownerId !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      // Mark current song as played (if any)
      const currentSong = await QueueModel.getCurrentlyPlaying(barId);
      if (currentSong) {
        await QueueModel.update(currentSong.id, {
          status: 'played',
          played_at: new Date()
        });
      }

      // Get next song and mark as playing
      const nextSong = await QueueModel.getNextInQueue(barId);

      if (!nextSong) {
        res.json({
          success: true,
          message: 'No more songs in queue',
          data: {
            current_song: null,
            next_song: null
          }
        });
        return;
      }

      await QueueModel.update(nextSong.id, {
        status: 'playing'
      });

      // Get updated song with details
      const updatedSong = await QueueModel.findById(nextSong.id, true);

      logger.info('Next song started via API', {
        barId,
        previousSongId: currentSong?.id,
        currentSongId: nextSong.id,
        userId
      });

      res.json({
        success: true,
        message: 'Next song started',
        data: {
          current_song: updatedSong,
          previous_song: currentSong
        }
      });
    } catch (error) {
      logger.error('Failed to play next song', error);
      res.status(500).json({
        success: false,
        message: 'Failed to play next song'
      });
    }
  }

  // Handle song finished playing (called by player)
  static async songFinished(req: Request, res: Response): Promise<void> {
    try {
      const { queueId } = req.body;

      if (!queueId) {
        res.status(400).json({
          success: false,
          message: 'queueId is required'
        });
        return;
      }

      // Get the queue entry
      const queueEntry = await QueueModel.findById(queueId);
      if (!queueEntry) {
        res.status(404).json({
          success: false,
          message: 'Queue entry not found'
        });
        return;
      }

      if (queueEntry.status !== 'playing') {
        res.status(400).json({
          success: false,
          message: 'Song is not currently playing'
        });
        return;
      }

      // Mark current song as played
      await QueueModel.update(queueId, {
        status: 'played',
        played_at: new Date()
      });

      // Get next song in queue
      const nextSong = await QueueModel.getNextInQueue(queueEntry.bar_id);

      let nextSongData = null;
      if (nextSong) {
        // Mark next song as playing
        await QueueModel.update(nextSong.id, {
          status: 'playing'
        });

        // Get full next song data
        nextSongData = await QueueModel.findById(nextSong.id, true);

        logger.info('Next song started automatically', {
          barId: queueEntry.bar_id,
          previousSongId: queueId,
          nextSongId: nextSong.id
        });
      } else {
        logger.info('No more songs in queue', {
          barId: queueEntry.bar_id,
          lastSongId: queueId
        });
      }

      // Emit event for real-time updates
      await queueEventService.playNextSong(queueEntry.bar_id, nextSongData);

      res.json({
        success: true,
        message: nextSongData ? 'Next song started' : 'No more songs in queue',
        data: {
          previous_song: queueEntry,
          next_song: nextSongData
        }
      });
    } catch (error) {
      logger.error('Failed to handle song finished', error);
      res.status(500).json({
        success: false,
        message: 'Failed to handle song finished'
      });
    }
  }
}
