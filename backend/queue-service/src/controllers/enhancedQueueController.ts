import { Request, Response } from 'express';
import { musicQueueService, Track } from '../services/musicQueueService';
import { emitToBar } from '../websocket/socketHandler';
import logger from '../../../shared/utils/logger';

export class EnhancedQueueController {
  /**
   * Añadir canción a la cola con validación de puntos y duplicados
   */
  static async addToQueue(req: Request, res: Response): Promise<void> {
    try {
      const { bar_id, song_id, priority_play = false, points_used, notes } = req.body;
      const userId: string = (req.user as any)?.id || (req.user as any)?.userId;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado' });
        return;
      }

      // Validar campos requeridos
      if (!bar_id || !song_id) {
        res.status(400).json({
          success: false,
          message: 'bar_id y song_id son requeridos'
        });
        return;
      }

      // TODO: Validar que el usuario tenga suficientes puntos
      // TODO: Verificar que la canción no esté duplicada
      // TODO: Verificar límites de usuario

      // Crear objeto de canción (mock por ahora)
      const track: Omit<Track, 'source' | 'barId'> = {
        videoId: song_id, // Asumiendo que song_id es videoId por ahora
        title: 'Canción de ejemplo', // TODO: Obtener de servicio de música
        thumbnail: 'https://example.com/thumbnail.jpg',
        duration: 180, // 3 minutos
        userId,
        addedAt: new Date()
      };

      // Determinar tipo de cola
      const type = priority_play ? 'priority' : 'standard';

      // Añadir a la cola usando el servicio Redis
      const result = await musicQueueService.addToQueue(
        bar_id,
        track,
        type,
        userId,
        10 // límite de 10 canciones por usuario
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      // Notificar a todos los clientes conectados al bar
      emitToBar(bar_id, 'SONG_ADDED', {
        track: result.track,
        timestamp: new Date().toISOString()
      });

      logger.info(`Canción añadida a cola ${type} en bar ${bar_id} por usuario ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Canción añadida a la cola exitosamente',
        data: result.track
      });

    } catch (error) {
      logger.error('Error añadiendo canción a cola:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estado completo de la cola
   */
  static async getQueueState(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;

      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'barId es requerido'
        });
        return;
      }

      const queueState = await musicQueueService.getQueueState(barId);

      res.json({
        success: true,
        data: queueState
      });

    } catch (error) {
      logger.error('Error obteniendo estado de cola:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de la cola
   */
  static async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;

      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'barId es requerido'
        });
        return;
      }

      const stats = await musicQueueService.getQueueStats(barId);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error obteniendo estadísticas de cola:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Limpiar cola completa
   */
  static async clearQueue(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userRole = req.user?.role;

      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'barId es requerido'
        });
        return;
      }

      // TODO: Verificar permisos de admin/bar owner

      await musicQueueService.clearQueue(barId);

      // Notificar a todos los clientes
      emitToBar(barId, 'QUEUE_CLEARED', {
        timestamp: new Date().toISOString()
      });

      logger.info(`Cola limpiada para bar ${barId}`);

      res.json({
        success: true,
        message: 'Cola limpiada exitosamente'
      });

    } catch (error) {
      logger.error('Error limpiando cola:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Verificar si usuario puede añadir más canciones
   */
  static async checkUserLimit(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.userId;
      const limit = 10; // TODO: obtener de configuración

      if (!barId || !userId) {
        res.status(400).json({
          success: false,
          message: 'barId y userId son requeridos'
        });
        return;
      }

      const canAdd = await musicQueueService.canUserAddSong(barId, userId, limit);

      res.json({
        success: true,
        data: {
          canAdd,
          currentLimit: limit,
          barId,
          userId
        }
      });

    } catch (error) {
      logger.error('Error verificando límite de usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}