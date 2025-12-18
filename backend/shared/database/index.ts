import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

let pool: Pool | null = null;

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'encore_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  };
};

export const initializeDatabase = async (): Promise<void> => {
  if (!pool) {
    pool = new Pool(getDbConfig());
    await pool.query('SELECT 1'); // Test connection
    console.log('Database pool initialized');
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool(getDbConfig());
  }
  return pool;
};

export const query = async <T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> => {
  const p = getPool();
  const result = await p.query(sql, params);
  return {
    rows: result.rows,
    rowCount: result.rowCount || 0
  };
};

export const transaction = async <T = any>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export const runMigrations = async (): Promise<void> => {
  // Placeholder
};
