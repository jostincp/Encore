import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Database Configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
  connectionTimeout: number;
  queryTimeout: number;
  runMigrations: boolean;
  logging: boolean;
}

/**
 * Redis Configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database: number;
  keyPrefix: string;
  connectionTimeout: number;
  commandTimeout: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}

/**
 * Queue Configuration
 */
export interface QueueConfig {
  redis: RedisConfig;
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: string;
      delay: number;
    };
  };
  concurrency: {
    events: number;
    reports: number;
    analytics: number;
  };
}

/**
 * WebSocket Configuration
 */
export interface WebSocketConfig {
  enabled: boolean;
  port?: number;
  path: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  pingTimeout: number;
  pingInterval: number;
  maxConnections: number;
}

/**
 * Server Configuration
 */
export interface ServerConfig {
  host: string;
  port: number;
  environment: string;
  version: string;
  maxRequestSize: string;
  enableRequestLogging: boolean;
  enableMetrics: boolean;
  trustProxy: boolean;
}

/**
 * CORS Configuration
 */
export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Cache Configuration
 */
export interface CacheConfig {
  defaultTTL: number;
  maxKeys: number;
  checkPeriod: number;
  useClones: boolean;
  deleteOnExpire: boolean;
}

/**
 * Rate Limiting Configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: string;
}

/**
 * Authentication Configuration
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  sessionSecret: string;
  sessionMaxAge: number;
}

/**
 * Logging Configuration
 */
export interface LoggingConfig {
  level: string;
  format: string;
  colorize: boolean;
  timestamp: boolean;
  filename?: string;
  maxSize: string;
  maxFiles: number;
  datePattern: string;
}

/**
 * Metrics Configuration
 */
export interface MetricsConfig {
  enabled: boolean;
  collectDefaultMetrics: boolean;
  prefix: string;
  buckets: number[];
  percentiles: number[];
}

/**
 * File Storage Configuration
 */
export interface StorageConfig {
  reportsPath: string;
  tempPath: string;
  maxFileSize: number;
  allowedFormats: string[];
  cleanupInterval: number;
  retentionDays: number;
}

/**
 * External Services Configuration
 */
export interface ExternalServicesConfig {
  userService: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  musicService: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  menuService: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  notificationService: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
}

/**
 * Main Configuration Interface
 */
export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  queue: QueueConfig;
  websocket: WebSocketConfig;
  cors: CorsConfig;
  cache: CacheConfig;
  rateLimit: RateLimitConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
  metrics: MetricsConfig;
  storage: StorageConfig;
  externalServices: ExternalServicesConfig;
}

/**
 * Environment variable helpers
 */
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value || defaultValue!;
};

const getEnvNumber = (key: string, defaultValue?: number): number => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
};

const getEnvBoolean = (key: string, defaultValue?: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
};

const getEnvArray = (key: string, defaultValue?: string[]): string[] => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return defaultValue;
  }
  return value.split(',').map(item => item.trim());
};

/**
 * Create configuration from environment variables
 */
export const createConfig = (): Config => {
  const environment = getEnvVar('NODE_ENV', 'development');
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';

  return {
    server: {
      host: getEnvVar('SERVER_HOST', '0.0.0.0'),
      port: getEnvNumber('SERVER_PORT', 3003),
      environment,
      version: getEnvVar('SERVICE_VERSION', '1.0.0'),
      maxRequestSize: getEnvVar('MAX_REQUEST_SIZE', '10mb'),
      enableRequestLogging: getEnvBoolean('ENABLE_REQUEST_LOGGING', !isProduction),
      enableMetrics: getEnvBoolean('ENABLE_METRICS', true),
      trustProxy: getEnvBoolean('TRUST_PROXY', isProduction)
    },

    database: {
      host: getEnvVar('DB_HOST', 'localhost'),
      port: getEnvNumber('DB_PORT', 5432),
      database: getEnvVar('DB_NAME', 'encore_analytics'),
      username: getEnvVar('DB_USER', 'postgres'),
      password: getEnvVar('DB_PASSWORD'),
      ssl: getEnvBoolean('DB_SSL', isProduction),
      poolSize: getEnvNumber('DB_POOL_SIZE', 10),
      connectionTimeout: getEnvNumber('DB_CONNECTION_TIMEOUT', 30000),
      queryTimeout: getEnvNumber('DB_QUERY_TIMEOUT', 60000),
      runMigrations: getEnvBoolean('DB_RUN_MIGRATIONS', isDevelopment),
      logging: getEnvBoolean('DB_LOGGING', isDevelopment)
    },

    redis: {
      host: getEnvVar('REDIS_HOST', 'localhost'),
      port: getEnvNumber('REDIS_PORT', 6379),
      password: process.env.REDIS_PASSWORD,
      database: getEnvNumber('REDIS_DB', 0),
      keyPrefix: getEnvVar('REDIS_KEY_PREFIX', 'analytics:'),
      connectionTimeout: getEnvNumber('REDIS_CONNECTION_TIMEOUT', 10000),
      commandTimeout: getEnvNumber('REDIS_COMMAND_TIMEOUT', 5000),
      retryDelayOnFailover: getEnvNumber('REDIS_RETRY_DELAY', 100),
      maxRetriesPerRequest: getEnvNumber('REDIS_MAX_RETRIES', 3),
      lazyConnect: getEnvBoolean('REDIS_LAZY_CONNECT', true)
    },

    queue: {
      redis: {
        host: getEnvVar('QUEUE_REDIS_HOST', 'localhost'),
        port: getEnvNumber('QUEUE_REDIS_PORT', 6379),
        password: process.env.QUEUE_REDIS_PASSWORD,
        database: getEnvNumber('QUEUE_REDIS_DB', 1),
        keyPrefix: getEnvVar('QUEUE_REDIS_KEY_PREFIX', 'queue:'),
        connectionTimeout: getEnvNumber('QUEUE_REDIS_CONNECTION_TIMEOUT', 10000),
        commandTimeout: getEnvNumber('QUEUE_REDIS_COMMAND_TIMEOUT', 5000),
        retryDelayOnFailover: getEnvNumber('QUEUE_REDIS_RETRY_DELAY', 100),
        maxRetriesPerRequest: getEnvNumber('QUEUE_REDIS_MAX_RETRIES', 3),
        lazyConnect: getEnvBoolean('QUEUE_REDIS_LAZY_CONNECT', true)
      },
      defaultJobOptions: {
        removeOnComplete: getEnvNumber('QUEUE_REMOVE_ON_COMPLETE', 100),
        removeOnFail: getEnvNumber('QUEUE_REMOVE_ON_FAIL', 50),
        attempts: getEnvNumber('QUEUE_ATTEMPTS', 3),
        backoff: {
          type: getEnvVar('QUEUE_BACKOFF_TYPE', 'exponential'),
          delay: getEnvNumber('QUEUE_BACKOFF_DELAY', 2000)
        }
      },
      concurrency: {
        events: getEnvNumber('QUEUE_EVENTS_CONCURRENCY', 10),
        reports: getEnvNumber('QUEUE_REPORTS_CONCURRENCY', 5),
        analytics: getEnvNumber('QUEUE_ANALYTICS_CONCURRENCY', 3)
      }
    },

    websocket: {
      enabled: getEnvBoolean('WEBSOCKET_ENABLED', true),
      port: getEnvNumber('WEBSOCKET_PORT'),
      path: getEnvVar('WEBSOCKET_PATH', '/socket.io'),
      cors: {
        origin: getEnvArray('WEBSOCKET_CORS_ORIGINS', ['http://localhost:3000']),
        credentials: getEnvBoolean('WEBSOCKET_CORS_CREDENTIALS', true)
      },
      pingTimeout: getEnvNumber('WEBSOCKET_PING_TIMEOUT', 60000),
      pingInterval: getEnvNumber('WEBSOCKET_PING_INTERVAL', 25000),
      maxConnections: getEnvNumber('WEBSOCKET_MAX_CONNECTIONS', 1000)
    },

    cors: {
      allowedOrigins: getEnvArray('CORS_ALLOWED_ORIGINS', [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002'
      ]),
      allowedMethods: getEnvArray('CORS_ALLOWED_METHODS', [
        'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'
      ]),
      allowedHeaders: getEnvArray('CORS_ALLOWED_HEADERS', [
        'Content-Type', 'Authorization', 'X-Requested-With'
      ]),
      exposedHeaders: getEnvArray('CORS_EXPOSED_HEADERS', [
        'X-Total-Count', 'X-Page-Count'
      ]),
      credentials: getEnvBoolean('CORS_CREDENTIALS', true),
      maxAge: getEnvNumber('CORS_MAX_AGE', 86400)
    },

    cache: {
      defaultTTL: getEnvNumber('CACHE_DEFAULT_TTL', 300),
      maxKeys: getEnvNumber('CACHE_MAX_KEYS', 1000),
      checkPeriod: getEnvNumber('CACHE_CHECK_PERIOD', 600),
      useClones: getEnvBoolean('CACHE_USE_CLONES', false),
      deleteOnExpire: getEnvBoolean('CACHE_DELETE_ON_EXPIRE', true)
    },

    rateLimit: {
      windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
      maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
      skipSuccessfulRequests: getEnvBoolean('RATE_LIMIT_SKIP_SUCCESSFUL', false),
      skipFailedRequests: getEnvBoolean('RATE_LIMIT_SKIP_FAILED', false),
      keyGenerator: getEnvVar('RATE_LIMIT_KEY_GENERATOR', 'ip')
    },

    auth: {
      jwtSecret: getEnvVar('JWT_SECRET'),
      jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
      bcryptRounds: getEnvNumber('BCRYPT_ROUNDS', 12),
      sessionSecret: getEnvVar('SESSION_SECRET'),
      sessionMaxAge: getEnvNumber('SESSION_MAX_AGE', 86400000) // 24 hours
    },

    logging: {
      level: getEnvVar('LOG_LEVEL', isDevelopment ? 'debug' : 'info'),
      format: getEnvVar('LOG_FORMAT', isDevelopment ? 'dev' : 'combined'),
      colorize: getEnvBoolean('LOG_COLORIZE', isDevelopment),
      timestamp: getEnvBoolean('LOG_TIMESTAMP', true),
      filename: process.env.LOG_FILENAME,
      maxSize: getEnvVar('LOG_MAX_SIZE', '20m'),
      maxFiles: getEnvNumber('LOG_MAX_FILES', 5),
      datePattern: getEnvVar('LOG_DATE_PATTERN', 'YYYY-MM-DD')
    },

    metrics: {
      enabled: getEnvBoolean('METRICS_ENABLED', true),
      collectDefaultMetrics: getEnvBoolean('METRICS_COLLECT_DEFAULT', true),
      prefix: getEnvVar('METRICS_PREFIX', 'analytics_'),
      buckets: getEnvArray('METRICS_BUCKETS', ['0.1', '0.5', '1', '2', '5'])
        .map(b => parseFloat(b)),
      percentiles: getEnvArray('METRICS_PERCENTILES', ['0.5', '0.9', '0.95', '0.99'])
        .map(p => parseFloat(p))
    },

    storage: {
      reportsPath: getEnvVar('STORAGE_REPORTS_PATH', 
        path.join(process.cwd(), 'storage', 'reports')),
      tempPath: getEnvVar('STORAGE_TEMP_PATH', 
        path.join(process.cwd(), 'storage', 'temp')),
      maxFileSize: getEnvNumber('STORAGE_MAX_FILE_SIZE', 104857600), // 100MB
      allowedFormats: getEnvArray('STORAGE_ALLOWED_FORMATS', [
        'csv', 'json', 'pdf', 'xlsx'
      ]),
      cleanupInterval: getEnvNumber('STORAGE_CLEANUP_INTERVAL', 3600000), // 1 hour
      retentionDays: getEnvNumber('STORAGE_RETENTION_DAYS', 30)
    },

    externalServices: {
      userService: {
        baseUrl: getEnvVar('USER_SERVICE_URL', 'http://localhost:3001'),
        timeout: getEnvNumber('USER_SERVICE_TIMEOUT', 5000),
        retries: getEnvNumber('USER_SERVICE_RETRIES', 3)
      },
      musicService: {
        baseUrl: getEnvVar('MUSIC_SERVICE_URL', 'http://localhost:3002'),
        timeout: getEnvNumber('MUSIC_SERVICE_TIMEOUT', 5000),
        retries: getEnvNumber('MUSIC_SERVICE_RETRIES', 3)
      },
      menuService: {
        baseUrl: getEnvVar('MENU_SERVICE_URL', 'http://localhost:3004'),
        timeout: getEnvNumber('MENU_SERVICE_TIMEOUT', 5000),
        retries: getEnvNumber('MENU_SERVICE_RETRIES', 3)
      },
      notificationService: {
        baseUrl: getEnvVar('NOTIFICATION_SERVICE_URL', 'http://localhost:3005'),
        timeout: getEnvNumber('NOTIFICATION_SERVICE_TIMEOUT', 5000),
        retries: getEnvNumber('NOTIFICATION_SERVICE_RETRIES', 3)
      }
    }
  };
};

/**
 * Validate configuration
 */
export const validateConfig = (config: Config): void => {
  const errors: string[] = [];

  // Validate required fields
  if (!config.auth.jwtSecret) {
    errors.push('JWT_SECRET is required');
  }

  if (!config.auth.sessionSecret) {
    errors.push('SESSION_SECRET is required');
  }

  if (!config.database.password) {
    errors.push('DB_PASSWORD is required');
  }

  // Validate numeric ranges
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('SERVER_PORT must be between 1 and 65535');
  }

  if (config.database.poolSize < 1) {
    errors.push('DB_POOL_SIZE must be greater than 0');
  }

  if (config.auth.bcryptRounds < 4 || config.auth.bcryptRounds > 20) {
    errors.push('BCRYPT_ROUNDS must be between 4 and 20');
  }

  // Validate arrays
  if (!config.cors.allowedOrigins || config.cors.allowedOrigins.length === 0) {
    errors.push('CORS_ALLOWED_ORIGINS must contain at least one origin');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

/**
 * Default configuration instance
 */
export const config = createConfig();

// Validate configuration on load
validateConfig(config);

export default config;