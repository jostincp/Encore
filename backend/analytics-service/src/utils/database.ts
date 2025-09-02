import { Pool, PoolClient, QueryResult } from 'pg';
import logger, { logPerformance } from './logger';
import config from './config';

/**
 * Database query interface
 */
export interface DatabaseQuery {
  text: string;
  values?: any[];
}

/**
 * Database transaction interface
 */
export interface DatabaseTransaction {
  query: (text: string, values?: any[]) => Promise<QueryResult>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

/**
 * Database connection statistics
 */
export interface DatabaseStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
}

/**
 * Database Manager class
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool;
  private isConnected: boolean = false;
  private queryCount: number = 0;
  private totalQueryTime: number = 0;
  private slowQueryCount: number = 0;
  private readonly slowQueryThreshold: number = 1000; // 1 second

  private constructor() {
    this.pool = new Pool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
      max: config.DB_POOL_MAX,
      connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT || 30000,
      query_timeout: config.DB_QUERY_TIMEOUT || 30000,
      statement_timeout: config.DB_QUERY_TIMEOUT || 30000,
      idle_in_transaction_session_timeout: 30000
    });

    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Setup pool event handlers
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      logger.debug('New database client connected');
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Database client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      logger.debug('Database client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database pool error', { error: err.message, stack: err.stack });
    });
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('Database connected successfully', {
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_NAME,
        maxConnections: config.DB_POOL_MAX
      });
    } catch (error) {
      this.isConnected = false;
      logger.error('Database connection failed', {
        error: {
          code: 'DB_CONNECTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_NAME
      });
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database', {
        error: {
          code: 'DB_DISCONNECT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  public isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Execute a query
   */
  public async query(text: string, values?: any[]): Promise<QueryResult> {
    const startTime = Date.now();
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.debug('Executing database query', {
        queryId,
        text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        valuesCount: values?.length || 0
      });

      const result = await this.pool.query(text, values);
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.queryCount++;
      this.totalQueryTime += duration;
      
      if (duration > this.slowQueryThreshold) {
        this.slowQueryCount++;
        logger.warn('Slow query detected', {
          queryId,
          duration,
          text: text.substring(0, 500),
          rowCount: result.rowCount
        });
      }

      logPerformance('Database query completed', duration, {
        queryId,
        rowCount: result.rowCount,
        command: result.command
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database query failed', {
        queryId,
        duration,
        error: {
          code: 'DB_QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        text: text.substring(0, 500),
        values: values?.slice(0, 10) // Log first 10 values only
      });
      throw error;
    }
  }

  /**
   * Execute a query with a specific client
   */
  public async queryWithClient(client: PoolClient, text: string, values?: any[]): Promise<QueryResult> {
    const startTime = Date.now();
    const queryId = `client_query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.debug('Executing database query with client', {
        queryId,
        text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        valuesCount: values?.length || 0
      });

      const result = await client.query(text, values);
      const duration = Date.now() - startTime;
      
      logPerformance('Database query with client completed', duration, {
        queryId,
        rowCount: result.rowCount,
        command: result.command
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database query with client failed', {
        queryId,
        duration,
        error: {
          code: 'DB_CLIENT_QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        text: text.substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  public async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      logger.debug('Database client acquired');
      return client;
    } catch (error) {
      logger.error('Failed to acquire database client', {
        error: {
          code: 'DB_CLIENT_ACQUIRE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
  }

  /**
   * Start a transaction
   */
  public async beginTransaction(): Promise<DatabaseTransaction> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      logger.debug('Database transaction started');
      
      return {
        query: async (text: string, values?: any[]) => {
          return this.queryWithClient(client, text, values);
        },
        commit: async () => {
          try {
            await client.query('COMMIT');
            logger.debug('Database transaction committed');
          } finally {
            client.release();
          }
        },
        rollback: async () => {
          try {
            await client.query('ROLLBACK');
            logger.debug('Database transaction rolled back');
          } finally {
            client.release();
          }
        }
      };
    } catch (error) {
      client.release();
      logger.error('Failed to start database transaction', {
        error: {
          code: 'DB_TRANSACTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  public async executeTransaction(queries: DatabaseQuery[]): Promise<QueryResult[]> {
    const transaction = await this.beginTransaction();
    const results: QueryResult[] = [];
    
    try {
      for (const query of queries) {
        const result = await transaction.query(query.text, query.values);
        results.push(result);
      }
      
      await transaction.commit();
      logger.info('Transaction executed successfully', {
        queryCount: queries.length,
        totalRows: results.reduce((sum, result) => sum + (result.rowCount || 0), 0)
      });
      
      return results;
    } catch (error) {
      await transaction.rollback();
      logger.error('Transaction failed and rolled back', {
        error: {
          code: 'DB_TRANSACTION_ROLLBACK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        queryCount: queries.length
      });
      throw error;
    }
  }

  /**
   * Execute a query with retry logic
   */
  public async queryWithRetry(
    text: string,
    values?: any[],
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<QueryResult> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.query(text, values);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          logger.error('Query failed after all retries', {
            attempts: maxRetries,
            error: lastError.message,
            text: text.substring(0, 200)
          });
          throw lastError;
        }
        
        logger.warn('Query failed, retrying', {
          attempt,
          maxRetries,
          error: lastError.message,
          retryDelay
        });
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    
    throw lastError!;
  }

  /**
   * Get database statistics
   */
  public getStats(): DatabaseStats {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      totalQueries: this.queryCount,
      averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      slowQueries: this.slowQueryCount
    };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    stats: DatabaseStats;
  }> {
    const startTime = Date.now();
    
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
        stats: this.getStats()
      };
    } catch (error) {
      logger.error('Database health check failed', {
        error: {
          code: 'DB_HEALTH_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        stats: this.getStats()
      };
    }
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.queryCount = 0;
    this.totalQueryTime = 0;
    this.slowQueryCount = 0;
    logger.info('Database statistics reset');
  }

  /**
   * Get pool instance (for advanced usage)
   */
  public getPool(): Pool {
    return this.pool;
  }
}

/**
 * Helper functions
 */

/**
 * Build WHERE clause from filters
 */
export const buildWhereClause = (filters: Record<string, any>, startIndex: number = 1): {
  clause: string;
  values: any[];
  nextIndex: number;
} => {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = startIndex;

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${key} IN (${placeholders})`);
          values.push(...value);
        }
      } else if (typeof value === 'object' && value.operator) {
        conditions.push(`${key} ${value.operator} $${paramIndex++}`);
        values.push(value.value);
      } else {
        conditions.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    nextIndex: paramIndex
  };
};

/**
 * Build ORDER BY clause
 */
export const buildOrderByClause = (orderBy?: string, order?: 'ASC' | 'DESC'): string => {
  if (!orderBy) return '';
  return `ORDER BY ${orderBy} ${order || 'ASC'}`;
};

/**
 * Build LIMIT and OFFSET clause
 */
export const buildLimitClause = (limit?: number, offset?: number): {
  clause: string;
  values: any[];
  nextIndex: number;
} => {
  const clauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (limit !== undefined) {
    clauses.push(`LIMIT $${paramIndex++}`);
    values.push(limit);
  }

  if (offset !== undefined) {
    clauses.push(`OFFSET $${paramIndex++}`);
    values.push(offset);
  }

  return {
    clause: clauses.join(' '),
    values,
    nextIndex: paramIndex
  };
};

/**
 * Escape SQL identifier
 */
export const escapeIdentifier = (identifier: string): string => {
  return `"${identifier.replace(/"/g, '""')}"`;
};

/**
 * Format SQL query for logging
 */
export const formatQuery = (text: string, values?: any[]): string => {
  if (!values || values.length === 0) {
    return text;
  }

  let formattedQuery = text;
  values.forEach((value, index) => {
    const placeholder = `$${index + 1}`;
    const formattedValue = typeof value === 'string' ? `'${value}'` : String(value);
    formattedQuery = formattedQuery.replace(placeholder, formattedValue);
  });

  return formattedQuery;
};

export default DatabaseManager;