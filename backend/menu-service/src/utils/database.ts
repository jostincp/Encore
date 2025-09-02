import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from './config';
import { logInfo, logError, logDebug } from '../types/shared';

// Database connection pool
let pool: Pool | null = null;

// Database configuration
const dbConfig = {
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
  min: config.DB_POOL_MIN,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000
};

// Use DATABASE_URL if provided (for production environments like Railway, Heroku)
if (config.DATABASE_URL) {
  Object.assign(dbConfig, {
    connectionString: config.DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

// Connect to database
export const connectDatabase = async (): Promise<Pool> => {
  try {
    if (pool) {
      return pool;
    }
    
    pool = new Pool(dbConfig);
    
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();
    
    logInfo('Database connected successfully', {
      host: config.DB_HOST,
      database: config.DB_NAME,
      currentTime: result.rows[0].current_time,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
    });
    
    // Handle pool errors
    pool.on('error', (err) => {
      logError('Database pool error', { error: err });
    });
    
    pool.on('connect', (client) => {
      logDebug('New database client connected');
    });
    
    pool.on('remove', (client) => {
      logDebug('Database client removed from pool');
    });
    
    return pool;
    
  } catch (error) {
    logError('Failed to connect to database', { error });
    throw error;
  }
};

// Get database pool
export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
};

// Execute query with logging and error handling
export const query = async <T extends Record<string, any> = any>(
  text: string, 
  params?: any[], 
  client?: PoolClient
): Promise<QueryResult<T>> => {
  const start = Date.now();
  const queryId = Math.random().toString(36).substring(7);
  
  try {
    logDebug('Executing query', {
      queryId,
      query: text.replace(/\s+/g, ' ').trim(),
      params: params ? params.length : 0
    });
    
    let result: QueryResult<T>;
    
    if (client) {
      result = await client.query<T>(text, params);
    } else {
      const pool = getPool();
      result = await pool.query<T>(text, params);
    }
    
    const duration = Date.now() - start;
    
    // logDatabase('SELECT', 'query', duration); // Disabled for now
    
    logDebug('Query executed successfully', {
      queryId,
      duration: `${duration}ms`,
      rowCount: result.rowCount
    });
    
    return result;
    
  } catch (error: any) {
    const duration = Date.now() - start;
    
    // logDatabase('SELECT', 'query', duration, error); // Disabled for now
    
    logError('Query execution failed', {
      queryId,
      query: text.replace(/\s+/g, ' ').trim(),
      params: params ? params.length : 0,
      duration: `${duration}ms`,
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position
      }
    });
    
    throw error;
  }
};

// Execute transaction
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const pool = getPool();
  const client = await pool.connect();
  const transactionId = Math.random().toString(36).substring(7);
  
  try {
    logDebug('Starting transaction', { transactionId });
    
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    
    logDebug('Transaction committed successfully', { transactionId });
    
    return result;
    
  } catch (error) {
    logError('Transaction failed, rolling back', {
      transactionId,
      error
    });
    
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logError('Rollback failed', {
        transactionId,
        rollbackError
      });
    }
    
    throw error;
    
  } finally {
    client.release();
  }
};

// Get a client from the pool
export const getClient = async (): Promise<PoolClient> => {
  const pool = getPool();
  return await pool.connect();
};

// Close database connection
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      logInfo('Database connection closed');
    } catch (error) {
      logError('Error closing database connection', { error });
      throw error;
    }
  }
};

// Health check
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> => {
  try {
    const start = Date.now();
    const result = await query('SELECT 1 as health_check, NOW() as current_time');
    const duration = Date.now() - start;
    
    return {
      status: 'healthy',
      details: {
        connected: true,
        responseTime: `${duration}ms`,
        currentTime: result.rows[0].current_time,
        poolSize: pool?.totalCount || 0,
        idleConnections: pool?.idleCount || 0,
        waitingClients: pool?.waitingCount || 0
      }
    };
    
  } catch (error) {
    logError('Database health check failed', { error });
    
    return {
      status: 'unhealthy',
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

// Database utility functions
export const dbUtils = {
  // Check if table exists
  tableExists: async (tableName: string): Promise<boolean> => {
    try {
      const result = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );
      return result.rows[0].exists;
    } catch (error) {
      logError('Error checking table existence', { tableName, error });
      return false;
    }
  },
  
  // Get table row count
  getRowCount: async (tableName: string): Promise<number> => {
    try {
      const result = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logError('Error getting row count', { tableName, error });
      return 0;
    }
  },
  
  // Check database connection
  isConnected: (): boolean => {
    return pool !== null && !pool.ended;
  },
  
  // Get pool statistics
  getPoolStats: () => {
    if (!pool) {
      return null;
    }
    
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }
};

// Export types
export type { Pool, PoolClient, QueryResult };

export default {
  connectDatabase,
  getPool,
  query,
  transaction,
  getClient,
  closeDatabase,
  healthCheck,
  dbUtils
};