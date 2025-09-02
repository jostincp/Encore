"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseStats = exports.tableExists = exports.runMigration = exports.deleteById = exports.update = exports.create = exports.findMany = exports.findOne = exports.findByField = exports.findById = exports.transaction = exports.query = exports.closeDatabase = exports.getPool = exports.initializeDatabase = void 0;
const pg_1 = require("pg");
const logger_1 = require("./logger");
let pool;
const initializeDatabase = async () => {
    try {
        pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        (0, logger_1.logInfo)('Database connection established successfully');
    }
    catch (error) {
        (0, logger_1.logError)('Failed to connect to database', error);
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
const getPool = () => {
    if (!pool) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return pool;
};
exports.getPool = getPool;
const closeDatabase = async () => {
    if (pool) {
        await pool.end();
        (0, logger_1.logInfo)('Database connection closed');
    }
};
exports.closeDatabase = closeDatabase;
const query = async (text, params) => {
    const client = await pool.connect();
    try {
        const start = Date.now();
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        (0, logger_1.logInfo)('Executed query', {
            query: text,
            duration: `${duration}ms`,
            rows: result.rowCount
        });
        return result;
    }
    catch (error) {
        (0, logger_1.logError)('Query execution failed', error, {
            query: text,
            params
        });
        throw error;
    }
    finally {
        client.release();
    }
};
exports.query = query;
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        (0, logger_1.logError)('Transaction failed', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.transaction = transaction;
const findById = async (table, id) => {
    const result = await (0, exports.query)(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0] || null;
};
exports.findById = findById;
const findByField = async (table, field, value) => {
    const result = await (0, exports.query)(`SELECT * FROM ${table} WHERE ${field} = $1`, [value]);
    return result.rows;
};
exports.findByField = findByField;
const findOne = async (table, conditions) => {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const result = await (0, exports.query)(`SELECT * FROM ${table} WHERE ${whereClause}`, values);
    return result.rows[0] || null;
};
exports.findOne = findOne;
const findMany = async (table, conditions = {}, options = {}) => {
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
    const result = await (0, exports.query)(queryText, values);
    return result.rows;
};
exports.findMany = findMany;
const create = async (table, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const columns = keys.join(', ');
    const queryText = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await (0, exports.query)(queryText, values);
    return result.rows[0];
};
exports.create = create;
const update = async (table, id, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const queryText = `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await (0, exports.query)(queryText, [id, ...values]);
    return result.rows[0];
};
exports.update = update;
const deleteById = async (table, id) => {
    const result = await (0, exports.query)(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return result.rowCount > 0;
};
exports.deleteById = deleteById;
const runMigration = async (migrationSql) => {
    try {
        await (0, exports.query)(migrationSql);
        (0, logger_1.logInfo)('Migration executed successfully');
    }
    catch (error) {
        (0, logger_1.logError)('Migration failed', error);
        throw error;
    }
};
exports.runMigration = runMigration;
const tableExists = async (tableName) => {
    const result = await (0, exports.query)(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`, [tableName]);
    return result.rows[0].exists;
};
exports.tableExists = tableExists;
const getDatabaseStats = async () => {
    const result = await (0, exports.query)(`
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
exports.getDatabaseStats = getDatabaseStats;
//# sourceMappingURL=database.js.map