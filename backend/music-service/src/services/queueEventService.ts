import Redis from 'ioredis';
import { getRedisClient } from '@shared/utils/redis';
import logger from '@shared/utils/logger';

export class QueueEventService {
  private static instance: QueueEventService;
  private redisPublisher: Redis | null = null;

  private constructor() {}

  public static getInstance(): QueueEventService {
    if (!QueueEventService.instance) {
      QueueEventService.instance = new QueueEventService();
    }
    return QueueEventService.instance;
  }

  private async getRedisPublisher(): Promise<Redis | null> {
    if (this.redisPublisher) return this.redisPublisher;

    const client = getRedisClient();
    if (client && 'publish' in client) {
      this.redisPublisher = client as Redis;
      return this.redisPublisher;
    }

    logger.warn('Redis not available for pub/sub, queue events will not be emitted', {
      service: 'music-service'
    });
    return null;
  }

  /**
   * Emitir evento de cambio en la cola
   */
  async emitQueueUpdate(barId: string, eventType: string, data: any) {
    try {
      const redisPublisher = await this.getRedisPublisher();
      if (!redisPublisher) return;

      const eventData = {
        barId,
        eventType,
        data,
        timestamp: new Date().toISOString()
      };

      // Publicar en Redis para que el queue-service lo reciba
      await redisPublisher.publish('queue:events', JSON.stringify(eventData));

      logger.debug('Queue event emitted', {
        barId,
        eventType,
        service: 'music-service'
      });
    } catch (error) {
      logger.error('Failed to emit queue event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        barId,
        eventType,
        service: 'music-service'
      });
    }
  }

  /**
   * Notificar cuando se añade una canción a la cola
   */
  async songAdded(barId: string, queueEntry: any) {
    await this.emitQueueUpdate(barId, 'song_added', {
      queueEntry,
      action: 'add'
    });
  }

  /**
   * Notificar cuando se actualiza el estado de una canción
   */
  async songStatusUpdated(barId: string, queueEntry: any, oldStatus: string, newStatus: string) {
    await this.emitQueueUpdate(barId, 'song_status_updated', {
      queueEntry,
      oldStatus,
      newStatus,
      action: 'status_update'
    });
  }

  /**
   * Notificar cuando se elimina una canción de la cola
   */
  async songRemoved(barId: string, queueId: string) {
    await this.emitQueueUpdate(barId, 'song_removed', {
      queueId,
      action: 'remove'
    });
  }

  /**
   * Notificar cuando se reordena la cola
   */
  async queueReordered(barId: string, newOrder: string[]) {
    await this.emitQueueUpdate(barId, 'queue_reordered', {
      newOrder,
      action: 'reorder'
    });
  }

  /**
    * Notificar cuando se limpia la cola
    */
   async queueCleared(barId: string, clearedCount: number) {
     await this.emitQueueUpdate(barId, 'queue_cleared', {
       clearedCount,
       action: 'clear'
     });
   }

   /**
    * Notificar cuando se debe reproducir la siguiente canción
    */
   async playNextSong(barId: string, nextSong: any) {
     await this.emitQueueUpdate(barId, 'play_next_song', {
       nextSong,
       action: 'play_next'
     });
   }
}

export const queueEventService = QueueEventService.getInstance();