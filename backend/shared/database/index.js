"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pool = exports.dbOperations = exports.getStats = exports.healthCheck = exports.runMigrations = exports.transaction = exports.query = exports.closeDatabase = exports.getPool = exports.initializeDatabase = void 0;
const pg_1 = require("pg");
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
let pool = null;
const initializeDatabase = async () => {
    try {
        pool = new pg_1.Pool({
            host: config_1.config.database.host,
            port: config_1.config.database.port,
            database: config_1.config.database.name,
            user: config_1.config.database.user,
            password: config_1.config.database.password,
            ssl: config_1.config.database.ssl ? { rejectUnauthorized: false } : false,
            max: config_1.config.database.maxConnections,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger_1.logger.info('Database connection pool initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize database connection pool:', error);
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
const getPool = () => {
    if (!pool) {
        throw new Error('Database pool not initialized. Call initializeDatabase() first.');
    }
    return pool;
};
exports.getPool = getPool;
const closeDatabase = async () => {
    if (pool) {
        await pool.end();
        pool = null;
        logger_1.logger.info('Database connection pool closed');
    }
};
exports.closeDatabase = closeDatabase;
const query = async (text, params) => {
    const client = await (0, exports.getPool)().connect();
    try {
        const start = Date.now();
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        logger_1.logger.debug('Executed query', {
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            duration: `${duration}ms`,
            rows: result.rowCount
        });
        return result;
    }
    catch (error) {
        logger_1.logger.error('Database query error:', {
            error: error instanceof Error ? error.message : error,
            query: text.substring(0, 200)
        });
        throw error;
    }
    finally {
        client.release();
    }
};
exports.query = query;
const transaction = async (callback) => {
    const client = await (0, exports.getPool)().connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Transaction rolled back:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.transaction = transaction;
const runMigrations = async () => {
    try {
        logger_1.logger.info('Running database migrations...');
        await (0, exports.query)(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        const executedMigrations = await (0, exports.query)('SELECT filename FROM migrations ORDER BY id');
        const executedFiles = new Set(executedMigrations.rows.map(row => row.filename));
        const migrationFiles = [
            '001_initial_schema.sql'
        ];
        for (const filename of migrationFiles) {
            if (!executedFiles.has(filename)) {
                logger_1.logger.info(`Running migration: ${filename}`);
                const migrationPath = (0, path_1.join)(__dirname, 'migrations', filename);
                const migrationSQL = (0, fs_1.readFileSync)(migrationPath, 'utf8');
                await (0, exports.transaction)(async (client) => {
                    await client.query(migrationSQL);
                    await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
                });
                logger_1.logger.info(`Migration completed: ${filename}`);
            }
        }
        logger_1.logger.info('All migrations completed successfully');
    }
    catch (error) {
        logger_1.logger.error('Migration failed:', error);
        throw error;
    }
};
exports.runMigrations = runMigrations;
const healthCheck = async () => {
    try {
        await (0, exports.query)('SELECT 1');
        return true;
    }
    catch (error) {
        logger_1.logger.error('Database health check failed:', error);
        return false;
    }
};
exports.healthCheck = healthCheck;
const getStats = async () => {
    const pool = (0, exports.getPool)();
    return {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingCount: pool.waitingCount
    };
};
exports.getStats = getStats;
exports.dbOperations = {
    findById: async (table, id) => {
        const result = await (0, exports.query)(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        return result.rows[0] || null;
    },
    findByField: async (table, field, value) => {
        const result = await (0, exports.query)(`SELECT * FROM ${table} WHERE ${field} = $1`, [value]);
        return result.rows;
    },
    findOne: async (table, conditions) => {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const result = await (0, exports.query)(`SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`, values);
        return result.rows[0] || null;
    },
    findMany: async (table, conditions = {}, options = {}) => {
        const { limit = 50, offset = 0, orderBy = 'created_at', orderDirection = 'DESC' } = options;
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.length > 0
            ? 'WHERE ' + keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ')
            : '';
        const countResult = await (0, exports.query)(`SELECT COUNT(*) as count FROM ${table} ${whereClause}`, values);
        const total = parseInt(countResult.rows[0].count);
        const dataResult = await (0, exports.query)(`SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} ${orderDirection} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]);
        return {
            rows: dataResult.rows,
            total
        };
    },
    create: async (table, data) => {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const columns = keys.join(', ');
        const result = await (0, exports.query)(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`, values);
        return result.rows[0];
    },
    update: async (table, id, data) => {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const result = await (0, exports.query)(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
        return result.rows[0] || null;
    },
    deleteById: async (table, id) => {
        const result = await (0, exports.query)(`DELETE FROM ${table} WHERE id = $1`, [id]);
        return (result.rowCount || 0) > 0;
    },
    softDelete: async (table, id) => {
        const result = await (0, exports.query)(`UPDATE ${table} SET is_active = false WHERE id = $1 RETURNING *`, [id]);
        return result.rows[0] || null;
    }
};
__exportStar(require("../utils/database"), exports);
var pg_2 = require("pg");
Object.defineProperty(exports, "Pool", { enumerable: true, get: function () { return pg_2.Pool; } });
//# sourceMappingURL=index.js.map