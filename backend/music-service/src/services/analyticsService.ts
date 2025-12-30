
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
});

// Buffer simple para analytics
let analyticsBuffer: AnalyticsEvent[] = [];
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30 segundos

interface AnalyticsEvent {
    barId: string;
    searchQuery: string;
    resultsCount: number;
    cacheHit: boolean;
    timestamp: Date;
}

export class AnalyticsService {

    static async initialize() {
        try {
            await pool.query(`
        CREATE TABLE IF NOT EXISTS search_analytics (
          id SERIAL PRIMARY KEY,
          bar_id UUID NOT NULL,
          search_query TEXT NOT NULL,
          results_count INTEGER NOT NULL,
          cache_hit BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_analytics_bar_date ON search_analytics(bar_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_analytics_query ON search_analytics(search_query);
      `);
            console.log('✅ Analytics table initialized');
        } catch (error) {
            console.error('❌ Failed to initialize analytics table:', error);
        }
    }

    /**
     * Registrar evento de búsqueda de forma segura
     */
    static track(data: Omit<AnalyticsEvent, 'timestamp'>) {
        analyticsBuffer.push({
            ...data,
            timestamp: new Date()
        });

        // Flush inmediato si alcanzamos el tamaño del batch
        if (analyticsBuffer.length >= BATCH_SIZE) {
            this.flush().catch(console.error);
        }
    }

    /**
     * Guardar batch en base de datos de forma SEGURA (SQL Injection Proof)
     */
    static async flush(retryCount = 0) {
        if (analyticsBuffer.length === 0) return;

        // Tomar todos los items actuales y limpiar buffer
        const batch = analyticsBuffer.splice(0, analyticsBuffer.length);

        try {
            // ✅ SEGURO: Generar placeholders ($1, $2, $3...) dinámicamente
            // Generamos ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), etc.
            const placeholders = batch.map((_, i) => {
                const base = i * 5;
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
            }).join(',');

            // ✅ SEGURO: Aplanar todos los valores en un solo array
            const params = batch.flatMap(item => [
                item.barId,
                item.searchQuery,
                item.resultsCount,
                item.cacheHit,
                item.timestamp.toISOString()
            ]);

            // Ejecutar query parametrizada
            await pool.query(`
        INSERT INTO search_analytics (bar_id, search_query, results_count, cache_hit, created_at)
        VALUES ${placeholders}
      `, params);

            console.log(`✅ Analytics flushed: ${batch.length} records`);

        } catch (error) {
            console.error('❌ Failed to flush analytics:', error);

            // Retry con exponential backoff simple
            if (retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                console.log(`⚠️ Retry ${retryCount + 1} in ${delay}ms`);

                // Reinsertar en buffer al principio para mantener orden aproximado
                analyticsBuffer.unshift(...batch);

                setTimeout(() => this.flush(retryCount + 1), delay);
            } else {
                console.error(`❌ Analytics lost after 3 retries: ${batch.length} records dropped`);
                // En un sistema real, aquí podríamos escribir a un archivo de log local como último recurso
            }
        }
    }
}

// Inicializar tabla y flush automático
AnalyticsService.initialize();
setInterval(() => AnalyticsService.flush().catch(console.error), FLUSH_INTERVAL);

// Graceful shutdown
const cleanup = async () => {
    console.log('🛑 Flushing analytics before shutdown...');
    await AnalyticsService.flush();
    await pool.end();
    console.log('✅ Analytics service stopped');
};

// Capturar señales de terminación
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
