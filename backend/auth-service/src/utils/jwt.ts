import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { JWTPayload, RequestWithUser } from '../types';
import { UnauthorizedError, ForbiddenError } from './errors';
import { logger } from './logger';

/**
 * Generate JWT token
 */
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  } as jwt.SignOptions);
};

/**
 * Generate access token (alias for generateToken)
 */
export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return generateToken(payload);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  } as jwt.SignOptions);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Token inválido');
    }
    throw new UnauthorizedError('Error de autenticación');
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Refresh token inválido');
    }
    throw new UnauthorizedError('Error de autenticación');
  }
};

/**
 * Extract token from Authorization header
 */
export const extractToken = (authHeader?: string): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Authentication middleware
 */
export const authenticate = (req: RequestWithUser, res: Response, next: NextFunction): void => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (!token) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    
    logger.debug('User authenticated', { userId: decoded.userId, role: decoded.role });
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization middleware - check if user has required role
 */
export const authorize = (...roles: string[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Usuario no autenticado');
      }

      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError('Permisos insuficientes');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Bar access middleware - check if user can access specific bar
 */
export const authorizeBarAccess = (barId: string) => {
  return (req: RequestWithUser, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Usuario no autenticado');
      }

      // Admin can access any bar
      if (req.user.role === 'super_admin') {
        return next();
      }

      // Bar admin can only access their own bar
      if (req.user.role === 'bar_admin' && req.user.barId !== barId) {
        throw new ForbiddenError('Acceso denegado a este bar');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication middleware - doesn't throw error if no token
 */
export const optionalAuthenticate = (req: RequestWithUser, res: Response, next: NextFunction): void => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        barId: decoded.barId
      };
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next();
  }
};