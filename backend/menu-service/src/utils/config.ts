import dotenv from 'dotenv';
import path from 'path';
import { logInfo, logError } from '../types/shared';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // backend/menu-service/.env


interface Config {
  // Server configuration
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  
  // Database configuration
  DATABASE_URL: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
  DB_POOL_MIN: number;
  DB_POOL_MAX: number;
  
  // Redis configuration
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  REDIS_CACHE_TTL: number;
  
  // JWT configuration
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  
  // API Keys
  YOUTUBE_API_KEY?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  
  // External service URLs
  AUTH_SERVICE_URL: string;
  MUSIC_SERVICE_URL: string;
  QUEUE_SERVICE_URL: string;
  POINTS_SERVICE_URL: string;
  ANALYTICS_SERVICE_URL: string;
  
  // File upload configuration
  MAX_FILE_SIZE: number;
  ALLOWED_IMAGE_TYPES: string[];
  UPLOAD_PATH: string;
  
  // Cache configuration
  CACHE_ENABLED: boolean;
  CACHE_DEFAULT_TTL: number;
  CACHE_MENU_TTL: number;
  CACHE_CATEGORY_TTL: number;
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_AUTH_MAX: number;
  
  // Logging
  LOG_LEVEL: string;
  LOG_FILE_ENABLED: boolean;
  LOG_FILE_PATH: string;
  
  // Security
  BCRYPT_ROUNDS: number;
  SESSION_SECRET: string;
  CORS_ORIGINS: string[];
  
  // Business logic
  MAX_MENU_ITEMS_PER_BAR: number;
  MAX_CATEGORIES_PER_BAR: number;
  MAX_TAGS_PER_ITEM: number;
  MAX_INGREDIENTS_PER_ITEM: number;
  MIN_PRICE: number;
  MAX_PRICE: number;
  MAX_PREPARATION_TIME: number;
}

// Helper function to parse boolean values
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
};

// Helper function to parse number values
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse array values
const parseArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

// Configuration object
export const config: Config = {
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseNumber(process.env.MENU_SERVICE_PORT || process.env.PORT, 3004),
  HOST: process.env.HOST || '0.0.0.0',
  
  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseNumber(process.env.DB_PORT, 5432),
  DB_NAME: process.env.DB_NAME || 'encore',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: parseBoolean(process.env.DB_SSL, false),
  DB_POOL_MIN: parseNumber(process.env.DB_POOL_MIN, 2),
  DB_POOL_MAX: parseNumber(process.env.DB_POOL_MAX, 10),
  
  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseNumber(process.env.REDIS_PORT, 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: parseNumber(process.env.REDIS_DB, 0),
  REDIS_CACHE_TTL: parseNumber(process.env.REDIS_CACHE_TTL, 3600), // 1 hour
  
  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // API Keys
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
  // External service URLs
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  MUSIC_SERVICE_URL: process.env.MUSIC_SERVICE_URL || 'http://localhost:3002',
  QUEUE_SERVICE_URL: process.env.QUEUE_SERVICE_URL || 'http://localhost:3003',
  POINTS_SERVICE_URL: process.env.POINTS_SERVICE_URL || 'http://localhost:3005',
  ANALYTICS_SERVICE_URL: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006',
  
  // File upload configuration
  MAX_FILE_SIZE: parseNumber(process.env.MAX_FILE_SIZE, 10 * 1024 * 1024), // 10MB
  ALLOWED_IMAGE_TYPES: parseArray(process.env.ALLOWED_IMAGE_TYPES, ['image/jpeg', 'image/png', 'image/webp']),
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
  
  // Cache configuration
  CACHE_ENABLED: parseBoolean(process.env.CACHE_ENABLED, true),
  CACHE_DEFAULT_TTL: parseNumber(process.env.CACHE_DEFAULT_TTL, 3600), // 1 hour
  CACHE_MENU_TTL: parseNumber(process.env.CACHE_MENU_TTL, 1800), // 30 minutes
  CACHE_CATEGORY_TTL: parseNumber(process.env.CACHE_CATEGORY_TTL, 3600), // 1 hour
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 1000),
  RATE_LIMIT_AUTH_MAX: parseNumber(process.env.RATE_LIMIT_AUTH_MAX, 50),
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE_ENABLED: parseBoolean(process.env.LOG_FILE_ENABLED, true),
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || './logs',
  
  // Security
  BCRYPT_ROUNDS: parseNumber(process.env.BCRYPT_ROUNDS, 12),
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  CORS_ORIGINS: parseArray(process.env.CORS_ORIGINS, [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://encore.vercel.app'
  ]),
  
  // Business logic
  MAX_MENU_ITEMS_PER_BAR: parseNumber(process.env.MAX_MENU_ITEMS_PER_BAR, 500),
  MAX_CATEGORIES_PER_BAR: parseNumber(process.env.MAX_CATEGORIES_PER_BAR, 50),
  MAX_TAGS_PER_ITEM: parseNumber(process.env.MAX_TAGS_PER_ITEM, 10),
  MAX_INGREDIENTS_PER_ITEM: parseNumber(process.env.MAX_INGREDIENTS_PER_ITEM, 20),
  MIN_PRICE: parseNumber(process.env.MIN_PRICE, 0),
  MAX_PRICE: parseNumber(process.env.MAX_PRICE, 10000), // $100.00
  MAX_PREPARATION_TIME: parseNumber(process.env.MAX_PREPARATION_TIME, 300) // 5 hours
};

// Validate required configuration
const validateConfig = () => {
  const requiredFields = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_USER'
  ];
  
  const missingFields = requiredFields.filter(field => {
    const value = config[field as keyof Config];
    return !value || (typeof value === 'string' && value.trim() === '');
  });
  
  if (missingFields.length > 0) {
    const error = `Missing required configuration fields: ${missingFields.join(', ')}`;
    logError(error);
    throw new Error(error);
  }
  
  // Validate database URL if provided
  if (config.DATABASE_URL && !config.DATABASE_URL.startsWith('postgresql://')) {
    logError('DATABASE_URL should start with postgresql://');
  }
  
  // Validate Redis URL if provided
  if (config.REDIS_URL && !config.REDIS_URL.startsWith('redis://')) {
    logError('REDIS_URL should start with redis://');
  }
  
  // Warn about default secrets in production
  if (config.NODE_ENV === 'production') {
    const defaultSecrets = [
      { key: 'JWT_SECRET', value: config.JWT_SECRET },
      { key: 'JWT_REFRESH_SECRET', value: config.JWT_REFRESH_SECRET },
      { key: 'SESSION_SECRET', value: config.SESSION_SECRET }
    ];
    
    defaultSecrets.forEach(({ key, value }) => {
      if (value.includes('change-in-production')) {
        logError(`${key} is using default value in production!`);
      }
    });
  }
  
  logInfo('Configuration validated successfully', {
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    dbHost: config.DB_HOST,
    dbName: config.DB_NAME,
    redisHost: config.REDIS_HOST,
    cacheEnabled: config.CACHE_ENABLED
  });
};

// Validate configuration on import
validateConfig();

export default config;