import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger';
import { config } from '../config';
import { initializeSQLite, sqliteQuery, closeSQLite } from './sqlite';

// Database connection pool
let pool: Pool | null = null;
let usingSQLite = false;

/**
 * Initialize database connection pool
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Try PostgreSQL first
    pool = new Pool({
      connectionString: config.database.url,
      ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('PostgreSQL database connection pool initialized successfully');
    usingSQLite = false;
  } catch (error) {
    logger.warn('PostgreSQL connection failed, falling back to SQLite:', error);
    
    // Close PostgreSQL pool if it was created
    if (pool) {
      await pool.end();
      pool = null;
    }
    
    // Initialize SQLite as fallback
    await initializeSQLite();
    usingSQLite = true;
    logger.info('SQLite database initialized as fallback');
  }
};

/**
 * Get database connection pool
 */
export const getPool = (): Pool => {
  if (usingSQLite) {
    throw new Error('Cannot get PostgreSQL pool when using SQLite. Use query() function instead.');
  }
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

/**
 * Close database connection pool
 */
export const closeDatabase = async (): Promise<void> => {
  if (usingSQLite) {
    await closeSQLite();
  } else if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
};

/**
 * Execute a query with parameters
 */
export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  if (usingSQLite) {
    const result = await sqliteQuery<T>(text, params || []);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      command: '',
      oid: 0,
      fields: []
    } as QueryResult<T>;
  }
  
  const client = await getPool().connect();
  try {
    const start = Date.now();
    const result = await client.query<T>(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      error: error instanceof Error ? error.message : error,
      query: text.substring(0, 200)
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Execute a transaction
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Run database migrations
 */
export const runMigrations = async (): Promise<void> => {
  try {
    logger.info('Running database migrations...');
    
    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of executed migrations
    const executedMigrations = await query<{ filename: string }>(
      'SELECT filename FROM migrations ORDER BY id'
    );
    const executedFiles = new Set(executedMigrations.rows.map(row => row.filename));
    
    // Migration files to run
    const migrationFiles = [
      '001_initial_schema.sql',
      '002_role_mapping.sql'
    ];
    
    for (const filename of migrationFiles) {
      if (!executedFiles.has(filename)) {
        logger.info(`Running migration: ${filename}`);
        
        const migrationPath = join(__dirname, 'migrations', filename);
        const migrationSQL = readFileSync(migrationPath, 'utf8');
        
        await transaction(async (client) => {
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [filename]
          );
        });
        
        logger.info(`Migration completed: ${filename}`);
      }
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

/**
 * Check if database is healthy
 */
export const healthCheck = async (): Promise<boolean> => {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

/**
 * Get database statistics
 */
export const getStats = async (): Promise<{
  totalConnections: number;
  idleConnections: number;
  waitingCount: number;
}> => {
  const pool = getPool();
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingCount: pool.waitingCount
  };
};

// Common database operations
export const dbOperations = {
  /**
   * Find record by ID
   */
  findById: async <T extends QueryResultRow = any>(table: string, id: string): Promise<T | null> => {
    const result = await query<T>(
      `SELECT * FROM ${table} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Find records by field
   */
  findByField: async <T extends QueryResultRow = any>(
    table: string,
    field: string,
    value: any
  ): Promise<T[]> => {
    const result = await query<T>(
      `SELECT * FROM ${table} WHERE ${field} = $1`,
      [value]
    );
    return result.rows;
  },

  /**
   * Find one record by conditions
   */
  findOne: async <T extends QueryResultRow = any>(
    table: string,
    conditions: Record<string, any>
  ): Promise<T | null> => {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    
    const result = await query<T>(
      `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Find many records with pagination
   */
  findMany: async <T extends QueryResultRow = any>(
    table: string,
    conditions: Record<string, any> = {},
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{ rows: T[]; total: number }> => {
    const { limit = 50, offset = 0, orderBy = 'created_at', orderDirection = 'DESC' } = options;
    
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.length > 0 
      ? 'WHERE ' + keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ')
      : '';
    
    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${table} ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Get paginated results
    const dataResult = await query<T>(
      `SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} ${orderDirection} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );
    
    return {
      rows: dataResult.rows,
      total
    };
  },

  /**
   * Create new record
   */
  create: async <T extends QueryResultRow = any>(
    table: string,
    data: Record<string, any>
  ): Promise<T> => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const columns = keys.join(', ');
    
    const result = await query<T>(
      `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return result.rows[0];
  },

  /**
   * Update record by ID
   */
  update: async <T extends QueryResultRow = any>(
    table: string,
    id: string,
    data: Record<string, any>
  ): Promise<T | null> => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    
    const result = await query<T>(
      `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete record by ID
   */
  deleteById: async (table: string, id: string): Promise<boolean> => {
    const result = await query(
      `DELETE FROM ${table} WHERE id = $1`,
      [id]
    );
    return (result.rowCount || 0) > 0;
  },

  /**
   * Soft delete (set is_active = false)
   */
  softDelete: async <T extends QueryResultRow = any>(
    table: string,
    id: string
  ): Promise<T | null> => {
    const result = await query<T>(
      `UPDATE ${table} SET is_active = false WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }
};

// Export everything
export { Pool } from 'pg';
export type { PoolClient, QueryResult } from 'pg';