
import { Request, Response, NextFunction } from 'express';

// Estados del Circuit Breaker
enum CircuitState {
    CLOSED, // Todo bien, tráfico fluye
    OPEN,   // Fallos detectados, tráfico bloqueado
    HALF_OPEN // Probando recuperación
}

interface CircuitStats {
    failureCount: number;
    lastFailureTime: number;
    state: CircuitState;
    nextAttempt: number;
}

// Configuración
const FAILURE_THRESHOLD = 5; // Número de fallos para abrir circuito (reduje de 10 a 5 por seguridad)
const RESET_TIMEOUT = 60000; // 1 minuto de espera cuando está abierto

// Estado global (en memoria)
const circuit: CircuitStats = {
    failureCount: 0,
    lastFailureTime: 0,
    state: CircuitState.CLOSED,
    nextAttempt: 0
};

/**
 * Middleware para proteger llamadas externas (YouTube API)
 */
export const circuitBreakerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (circuit.state === CircuitState.OPEN) {
        if (Date.now() > circuit.nextAttempt) {
            circuit.state = CircuitState.HALF_OPEN;
        } else {
            return res.status(503).json({
                success: false,
                message: 'Service temporarily unavailable (Circuit Breaker)',
                retryAfter: Math.ceil((circuit.nextAttempt - Date.now()) / 1000)
            });
        }
    }

    next();
};

/**
 * Wrapper para llamadas a API que monitorea fallos
 */
export async function executeProtectedCall<T>(fn: () => Promise<T>): Promise<T> {
    // Check fast fail
    if (circuit.state === CircuitState.OPEN) {
        if (Date.now() > circuit.nextAttempt) {
            circuit.state = CircuitState.HALF_OPEN; // Permitir 1 intento
        } else {
            throw new Error('Circuit Breaker is OPEN');
        }
    }

    try {
        const result = await fn();

        // Si éxito en HALF_OPEN, cerrar circuito
        if (circuit.state === CircuitState.HALF_OPEN) {
            resetCircuit();
            console.log('✅ Circuit Breaker recovered (CLOSED)');
        }
        return result;

    } catch (error: any) {
        handleFailure(error);
        throw error;
    }
}

function handleFailure(error: any) {
    // Analizar tipo de error para decidir si abrir circuito

    // 1. Errores de Cliente (4xx) - NO deben abrir circuito usualmente (excepto 429)
    if (error.response) {
        const status = error.response.status;

        // 404 = Video no encontrado -> No cuenta como fallo de sistema
        if (status === 404) return;

        // 400 = Bad Request -> No cuenta
        if (status === 400) return;

        // 429 = Too Many Requests (YouTube Quota) -> CRÍTICO, abrir inmediato
        if (status === 429) {
            console.error('🚨 YouTube Quota Exceeded! Opening Circuit Breaker immediately.');
            openCircuit();
            return;
        }
    }

    // 2. Errores de Sistema (5xx, Network) -> Cuentan para fallo
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    console.warn(`⚠️ API Failure detected (${circuit.failureCount}/${FAILURE_THRESHOLD})`);

    if (circuit.failureCount >= FAILURE_THRESHOLD) {
        openCircuit();
    }
}

function openCircuit() {
    circuit.state = CircuitState.OPEN;
    circuit.nextAttempt = Date.now() + RESET_TIMEOUT;
    console.error('🔥 Circuit Breaker OPENED. Requests paused for 60s.');
}

function resetCircuit() {
    circuit.state = CircuitState.CLOSED;
    circuit.failureCount = 0;
    circuit.nextAttempt = 0;
}

export const getCircuitStatus = () => ({
    state: CircuitState[circuit.state],
    failures: circuit.failureCount,
    isOpen: circuit.state === CircuitState.OPEN
});
