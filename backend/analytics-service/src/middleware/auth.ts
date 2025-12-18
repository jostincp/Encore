/**
 * =============================================================================
 * MusicBar Analytics Service - Authentication Middleware
 * =============================================================================
 * Description: JWT-based authentication middleware
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { CacheManager } from '../utils/cache';
import config from '../utils/config';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'bar_owner' | 'staff' | 'user';
  bar_id?: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

interface JWTPayload {
  sub: string; // user id
  userId?: string;
  id?: string;
  email: string;
  role: string;
  bar_id?: string;
  barId?: string;
  permissions: string[];
  iat: number;
  exp: number;
}

// =============================================================================
// Configuration
// =============================================================================

const JWT_SECRET = config.JWT_SECRET;
const JWT_ALGORITHM = 'HS256';
const TOKEN_CACHE_TTL = 300; // 5 minutes

// Cache manager will be initialized when Redis is available
let cacheManager: CacheManager | null = null;

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * Main authentication middleware
 * Validates JWT tokens and adds user context to request
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (!token) {
      throw new AuthenticationError('Token not provided');
    }

    // Check if token is blacklisted (cached) - skip if cache not available
    if (cacheManager) {
      const isBlacklisted = await cacheManager.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked');
      }

      // Check cache for validated token
      const cachedUser = await cacheManager.get(`auth:${token}`);
      if (cachedUser && typeof cachedUser === 'string') {
        req.user = JSON.parse(cachedUser);
        req.token = token;
        return next();
      }
    }

        // Verify and decode JWT token
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
          algorithms: [JWT_ALGORITHM]
        }) as JWTPayload;

        // Check for required fields
        const userId = decoded.sub || decoded.userId || decoded.id;
        if (!userId) {
           // Allow without user ID if it's a valid token, might be a service token or partial auth
           // But better to log warning
           logger.warn('Token payload missing user ID');
        }

        // Create user object from token payload
        const user: AuthenticatedUser = {
          id: userId || 'unknown',
          email: decoded.email,
          role: decoded.role as AuthenticatedUser['role'],
          bar_id: decoded.bar_id || decoded.barId,
          permissions: decoded.permissions || [],
          iat: decoded.iat,
          exp: decoded.exp
        };
    
        // ... (rest of logic)
        
        // Add user and token to request
        req.user = user;
        req.token = token;
    
        logger.debug('User authenticated successfully', {
          userId: user.id,
          role: user.role,
          barId: user.bar_id
        });
    
        next();
    } catch (err: any) {
        logger.error('JWT Verify Failed', { 
            error: err.message, 
            secretLength: JWT_SECRET.length,
            secretFirstChar: JWT_SECRET.substring(0, 1),
            tokenSnippet: token.substring(0, 10)
        });
        throw err;
    }

  } catch (error) {
    logger.warn('Authentication failed', {
      error: {
        code: 'AUTH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AuthenticationError('Invalid token'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AuthenticationError('Token has expired'));
    }
    if (error instanceof jwt.NotBeforeError) {
      return next(new AuthenticationError('Token not active yet'));
    }

    next(error);
  }
};

// =============================================================================
// Optional Authentication Middleware
// =============================================================================

/**
 * Optional authentication middleware
 * Adds user context if token is provided, but doesn't require it
 */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token provided, continue without authentication
    }

    // Use the main auth middleware if token is provided
    await authMiddleware(req, res, next);
  } catch (error) {
    // Log the error but continue without authentication
    logger.debug('Optional authentication failed, continuing without auth', {
      error: {
        code: 'OPTIONAL_AUTH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
    next();
  }
};

// =============================================================================
// Role-based Authorization Middleware
// =============================================================================

/**
 * Create role-based authorization middleware
 */
export const requireRole = (...allowedRoles: AuthenticatedUser['role'][]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      ));
    }

    next();
  };
};

/**
 * Admin-only authorization middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * Manager or admin authorization middleware
 */
// Replace manager with bar_owner per unified roles
export const requireManager = requireRole('admin', 'bar_owner');

/**
 * Staff or higher authorization middleware
 */
export const requireStaff = requireRole('admin', 'bar_owner', 'staff');

// =============================================================================
// Permission-based Authorization Middleware
// =============================================================================

/**
 * Create permission-based authorization middleware
 */
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return next(new AuthorizationError(
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}`
      ));
    }

    next();
  };
};

// =============================================================================
// Bar-specific Authorization Middleware
// =============================================================================

/**
 * Ensure user has access to specific bar
 */
export const requireBarAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }

  // Admin users have access to all bars
  if (req.user.role === 'admin') {
    return next();
  }

  // Get bar_id from request params or query
  const requestedBarId = req.params.bar_id || req.query.bar_id as string;
  
  if (!requestedBarId) {
    return next(); // No specific bar requested
  }

  // Check if user has access to the requested bar
  if (req.user.bar_id && req.user.bar_id !== requestedBarId) {
    return next(new AuthorizationError(
      'Access denied. You do not have permission to access this bar\'s data'
    ));
  }

  next();
};

// =============================================================================
// Token Utilities
// =============================================================================

/**
 * Blacklist a token (logout)
 */
export const blacklistToken = async (token: string): Promise<void> => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await cacheManager.set(`blacklist:${token}`, 'true', ttl);
        await cacheManager.del(`auth:${token}`);
      }
    }
  } catch (error) {
    logger.error('Failed to blacklist token', { error });
  }
};

/**
 * Clear user's cached authentication
 */
export const clearUserCache = async (userId: string): Promise<void> => {
  try {
    // This would require maintaining a user->token mapping
    // For now, we'll just log the action
    logger.info('User cache clear requested', { userId });
  } catch (error) {
    logger.error('Failed to clear user cache', { error, userId });
  }
};

// =============================================================================
// Export Default
// =============================================================================

export default {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireManager,
  requireStaff,
  requirePermission,
  requireBarAccess,
  blacklistToken,
  clearUserCache
};