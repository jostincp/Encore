import { Pool, PoolClient } from 'pg';
import { logInfo, logError } from './logger';

// Configuración de la conexión a PostgreSQL
let pool: Pool;

export const initializeDatabase = async (): Promise<void> => {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Máximo número de conexiones en el pool
      idleTimeoutMillis: 30000, // Tiempo de espera antes de cerrar conexiones inactivas
      connectionTimeoutMillis: 2000, // Tiempo de espera para obtener una conexión
    });

    // Probar la conexión
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logInfo('Database connection established successfully');
  } catch (error) {
    logError('Failed to connect to database', error as Error);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logInfo('Database connection closed');
  }
};

// Función para ejecutar queries con manejo de errores
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await pool.connect();
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    logInfo('Executed query', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logError('Query execution failed', error as Error, {
      query: text,
      params
    });
    throw error;
  } finally {
    client.release();
  }
};

// Función para transacciones
export const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logError('Transaction failed', error as Error);
    throw error;
  } finally {
    client.release();
  }
};

// Funciones de utilidad para queries comunes
export const findById = async (table: string, id: string): Promise<any> => {
  const result = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

export const findByField = async (table: string, field: string, value: any): Promise<any[]> => {
  const result = await query(`SELECT * FROM ${table} WHERE ${field} = $1`, [value]);
  return result.rows;
};

export const findOne = async (table: string, conditions: Record<string, any>): Promise<any> => {
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
  
  const result = await query(`SELECT * FROM ${table} WHERE ${whereClause}`, values);
  return result.rows[0] || null;
};

export const findMany = async (
  table: string,
  conditions: Record<string, any> = {},
  options: {
    orderBy?: string;
    order?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> => {
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  
  let queryText = `SELECT * FROM ${table}`;
  
  if (keys.length > 0) {
    const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    queryText += ` WHERE ${whereClause}`;
  }
  
  if (options.orderBy) {
    queryText += ` ORDER BY ${options.orderBy} ${options.order || 'ASC'}`;
  }
  
  if (options.limit) {
    queryText += ` LIMIT ${options.limit}`;
  }
  
  if (options.offset) {
    queryText += ` OFFSET ${options.offset}`;
  }
  
  const result = await query(queryText, values);
  return result.rows;
};

export const create = async (table: string, data: Record<string, any>): Promise<any> => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  const columns = keys.join(', ');
  
  const queryText = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
  const result = await query(queryText, values);
  return result.rows[0];
};

export const update = async (table: string, id: string, data: Record<string, any>): Promise<any> => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
  
  const queryText = `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const result = await query(queryText, [id, ...values]);
  return result.rows[0];
};

export const deleteById = async (table: string, id: string): Promise<boolean> => {
  const result = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return result.rowCount > 0;
};

// Función para ejecutar migraciones
export const runMigration = async (migrationSql: string): Promise<void> => {
  try {
    await query(migrationSql);
    logInfo('Migration executed successfully');
  } catch (error) {
    logError('Migration failed', error as Error);
    throw error;
  }
};

// Función para verificar si una tabla existe
export const tableExists = async (tableName: string): Promise<boolean> => {
  const result = await query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
    [tableName]
  );
  return result.rows[0].exists;
};

// Función para obtener estadísticas de la base de datos
export const getDatabaseStats = async (): Promise<any> => {
  const result = await query(`
    SELECT 
      schemaname,
      tablename,
      attname,
      n_distinct,
      correlation
    FROM pg_stats 
    WHERE schemaname = 'public'
    ORDER BY tablename, attname
  `);
  return result.rows;
};