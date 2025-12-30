
import { Request, Response, NextFunction } from 'express';

// Token Bucket Algorithm implementation
// Permite ráfagas cortas pero mantiene el promedio bajo el límite

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

// Configuración por defecto
const DEFAULT_MAX_TOKENS = 30; // Máximo tokens acumulados (Burst size)
const DEFAULT_REFILL_RATE = 2; // Tokens por segundo (Average rate)

// Almacenamiento en memoria (podría ser Redis para clusters)
const barTokens = new Map<string, TokenBucket>();
const ipTokens = new Map<string, TokenBucket>();

// Limpiar buckets inactivos cada 10 minutos
setInterval(() => {
    const now = Date.now();
    const TEN_MINUTES = 10 * 60 * 1000;

    for (const [key, bucket] of barTokens.entries()) {
        if (now - bucket.lastRefill > TEN_MINUTES) {
            barTokens.delete(key);
        }
    }
    for (const [key, bucket] of ipTokens.entries()) {
        if (now - bucket.lastRefill > TEN_MINUTES) {
            ipTokens.delete(key);
        }
    }
}, 600000);

/**
 * Verifica si hay tokens disponibles y consume uno
 */
function consumeToken(
    map: Map<string, TokenBucket>,
    key: string,
    maxTokens: number,
    refillRate: number
): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    let bucket = map.get(key);

    if (!bucket) {
        bucket = { tokens: maxTokens, lastRefill: now };
        map.set(key, bucket);
    }

    // Refill tokens basado en el tiempo transcurrido
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;

    if (elapsedSeconds > 0) {
        const newTokens = elapsedSeconds * refillRate;
        bucket.tokens = Math.min(maxTokens, bucket.tokens + newTokens);
        bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true };
    } else {
        // Calcular tiempo para obtener 1 token
        const secondsToWait = (1 - bucket.tokens) / refillRate;
        return { allowed: false, retryAfter: Math.ceil(secondsToWait) };
    }
}

/**
 * Middleware para límite por Bar ID (Token Bucket)
 * Protege contra un bar específico haciendo spam
 */
export const barRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    // Intentar obtener barId de varios lugares
    const barId = req.params.barId || req.query.barId || req.body.barId;

    if (!barId) {
        // Si no hay barId, pasar al siguiente (podría ser un admin request)
        // O aplicar IP rate limiter
        return next();
    }

    // Whitelist para bares premium (ejemplo)
    if (barId === 'test-bar-premium') return next();

    const { allowed, retryAfter } = consumeToken(barTokens, String(barId), 20, 1); // 20 burst, 1 req/s avg

    if (allowed) {
        next();
    } else {
        res.status(429).json({
            success: false,
            message: 'Too many requests from this bar. Please wait.',
            retryAfter
        });
    }
};

/**
 * Middleware para límite por IP (Token Bucket)
 * Protege contra clientes individuales abusivos
 */
export const ipRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Limites más relajados para IP (pueden ser muchos usuarios tras NAT)
    const { allowed, retryAfter } = consumeToken(ipTokens, String(ip), 50, 5); // 50 burst, 5 req/s avg

    if (allowed) {
        next();
    } else {
        res.status(429).json({
            success: false,
            message: 'Too many requests from your IP. Please wait.',
            retryAfter
        });
    }
};
