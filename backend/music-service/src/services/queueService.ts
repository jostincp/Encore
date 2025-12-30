
import { redisClient } from '../config/redis';

export interface QueueItem {
  id: string;
  songId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  requestedBy: {
    tableId: string;
    userId?: string;
  };
  pointsUsed: number;
  priority: boolean;
  status: 'pending' | 'playing' | 'completed';
  addedAt: string;
  source: 'youtube' | 'spotify';
}

export class QueueService {
  private static getKey(barId: string): string {
    return `queue:${barId}`;
  }

  /**
   * Add a song to the queue
   */
  static async addSong(barId: string, item: QueueItem): Promise<QueueItem[]> {
    const key = this.getKey(barId);

    // Store as JSON string
    await redisClient.rpush(key, JSON.stringify(item));

    // Return updated queue
    return this.getQueue(barId);
  }

  /**
   * Get the full queue for a bar
   */
  static async getQueue(barId: string): Promise<QueueItem[]> {
    const key = this.getKey(barId);
    const rawItems = await redisClient.lrange(key, 0, -1);

    return rawItems.map(item => JSON.parse(item));
  }

  /**
   * Remove a specific song from the queue
   */
  static async removeSong(barId: string, songUniqueId: string): Promise<QueueItem[]> {
    const key = this.getKey(barId);
    const currentQueue = await this.getQueue(barId);

    const newQueue = currentQueue.filter(item => item.id !== songUniqueId);

    // Atomic replace (simplest way to handle removal in list without complex LREM logic for JSON)
    await redisClient.del(key);
    if (newQueue.length > 0) {
      const strings = newQueue.map(item => JSON.stringify(item));
      await redisClient.rpush(key, ...strings);
    }

    return newQueue;
  }

  /**
   * Move to next song (Shift queue)
   * This removes the first item. 
   * In a real implementation we might want to keep "history", but for now we keep it simple.
   */
  static async shiftQueue(barId: string): Promise<QueueItem | null> {
    const key = this.getKey(barId);
    const popped = await redisClient.lpop(key);

    return popped ? JSON.parse(popped) : null;
  }

  /**
   * Clear the entire queue
   */
  static async clearQueue(barId: string): Promise<void> {
    const key = this.getKey(barId);
    await redisClient.del(key);
  }
}