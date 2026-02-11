import dotenv from 'dotenv';
import path from 'path';
import logger from './logger';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

/**
 * Configuration interface
 */
export interface Config {
  // Server configuration
  PORT: number;
  NODE_ENV: string;
  API_VERSION: string;
  SERVICE_NAME: string;

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
  DB_TIMEOUT: number;
  DB_QUERY_TIMEOUT: number;
  DB_CONNECTION_TIMEOUT: number;

  // Redis configuration
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  REDIS_TIMEOUT: number;
  REDIS_RETRY_ATTEMPTS: number;

  // JWT configuration
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  JWT_ISSUER: string;

  // Service configuration
  SERVICE_SECRET: string;
  SERVICE_TOKEN_EXPIRES_IN: string;

  // External services
  USER_SERVICE_URL: string;
  MUSIC_SERVICE_URL: string;
  MENU_SERVICE_URL: string;
  QUEUE_SERVICE_URL: string;
  NOTIFICATION_SERVICE_URL: string;

  // WebSocket configuration
  WEBSOCKET_PORT: number;
  WEBSOCKET_CORS_ORIGIN: string[];
  WEBSOCKET_PING_TIMEOUT: number;
  WEBSOCKET_PING_INTERVAL: number;

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_STRICT_MAX: number;
  RATE_LIMIT_BURST_MAX: number;

  // Logging
  LOG_LEVEL: string;
  LOG_FILE_MAX_SIZE: string;
  LOG_FILE_MAX_FILES: string;

  // Analytics configuration
  ANALYTICS_BATCH_SIZE: number;
  ANALYTICS_PROCESSING_INTERVAL: number;
  ANALYTICS_RETENTION_DAYS: number;
  ANALYTICS_CACHE_TTL: number;

  // Report configuration
  REPORT_MAX_SIZE: number;
  REPORT_TIMEOUT: number;
  REPORT_STORAGE_PATH: string;
  REPORT_CLEANUP_INTERVAL: number;

  // Performance monitoring
  PERFORMANCE_MONITORING: boolean;
  PERFORMANCE_SAMPLE_RATE: number;

  // Security
  CORS_ORIGIN: string[];
  HELMET_ENABLED: boolean;
  TRUST_PROXY: boolean;

  // Health check
  HEALTH_CHECK_INTERVAL: number;
  HEALTH_CHECK_TIMEOUT: number;
}

/**
 * Default configuration values
 */
const defaultConfig: Partial<Config> = {
  PORT: 3007,
  NODE_ENV: 'development',
  API_VERSION: 'v1',
  SERVICE_NAME: 'analytics-service',

  // Database defaults
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_NAME: 'encore_analytics',
  DB_USER: 'postgres',
  DB_SSL: false,
  DB_POOL_MIN: 2,
  DB_POOL_MAX: 10,
  DB_TIMEOUT: 30000,
  DB_QUERY_TIMEOUT: 30000,
  DB_CONNECTION_TIMEOUT: 30000,

  // Redis defaults
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_DB: 2,
  REDIS_TIMEOUT: 5000,
  REDIS_RETRY_ATTEMPTS: 3,

  // JWT defaults
  JWT_EXPIRES_IN: '1h',
  JWT_REFRESH_EXPIRES_IN: '7d',
  JWT_ISSUER: 'encore-analytics',

  // Service defaults
  SERVICE_TOKEN_EXPIRES_IN: '24h',

  // External services defaults
  USER_SERVICE_URL: 'http://localhost:3001',
  MUSIC_SERVICE_URL: 'http://localhost:3002',
  MENU_SERVICE_URL: 'http://localhost:3005',
  QUEUE_SERVICE_URL: 'http://localhost:3003',
  NOTIFICATION_SERVICE_URL: 'http://localhost:3006',

  // WebSocket defaults
  WEBSOCKET_PORT: 3015,
  WEBSOCKET_CORS_ORIGIN: ['http://localhost:3000', 'http://localhost:5173'],
  WEBSOCKET_PING_TIMEOUT: 60000,
  WEBSOCKET_PING_INTERVAL: 25000,

  // Rate limiting defaults
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  RATE_LIMIT_STRICT_MAX: 10,
  RATE_LIMIT_BURST_MAX: 200,

  // Logging defaults
  LOG_LEVEL: 'info',
  LOG_FILE_MAX_SIZE: '20m',
  LOG_FILE_MAX_FILES: '14d',

  // Analytics defaults
  ANALYTICS_BATCH_SIZE: 100,
  ANALYTICS_PROCESSING_INTERVAL: 60000, // 1 minute
  ANALYTICS_RETENTION_DAYS: 365,
  ANALYTICS_CACHE_TTL: 300, // 5 minutes

  // Report defaults
  REPORT_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  REPORT_TIMEOUT: 300000, // 5 minutes
  REPORT_STORAGE_PATH: './reports',
  REPORT_CLEANUP_INTERVAL: 86400000, // 24 hours

  // Performance defaults
  PERFORMANCE_MONITORING: true,
  PERFORMANCE_SAMPLE_RATE: 0.1,

  // Security defaults
  CORS_ORIGIN: ['http://localhost:3000', 'http://localhost:5173'],
  HELMET_ENABLED: true,
  TRUST_PROXY: false,

  // Health check defaults
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  HEALTH_CHECK_TIMEOUT: 5000 // 5 seconds
};

/**
 * Parse environment variable as number
 */
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Parse environment variable as boolean
 */
const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

/**
 * Parse environment variable as array
 */
const parseArray = (value: string | undefined, defaultValue: string[]): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

/**
 * Parse environment variable as float
 */
const parseFloat = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Validate required environment variables
 */
const validateRequiredEnvVars = () => {
  const required = [
    'JWT_SECRET',
    'SERVICE_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

/**
 * Build configuration object
 */
const buildConfig = (): Config => {
  // Validate required environment variables
  validateRequiredEnvVars();

  return {
    // Server configuration
    PORT: parseNumber(process.env.PORT, defaultConfig.PORT!),
    NODE_ENV: process.env.NODE_ENV || defaultConfig.NODE_ENV!,
    API_VERSION: process.env.API_VERSION || defaultConfig.API_VERSION!,
    SERVICE_NAME: process.env.SERVICE_NAME || defaultConfig.SERVICE_NAME!,

    // Database configuration
    DATABASE_URL: process.env.DATABASE_URL || '',
    DB_HOST: process.env.DB_HOST || defaultConfig.DB_HOST!,
    DB_PORT: parseNumber(process.env.DB_PORT, defaultConfig.DB_PORT!),
    DB_NAME: process.env.DB_NAME || defaultConfig.DB_NAME!,
    DB_USER: process.env.DB_USER || defaultConfig.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_SSL: parseBoolean(process.env.DB_SSL, defaultConfig.DB_SSL!),
    DB_POOL_MIN: parseNumber(process.env.DB_POOL_MIN, defaultConfig.DB_POOL_MIN!),
    DB_POOL_MAX: parseNumber(process.env.DB_POOL_MAX, defaultConfig.DB_POOL_MAX!),
    DB_TIMEOUT: parseNumber(process.env.DB_TIMEOUT, defaultConfig.DB_TIMEOUT!),
    DB_QUERY_TIMEOUT: parseNumber(process.env.DB_QUERY_TIMEOUT, defaultConfig.DB_QUERY_TIMEOUT!),
    DB_CONNECTION_TIMEOUT: parseNumber(process.env.DB_CONNECTION_TIMEOUT, defaultConfig.DB_CONNECTION_TIMEOUT!),

    // Redis configuration
    REDIS_URL: process.env.REDIS_URL || '',
    REDIS_HOST: process.env.REDIS_HOST || defaultConfig.REDIS_HOST!,
    REDIS_PORT: parseNumber(process.env.REDIS_PORT, defaultConfig.REDIS_PORT!),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_DB: parseNumber(process.env.REDIS_DB, defaultConfig.REDIS_DB!),
    REDIS_TIMEOUT: parseNumber(process.env.REDIS_TIMEOUT, defaultConfig.REDIS_TIMEOUT!),
    REDIS_RETRY_ATTEMPTS: parseNumber(process.env.REDIS_RETRY_ATTEMPTS, defaultConfig.REDIS_RETRY_ATTEMPTS!),

    // JWT configuration
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || defaultConfig.JWT_EXPIRES_IN!,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || defaultConfig.JWT_REFRESH_EXPIRES_IN!,
    JWT_ISSUER: process.env.JWT_ISSUER || defaultConfig.JWT_ISSUER!,

    // Service configuration
    SERVICE_SECRET: process.env.SERVICE_SECRET!,
    SERVICE_TOKEN_EXPIRES_IN: process.env.SERVICE_TOKEN_EXPIRES_IN || defaultConfig.SERVICE_TOKEN_EXPIRES_IN!,

    // External services
    USER_SERVICE_URL: process.env.USER_SERVICE_URL || defaultConfig.USER_SERVICE_URL!,
    MUSIC_SERVICE_URL: process.env.MUSIC_SERVICE_URL || defaultConfig.MUSIC_SERVICE_URL!,
    MENU_SERVICE_URL: process.env.MENU_SERVICE_URL || defaultConfig.MENU_SERVICE_URL!,
    QUEUE_SERVICE_URL: process.env.QUEUE_SERVICE_URL || defaultConfig.QUEUE_SERVICE_URL!,
    NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || defaultConfig.NOTIFICATION_SERVICE_URL!,

    // WebSocket configuration
    WEBSOCKET_PORT: parseNumber(process.env.WEBSOCKET_PORT, defaultConfig.WEBSOCKET_PORT!),
    WEBSOCKET_CORS_ORIGIN: parseArray(process.env.WEBSOCKET_CORS_ORIGIN, defaultConfig.WEBSOCKET_CORS_ORIGIN!),
    WEBSOCKET_PING_TIMEOUT: parseNumber(process.env.WEBSOCKET_PING_TIMEOUT, defaultConfig.WEBSOCKET_PING_TIMEOUT!),
    WEBSOCKET_PING_INTERVAL: parseNumber(process.env.WEBSOCKET_PING_INTERVAL, defaultConfig.WEBSOCKET_PING_INTERVAL!),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, defaultConfig.RATE_LIMIT_WINDOW_MS!),
    RATE_LIMIT_MAX_REQUESTS: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, defaultConfig.RATE_LIMIT_MAX_REQUESTS!),
    RATE_LIMIT_STRICT_MAX: parseNumber(process.env.RATE_LIMIT_STRICT_MAX, defaultConfig.RATE_LIMIT_STRICT_MAX!),
    RATE_LIMIT_BURST_MAX: parseNumber(process.env.RATE_LIMIT_BURST_MAX, defaultConfig.RATE_LIMIT_BURST_MAX!),

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || defaultConfig.LOG_LEVEL!,
    LOG_FILE_MAX_SIZE: process.env.LOG_FILE_MAX_SIZE || defaultConfig.LOG_FILE_MAX_SIZE!,
    LOG_FILE_MAX_FILES: process.env.LOG_FILE_MAX_FILES || defaultConfig.LOG_FILE_MAX_FILES!,

    // Analytics configuration
    ANALYTICS_BATCH_SIZE: parseNumber(process.env.ANALYTICS_BATCH_SIZE, defaultConfig.ANALYTICS_BATCH_SIZE!),
    ANALYTICS_PROCESSING_INTERVAL: parseNumber(process.env.ANALYTICS_PROCESSING_INTERVAL, defaultConfig.ANALYTICS_PROCESSING_INTERVAL!),
    ANALYTICS_RETENTION_DAYS: parseNumber(process.env.ANALYTICS_RETENTION_DAYS, defaultConfig.ANALYTICS_RETENTION_DAYS!),
    ANALYTICS_CACHE_TTL: parseNumber(process.env.ANALYTICS_CACHE_TTL, defaultConfig.ANALYTICS_CACHE_TTL!),

    // Report configuration
    REPORT_MAX_SIZE: parseNumber(process.env.REPORT_MAX_SIZE, defaultConfig.REPORT_MAX_SIZE!),
    REPORT_TIMEOUT: parseNumber(process.env.REPORT_TIMEOUT, defaultConfig.REPORT_TIMEOUT!),
    REPORT_STORAGE_PATH: process.env.REPORT_STORAGE_PATH || defaultConfig.REPORT_STORAGE_PATH!,
    REPORT_CLEANUP_INTERVAL: parseNumber(process.env.REPORT_CLEANUP_INTERVAL, defaultConfig.REPORT_CLEANUP_INTERVAL!),

    // Performance monitoring
    PERFORMANCE_MONITORING: parseBoolean(process.env.PERFORMANCE_MONITORING, defaultConfig.PERFORMANCE_MONITORING!),
    PERFORMANCE_SAMPLE_RATE: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE, defaultConfig.PERFORMANCE_SAMPLE_RATE!),

    // Security
    CORS_ORIGIN: parseArray(process.env.CORS_ORIGIN, defaultConfig.CORS_ORIGIN!),
    HELMET_ENABLED: parseBoolean(process.env.HELMET_ENABLED, defaultConfig.HELMET_ENABLED!),
    TRUST_PROXY: parseBoolean(process.env.TRUST_PROXY, defaultConfig.TRUST_PROXY!),

    // Health check
    HEALTH_CHECK_INTERVAL: parseNumber(process.env.HEALTH_CHECK_INTERVAL, defaultConfig.HEALTH_CHECK_INTERVAL!),
    HEALTH_CHECK_TIMEOUT: parseNumber(process.env.HEALTH_CHECK_TIMEOUT, defaultConfig.HEALTH_CHECK_TIMEOUT!)
  };
};

/**
 * Configuration validation
 */
const validateConfig = (config: Config) => {
  const errors: string[] = [];

  // Validate port ranges
  if (config.PORT < 1 || config.PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (config.WEBSOCKET_PORT < 1 || config.WEBSOCKET_PORT > 65535) {
    errors.push('WEBSOCKET_PORT must be between 1 and 65535');
  }

  // Validate database configuration
  if (config.DB_POOL_MIN < 0 || config.DB_POOL_MIN > config.DB_POOL_MAX) {
    errors.push('DB_POOL_MIN must be >= 0 and <= DB_POOL_MAX');
  }

  if (config.DB_POOL_MAX < 1) {
    errors.push('DB_POOL_MAX must be >= 1');
  }

  // Validate Redis configuration
  if (config.REDIS_DB < 0 || config.REDIS_DB > 15) {
    errors.push('REDIS_DB must be between 0 and 15');
  }

  // Validate rate limiting
  if (config.RATE_LIMIT_WINDOW_MS < 1000) {
    errors.push('RATE_LIMIT_WINDOW_MS must be >= 1000');
  }

  if (config.RATE_LIMIT_MAX_REQUESTS < 1) {
    errors.push('RATE_LIMIT_MAX_REQUESTS must be >= 1');
  }

  // Validate analytics configuration
  if (config.ANALYTICS_BATCH_SIZE < 1 || config.ANALYTICS_BATCH_SIZE > 1000) {
    errors.push('ANALYTICS_BATCH_SIZE must be between 1 and 1000');
  }

  if (config.ANALYTICS_RETENTION_DAYS < 1) {
    errors.push('ANALYTICS_RETENTION_DAYS must be >= 1');
  }

  // Validate performance monitoring
  if (config.PERFORMANCE_SAMPLE_RATE < 0 || config.PERFORMANCE_SAMPLE_RATE > 1) {
    errors.push('PERFORMANCE_SAMPLE_RATE must be between 0 and 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
};

/**
 * Get configuration for specific environment
 */
export const getEnvironmentConfig = (env: string) => {
  const envConfigs = {
    development: {
      LOG_LEVEL: 'debug',
      PERFORMANCE_MONITORING: true,
      HELMET_ENABLED: false
    },
    test: {
      LOG_LEVEL: 'error',
      PERFORMANCE_MONITORING: false,
      DB_NAME: 'encore_analytics_test',
      REDIS_DB: 15
    },
    production: {
      LOG_LEVEL: 'info',
      PERFORMANCE_MONITORING: true,
      HELMET_ENABLED: true,
      TRUST_PROXY: true,
      DB_SSL: true
    }
  };

  return envConfigs[env as keyof typeof envConfigs] || {};
};

/**
 * Create and validate configuration
 */
let config: Config;

try {
  config = buildConfig();

  // Apply environment-specific overrides
  const envConfig = getEnvironmentConfig(config.NODE_ENV);
  Object.assign(config, envConfig);

  // Validate configuration
  validateConfig(config);

  // Log configuration (excluding sensitive data)
  if (config.NODE_ENV !== 'test') {
    const safeConfig = { ...config };
    delete (safeConfig as any).JWT_SECRET;
    delete (safeConfig as any).JWT_REFRESH_SECRET;
    delete (safeConfig as any).SERVICE_SECRET;
    delete (safeConfig as any).DB_PASSWORD;
    delete (safeConfig as any).REDIS_PASSWORD;

    logger.info('Configuration loaded successfully', {
      environment: config.NODE_ENV,
      service: config.SERVICE_NAME,
      port: config.PORT,
      websocketPort: config.WEBSOCKET_PORT
    });
  }
} catch (error) {
  console.error('Failed to load configuration:', error);
  process.exit(1);
}

export { config };
export default config;

/**
 * Configuration utilities
 */
export const configUtils = {
  /**
   * Check if running in development mode
   */
  isDevelopment: () => config.NODE_ENV === 'development',

  /**
   * Check if running in production mode
   */
  isProduction: () => config.NODE_ENV === 'production',

  /**
   * Check if running in test mode
   */
  isTest: () => config.NODE_ENV === 'test',

  /**
   * Get database connection string
   */
  getDatabaseUrl: () => {
    if (config.DATABASE_URL) {
      return config.DATABASE_URL;
    }

    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = config;
    return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  },

  /**
   * Get Redis connection string
   */
  getRedisUrl: () => {
    if (config.REDIS_URL) {
      return config.REDIS_URL;
    }

    const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } = config;
    const auth = REDIS_PASSWORD ? `:${REDIS_PASSWORD}@` : '';
    return `redis://${auth}${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`;
  },

  /**
   * Get service URL
   */
  getServiceUrl: (service: string) => {
    const serviceUrls: Record<string, string> = {
      user: config.USER_SERVICE_URL,
      music: config.MUSIC_SERVICE_URL,
      menu: config.MENU_SERVICE_URL,
      queue: config.QUEUE_SERVICE_URL,
      notification: config.NOTIFICATION_SERVICE_URL
    };

    return serviceUrls[service] || '';
  },

  /**
   * Get full API URL
   */
  getApiUrl: () => {
    const protocol = configUtils.isProduction() ? 'https' : 'http';
    const host = configUtils.isProduction() ? process.env.HOST || 'localhost' : 'localhost';
    return `${protocol}://${host}:${config.PORT}/api/${config.API_VERSION}`;
  },

  /**
   * Get WebSocket URL
   */
  getWebSocketUrl: () => {
    const protocol = configUtils.isProduction() ? 'wss' : 'ws';
    const host = configUtils.isProduction() ? process.env.HOST || 'localhost' : 'localhost';
    return `${protocol}://${host}:${config.WEBSOCKET_PORT}`;
  }
};

// Add utility methods to config
Object.assign(config, configUtils);