import { getRedisClient } from '../../../shared/utils/redis';
import logger from '../../../shared/utils/logger';

export interface Track {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number;
  source: 'priority' | 'standard' | 'fallback';
  userId?: string;
  barId: string;
  addedAt?: Date;
}

export interface QueueState {
  current?: Track;
  priority: Track[];
  standard: Track[];
  activeVideoIds: Set<string>;
}

export class MusicQueueService {
  private static instance: MusicQueueService;
  private redis = getRedisClient();

  private constructor() {}

  public static getInstance(): MusicQueueService {
    if (!MusicQueueService.instance) {
      MusicQueueService.instance = new MusicQueueService();
    }
    return MusicQueueService.instance;
  }

  /**
   * Añadir canción a la cola con validación de duplicados y límites
   */
  async addToQueue(
    barId: string,
    track: Omit<Track, 'source' | 'barId'>,
    type: 'priority' | 'standard',
    userId: string,
    userSongLimit: number = 10
  ): Promise<{ success: boolean; message: string; track?: Track }> {
    try {
      const videoId = track.videoId;
      const setKey = `queue:${barId}:set`;
      const userCountKey = `queue:${barId}:user:${userId}:count`;

      // Verificar si la canción ya está en cola
      const isDuplicate = await this.redis.sismember(setKey, videoId);
      if (isDuplicate === 1) {
        return { success: false, message: 'Canción ya está en la cola' };
      }

      // Verificar límite de canciones por usuario (solo para standard)
      if (type === 'standard') {
        const userCount = await this.redis.get(userCountKey);
        const currentCount = userCount ? parseInt(userCount) : 0;

        if (currentCount >= userSongLimit) {
          return { success: false, message: `Límite de ${userSongLimit} canciones alcanzado` };
        }
      }

      // Crear objeto track completo
      const fullTrack: Track = {
        ...track,
        source: type,
        barId,
        userId,
        addedAt: new Date()
      };

      // Determinar cola destino
      const queueKey = type === 'priority'
        ? `queue:${barId}:priority`
        : `queue:${barId}:standard`;

      // Añadir a Redis (RPUSH para FIFO)
      await this.redis.rpush(queueKey, JSON.stringify(fullTrack));

      // Añadir al set de videoIds activos
      await this.redis.sadd(setKey, videoId);

      // Incrementar contador de usuario si es standard
      if (type === 'standard') {
        await this.redis.incr(userCountKey);
      }

      // Set TTL para limpieza automática (24 horas)
      await this.redis.expire(setKey, 86400);
      await this.redis.expire(queueKey, 86400);
      await this.redis.expire(userCountKey, 86400);

      logger.info(`Canción añadida a cola ${type}: ${videoId} en bar ${barId}`);

      return { success: true, message: 'Canción añadida exitosamente', track: fullTrack };

    } catch (error) {
      logger.error('Error añadiendo canción a cola:', error);
      return { success: false, message: 'Error interno del servidor' };
    }
  }

  /**
   * Obtener siguiente canción según algoritmo de prioridad
   */
  async getNextTrack(barId: string): Promise<Track | null> {
    try {
      const priorityKey = `queue:${barId}:priority`;
      const standardKey = `queue:${barId}:standard`;
      const currentKey = `queue:${barId}:current`;
      const setKey = `queue:${barId}:set`;

      let nextTrack: Track | null = null;

      // 1. Intentar obtener de cola prioritaria
      const priorityTrack = await this.redis.lpop(priorityKey);
      if (priorityTrack) {
        nextTrack = JSON.parse(priorityTrack);
        nextTrack.source = 'priority';
      } else {
        // 2. Intentar obtener de cola estándar
        const standardTrack = await this.redis.lpop(standardKey);
        if (standardTrack) {
          nextTrack = JSON.parse(standardTrack);
          nextTrack.source = 'standard';

          // Decrementar contador de usuario
          const userCountKey = `queue:${barId}:user:${nextTrack.userId}:count`;
          await this.redis.decr(userCountKey);
        }
      }

      // 3. Si no hay canciones, implementar fallback
      if (!nextTrack) {
        nextTrack = await this.getFallbackTrack(barId);
      }

      // 4. Actualizar estado actual y limpiar duplicados
      if (nextTrack) {
        await this.redis.set(currentKey, JSON.stringify(nextTrack));
        await this.redis.expire(currentKey, 86400);

        // Remover del set si no es fallback
        if (nextTrack.source !== 'fallback') {
          await this.redis.srem(setKey, nextTrack.videoId);
        }

        logger.info(`Nueva canción actual en bar ${barId}: ${nextTrack.videoId} (${nextTrack.source})`);
      }

      return nextTrack;

    } catch (error) {
      logger.error('Error obteniendo siguiente canción:', error);
      return null;
    }
  }

  /**
   * Obtener canción de fallback (aleatoria de playlist base)
   */
  private async getFallbackTrack(barId: string): Promise<Track | null> {
    try {
      // TODO: Implementar consulta a PostgreSQL para playlist base del bar
      // Por ahora, devolver null para evitar complejidad
      logger.warn(`Modo fallback activado para bar ${barId} - no hay canciones en cola`);
      return null;
    } catch (error) {
      logger.error('Error obteniendo canción de fallback:', error);
      return null;
    }
  }

  /**
   * Obtener estado actual de la cola
   */
  async getQueueState(barId: string): Promise<QueueState> {
    try {
      const currentKey = `queue:${barId}:current`;
      const priorityKey = `queue:${barId}:priority`;
      const standardKey = `queue:${barId}:standard`;
      const setKey = `queue:${barId}:set`;

      // Obtener canción actual
      const currentData = await this.redis.get(currentKey);
      const current = currentData ? JSON.parse(currentData) : undefined;

      // Obtener colas
      const priorityData = await this.redis.lrange(priorityKey, 0, -1);
      const standardData = await this.redis.lrange(standardKey, 0, -1);

      const priority: Track[] = priorityData.map(item => JSON.parse(item));
      const standard: Track[] = standardData.map(item => JSON.parse(item));

      // Obtener set de videoIds activos
      const activeVideoIds = new Set(await this.redis.smembers(setKey));

      return {
        current,
        priority,
        standard,
        activeVideoIds
      };

    } catch (error) {
      logger.error('Error obteniendo estado de cola:', error);
      return {
        current: undefined,
        priority: [],
        standard: [],
        activeVideoIds: new Set()
      };
    }
  }

  /**
   * Limpiar cola completa para un bar
   */
  async clearQueue(barId: string): Promise<void> {
    try {
      const keys = [
        `queue:${barId}:current`,
        `queue:${barId}:priority`,
        `queue:${barId}:standard`,
        `queue:${barId}:set`
      ];

      // Obtener todas las claves de usuario para limpiar contadores
      const userKeys = await this.redis.keys(`queue:${barId}:user:*:count`);

      await this.redis.del([...keys, ...userKeys]);

      logger.info(`Cola limpiada para bar ${barId}`);

    } catch (error) {
      logger.error('Error limpiando cola:', error);
      throw error;
    }
  }

  /**
   * Verificar si usuario puede añadir más canciones
   */
  async canUserAddSong(barId: string, userId: string, limit: number): Promise<boolean> {
    try {
      const userCountKey = `queue:${barId}:user:${userId}:count`;
      const count = await this.redis.get(userCountKey);
      const currentCount = count ? parseInt(count) : 0;

      return currentCount < limit;
    } catch (error) {
      logger.error('Error verificando límite de usuario:', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas de la cola
   */
  async getQueueStats(barId: string): Promise<{
    totalSongs: number;
    priorityCount: number;
    standardCount: number;
    activeUsers: number;
  }> {
    try {
      const priorityKey = `queue:${barId}:priority`;
      const standardKey = `queue:${barId}:standard`;

      const [priorityLength, standardLength] = await Promise.all([
        this.redis.llen(priorityKey),
        this.redis.llen(standardKey)
      ]);

      // Contar usuarios activos (aproximado)
      const userKeys = await this.redis.keys(`queue:${barId}:user:*:count`);
      const activeUsers = userKeys.length;

      return {
        totalSongs: priorityLength + standardLength,
        priorityCount: priorityLength,
        standardCount: standardLength,
        activeUsers
      };

    } catch (error) {
      logger.error('Error obteniendo estadísticas de cola:', error);
      return {
        totalSongs: 0,
        priorityCount: 0,
        standardCount: 0,
        activeUsers: 0
      };
    }
  }
}

export const musicQueueService = MusicQueueService.getInstance();