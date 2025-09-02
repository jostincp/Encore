import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from '../config';
import { rateLimitService } from '../utils/redis';
import { logInfo, logWarn, requestLogger } from '../utils/logger';
import { sendErrorResponse, AppError } from '../utils/errors';
import { AuthenticatedRequest } from '../utils/jwt';

// Middleware de seguridad con Helmet
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Middleware de CORS
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Bar-ID',
    'X-Table-ID'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ]
});

// Middleware de compresión
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Solo comprimir si es mayor a 1KB
});

// Rate limiting básico con express-rate-limit
export const basicRateLimit = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logWarn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      url: req.url,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
    });
  }
});

// Rate limiting avanzado con Redis
export const advancedRateLimit = (options: {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  const {
    maxRequests,
    windowMs,
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const result = await rateLimitService.checkRateLimit(key, maxRequests, windowMs);

      // Agregar headers de rate limit
      res.set({
        'X-Rate-Limit-Limit': maxRequests.toString(),
        'X-Rate-Limit-Remaining': result.remaining.toString(),
        'X-Rate-Limit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        logWarn(`Advanced rate limit exceeded for key: ${key}`, {
          key,
          url: req.url,
          method: req.method
        });

        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded, please try again later.',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      // Middleware para limpiar rate limit en caso de éxito/fallo
      const originalSend = res.send;
      res.send = function(data) {
        const statusCode = res.statusCode;
        
        if (skipSuccessfulRequests && statusCode < 400) {
          rateLimitService.clearRateLimit(key);
        } else if (skipFailedRequests && statusCode >= 400) {
          rateLimitService.clearRateLimit(key);
        }
        
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      // En caso de error con Redis, permitir la request
      logWarn('Rate limit check failed, allowing request', error as Error);
      next();
    }
  };
};

// Rate limiting específico para autenticación
export const authRateLimit = advancedRateLimit({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutos
  keyGenerator: (req) => `auth:${req.ip}`,
  skipSuccessfulRequests: true
});

// Rate limiting específico para APIs de música
export const musicApiRateLimit = advancedRateLimit({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minuto
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user ? `music:${req.user.userId}` : `music:${req.ip}`;
  }
});

// Rate limiting específico para solicitudes de canciones
export const songRequestRateLimit = advancedRateLimit({
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 5 minutos
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user ? `song_request:${req.user.userId}` : `song_request:${req.ip}`;
  }
});

// Middleware de validación de Content-Type
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return sendErrorResponse(res, new AppError('Content-Type header is required', 400));
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      return sendErrorResponse(res, new AppError(
        `Invalid Content-Type. Allowed types: ${allowedTypes.join(', ')}`,
        400
      ));
    }

    next();
  };
};

// Middleware de validación de API Key (para servicios externos)
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!apiKey) {
    return sendErrorResponse(res, new AppError('API Key required', 401));
  }

  if (!validApiKeys.includes(apiKey)) {
    return sendErrorResponse(res, new AppError('Invalid API Key', 401));
  }

  next();
};

// Middleware de validación de Bar ID
export const validateBarId = (req: Request, res: Response, next: NextFunction) => {
  const barId = req.params.barId || req.headers['x-bar-id'] || req.body.barId;
  
  if (!barId) {
    return sendErrorResponse(res, new AppError('Bar ID is required', 400));
  }

  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(barId)) {
    return sendErrorResponse(res, new AppError('Invalid Bar ID format', 400));
  }

  // Agregar barId al request para uso posterior
  (req as any).barId = barId;
  next();
};

// Middleware de validación de Table ID
export const validateTableId = (req: Request, res: Response, next: NextFunction) => {
  const tableId = req.params.tableId || req.headers['x-table-id'] || req.body.tableId;
  
  if (!tableId) {
    return sendErrorResponse(res, new AppError('Table ID is required', 400));
  }

  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tableId)) {
    return sendErrorResponse(res, new AppError('Invalid Table ID format', 400));
  }

  // Agregar tableId al request para uso posterior
  (req as any).tableId = tableId;
  next();
};

// Middleware de paginación
export const paginationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); // Máximo 100 items
  const offset = (page - 1) * limit;

  // Agregar parámetros de paginación al request
  (req as any).pagination = {
    page,
    limit,
    offset
  };

  next();
};

// Middleware de logging de requests
export const requestLoggingMiddleware = requestLogger;

// Middleware de health check
export const healthCheckMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/ping') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: config.serviceName,
      version: process.env.npm_package_version || '1.0.0'
    });
  }
  next();
};

// Middleware de timeout
export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request Timeout',
          message: 'Request took too long to process'
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Middleware de validación de JSON
export const validateJsonMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'DELETE') {
    return next();
  }

  const contentType = req.headers['content-type'];
  
  if (contentType && contentType.includes('application/json')) {
    if (Object.keys(req.body).length === 0) {
      return sendErrorResponse(res, new AppError('Request body cannot be empty', 400));
    }
  }

  next();
};

// Middleware combinado para configuración básica
export const basicMiddleware = [
  healthCheckMiddleware,
  securityMiddleware,
  corsMiddleware,
  compressionMiddleware,
  requestLoggingMiddleware,
  timeoutMiddleware(),
  validateJsonMiddleware
];

// Middleware combinado para APIs protegidas
export const protectedApiMiddleware = [
  ...basicMiddleware,
  basicRateLimit,
  validateContentType(['application/json'])
];

// Middleware combinado para APIs de autenticación
export const authApiMiddleware = [
  ...basicMiddleware,
  authRateLimit,
  validateContentType(['application/json'])
];