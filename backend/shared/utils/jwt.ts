import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from './errors';
import { logError } from './logger';

// Interfaces para el payload del JWT
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'customer';
  barId?: string;
  iat?: number;
  exp?: number;
}

// Extender la interfaz Request de Express para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Generar token de acceso
export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as StringValue,
    issuer: 'encore-api',
    audience: 'encore-client'
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

// Generar token de refresh
export const generateRefreshToken = (userId: string): string => {
  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN as StringValue,
    issuer: 'encore-api',
    audience: 'encore-client'
  };
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, options);
};

// Verificar token
export const verifyToken = (token: string): JwtPayload => {
  try {
    const options: VerifyOptions = {
      issuer: 'encore-api',
      audience: 'encore-client'
    };
    const decoded = jwt.verify(token, JWT_SECRET, options) as JwtPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token');
    } else {
      throw new UnauthorizedError('Token verification failed');
    }
  }
};

// Middleware de autenticación
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    logError('Authentication failed', error as Error, {
      url: req.url,
      method: req.method,
      headers: req.headers
    });
    next(error);
  }
};

// Middleware de autorización por rol
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware de autorización por bar (para admins)
export const requireBarAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    const barId = req.params.barId || req.body.barId || req.query.barId;
    
    if (!barId) {
      throw new ForbiddenError('Bar ID required');
    }

    // Si es admin, debe tener acceso al bar específico
    if (req.user.role === 'admin' && req.user.barId !== barId) {
      throw new ForbiddenError('Access denied to this bar');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware opcional de autenticación (no lanza error si no hay token)
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // En autenticación opcional, continuamos sin usuario si el token es inválido
    next();
  }
};

// Función para extraer token de diferentes fuentes
export const extractToken = (req: Request): string | null => {
  // Buscar en header Authorization
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Buscar en cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  // Buscar en query parameters (menos seguro, solo para casos específicos)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
};

// Función para generar tokens de sesión de mesa (para clientes anónimos)
export const generateTableSessionToken = (tableId: string, barId: string): string => {
  return jwt.sign(
    {
      tableId,
      barId,
      type: 'table_session',
      role: 'customer'
    },
    JWT_SECRET,
    {
      expiresIn: '12h', // Sesiones de mesa duran 12 horas
      issuer: 'encore-api',
      audience: 'encore-client'
    }
  );
};

// Verificar token de sesión de mesa
export const verifyTableSessionToken = (token: string): { tableId: string; barId: string } => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'table_session') {
      throw new UnauthorizedError('Invalid session token');
    }
    
    return {
      tableId: decoded.tableId,
      barId: decoded.barId
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid table session token');
  }
};

// Middleware para autenticación de sesión de mesa
export const authenticateTableSession = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new UnauthorizedError('Session token required');
    }

    const sessionData = verifyTableSessionToken(token);
    
    // Agregar datos de sesión al request
    req.user = {
      userId: `table_${sessionData.tableId}`,
      email: '',
      role: 'customer',
      barId: sessionData.barId
    };
    
    (req as any).tableSession = sessionData;
    
    next();
  } catch (error) {
    next(error);
  }
};

// Función para decodificar token sin verificar (útil para debugging)
export const decodeTokenUnsafe = (token: string): any => {
  return jwt.decode(token);
};

// Función para verificar si un token está próximo a expirar
export const isTokenExpiringSoon = (token: string, minutesThreshold: number = 15): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return false;
    
    const expirationTime = decoded.exp * 1000; // Convertir a milliseconds
    const currentTime = Date.now();
    const thresholdTime = minutesThreshold * 60 * 1000;
    
    return (expirationTime - currentTime) < thresholdTime;
  } catch (error) {
    return true; // Si hay error, asumir que está expirando
  }
};