import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';
import { config } from '../config';

// ==============================================
// CONFIGURACIÓN DE CORS SEGURA
// ==============================================
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = config.cors.origins;
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('No permitido por política CORS'), false);
    }
  },
  credentials: config.cors.credentials,
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
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 horas
};

// ==============================================
// CONFIGURACIÓN DE HELMET SEGURA
// ==============================================
export const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'https://api.spotify.com', 'https://www.googleapis.com'],
      mediaSrc: ["'self'", 'https:', 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Para compatibilidad con APIs externas
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

// ==============================================
// RATE LIMITING GRANULAR
// ==============================================

// Rate limiting general
export const generalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Saltar rate limiting para health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Rate limiting estricto para autenticación
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: {
    error: 'Demasiados intentos de autenticación, intenta de nuevo en 15 minutos.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para APIs externas
export const externalApiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requests por minuto
  message: {
    error: 'Límite de búsquedas alcanzado, intenta de nuevo en un minuto.',
    retryAfter: 60
  }
});

// Rate limiting para WebSocket connections
export const socketRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 eventos por minuto
  message: {
    error: 'Demasiada actividad en tiempo real, reduce la frecuencia.',
    retryAfter: 60
  }
});

// ==============================================
// VALIDADORES DE INPUT
// ==============================================

// Validador de ID de MongoDB/UUID
export const validateId = param('id')
  .isLength({ min: 1 })
  .matches(/^[a-fA-F0-9]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  .withMessage('ID inválido');

// Validador de email
export const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Email inválido');

// Validador de contraseña segura
export const validatePassword = body('password')
  .isLength({ min: 8, max: 128 })
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]$/)
  .withMessage('La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos');

// Validador de nombre de usuario
export const validateUsername = body('username')
  .isLength({ min: 3, max: 30 })
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage('El nombre de usuario debe tener 3-30 caracteres alfanuméricos');

// Validador de texto general (previene XSS)
export const validateText = (field: string, maxLength: number = 500) => {
  return body(field)
    .isLength({ max: maxLength })
    .customSanitizer((value) => {
      return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
    })
    .withMessage(`${field} excede la longitud máxima de ${maxLength} caracteres`);
};

// Validador de puntos (números positivos)
export const validatePoints = body('points')
  .isInt({ min: 0, max: 10000 })
  .withMessage('Los puntos deben ser un número entero entre 0 y 10000');

// Validador de precio
export const validatePrice = body('price')
  .isFloat({ min: 0, max: 9999.99 })
  .withMessage('El precio debe ser un número válido entre 0 y 9999.99');

// Validador de URL de canción
export const validateSongUrl = body('url')
  .isURL({ protocols: ['https'] })
  .matches(/^https:\/\/(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com)/)
  .withMessage('URL de canción inválida (solo YouTube y Spotify)');

// ==============================================
// MIDDLEWARE DE VALIDACIÓN
// ==============================================
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
  }
  
  return next();
};

// ==============================================
// SANITIZACIÓN DE DATOS
// ==============================================
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitizar body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitizar query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  return next();
};

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Remover caracteres peligrosos y sanitizar HTML
      sanitized[key] = DOMPurify.sanitize(value.trim(), { ALLOWED_TAGS: [] });
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ==============================================
// RATE LIMITERS ORGANIZADOS
// ==============================================
export const rateLimiters = {
  general: generalRateLimit,
  auth: authRateLimit,
  externalApi: externalApiRateLimit,
  socket: socketRateLimit
};

// ==============================================
// MIDDLEWARE DE SEGURIDAD COMBINADO
// ==============================================
export const securityMiddleware = [
  helmet(helmetOptions),
  cors(corsOptions),
  generalRateLimit,
  sanitizeInput
];

// ==============================================
// UTILIDADES DE SEGURIDAD
// ==============================================
export const generateSecureToken = (): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

export const hashSensitiveData = (data: string): string => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Verificar si una IP está en lista negra (implementar según necesidades)
export const isBlacklisted = (ip: string): boolean => {
  // Lista básica de IPs bloqueadas (en producción usar base de datos)
  const blacklistedIPs = [
    '0.0.0.0',
    '127.0.0.1'
  ];
  
  return blacklistedIPs.includes(ip);
};

// Middleware para bloquear IPs en lista negra
export const blockBlacklistedIPs = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (isBlacklisted(clientIP)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado'
    });
  }
  
  return next();
};

export default {
  corsOptions,
  helmetOptions,
  generalRateLimit,
  authRateLimit,
  externalApiRateLimit,
  socketRateLimit,
  validateId,
  validateEmail,
  validatePassword,
  validateUsername,
  validateText,
  validatePoints,
  validatePrice,
  validateSongUrl,
  handleValidationErrors,
  sanitizeInput,
  securityMiddleware,
  generateSecureToken,
  hashSensitiveData,
  blockBlacklistedIPs
};