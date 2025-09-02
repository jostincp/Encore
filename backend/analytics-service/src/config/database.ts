import { Pool, PoolConfig } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { DatabaseConfig, RedisConfig } from '../types';
import { logger } from '../utils/logger';

const logInfo = (message: string, meta?: any) => logger.info(message, meta);
const logError = (message: string, error?: any) => logger.error(message, { error });

class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool | null = null;
  private redisClient: RedisClientType | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // PostgreSQL Connection
  public async initializePostgreSQL(): Promise<Pool> {
    if (this.pool) {
      return this.pool;
    }

    const config: PoolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'encore_analytics',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    try {
      this.pool = new Pool(config);
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logInfo('PostgreSQL connected successfully');
      return this.pool;
    } catch (error) {
      logError('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  // Redis Connection
  public async initializeRedis(): Promise<RedisClientType> {
    if (this.redisClient && this.redisClient.isOpen) {
      return this.redisClient;
    }

    const config = {
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '2'),
    };

    try {
      this.redisClient = createClient(config);
      
      this.redisClient.on('error', (err) => {
        logError('Redis Client Error:', err);
      });

      this.redisClient.on('connect', () => {
        logInfo('Redis connected successfully');
      });

      this.redisClient.on('reconnecting', () => {
        logInfo('Redis reconnecting...');
      });

      await this.redisClient.connect();
      return this.redisClient;
    } catch (error) {
      logError('Failed to connect to Redis:', error);
      throw error;
    }
  }

  // Get existing connections
  public getPool(): Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL not initialized. Call initializePostgreSQL() first.');
    }
    return this.pool;
  }

  public getRedisClient(): RedisClientType {
    if (!this.redisClient || !this.redisClient.isOpen) {
      throw new Error('Redis not initialized. Call initializeRedis() first.');
    }
    return this.redisClient;
  }

  // Close connections
  public async closeConnections(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
        logInfo('PostgreSQL connection closed');
      }

      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.quit();
        this.redisClient = null;
        logInfo('Redis connection closed');
      }
    } catch (error) {
      logError('Error closing database connections:', error);
    }
  }

  // Health check
  public async healthCheck(): Promise<{ postgres: boolean; redis: boolean }> {
    const health = { postgres: false, redis: false };

    try {
      if (this.pool) {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
        health.postgres = true;
      }
    } catch (error) {
      logError('PostgreSQL health check failed:', error);
    }

    try {
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.ping();
        health.redis = true;
      }
    } catch (error) {
      logError('Redis health check failed:', error);
    }

    return health;
  }
}

// Export singleton instance
export const dbManager = DatabaseManager.getInstance();

// Convenience exports
export const getPool = () => dbManager.getPool();
export const getRedisClient = () => dbManager.getRedisClient();
export const initializeDatabases = async () => {
  await dbManager.initializePostgreSQL();
  await dbManager.initializeRedis();
};
export const closeDatabases = () => dbManager.closeConnections();
export const checkDatabaseHealth = () => dbManager.healthCheck();