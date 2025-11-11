import { Request, Response } from 'express';
import { musicQueueService, Track } from '../services/musicQueueService';
import { emitToBar } from '../websocket/socketHandler';
import logger from '../../../shared/utils/logger';

export class NextTrackController {
  /**
   * Obtener siguiente canción (llamado automáticamente al terminar una canción)
   */
  static async getNextTrack(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;

      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'barId es requerido'
        });
        return;
      }

      logger.info(`Obteniendo siguiente canción para bar: ${barId}`);

      // Ejecutar algoritmo getNextTrack
      const nextTrack = await musicQueueService.getNextTrack(barId);

      if (nextTrack) {
        // Notificar a todos los clientes conectados al bar
        emitToBar(barId, 'TRACK_CHANGED', {
          track: nextTrack,
          timestamp: new Date().toISOString()
        });

        // Log para análisis
        logger.info(`Nueva canción en reproducción: ${nextTrack.title} (${nextTrack.videoId}) en bar ${barId}`);

        res.json({
          success: true,
          data: nextTrack
        });
      } else {
        // Caso extremo: no hay canciones disponibles
        emitToBar(barId, 'ERROR_NO_TRACK', {
          message: 'No hay canciones disponibles',
          timestamp: new Date().toISOString()
        });

        logger.warn(`No hay canciones disponibles para bar ${barId}`);

        res.status(404).json({
          success: false,
          message: 'No hay canciones disponibles'
        });
      }

    } catch (error) {
      logger.error('Error obteniendo siguiente canción:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Forzar siguiente canción (skip manual por admin)
   */
  static async skipTrack(req: Request, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { reason } = req.body;

      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'barId es requerido'
        });
        return;
      }

      logger.info(`Saltando canción manualmente en bar: ${barId}, razón: ${reason || 'No especificada'}`);

      // Obtener siguiente canción
      const nextTrack = await musicQueueService.getNextTrack(barId);

      if (nextTrack) {
        // Notificar skip
        emitToBar(barId, 'TRACK_SKIPPED', {
          skippedTrack: null, // TODO: obtener canción actual antes del skip
          nextTrack,
          reason,
          timestamp: new Date().toISOString()
        });

        res.json({
          success: true,
          message: 'Canción saltada exitosamente',
          data: nextTrack
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'No hay siguiente canción disponible'
        });
      }

    } catch (error) {
      logger.error('Error saltando canción:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estado actual de la cola
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
}