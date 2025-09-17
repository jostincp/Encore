import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from './logger';
import { auditQuery } from '../../../shared/utils/database-audit';
import { Request } from 'express';

let pool: Pool | null = null;

export const initializeDatabase = async () => {
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
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const runMigrations = async () => {
  try {
    logger.info('Running database migrations...');
    // Add migration logic here if needed
    logger.info('Database migrations completed');
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
  const pool = getPool();
  const client = await pool.connect();
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