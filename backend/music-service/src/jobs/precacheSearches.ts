import cron from 'node-cron';
import axios from 'axios';
import { TOP_200_SEARCHES_COLOMBIA } from '../config/topSearches';
import { normalizeQuery } from '../utils/queryNormalizer';

// Importar configuración de Redis
const Redis = require('ioredis');
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times: number) => Math.min(times * 50, 2000)
});

const BATCH_SIZE = 5; // 5 búsquedas en paralelo
const BATCH_DELAY_MS = 1000; // 1 segundo entre lotes
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const CACHE_TTL = 864000; // 10 días en segundos
const MAX_RETRIES = 3; // Reintentos en caso de error
const RETRY_DELAY_MS = 5000; // 5 segundos entre reintentos

/**
 * Divide un array en lotes del tamaño especificado
 */
function chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );
}

/**
 * Espera un número de milisegundos
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cachea una búsqueda individual en Redis
 */
async function cacheQuery(query: string): Promise<'cached' | 'skipped' | 'error'> {
    try {
        const key = `search:${normalizeQuery(query)}`;

        // Verificar si existe y NO está por expirar
        const existing = await redis.get(key);
        if (existing) {
            const data = JSON.parse(existing);
            const age = Date.now() - new Date(data.cachedAt).getTime();
            const twoDays = 2 * 24 * 60 * 60 * 1000;

            if (age < twoDays) {
                return 'skipped'; // Skip si tiene <2 días
            }
        }

        // Llamar a YouTube API con retry logic
        let results;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: {
                        part: 'snippet',
                        q: query,
                        type: 'video',
                        maxResults: 10,
                        key: YOUTUBE_API_KEY,
                        regionCode: 'CO', // Colombia
                        relevanceLanguage: 'es'
                    }
                });

                // Transformar resultados
                results = response.data.items.map((item: any) => ({
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    artist: item.snippet.channelTitle,
                    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                    channel: item.snippet.channelTitle,
                    publishedAt: item.snippet.publishedAt
                }));

                break; // Éxito, salir del loop de reintentos

            } catch (error: any) {
                if (attempt === MAX_RETRIES - 1) {
                    throw error; // Último intento falló
                }
                console.warn(`Retry ${attempt + 1}/${MAX_RETRIES} for '${query}': ${error.message}`);
                await sleep(RETRY_DELAY_MS);
            }
        }

        // Guardar en Redis con TTL de 10 días
        await redis.setex(
            key,
            CACHE_TTL,
            JSON.stringify({
                query,
                results,
                cachedAt: new Date().toISOString(),
                ttl: CACHE_TTL
            })
        );

        return 'cached';

    } catch (error: any) {
        console.error(`Error caching '${query}':`, error.message);
        return 'error';
    }
}

/**
 * Función principal de pre-caché
 */
export async function runPrecache(searchList: string[] = TOP_200_SEARCHES_COLOMBIA) {
    console.log('🔄 Iniciando pre-caché de búsquedas...');
    console.log(`📊 Total de búsquedas a procesar: ${searchList.length}`);

    const batches = chunk(searchList, BATCH_SIZE);
    let cached = 0;
    let skipped = 0;
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        // Procesar lote en paralelo
        const results = await Promise.all(batch.map(cacheQuery));

        // Contar resultados
        results.forEach(result => {
            if (result === 'cached') cached++;
            else if (result === 'skipped') skipped++;
            else if (result === 'error') errors++;
        });

        // Log de progreso cada 10 lotes
        if ((i + 1) % 10 === 0) {
            const progress = ((i + 1) / batches.length * 100).toFixed(1);
            console.log(`⏳ Progreso: ${progress}% (${i + 1}/${batches.length} lotes)`);
        }

        // Delay entre lotes (excepto el último)
        if (i < batches.length - 1) {
            await sleep(BATCH_DELAY_MS);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalCost = cached * 100; // Cada búsqueda = 100 units

    console.log(`✅ Pre-caché completado en ${duration}s`);
    console.log(`📊 Resultados: ${cached} cacheadas, ${skipped} omitidas, ${errors} errores`);
    console.log(`💰 Cuota usada: ${totalCost} units`);

    // Guardar costo en Redis para endpoint de stats
    await redis.set('cron:last_cost', totalCost.toString());
    await redis.set('cron:last_run', new Date().toISOString());
}

// Programar ejecución SEMANAL (domingos a las 4 AM)
cron.schedule('0 4 * * 0', async () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🕐 Cron Job Ejecutado: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        await runPrecache();
    } catch (error) {
        console.error('❌ Error en cron job de pre-caché:', error);
    }

    console.log(`\n${'='.repeat(60)}\n`);
});

console.log('⏰ Cron job de pre-caché registrado (ejecuta SEMANALMENTE domingos a las 4 AM)');

// Permitir ejecución inmediata para testing (LIMITADO A 10 BÚSQUEDAS)
if (process.env.RUN_CRON_NOW === 'true') {
    console.log('\n🧪 Modo de testing: Ejecutando pre-caché con 10 búsquedas...\n');
    const testSearches = TOP_200_SEARCHES_COLOMBIA.slice(0, 10);
    runPrecache(testSearches)
        .then(() => {
            console.log('\n✅ Testing completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error en testing:', error);
            process.exit(1);
        });
}
