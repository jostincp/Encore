// Minimal shared database module to satisfy service imports during development
// Provides stubbed interfaces compatible with expected usage in services.

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

// Initialize database (no-op for development stubs)
export const initializeDatabase = async (): Promise<void> => {
  // Intentionally left blank. Replace with real initialization when integrating DB.
};

// Get pool/client placeholder
export const getPool = (): any => {
  // Return a minimal object that can be passed to transaction handlers if needed.
  return {};
};

// Basic query stub that returns empty results.
// Keeps signature compatible with pg-style callers that expect { rows }.
export const query = async <T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> => {
  // For development, return empty result set. Replace with real DB logic later.
  return { rows: [], rowCount: 0 };
};

// Transaction wrapper executing provided function with a dummy client.
export const transaction = async <T = any>(fn: (client: any) => Promise<T>): Promise<T> => {
  const client = getPool();
  return fn(client);
};

// Close database connections (no-op for stubs)
export const closeDatabase = async (): Promise<void> => {
  // Intentionally left blank.
};

// Run migrations (no-op for stubs)
export const runMigrations = async (): Promise<void> => {
  // Intentionally left blank. Hook for future migration system.
};