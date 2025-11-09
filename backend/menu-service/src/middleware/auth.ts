import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// Extend Request interface to include user information
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'bar_owner' | 'staff' | 'user' | 'guest';
    bar_id?: string;
  };
}

// JWT Authentication Middleware
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Add user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      bar_id: decoded.bar_id
    };

    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }
};

// Authorization middleware for admin users
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }

  next();
};

// Authorization middleware for bar owners
export const requireBarOwner = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'bar_owner') {
    res.status(403).json({
      success: false,
      message: 'Bar owner access required'
    });
    return;
  }

  next();
};

// Authorization middleware for admin or bar owner
export const requireAdminOrBarOwner = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin' && req.user.role !== 'bar_owner') {
    res.status(403).json({
      success: false,
      message: 'Admin or bar owner access required'
    });
    return;
  }

  next();
};

// Authorization middleware to check if user can access specific bar
export const requireBarAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  const barId = req.params.barId;
  
  if (!barId) {
    res.status(400).json({
      success: false,
      message: 'Bar ID required'
    });
    return;
  }

  // Admin can access any bar
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Bar owner can only access their own bar
  if (req.user.role === 'bar_owner') {
    if (req.user.bar_id !== barId) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this bar'
      });
      return;
    }
    next();
    return;
  }

  // Users can view menu items but cannot modify
  if (req.user.role === 'user') {
    const method = req.method.toLowerCase();
    if (method === 'get') {
      next();
      return;
    } else {
      res.status(403).json({
        success: false,
        message: 'Users can only view menu items'
      });
      return;
    }
  }

  res.status(403).json({
    success: false,
    message: 'Access denied'
  });
};

// Middleware to check if user can modify menu items (admin or bar owner of the specific bar)
export const requireMenuModifyAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  // Admin can modify any menu
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Bar owner can only modify their own bar's menu
  if (req.user.role === 'bar_owner') {
    const barId = req.params.barId;
    
    if (!barId) {
      res.status(400).json({
        success: false,
        message: 'Bar ID required'
      });
      return;
    }

    if (req.user.bar_id !== barId) {
      res.status(403).json({
        success: false,
        message: 'You can only modify your own bar\'s menu'
      });
      return;
    }
    
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'Menu modification requires admin or bar owner privileges'
  });
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      bar_id: decoded.bar_id
    };

    next();
  } catch (error) {
    // If token is invalid, continue without user info
    logger.warn('Optional auth failed:', error);
    next();
  }
};

// Rate limiting middleware for different user roles
export const createRoleBasedRateLimit = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // This would integrate with express-rate-limit
    // Different limits based on user role
    const user = req.user;
    
    if (!user) {
      // Usuarios invitados/anonimos (GUEST)
      (req as any).rateLimit = { max: 10, windowMs: 60000 }; // 10 solicitudes por minuto
    } else if (user.role === 'user') {
      (req as any).rateLimit = { max: 30, windowMs: 60000 }; // 30 solicitudes por minuto
    } else if (user.role === 'bar_owner') {
      (req as any).rateLimit = { max: 100, windowMs: 60000 }; // 100 requests per minute
    } else if (user.role === 'admin') {
      (req as any).rateLimit = { max: 500, windowMs: 60000 }; // 500 requests per minute
    }
    
    next();
  };
};

// Middleware to log user actions for audit purposes
export const auditLog = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log the action after response is sent
    const user = req.user;
    const action = {
      method: req.method,
      path: req.path,
      user_id: user?.id,
      user_role: user?.role,
      bar_id: req.params.barId,
      status_code: res.statusCode,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      user_agent: req.get('User-Agent')
    };
    
    // Only log modification actions
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      logger.info('Menu action audit:', action);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Middleware to check if bar exists and is active
export const validateBarExists = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const barId = req.params.barId;
    
    if (!barId) {
      res.status(400).json({
        success: false,
        message: 'Bar ID required'
      });
      return;
    }

    // This would typically check the database
    // For now, we'll assume the bar exists if the ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(barId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid bar ID format'
      });
      return;
    }

    // TODO: Add actual database check for bar existence and status
    // const bar = await BarModel.findById(barId);
    // if (!bar || !bar.is_active) {
    //   res.status(404).json({
    //     success: false,
    //     message: 'Bar not found or inactive'
    //   });
    //   return;
    // }

    next();
  } catch (error) {
    logger.error('Bar validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating bar'
    });
  }
};