import { QueueModel, QueueData, CreateQueueData, UpdateQueueData, QueueFilters, QueueStats } from '../models/Queue';
import { CacheService, CacheKeys, CacheTags } from './cacheService';
import logger from '@shared/utils/logger';

export class QueueService {
  /**
   * Create a new queue entry with cache invalidation
   */
  public static async createQueueEntry(data: CreateQueueData): Promise<QueueData> {
    try {
      const queueEntry = await QueueModel.create(data);
      
      // Invalidate related caches
      await CacheService.invalidateByTags([
        CacheTags.queue(data.bar_id),
        CacheTags.bar(data.bar_id)
      ]);
      
      return queueEntry;
    } catch (error) {
      logger.error('Create queue entry error:', { data, error });
      throw error;
    }
  }

  /**
   * Get queue entries for a bar with caching
   */
  public static async getQueueByBarId(
    barId: string,
    filters: QueueFilters = {},
    limit: number = 50,
    offset: number = 0,
    includeDetails: boolean = true
  ): Promise<{ items: QueueData[]; total: number }> {
    const cacheKey = CacheKeys.queueByBar(barId, filters, limit, offset, includeDetails);
    
    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await QueueModel.findByBarId(barId, filters, limit, offset, includeDetails);
        },
        {
          ttl: 60, // 1 minute - queue changes frequently
          tags: [CacheTags.queue(barId), CacheTags.bar(barId)]
        }
      );
    } catch (error) {
      logger.error('Get queue by bar ID error:', { barId, filters, error });
      throw error;
    }
  }

  /**
   * Get currently playing song with caching
   */
  public static async getCurrentlyPlaying(barId: string): Promise<QueueData | null> {
    const cacheKey = CacheKeys.currentlyPlaying(barId);
    
    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await QueueModel.getCurrentlyPlaying(barId);
        },
        {
          ttl: 30, // 30 seconds - very dynamic data
          tags: [CacheTags.queue(barId), CacheTags.bar(barId)]
        }
      );
    } catch (error) {
      logger.error('Get currently playing error:', { barId, error });
      throw error;
    }
  }

  /**
   * Get next song in queue with caching
   */
  public static async getNextInQueue(barId: string): Promise<QueueData | null> {
    const cacheKey = CacheKeys.nextInQueue(barId);
    
    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await QueueModel.getNextInQueue(barId);
        },
        {
          ttl: 30, // 30 seconds - very dynamic data
          tags: [CacheTags.queue(barId), CacheTags.bar(barId)]
        }
      );
    } catch (error) {
      logger.error('Get next in queue error:', { barId, error });
      throw error;
    }
  }

  /**
   * Update queue entry with cache invalidation
   */
  public static async updateQueueEntry(id: string, data: UpdateQueueData): Promise<QueueData | null> {
    try {
      // Get the queue entry first to know which bar to invalidate
      const existingEntry = await QueueModel.findById(id);
      if (!existingEntry) {
        return null;
      }

      const updatedEntry = await QueueModel.update(id, data);
      
      if (updatedEntry) {
        // Invalidate related caches
        await CacheService.invalidateByTags([
          CacheTags.queue(existingEntry.bar_id),
          CacheTags.bar(existingEntry.bar_id)
        ]);
      }
      
      return updatedEntry;
    } catch (error) {
      logger.error('Update queue entry error:', { id, data, error });
      throw error;
    }
  }

  /**
   * Delete queue entry with cache invalidation
   */
  public static async deleteQueueEntry(id: string): Promise<boolean> {
    try {
      // Get the queue entry first to know which bar to invalidate
      const existingEntry = await QueueModel.findById(id);
      if (!existingEntry) {
        return false;
      }

      const deleted = await QueueModel.delete(id);
      
      if (deleted) {
        // Invalidate related caches
        await CacheService.invalidateByTags([
          CacheTags.queue(existingEntry.bar_id),
          CacheTags.bar(existingEntry.bar_id)
        ]);
      }
      
      return deleted;
    } catch (error) {
      logger.error('Delete queue entry error:', { id, error });
      throw error;
    }
  }

  /**
   * Reorder queue with cache invalidation
   */
  public static async reorderQueue(barId: string, newOrder: Array<{ id: string; position: number }>): Promise<void> {
    try {
      await QueueModel.reorderQueue(barId, newOrder);
      
      // Invalidate related caches
      await CacheService.invalidateByTags([
        CacheTags.queue(barId),
        CacheTags.bar(barId)
      ]);
      
    } catch (error) {
      logger.error('Reorder queue error:', { barId, newOrder, error });
      throw error;
    }
  }

  /**
   * Clear queue with cache invalidation
   */
  public static async clearQueue(barId: string, keepCurrentlyPlaying: boolean = true): Promise<void> {
    try {
      await QueueModel.clearQueue(barId, keepCurrentlyPlaying);
      
      // Invalidate related caches
      await CacheService.invalidateByTags([
        CacheTags.queue(barId),
        CacheTags.bar(barId)
      ]);
      
    } catch (error) {
      logger.error('Clear queue error:', { barId, keepCurrentlyPlaying, error });
      throw error;
    }
  }

  /**
   * Get queue statistics with caching
   */
  public static async getQueueStats(
    barId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<QueueStats> {
    const cacheKey = CacheKeys.queueStats(barId, dateFrom, dateTo);
    
    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await QueueModel.getStats(barId, dateFrom, dateTo);
        },
        {
          ttl: 1800, // 30 minutes - stats don't change frequently
          tags: [CacheTags.queue(barId), CacheTags.bar(barId)]
        }
      );
    } catch (error) {
      logger.error('Get queue stats error:', { barId, dateFrom, dateTo, error });
      throw error;
    }
  }

  /**
   * Get popular songs from queue history with caching
   */
  public static async getPopularSongs(
    barId: string,
    options: { limit?: number; timeframe?: 'day' | 'week' | 'month' | 'all' } = {}
  ): Promise<Array<{ song_id: string; play_count: number; last_played: Date }>> {
    const { limit = 20, timeframe = 'week' } = options;
    const cacheKey = CacheKeys.popularFromQueue(barId, limit, timeframe);
    
    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await QueueModel.getPopularSongs(barId, { limit, timeframe });
        },
        {
          ttl: 1800, // 30 minutes
          tags: [CacheTags.queue(barId), CacheTags.bar(barId), CacheTags.popular()]
        }
      );
    } catch (error) {
      logger.error('Get popular songs from queue error:', { barId, options, error });
      throw error;
    }
  }

  /**
   * Get recent songs from queue history with caching
   */
  public static async getRecentSongs(
    barId: string,
    options: { limit?: number } = {}
  ): Promise<Array<{ song_id: string; played_at: Date }>> {
    const { limit = 20 } = options;
    const cacheKey = CacheKeys.recentFromQueue(barId, limit);
    
    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await QueueModel.getRecentSongs(barId, { limit });
        },
        {
          ttl: 300, // 5 minutes
          tags: [CacheTags.queue(barId), CacheTags.bar(barId)]
        }
      );
    } catch (error) {
      logger.error('Get recent songs from queue error:', { barId, options, error });
      throw error;
    }
  }

  /**
   * Warm up cache for a bar's queue data
   */
  public static async warmUpCache(barId: string): Promise<void> {
    try {
      // Warm up commonly accessed data
      const warmUpPromises = [
        this.getCurrentlyPlaying(barId),
        this.getNextInQueue(barId),
        this.getQueueByBarId(barId, {}, 20, 0, true),
        this.getPopularSongs(barId, { limit: 10 }),
        this.getRecentSongs(barId, { limit: 10 })
      ];

      await Promise.allSettled(warmUpPromises);
      
      logger.info('Queue cache warmed up', { barId });
    } catch (error) {
      logger.warn('Queue cache warm up failed:', { barId, error });
    }
  }
}