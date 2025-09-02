// Local type definitions to replace shared imports
import { Request } from 'express';

export interface Config {
  port: number;
  nodeEnv: string;
  serviceName: string;
  databaseUrl: string;
  redisUrl?: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  corsOrigins: string[];
  youtubeApiKey?: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'bar_owner' | 'customer';
  bar_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DatabaseConnection {
  query: (text: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
}

export interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: any) => Promise<string>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
}

// Error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

// JWT utilities
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  barId?: string;
}

export const generateToken = (payload: JwtPayload): string => {
  // Mock implementation - replace with actual JWT generation
  return 'mock-token';
};

export const verifyToken = (token: string): JwtPayload => {
  // Mock implementation - replace with actual JWT verification
  return {
    userId: 'mock-user-id',
    email: 'mock@email.com',
    role: 'customer'
  };
};

// Logger utilities
export const logInfo = (message: string, meta?: any): void => {
  console.log(`[INFO] ${message}`, meta || '');
};

export const logError = (message: string, error?: any): void => {
  console.error(`[ERROR] ${message}`, error || '');
};

export const logWarn = (message: string, meta?: any): void => {
  console.warn(`[WARN] ${message}`, meta || '');
};

export const logDebug = (message: string, meta?: any): void => {
  console.debug(`[DEBUG] ${message}`, meta || '');
};

// Menu-related interfaces
export interface CreateCategoryData {
  bar_id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface MenuFilters {
  category_id?: string;
  is_available?: boolean;
  min_price?: number;
  max_price?: number;
  tags?: string[];
  allergens?: string[];
  search?: string;
}

export interface CreateMenuItemData {
  bar_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available?: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
  nutritional_info?: any;
  tags?: string[];
  sort_order?: number;
}

export interface UpdateMenuItemData {
  category_id?: string;
  name?: string;
  description?: string;
  price?: number;
  image_url?: string;
  is_available?: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
  nutritional_info?: any;
  tags?: string[];
  sort_order?: number;
}

export interface CreateDailySpecialData {
  bar_id: string;
  menu_item_id: string;
  special_price: number;
  start_date: Date;
  end_date: Date;
  description?: string;
  is_active?: boolean;
}

export interface UpdateDailySpecialData {
  menu_item_id?: string;
  special_price?: number;
  start_date?: Date;
  end_date?: Date;
  description?: string;
  is_active?: boolean;
}