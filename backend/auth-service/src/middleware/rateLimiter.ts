import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Basic rate limiter configuration
 */
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: 'Rate limit exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json({
        success: false,
        message,
        error: 'Rate limit exceeded'
      });
    }
  });
};

/**
 * General rate limiter - 100 requests per 15 minutes
 */
export const rateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100,
  'Demasiadas solicitudes, intenta de nuevo más tarde'
);

/**
 * Auth rate limiter - 5 login attempts per 15 minutes
 */
export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5,
  'Demasiados intentos de login, intenta de nuevo más tarde'
);

/**
 * Registration rate limiter - 3 registrations per hour
 */
export const registrationRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3,
  'Demasiados intentos de registro, intenta de nuevo más tarde'
);

/**
 * Password reset rate limiter - 3 attempts per hour
 */
export const passwordResetRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3,
  'Demasiados intentos de recuperación de contraseña, intenta de nuevo más tarde'
);

/**
 * Email verification rate limiter - 5 attempts per hour
 */
export const emailVerificationRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5,
  'Demasiados intentos de verificación de email, intenta de nuevo más tarde'
);

/**
 * Strict rate limiter - 10 requests per 15 minutes
 */
export const strictRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10,
  'Límite de solicitudes excedido, intenta de nuevo más tarde'
);

export const rateLimitEmailVerification = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: {
    error: 'Too many email verification attempts, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Límite de solicitudes excedido, intenta de nuevo más tarde',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Strict rate limiter for sensitive operations
 */
export const rateLimitStrict = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per hour
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Límite estricto de solicitudes excedido, intenta de nuevo más tarde',
      retryAfter: '1 hour'
    });
  }
});