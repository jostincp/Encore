import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from './logger';
import { auditQuery } from '../../../shared/utils/database-audit';
import { Request } from 'express';

let pool: Pool | null = null;

export const initializeDatabase = async () => {
  const maxAttempts = 5;
  let attempt = 0;
  let lastError: any = null;

  // Log configuration used for DB connection (excluding password for security)
  logger.info('Initializing DB connection', {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    ssl: config.database.ssl
  });

  while (attempt < maxAttempts) {
    attempt++;
    try {
      pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password
      });

      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Database connected successfully');
      return; // success
    } catch (error) {
      lastError = error;
      const msg = (error as Error)?.message || String(error);
      logger.warn(`DB connection attempt ${attempt}/${maxAttempts} failed`, { message: msg });
      // incremental backoff: 0.5s, 1s, 2s, 3s, 5s
      const delays = [500, 1000, 2000, 3000, 5000];
      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      await new Promise(res => setTimeout(res, delay));
    }
  }

  logger.error('Failed to connect to database after retries:', lastError);
  throw lastError;
};

export const runMigrations = async () => {
  try {
    logger.info('Running database migrations...');
    // Create required tables if they do not exist
    const pool = getPool();
    const client = await pool.connect();

    try {
      // Ensure users table exists (minimal schema)
      await client.query(
        `CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          phone VARCHAR(20),
          avatar_url TEXT,
          bar_id UUID,
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`
      );

      // Create refresh_tokens table required by auth flow
      await client.query(
        `CREATE TABLE IF NOT EXISTS refresh_tokens (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_revoked BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );

      // Indexes to optimize lookups
      await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`);

      // Create bars table used by BarModel
      await client.query(
        `CREATE TABLE IF NOT EXISTS bars (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          address VARCHAR(255) NOT NULL,
          city VARCHAR(100) NOT NULL,
          country VARCHAR(100) NOT NULL,
          phone VARCHAR(20),
          email VARCHAR(255),
          website_url TEXT,
          logo_url TEXT,
          cover_image_url TEXT,
          owner_id UUID NOT NULL,
          timezone VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_bars_owner_id FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );

      // Helpful indexes for bars
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bars_owner_id ON bars(owner_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bars_is_active ON bars(is_active)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bars_city ON bars(city)`);

      // Create bar_settings table used by BarModel.getSettings / updateSettings
      await client.query(
        `CREATE TABLE IF NOT EXISTS bar_settings (
          id UUID PRIMARY KEY,
          bar_id UUID NOT NULL UNIQUE,
          max_songs_per_user INTEGER DEFAULT 5,
          song_request_cooldown INTEGER DEFAULT 60,
          priority_play_cost INTEGER DEFAULT 100,
          auto_approve_requests BOOLEAN DEFAULT false,
          allow_explicit_content BOOLEAN DEFAULT false,
          max_queue_size INTEGER DEFAULT 100,
          points_per_visit INTEGER DEFAULT 10,
          points_per_purchase INTEGER DEFAULT 10,
          enable_loyalty_program BOOLEAN DEFAULT true,
          open_time VARCHAR(10),
          close_time VARCHAR(10),
          timezone VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_bar_settings_bar_id FOREIGN KEY (bar_id) REFERENCES bars(id) ON DELETE CASCADE
        )`
      );

      await client.query(`CREATE INDEX IF NOT EXISTS idx_bar_settings_bar_id ON bar_settings(bar_id)`);

      logger.info('Database migrations completed');
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to run migrations:', error);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
};

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  auditOptions?: {
    userId?: string;
    req?: Request;
    sensitive?: boolean;
  }
) => {
  // Ensure database pool is initialized (lazy init on first query if needed)
  let dbPool: Pool;
  try {
    dbPool = getPool();
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (/Database not initialized/i.test(msg)) {
      // Attempt to initialize DB dynamically to avoid 503 in development
      try {
        await initializeDatabase();
        logger.info('Database lazily initialized on first query');
        dbPool = getPool();
      } catch (initErr) {
        // Re-throw original error if initialization fails
        throw e;
      }
    } else {
      throw e;
    }
  }

  const client = await dbPool.connect();
  const startTime = Date.now();

  try {
    const result = await client.query<T>(text, params);
    const duration = Date.now() - startTime;

    // Auditoría para consultas sensibles
    if (auditOptions?.sensitive || isSensitiveQuery(text)) {
      const action = getQueryAction(text);
      const table = extractTableName(text);

      auditQuery(
        'auth-service',
        action,
        table,
        text,
        params || [],
        {
          userId: auditOptions?.userId,
          req: auditOptions?.req,
          success: true,
          duration
        }
      );
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Registrar errores de base de datos
    if (auditOptions?.sensitive || isSensitiveQuery(text)) {
      const action = getQueryAction(text);
      const table = extractTableName(text);

      auditQuery(
        'auth-service',
        action,
        table,
        text,
        params || [],
        {
          userId: auditOptions?.userId,
          req: auditOptions?.req,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Database error'
        }
      );
    }

    throw error;
  } finally {
    client.release();
  }
};

export const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const dbOperations = {
  async create<T extends QueryResultRow>(table: string, data: Record<string, any>): Promise<T> {
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

  async findById<T extends QueryResultRow>(table: string, id: string): Promise<T | null> {
    const result = await query<T>(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  async findByField<T extends QueryResultRow>(table: string, field: string, value: any): Promise<T[]> {
    const result = await query<T>(`SELECT * FROM ${table} WHERE ${field} = $1`, [value]);
    return result.rows;
  },

  async update<T extends QueryResultRow>(table: string, id: string, data: Record<string, any>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    
    const result = await query<T>(
      `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },

  async delete(table: string, id: string): Promise<boolean> {
    const result = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return (result.rowCount || 0) > 0;
  }
};

// ==============================================
// FUNCIONES AUXILIARES PARA AUDITORÍA
// ==============================================

/**
 * Determina si una consulta es sensible y debe ser auditada
 */
function isSensitiveQuery(query: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /session/i,
    /auth/i,
    /login/i,
    /users/i,
    /admin/i
  ];

  return sensitivePatterns.some(pattern => pattern.test(query));
}

/**
 * Extrae la acción de la consulta SQL
 */
function getQueryAction(query: string): string {
  const upperQuery = query.toUpperCase().trim();

  if (upperQuery.startsWith('SELECT')) return 'SELECT';
  if (upperQuery.startsWith('INSERT')) return 'INSERT';
  if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
  if (upperQuery.startsWith('DELETE')) return 'DELETE';

  return 'QUERY';
}

/**
 * Extrae el nombre de la tabla de la consulta SQL
 */
function extractTableName(query: string): string {
  // Patrones para extraer nombres de tabla de diferentes tipos de consultas
  const patterns = [
    /FROM\s+(\w+)/i,
    /INTO\s+(\w+)/i,
    /UPDATE\s+(\w+)/i,
    /DELETE\s+FROM\s+(\w+)/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return 'unknown';
}