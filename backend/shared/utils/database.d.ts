import { Pool, PoolClient } from 'pg';
export declare const initializeDatabase: () => Promise<void>;
export declare const getPool: () => Pool;
export declare const closeDatabase: () => Promise<void>;
export declare const query: (text: string, params?: any[]) => Promise<any>;
export declare const transaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
export declare const findById: (table: string, id: string) => Promise<any>;
export declare const findByField: (table: string, field: string, value: any) => Promise<any[]>;
export declare const findOne: (table: string, conditions: Record<string, any>) => Promise<any>;
export declare const findMany: (table: string, conditions?: Record<string, any>, options?: {
    orderBy?: string;
    order?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
}) => Promise<any[]>;
export declare const create: (table: string, data: Record<string, any>) => Promise<any>;
export declare const update: (table: string, id: string, data: Record<string, any>) => Promise<any>;
export declare const deleteById: (table: string, id: string) => Promise<boolean>;
export declare const runMigration: (migrationSql: string) => Promise<void>;
export declare const tableExists: (tableName: string) => Promise<boolean>;
export declare const getDatabaseStats: () => Promise<any>;
//# sourceMappingURL=database.d.ts.map