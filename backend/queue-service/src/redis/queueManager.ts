import Redis from 'ioredis';
import logger from './logger';

export interface QueueItem {
  id: string;
  barId: string;
  songId: string;
  videoId: string;
  title: string;
  artist: string;
  userId: string;
  username: string;
  type: 'priority' | 'standard';
  position: number;
  status: 'pending' | 'playing' | 'completed';
  pointsCost: number;
  requestedAt: Date;
  estimatedPlayTime?: Date;
}

export interface QueueStats {
  totalItems: number;
  priorityItems: number;
  standardItems: number;
  currentlyPlaying?: QueueItem;
  estimatedWaitTime: number;
}

class RedisQueueManager {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis Queue Manager connected');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis Queue Manager error:', error);
    });
  }

  /**
   * Obtener cliente Redis
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * Verificar conexión
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Estructura Redis exacta según auditoría:
   * queue:{barId}:current (STRING/JSON)
   * queue:{barId}:priority (LIST)
   * queue:{barId}:standard (LIST)
   * queue:{barId}:set (SET) para deduplicación O(1)
   */

  /**
   * Añadir item a la cola con atomicidad
   */
  async addToQueue(item: QueueItem): Promise<{ success: boolean; position?: number; error?: string }> {
    try {
      const queueKey = `queue:${item.barId}:${item.type}`;
      const setKey = `queue:${item.barId}:set`;
      const currentKey = `queue:${item.barId}:current`;

      // Verificar duplicado O(1) con SISMEMBER
      const isDuplicate = await this.redis.sismember(setKey, item.videoId);
      if (isDuplicate) {
        return { success: false, error: 'Song already in queue' };
      }

      // Transacción atómica MULTI/EXEC
      const multi = this.redis.multi();
      
      // Añadir a la lista correspondiente
      multi.rpush(queueKey, JSON.stringify(item));
      
      // Añadir al set de deduplicación
      multi.sadd(setKey, item.videoId);
      
      // Obtener posición
      multi.llen(queueKey);

      const results = await multi.exec();
      
      if (!results) {
        return { success: false, error: 'Redis transaction failed' };
      }

      const position = results[2][1] as number;
      
      logger.info(`Added to queue: ${item.title} at position ${position}`);
      
      return { success: true, position };
    } catch (error) {
      logger.error('Error adding to queue:', error);
      return { success: false, error: 'Failed to add to queue' };
    }
  }

  /**
   * Eliminar item de la cola con atomicidad
   */
  async removeFromQueue(barId: string, itemId: string, videoId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const priorityKey = `queue:${barId}:priority`;
      const standardKey = `queue:${barId}:standard`;
      const setKey = `queue:${barId}:set`;

      // Transacción atómica
      const multi = this.redis.multi();
      
      // Eliminar de ambas listas (no sabemos en cuál está)
      multi.lrem(priorityKey, 0, itemId);
      multi.lrem(standardKey, 0, itemId);
      
      // Eliminar del set de deduplicación
      multi.srem(setKey, videoId);

      const results = await multi.exec();
      
      if (!results) {
        return { success: false, error: 'Redis transaction failed' };
      }

      logger.info(`Removed from queue: ${itemId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error removing from queue:', error);
      return { success: false, error: 'Failed to remove from queue' };
    }
  }

  /**
   * Obtener cola completa de un bar
   */
  async getQueue(barId: string): Promise<{ items: QueueItem[]; stats: QueueStats }> {
    try {
      const priorityKey = `queue:${barId}:priority`;
      const standardKey = `queue:${barId}:standard`;
      const currentKey = `queue:${barId}:current`;

      // Obtener items de ambas colas
      const [priorityItems, standardItems, current] = await Promise.all([
        this.redis.lrange(priorityKey, 0, -1),
        this.redis.lrange(standardKey, 0, -1),
        this.redis.get(currentKey)
      ]);

      // Parsear items
      const parsedPriority = priorityItems.map(item => JSON.parse(item));
      const parsedStandard = standardItems.map(item => JSON.parse(item));
      const currentlyPlaying = current ? JSON.parse(current) : null;

      // Combinar en orden correcto (priority first)
      const allItems: QueueItem[] = [
        ...parsedPriority.map((item, index) => ({ ...item, position: index + 1 })),
        ...parsedStandard.map((item, index) => ({ 
          ...item, 
          position: parsedPriority.length + index + 1 
        }))
      ];

      // Calcular estadísticas
      const stats: QueueStats = {
        totalItems: allItems.length,
        priorityItems: parsedPriority.length,
        standardItems: parsedStandard.length,
        currentlyPlaying,
        estimatedWaitTime: this.calculateEstimatedWaitTime(allItems)
      };

      return { items: allItems, stats };
    } catch (error) {
      logger.error('Error getting queue:', error);
      return { items: [], stats: { totalItems: 0, priorityItems: 0, standardItems: 0, estimatedWaitTime: 0 } };
    }
  }

  /**
   * Establecer canción actual
   */
  async setCurrentSong(barId: string, item: QueueItem): Promise<{ success: boolean; error?: string }> {
    try {
      const currentKey = `queue:${barId}:current`;
      
      await this.redis.set(currentKey, JSON.stringify(item));
      
      logger.info(`Set current song: ${item.title} for bar ${barId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error setting current song:', error);
      return { success: false, error: 'Failed to set current song' };
    }
  }

  /**
   * Obtener canción actual
   */
  async getCurrentSong(barId: string): Promise<QueueItem | null> {
    try {
      const currentKey = `queue:${barId}:current`;
      const current = await this.redis.get(currentKey);
      
      return current ? JSON.parse(current) : null;
    } catch (error) {
      logger.error('Error getting current song:', error);
      return null;
    }
  }

  /**
   * Verificar si canción está en cola (O(1))
   */
  async isSongInQueue(barId: string, videoId: string): Promise<boolean> {
    try {
      const setKey = `queue:${barId}:set`;
      return await this.redis.sismember(setKey, videoId);
    } catch (error) {
      logger.error('Error checking if song is in queue:', error);
      return false;
    }
  }

  /**
   * Limpiar cola completa de un bar
   */
  async clearQueue(barId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const priorityKey = `queue:${barId}:priority`;
      const standardKey = `queue:${barId}:standard`;
      const setKey = `queue:${barId}:set`;
      const currentKey = `queue:${barId}:current`;

      const multi = this.redis.multi();
      multi.del(priorityKey);
      multi.del(standardKey);
      multi.del(setKey);
      multi.del(currentKey);

      await multi.exec();
      
      logger.info(`Cleared queue for bar ${barId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error clearing queue:', error);
      return { success: false, error: 'Failed to clear queue' };
    }
  }

  /**
   * Mover siguiente canción a reproducción
   */
  async moveToNext(barId: string): Promise<QueueItem | null> {
    try {
      const queue = await this.getQueue(barId);
      
      if (queue.items.length === 0) {
        return null;
      }

      const nextItem = queue.items[0];
      
      // Establecer como actual
      await this.setCurrentSong(barId, nextItem);
      
      // Eliminar de la cola
      await this.removeFromQueue(barId, JSON.stringify(nextItem), nextItem.videoId);
      
      logger.info(`Moved to next song: ${nextItem.title}`);
      return nextItem;
    } catch (error) {
      logger.error('Error moving to next song:', error);
      return null;
    }
  }

  /**
   * Calcular tiempo de espera estimado
   */
  private calculateEstimatedWaitTime(items: QueueItem[]): number {
    const AVERAGE_SONG_DURATION = 3.5 * 60 * 1000; // 3.5 minutos en milisegundos
    return items.length * AVERAGE_SONG_DURATION;
  }

  /**
   * Obtener estadísticas detalladas
   */
  async getDetailedStats(barId: string): Promise<any> {
    try {
      const priorityKey = `queue:${barId}:priority`;
      const standardKey = `queue:${barId}:standard`;
      const setKey = `queue:${barId}:set`;
      const currentKey = `queue:${barId}:current`;

      const [priorityCount, standardCount, setCount, current] = await Promise.all([
        this.redis.llen(priorityKey),
        this.redis.llen(standardKey),
        this.redis.scard(setKey),
        this.redis.get(currentKey)
      ]);

      return {
        priorityCount,
        standardCount,
        totalUniqueSongs: setCount,
        currentlyPlaying: current ? JSON.parse(current) : null,
        totalInQueue: priorityCount + standardCount
      };
    } catch (error) {
      logger.error('Error getting detailed stats:', error);
      return null;
    }
  }

  /**
   * Health check de Redis
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Desconectar
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    this.isConnected = false;
  }
}

// Singleton
const redisQueueManager = new RedisQueueManager();
export default redisQueueManager;
