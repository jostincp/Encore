import { Response, NextFunction } from 'express';
import { RequestWithUser } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { authenticate as jwtAuthenticate } from '../utils/jwt';
import { UserRole } from '../constants/roles';

// Re-export authenticate from jwt utils
export const authenticate = jwtAuthenticate;

/**
 * Middleware to require specific roles
 */
export const requireRole = (roles: string[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (req: RequestWithUser, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new ForbiddenError('Admin access required');
  }

  next();
};

/**
 * Middleware to require owner or admin role
 */
export const requireOwnerOrAdmin = (req: RequestWithUser, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const userId = req.params.id || req.params.userId;
  if (req.user.userId !== userId && req.user.role !== UserRole.ADMIN) {
    throw new ForbiddenError('Access denied');
  }

  next();
};