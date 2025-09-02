/**
 * =============================================================================
 * MusicBar Analytics Service - Queue Utilities
 * =============================================================================
 * Description: Redis-based queue utilities for async processing
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import Redis from 'ioredis';
import logger from '../config/logger';
import { QueueError } from './errors';

// =============================================================================
// Queue Interfaces
// =============================================================================
export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueConfig {
  name: string;
  defaultPriority: number;
  maxAttempts: number;
  retryDelay: number;
  maxRetryDelay: number;
  backoffMultiplier: number;
  processingTimeout: number;
  cleanupInterval: number;
  maxCompletedJobs: number;
  maxFailedJobs: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

export type JobProcessor<T = any> = (job: QueueJob<T>) => Promise<void>;

// =============================================================================
// Queue Manager Class
// =============================================================================
export class QueueManager {
  private redis: Redis;
  private config: QueueConfig;
  private processors: Map<string, JobProcessor> = new Map();
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(redis: Redis, config: Partial<QueueConfig> & { name: string }) {
    this.redis = redis;
    this.config = {
      defaultPriority: 0,
      maxAttempts: 3,
      retryDelay: 1000,
      maxRetryDelay: 60000,
      backoffMultiplier: 2,
      processingTimeout: 30000,
      cleanupInterval: 300000, // 5 minutes
      maxCompletedJobs: 1000,
      maxFailedJobs: 500,
      ...config
    };
  }

  // ===========================================================================
  // Job Management
  // ===========================================================================
  async addJob<T>(
    type: string,
    data: T,
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
      jobId?: string;
    } = {}
  ): Promise<string> {
    try {
      const jobId = options.jobId || this.generateJobId();
      const priority = options.priority ?? this.config.defaultPriority;
      const delay = options.delay || 0;
      const maxAttempts = options.maxAttempts ?? this.config.maxAttempts;

      const job: QueueJob<T> = {
        id: jobId,
        type,
        data,
        priority,
        attempts: 0,
        maxAttempts,
        delay,
        createdAt: new Date()
      };

      const serializedJob = JSON.stringify(job);
      const score = delay > 0 ? Date.now() + delay : priority;
      const queueKey = delay > 0 ? this.getDelayedKey() : this.getWaitingKey();

      await this.redis.zadd(queueKey, score, serializedJob);

      logger.debug('Job added to queue:', {
        queueName: this.config.name,
        jobId,
        type,
        priority,
        delay
      });

      return jobId;
    } catch (error) {
      logger.error('Failed to add job to queue:', {
        queueName: this.config.name,
        type,
        error: error.message
      });
      throw new QueueError(`Failed to add job to queue: ${this.config.name}`, {
        type,
        error
      });
    }
  }

  async getJob(jobId: string): Promise<QueueJob | null> {
    try {
      // Check all possible locations for the job
      const keys = [
        this.getWaitingKey(),
        this.getActiveKey(),
        this.getCompletedKey(),
        this.getFailedKey(),
        this.getDelayedKey()
      ];

      for (const key of keys) {
        const jobs = await this.redis.zrange(key, 0, -1);
        for (const jobStr of jobs) {
          const job = JSON.parse(jobStr) as QueueJob;
          if (job.id === jobId) {
            return job;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get job:', {
        queueName: this.config.name,
        jobId,
        error: error.message
      });
      throw new QueueError(`Failed to get job: ${jobId}`, { jobId, error });
    }
  }

  async removeJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        return false;
      }

      const serializedJob = JSON.stringify(job);
      const keys = [
        this.getWaitingKey(),
        this.getActiveKey(),
        this.getDelayedKey()
      ];

      let removed = false;
      for (const key of keys) {
        const result = await this.redis.zrem(key, serializedJob);
        if (result > 0) {
          removed = true;
          break;
        }
      }

      if (removed) {
        logger.debug('Job removed from queue:', {
          queueName: this.config.name,
          jobId
        });
      }

      return removed;
    } catch (error) {
      logger.error('Failed to remove job:', {
        queueName: this.config.name,
        jobId,
        error: error.message
      });
      throw new QueueError(`Failed to remove job: ${jobId}`, { jobId, error });
    }
  }

  // ===========================================================================
  // Job Processing
  // ===========================================================================
  registerProcessor<T>(type: string, processor: JobProcessor<T>): void {
    this.processors.set(type, processor);
    logger.debug('Processor registered:', {
      queueName: this.config.name,
      type
    });
  }

  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    logger.info('Queue processing started:', { queueName: this.config.name });

    // Start processing loop
    this.processingInterval = setInterval(async () => {
      try {
        await this.processNextJob();
        await this.moveDelayedJobs();
      } catch (error) {
        logger.error('Error in processing loop:', {
          queueName: this.config.name,
          error: error.message
        });
      }
    }, 1000);

    // Start cleanup loop
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        logger.error('Error in cleanup loop:', {
          queueName: this.config.name,
          error: error.message
        });
      }
    }, this.config.cleanupInterval);
  }

  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    logger.info('Queue processing stopped:', { queueName: this.config.name });
  }

  private async processNextJob(): Promise<void> {
    // Get next job from waiting queue (highest priority first)
    const jobs = await this.redis.zrevrange(this.getWaitingKey(), 0, 0);
    if (jobs.length === 0) {
      return;
    }

    const jobStr = jobs[0];
    const job = JSON.parse(jobStr) as QueueJob;

    // Move job to active queue
    await this.redis.zrem(this.getWaitingKey(), jobStr);
    job.processedAt = new Date();
    await this.redis.zadd(this.getActiveKey(), Date.now(), JSON.stringify(job));

    try {
      // Get processor for job type
      const processor = this.processors.get(job.type);
      if (!processor) {
        throw new Error(`No processor registered for job type: ${job.type}`);
      }

      // Process job with timeout
      await Promise.race([
        processor(job),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Job processing timeout')), this.config.processingTimeout);
        })
      ]);

      // Job completed successfully
      await this.completeJob(job);
    } catch (error) {
      // Job failed
      await this.failJob(job, error.message);
    }
  }

  private async completeJob(job: QueueJob): Promise<void> {
    // Remove from active queue
    await this.redis.zrem(this.getActiveKey(), JSON.stringify(job));

    // Add to completed queue
    job.completedAt = new Date();
    await this.redis.zadd(this.getCompletedKey(), Date.now(), JSON.stringify(job));

    logger.debug('Job completed:', {
      queueName: this.config.name,
      jobId: job.id,
      type: job.type,
      attempts: job.attempts
    });
  }

  private async failJob(job: QueueJob, error: string): Promise<void> {
    // Remove from active queue
    await this.redis.zrem(this.getActiveKey(), JSON.stringify(job));

    job.attempts++;
    job.error = error;

    if (job.attempts < job.maxAttempts) {
      // Retry job with exponential backoff
      const delay = Math.min(
        this.config.retryDelay * Math.pow(this.config.backoffMultiplier, job.attempts - 1),
        this.config.maxRetryDelay
      );

      job.delay = delay;
      await this.redis.zadd(this.getDelayedKey(), Date.now() + delay, JSON.stringify(job));

      logger.debug('Job scheduled for retry:', {
        queueName: this.config.name,
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        delay
      });
    } else {
      // Job failed permanently
      job.failedAt = new Date();
      await this.redis.zadd(this.getFailedKey(), Date.now(), JSON.stringify(job));

      logger.error('Job failed permanently:', {
        queueName: this.config.name,
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        error
      });
    }
  }

  private async moveDelayedJobs(): Promise<void> {
    const now = Date.now();
    const jobs = await this.redis.zrangebyscore(this.getDelayedKey(), 0, now);

    for (const jobStr of jobs) {
      const job = JSON.parse(jobStr) as QueueJob;
      
      // Move from delayed to waiting queue
      await this.redis.zrem(this.getDelayedKey(), jobStr);
      await this.redis.zadd(this.getWaitingKey(), job.priority, jobStr);
    }
  }

  // ===========================================================================
  // Queue Statistics
  // ===========================================================================
  async getStats(): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.redis.zcard(this.getWaitingKey()),
        this.redis.zcard(this.getActiveKey()),
        this.redis.zcard(this.getCompletedKey()),
        this.redis.zcard(this.getFailedKey()),
        this.redis.zcard(this.getDelayedKey())
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', {
        queueName: this.config.name,
        error: error.message
      });
      throw new QueueError(`Failed to get queue stats: ${this.config.name}`, { error });
    }
  }

  async getJobs(status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed', start: number = 0, end: number = -1): Promise<QueueJob[]> {
    try {
      let key: string;
      switch (status) {
        case 'waiting':
          key = this.getWaitingKey();
          break;
        case 'active':
          key = this.getActiveKey();
          break;
        case 'completed':
          key = this.getCompletedKey();
          break;
        case 'failed':
          key = this.getFailedKey();
          break;
        case 'delayed':
          key = this.getDelayedKey();
          break;
        default:
          throw new Error(`Invalid status: ${status}`);
      }

      const jobs = await this.redis.zrange(key, start, end);
      return jobs.map(jobStr => JSON.parse(jobStr) as QueueJob);
    } catch (error) {
      logger.error('Failed to get jobs:', {
        queueName: this.config.name,
        status,
        error: error.message
      });
      throw new QueueError(`Failed to get jobs: ${this.config.name}`, { status, error });
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================
  private async cleanup(): Promise<void> {
    try {
      // Clean up old completed jobs
      const completedCount = await this.redis.zcard(this.getCompletedKey());
      if (completedCount > this.config.maxCompletedJobs) {
        const removeCount = completedCount - this.config.maxCompletedJobs;
        await this.redis.zremrangebyrank(this.getCompletedKey(), 0, removeCount - 1);
      }

      // Clean up old failed jobs
      const failedCount = await this.redis.zcard(this.getFailedKey());
      if (failedCount > this.config.maxFailedJobs) {
        const removeCount = failedCount - this.config.maxFailedJobs;
        await this.redis.zremrangebyrank(this.getFailedKey(), 0, removeCount - 1);
      }

      // Clean up stale active jobs (jobs that have been processing too long)
      const staleThreshold = Date.now() - (this.config.processingTimeout * 2);
      const staleJobs = await this.redis.zrangebyscore(this.getActiveKey(), 0, staleThreshold);
      
      for (const jobStr of staleJobs) {
        const job = JSON.parse(jobStr) as QueueJob;
        await this.failJob(job, 'Job processing timeout (stale)');
      }
    } catch (error) {
      logger.error('Cleanup failed:', {
        queueName: this.config.name,
        error: error.message
      });
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = [
        this.getWaitingKey(),
        this.getActiveKey(),
        this.getCompletedKey(),
        this.getFailedKey(),
        this.getDelayedKey()
      ];

      await this.redis.del(...keys);
      logger.info('Queue cleared:', { queueName: this.config.name });
    } catch (error) {
      logger.error('Failed to clear queue:', {
        queueName: this.config.name,
        error: error.message
      });
      throw new QueueError(`Failed to clear queue: ${this.config.name}`, { error });
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================
  private generateJobId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getWaitingKey(): string {
    return `encore:queue:${this.config.name}:waiting`;
  }

  private getActiveKey(): string {
    return `encore:queue:${this.config.name}:active`;
  }

  private getCompletedKey(): string {
    return `encore:queue:${this.config.name}:completed`;
  }

  private getFailedKey(): string {
    return `encore:queue:${this.config.name}:failed`;
  }

  private getDelayedKey(): string {
    return `encore:queue:${this.config.name}:delayed`;
  }
}

// =============================================================================
// Queue Factory
// =============================================================================
export class QueueFactory {
  private static queues: Map<string, QueueManager> = new Map();
  private static redis: Redis;

  static initialize(redis: Redis): void {
    this.redis = redis;
  }

  static createQueue(name: string, config: Partial<QueueConfig> = {}): QueueManager {
    if (!this.redis) {
      throw new Error('QueueFactory not initialized. Call initialize() first.');
    }

    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new QueueManager(this.redis, { name, ...config });
    this.queues.set(name, queue);
    
    return queue;
  }

  static getQueue(name: string): QueueManager | undefined {
    return this.queues.get(name);
  }

  static async stopAllQueues(): Promise<void> {
    const stopPromises = Array.from(this.queues.values()).map(queue => queue.stopProcessing());
    await Promise.all(stopPromises);
  }
}

// =============================================================================
// Export All
// =============================================================================
export default {
  QueueManager,
  QueueFactory
};