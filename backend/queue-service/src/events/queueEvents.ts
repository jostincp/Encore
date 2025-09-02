import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../../shared/utils/logger';
import { emitToBar, emitToUser } from '../websocket/socketHandler';
import { QueueModel } from '../models/Queue';
import { SongModel } from '../../../shared/models/Song';
import { UserModel } from '../../../shared/models/User';

// Event types
export interface QueueEventData {
  barId: string;
  queueId?: string;
  userId?: string;
  songId?: string;
  position?: number;
  status?: string;
  timestamp: string;
  metadata?: any;
}

export interface SongAddedEventData extends QueueEventData {
  queueId: string;
  userId: string;
  songId: string;
  position: number;
  priorityPlay: boolean;
  pointsUsed?: number;
}

export interface SongStatusChangedEventData extends QueueEventData {
  queueId: string;
  oldStatus: string;
  newStatus: string;
  reason?: string;
}

export interface QueueReorderedEventData extends QueueEventData {
  newOrder: string[];
  affectedPositions: { queueId: string; oldPosition: number; newPosition: number }[];
}

export interface CurrentSongChangedEventData extends QueueEventData {
  previousSongId?: string;
  currentSongId?: string;
  nextSongId?: string;
}

class QueueEventEmitterClass extends EventEmitter {
  private io?: SocketIOServer;

  initialize(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
    logger.info('Queue Event Emitter initialized');
  }

  private setupEventHandlers() {
    // Song added to queue
    this.on('song_added', this.handleSongAdded.bind(this));
    
    // Song status changed (approved, rejected, played, skipped)
    this.on('song_status_changed', this.handleSongStatusChanged.bind(this));
    
    // Queue reordered
    this.on('queue_reordered', this.handleQueueReordered.bind(this));
    
    // Current song changed
    this.on('current_song_changed', this.handleCurrentSongChanged.bind(this));
    
    // Queue cleared
    this.on('queue_cleared', this.handleQueueCleared.bind(this));
    
    // User points updated
    this.on('user_points_updated', this.handleUserPointsUpdated.bind(this));
    
    // Queue stats updated
    this.on('queue_stats_updated', this.handleQueueStatsUpdated.bind(this));
  }

  private async handleSongAdded(data: SongAddedEventData) {
    try {
      logger.info(`Song added to queue: ${data.queueId} in bar ${data.barId}`);
      
      // Get detailed queue entry
      const queueEntry = await QueueModel.findById(data.queueId, true);
      if (!queueEntry) {
        logger.error(`Queue entry not found: ${data.queueId}`);
        return;
      }

      // Emit to all users in the bar
      emitToBar(data.barId, 'song_added_to_queue', {
        queueEntry,
        position: data.position,
        priorityPlay: data.priorityPlay,
        pointsUsed: data.pointsUsed,
        timestamp: data.timestamp
      });

      // Emit specific event to the user who added the song
      emitToUser(data.userId, 'your_song_added', {
        queueEntry,
        position: data.position,
        estimatedWaitTime: await this.calculateEstimatedWaitTime(data.barId, data.position),
        timestamp: data.timestamp
      });

      // Update queue positions for other users
      await this.notifyQueuePositionUpdates(data.barId);

    } catch (error) {
      logger.error('Error handling song_added event:', error);
    }
  }

  private async handleSongStatusChanged(data: SongStatusChangedEventData) {
    try {
      logger.info(`Song status changed: ${data.queueId} from ${data.oldStatus} to ${data.newStatus}`);
      
      const queueEntry = await QueueModel.findById(data.queueId!, true);
      if (!queueEntry) {
        logger.error(`Queue entry not found: ${data.queueId}`);
        return;
      }

      // Emit to all users in the bar
      emitToBar(data.barId, 'song_status_changed', {
        queueEntry,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        reason: data.reason,
        timestamp: data.timestamp
      });

      // Emit specific event to the song requester
      if (queueEntry.user_id) {
        const eventName = this.getStatusEventName(data.newStatus);
        emitToUser(queueEntry.user_id, eventName, {
          queueEntry,
          reason: data.reason,
          timestamp: data.timestamp
        });
      }

      // If song was approved or rejected, update positions
      if (data.newStatus === 'approved' || data.newStatus === 'rejected') {
        await this.notifyQueuePositionUpdates(data.barId);
      }

    } catch (error) {
      logger.error('Error handling song_status_changed event:', error);
    }
  }

  private async handleQueueReordered(data: QueueReorderedEventData) {
    try {
      logger.info(`Queue reordered for bar ${data.barId}`);
      
      // Emit to all users in the bar
      emitToBar(data.barId, 'queue_reordered', {
        newOrder: data.newOrder,
        affectedPositions: data.affectedPositions,
        timestamp: data.timestamp
      });

      // Notify affected users about their new positions
      for (const position of data.affectedPositions) {
        const queueEntry = await QueueModel.findById(position.queueId, true);
        if (queueEntry && queueEntry.user_id) {
          emitToUser(queueEntry.user_id, 'your_song_position_changed', {
            queueEntry,
            oldPosition: position.oldPosition,
            newPosition: position.newPosition,
            timestamp: data.timestamp
          });
        }
      }

    } catch (error) {
      logger.error('Error handling queue_reordered event:', error);
    }
  }

  private async handleCurrentSongChanged(data: CurrentSongChangedEventData) {
    try {
      logger.info(`Current song changed for bar ${data.barId}`);
      
      // Get current song details
      let currentSong = null;
      let nextSong = null;
      
      if (data.currentSongId) {
        currentSong = await QueueModel.getCurrentlyPlaying(data.barId);
      }
      
      if (data.nextSongId) {
        nextSong = await QueueModel.getNextInQueue(data.barId);
      }

      // Emit to all users in the bar
      emitToBar(data.barId, 'current_song_changed', {
        previousSongId: data.previousSongId,
        currentSong,
        nextSong,
        timestamp: data.timestamp
      });

      // Update queue positions for all users
      await this.notifyQueuePositionUpdates(data.barId);

    } catch (error) {
      logger.error('Error handling current_song_changed event:', error);
    }
  }

  private async handleQueueCleared(data: QueueEventData) {
    try {
      logger.info(`Queue cleared for bar ${data.barId}`);
      
      // Emit to all users in the bar
      emitToBar(data.barId, 'queue_cleared', {
        barId: data.barId,
        clearedBy: data.userId,
        timestamp: data.timestamp,
        metadata: data.metadata
      });

    } catch (error) {
      logger.error('Error handling queue_cleared event:', error);
    }
  }

  private async handleUserPointsUpdated(data: QueueEventData & { newBalance: number; pointsUsed: number }) {
    try {
      logger.info(`Points updated for user ${data.userId}: ${data.pointsUsed} points used`);
      
      // Emit to the specific user
      if (data.userId) {
        emitToUser(data.userId, 'points_updated', {
          newBalance: data.newBalance,
          pointsUsed: data.pointsUsed,
          barId: data.barId,
          timestamp: data.timestamp
        });
      }

    } catch (error) {
      logger.error('Error handling user_points_updated event:', error);
    }
  }

  private async handleQueueStatsUpdated(data: QueueEventData) {
    try {
      logger.info(`Queue stats updated for bar ${data.barId}`);
      
      // Get updated stats
      const stats = await QueueModel.getQueueStats(data.barId);
      
      // Emit to admin/bar owner users in the bar
      emitToBar(data.barId, 'queue_stats_updated', {
        stats,
        timestamp: data.timestamp
      });

    } catch (error) {
      logger.error('Error handling queue_stats_updated event:', error);
    }
  }

  // Helper methods
  private getStatusEventName(status: string): string {
    switch (status) {
      case 'approved':
        return 'your_song_approved';
      case 'rejected':
        return 'your_song_rejected';
      case 'playing':
        return 'your_song_playing';
      case 'played':
        return 'your_song_played';
      case 'skipped':
        return 'your_song_skipped';
      default:
        return 'your_song_status_changed';
    }
  }

  private async calculateEstimatedWaitTime(barId: string, position: number): Promise<number> {
    try {
      // Get average song duration and current playing time
      const avgSongDuration = 3.5; // minutes (can be calculated from historical data)
      const estimatedMinutes = (position - 1) * avgSongDuration;
      return Math.max(0, estimatedMinutes);
    } catch (error) {
      logger.error('Error calculating estimated wait time:', error);
      return 0;
    }
  }

  private async notifyQueuePositionUpdates(barId: string) {
    try {
      // Get all pending songs in the queue
      const queueResult = await QueueModel.findByBarId(barId, {
        status: ['pending', 'approved'],
        includeDetails: true
      });

      // Notify each user about their current position
      for (let i = 0; i < queueResult.data.length; i++) {
        const queueEntry = queueResult.data[i];
        if (queueEntry.user_id) {
          const position = i + 1;
          const estimatedWaitTime = await this.calculateEstimatedWaitTime(barId, position);
          
          emitToUser(queueEntry.user_id, 'queue_position_updated', {
            queueEntry,
            position,
            estimatedWaitTime,
            totalInQueue: queueResult.total,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      logger.error('Error notifying queue position updates:', error);
    }
  }

  // Public methods to emit events
  emitSongAdded(data: SongAddedEventData) {
    this.emit('song_added', data);
  }

  emitSongStatusChanged(data: SongStatusChangedEventData) {
    this.emit('song_status_changed', data);
  }

  emitQueueReordered(data: QueueReorderedEventData) {
    this.emit('queue_reordered', data);
  }

  emitCurrentSongChanged(data: CurrentSongChangedEventData) {
    this.emit('current_song_changed', data);
  }

  emitQueueCleared(data: QueueEventData) {
    this.emit('queue_cleared', data);
  }

  emitUserPointsUpdated(data: QueueEventData & { newBalance: number; pointsUsed: number }) {
    this.emit('user_points_updated', data);
  }

  emitQueueStatsUpdated(data: QueueEventData) {
    this.emit('queue_stats_updated', data);
  }
}

// Export singleton instance
export const QueueEventEmitter = new QueueEventEmitterClass();

// Export types
export type {
  QueueEventData,
  SongAddedEventData,
  SongStatusChangedEventData,
  QueueReorderedEventData,
  CurrentSongChangedEventData
};