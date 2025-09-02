import { Pool, PoolClient, QueryResult } from 'pg';
export declare const initializeDatabase: () => Promise<void>;
export declare const getPool: () => Pool;
export declare const closeDatabase: () => Promise<void>;
export declare const query: <T = any>(text: string, params?: any[]) => Promise<QueryResult<T>>;
export declare const transaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
export declare const runMigrations: () => Promise<void>;
export declare const healthCheck: () => Promise<boolean>;
export declare const getStats: () => Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingCount: number;
}>;
export declare const dbOperations: {
    findById: <T = any>(table: string, id: string) => Promise<T | null>;
    findByField: <T = any>(table: string, field: string, value: any) => Promise<T[]>;
    findOne: <T = any>(table: string, conditions: Record<string, any>) => Promise<T | null>;
    findMany: <T = any>(table: string, conditions?: Record<string, any>, options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
        orderDirection?: "ASC" | "DESC";
    }) => Promise<{
        rows: T[];
        total: number;
    }>;
    create: <T = any>(table: string, data: Record<string, any>) => Promise<T>;
    update: <T = any>(table: string, id: string, data: Record<string, any>) => Promise<T | null>;
    deleteById: (table: string, id: string) => Promise<boolean>;
    softDelete: <T = any>(table: string, id: string) => Promise<T | null>;
};
export * from '../utils/database';
export { Pool, PoolClient, QueryResult } from 'pg';
//# sourceMappingURL=index.d.ts.map