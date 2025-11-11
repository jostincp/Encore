import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger';
import { validateRequired, validateUUID, validateEnum } from '../../../shared/utils/validation';
import { QueueEventEmitter } from '../events/queueEvents';
import { emitToBar, emitToUser } from '../websocket/socketHandler';
import { UserRole } from '../../../shared/types/index';
import redisQueueManager, { QueueItem } from '../redis/queueManager';
import pointsServiceClient, { PointsDeductRequest, PointsRefundRequest } from '../services/pointsService';

// Models (temporal hasta tener shared models)
const SongModel = {
  async findById(id: string) {
    return { 
      id, 
      title: 'Test Song', 
      artist: 'Test Artist',
      video_id: 'test_video_id',
      is_available: true 
    } as any;
  }
};

const BarModel = {
  async findById(id: string) {
    return { 
      id, 
      name: 'Test Bar',
      is_active: true,
      settings: {
        points_enabled: true,
        max_queue_size: 50
      }
    } as any;
  }
};

const UserModel = {
  async findById(id: string) {
    return { 
      id, 
      username: 'testuser',
      points: 1000,
      role: 'user'
    } as any;
  }
};

// Note: Avoid strict cross-package typing for Request due to duplicate @types/express.
// Controllers accept loosely-typed req/res to prevent type conflicts at route mounting time.
type AnyRequest = any;
type AnyResponse = any;

export class QueueController {
  /**
   * 🔥 CRÍTICO: Añadir canción a la cola con validación de puntos PRIMERO
   * IMPLEMENTACIÓN CORRECTA según auditoría
   */
  static async addToQueue(req: AnyRequest, res: AnyResponse) {
    const startTime = Date.now();
    let pointsTransactionId: string | undefined;
    
    try {
      const { bar_id, song_id, priority_play = false, notes } = req.body;
      const userId: string = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized: missing user context' });
      }
      
      // Validar campos requeridos
      validateRequired(bar_id, 'bar_id');
      validateRequired(song_id, 'song_id');
      validateUUID(bar_id, 'bar_id');
      validateUUID(song_id, 'song_id');
      
      logger.info('🎵 Starting addToQueue process', {
        userId,
        barId: bar_id,
        songId: song_id,
        priority: priority_play
      });

      // 1. Verificar que el bar existe y está activo
      const bar = await BarModel.findById(bar_id);
      if (!bar || !bar.is_active) {
        return res.status(404).json({ success: false, message: 'Bar not found or inactive' });
      }

      // 2. Verificar que la canción existe y está disponible
      const song = await SongModel.findById(song_id);
      if (!song || !song.is_available) {
        return res.status(404).json({ success: false, message: 'Song not found or unavailable' });
      }

      // 3. Verificar que el usuario existe
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // 4. 🔥 CRÍTICO: Obtener costos según configuración del bar
      const costs = await pointsServiceClient.getCosts(bar_id);
      const costPerSong = priority_play ? costs.prioritySong : costs.standardSong;

      // 5. 🔥 CRÍTICO: VERIFICAR DUPLICADO O(1) ANTES de cobrar puntos
      const isDuplicate = await redisQueueManager.isSongInQueue(bar_id, song.video_id);
      if (isDuplicate) {
        logger.warn('🚫 Song already in queue (O(1) check)', {
          userId,
          barId: bar_id,
          videoId: song.video_id,
          songTitle: song.title
        });
        return res.status(409).json({ 
          success: false, 
          message: 'Song already in queue',
          code: 'DUPLICATE_SONG'
        });
      }

      // 6. 🔥 CRÍTICO: COMUNICACIÓN SÍNCRONA CON POINTS SERVICE ANTES DE REDIS
      logger.info('💰 CRITICAL: Calling Points Service BEFORE Redis operation', {
        userId,
        barId: bar_id,
        amount: costPerSong,
        songTitle: song.title
      });

      const pointsRequest: PointsDeductRequest = {
        userId,
        barId: bar_id,
        amount: costPerSong,
        reason: priority_play ? 'priority_song' : 'song_request',
        metadata: {
          songId: song_id,
          videoId: song.video_id,
          title: song.title
        }
      };

      const pointsResponse = await pointsServiceClient.deductPoints(pointsRequest);

      if (!pointsResponse.success) {
        logger.error('❌ Points deduction failed - ABORTING queue operation', {
          userId,
          barId: bar_id,
          amount: costPerSong,
          error: pointsResponse.error,
          insufficientFunds: pointsResponse.insufficientFunds
        });

        const statusCode = pointsResponse.insufficientFunds ? 402 : 400;
        return res.status(statusCode).json({
          success: false,
          message: pointsResponse.error || 'Failed to deduct points',
          code: pointsResponse.insufficientFunds ? 'INSUFFICIENT_POINTS' : 'POINTS_ERROR'
        });
      }

      // ✅ Puntos deducidos exitosamente
      pointsTransactionId = pointsResponse.transactionId;
      logger.info('✅ Points deducted successfully - proceeding with Redis operation', {
        userId,
        barId: bar_id,
        amount: costPerSong,
        newBalance: pointsResponse.newBalance,
        transactionId: pointsTransactionId
      });

      // 7. 🔥 CRÍTICO: Operación atómica en Redis con MULTI/EXEC
      const queueItem: QueueItem = {
        id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        barId: bar_id,
        songId: song_id,
        videoId: song.video_id,
        title: song.title,
        artist: song.artist,
        userId: userId,
        username: user.username,
        type: priority_play ? 'priority' : 'standard',
        position: 0, // Se asignará en Redis
        status: 'pending',
        pointsCost: costPerSong,
        requestedAt: new Date(),
        notes: notes || ''
      };

      const redisResult = await redisQueueManager.addToQueue(queueItem);

      if (!redisResult.success) {
        // 🔥 CRÍTICO: Rollback de puntos si falla Redis
        logger.error('💥 Redis operation failed - initiating points rollback', {
          userId,
          barId: bar_id,
          transactionId: pointsTransactionId,
          redisError: redisResult.error
        });

        const refundRequest: PointsRefundRequest = {
          userId,
          barId: bar_id,
          amount: costPerSong,
          reason: 'queue_error',
          originalTransactionId: pointsTransactionId,
          metadata: {
            songId: song_id,
            videoId: song.video_id,
            errorReason: redisResult.error
          }
        };

        const refundResult = await pointsServiceClient.refundPoints(refundRequest);
        
        if (!refundResult.success) {
          logger.error('🚨 CRITICAL: Points rollback failed - MANUAL INTERVENTION REQUIRED', {
            userId,
            barId: bar_id,
            amount: costPerSong,
            originalTransactionId: pointsTransactionId,
            refundError: refundResult.error
          });
        } else {
          logger.info('✅ Points rollback completed successfully', {
            userId,
            barId: bar_id,
            amount: costPerSong,
            refundTransactionId: refundResult.transactionId
          });
        }

        return res.status(500).json({
          success: false,
          message: 'Failed to add song to queue - points refunded',
          code: 'QUEUE_ERROR_ROLLBACK'
        });
      }

      // 8. ✅ Éxito completo - Emitir eventos WebSocket
      const queue = await redisQueueManager.getQueue(bar_id);
      
      // Emitir a todos los clientes del bar
      emitToBar(bar_id, {
        type: 'queue_updated',
        data: {
          action: 'song_added',
          queue: queue.items,
          stats: queue.stats,
          addedBy: user.username,
          songTitle: song.title,
          priority: priority_play
        }
      });

      // Emitir al usuario específico
      emitToUser(userId, {
        type: 'song_added_success',
        data: {
          position: redisResult.position,
          queueLength: queue.stats.totalItems,
          estimatedWaitTime: queue.stats.estimatedWaitTime,
          pointsDeducted: costPerSong,
          newBalance: pointsResponse.newBalance
        }
      });

      // Emitir evento para analytics
      QueueEventEmitter.emit('song_added', {
        barId: bar_id,
        userId: userId,
        songId: song_id,
        priority: priority_play,
        pointsUsed: costPerSong,
        position: redisResult.position,
        processingTime: Date.now() - startTime
      });

      logger.info('🎉 addToQueue completed successfully', {
        userId,
        barId: bar_id,
        songId: song_id,
        position: redisResult.position,
        pointsDeducted: costPerSong,
        processingTime: Date.now() - startTime,
        transactionId: pointsTransactionId
      });

      return res.status(201).json({
        success: true,
        message: 'Song added to queue successfully',
        data: {
          queueItem: {
            ...queueItem,
            position: redisResult.position
          },
          queue: queue.items,
          stats: queue.stats,
          pointsDeducted: costPerSong,
          newBalance: pointsResponse.newBalance,
          transactionId: pointsTransactionId
        }
      });

    } catch (error) {
      // 🔥 CRÍTICO: Error inesperado - intentar rollback si hay transacción
      if (pointsTransactionId) {
        logger.error('💥 Unexpected error - attempting emergency points rollback', {
          userId: req.user?.id,
          transactionId: pointsTransactionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        try {
          const emergencyRefund: PointsRefundRequest = {
            userId: req.user?.id,
            barId: req.body.bar_id,
            amount: req.body.priority_play ? 25 : 10, // Estimar costo
            reason: 'system_error',
            originalTransactionId: pointsTransactionId,
            metadata: {
              errorReason: error instanceof Error ? error.message : 'Unknown error'
            }
          };

          await pointsServiceClient.refundPoints(emergencyRefund);
          logger.info('✅ Emergency points rollback completed');
        } catch (rollbackError) {
          logger.error('🚨 CRITICAL: Emergency rollback failed - MANUAL INTERVENTION REQUIRED', {
            transactionId: pointsTransactionId,
            rollbackError: rollbackError instanceof Error ? rollbackError.message : 'Unknown error'
          });
        }
      }

      logger.error('Error in addToQueue:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
  
  /**
   * Obtener cola completa de un bar
   */
  static async getQueue(req: AnyRequest, res: AnyResponse) {
    try {
      const { bar_id } = req.params;
      
      validateRequired(bar_id, 'bar_id');
      validateUUID(bar_id, 'bar_id');

      // Verificar que el bar existe
      const bar = await BarModel.findById(bar_id);
      if (!bar) {
        return res.status(404).json({ success: false, message: 'Bar not found' });
      }

      // Obtener cola desde Redis
      const queue = await redisQueueManager.getQueue(bar_id);

      return res.status(200).json({
        success: true,
        data: queue
      });
      
    } catch (error) {
      logger.error('Error getting queue:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  // Get currently playing song
  static async getCurrentlyPlaying(req: AnyRequest, res: AnyResponse) {
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
  static async getNextInQueue(req: AnyRequest, res: AnyResponse) {
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
  static async updateQueueEntry(req: AnyRequest, res: AnyResponse) {
    try {
      const { id } = req.params;
      const { status, position, notes, rejection_reason } = req.body;
      const userRole = req.user!.role;
      
      validateUUID(id, 'id');
      
      // Check permissions
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.BAR_OWNER && userRole !== UserRole.STAFF) {
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
      
      // For bar owners/staff, check if they belong to the bar
      if ((userRole === 'bar_owner' || userRole === 'staff') && req.user!.barId !== currentEntry.bar_id) {
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
  static async removeFromQueue(req: AnyRequest, res: AnyResponse) {
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
        (userRole === 'staff' && req.user!.barId === queueEntry.bar_id) ||
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
  static async reorderQueue(req: AnyRequest, res: AnyResponse) {
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
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.BAR_OWNER && userRole !== UserRole.STAFF) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if ((userRole === 'bar_owner' || userRole === 'staff') && req.user!.barId !== barId) {
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
  static async clearQueue(req: AnyRequest, res: AnyResponse) {
    try {
      const { barId } = req.params;
      const { status } = req.body;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      
      // Check permissions
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.BAR_OWNER && userRole !== UserRole.STAFF) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if ((userRole === 'bar_owner' || userRole === 'staff') && req.user!.barId !== barId) {
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
  static async getQueueStats(req: AnyRequest, res: AnyResponse) {
    try {
      const { barId } = req.params;
      const { date_from, date_to } = req.query;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner' && userRole !== 'staff') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if ((userRole === 'bar_owner' || userRole === 'staff') && req.user!.barId !== barId) {
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
  static async getUserQueuePosition(req: AnyRequest, res: AnyResponse) {
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
  static async getUserQueue(req: AnyRequest, res: AnyResponse) {
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
  static async skipCurrentSong(req: AnyRequest, res: AnyResponse) {
    try {
      const { barId } = req.params;
      const { reason } = req.body;
      const userRole = req.user!.role;
      
      validateUUID(barId, 'barId');
      
      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner' && userRole !== 'staff') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or bar owner role required.'
        });
      }
      
      // For bar owners, check if they own the bar
      if ((userRole === 'bar_owner' || userRole === 'staff') && req.user!.barId !== barId) {
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
  static async playNextSong(req: AnyRequest, res: AnyResponse) {
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

  /**
   * Health check del servicio
   */
  static async healthCheck(req: AnyRequest, res: AnyResponse) {
    try {
      const [redisHealth, pointsHealth] = await Promise.all([
        redisQueueManager.healthCheck(),
        pointsServiceClient.healthCheck()
      ]);

      const isHealthy = redisHealth.status === 'healthy' && pointsHealth.healthy;

      return res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: {
          redis: redisHealth,
          pointsService: pointsHealth,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error in health check:', error);
      return res.status(503).json({
        success: false,
        message: 'Service unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}