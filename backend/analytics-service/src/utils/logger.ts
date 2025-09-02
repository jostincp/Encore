import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

/**
 * Log categories
 */
export enum LogCategory {
  SYSTEM = 'system',
  DATABASE = 'database',
  CACHE = 'cache',
  WEBSOCKET = 'websocket',
  AUTH = 'auth',
  API = 'api',
  ANALYTICS = 'analytics',
  EVENTS = 'events',
  REPORTS = 'reports',
  PERFORMANCE = 'performance',
  SECURITY = 'security'
}

/**
 * Log metadata interface
 */
interface LogMetadata {
  category?: LogCategory;
  userId?: string;
  barId?: string;
  requestId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  error?: Error;
  stack?: string;
  [key: string]: any;
}

/**
 * Custom log format
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category: category || LogCategory.SYSTEM,
      message,
      service: 'analytics-service',
      environment: process.env.NODE_ENV || 'development',
      ...meta
    };

    return JSON.stringify(logEntry);
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
    const categoryStr = category ? `[${String(category).toUpperCase()}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level} ${categoryStr} ${message}${metaStr}`;
  })
);

/**
 * Ensure log directory exists
 */
const ensureLogDirectory = () => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
};

/**
 * Create daily rotate file transport
 */
const createRotateFileTransport = (filename: string, level: string) => {
  const logDir = ensureLogDirectory();
  
  return new DailyRotateFile({
    filename: path.join(logDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level,
    format: customFormat
  });
};

/**
 * Create Winston logger instance
 */
const createLogger = () => {
  const transports: winston.transport[] = [];

  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Console transport for development
  if (nodeEnv === 'development') {
    transports.push(
      new winston.transports.Console({
        level: 'debug',
        format: consoleFormat
      })
    );
  }

  // File transports for production
  if (nodeEnv === 'production') {
    // Error logs
    transports.push(createRotateFileTransport('error', 'error'));
    
    // Combined logs
    transports.push(createRotateFileTransport('combined', 'info'));
    
    // Access logs
    transports.push(createRotateFileTransport('access', 'http'));
  }

  // Always add file transports in non-test environments
  if (nodeEnv !== 'test') {
    transports.push(createRotateFileTransport('analytics', 'info'));
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: {
      service: 'analytics-service',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    },
    transports,
    exitOnError: false
  });
};

/**
 * Logger instance
 */
export const logger = createLogger();

/**
 * Enhanced logger with category support
 */
export class Logger {
  private winston: winston.Logger;

  constructor() {
    this.winston = logger;
  }

  /**
   * Log error message
   */
  error(message: string, meta: LogMetadata = {}) {
    this.winston.error(message, { category: LogCategory.SYSTEM, ...meta });
  }

  /**
   * Log warning message
   */
  warn(message: string, meta: LogMetadata = {}) {
    this.winston.warn(message, { category: LogCategory.SYSTEM, ...meta });
  }

  /**
   * Log info message
   */
  info(message: string, meta: LogMetadata = {}) {
    this.winston.info(message, { category: LogCategory.SYSTEM, ...meta });
  }

  /**
   * Log HTTP request
   */
  http(message: string, meta: LogMetadata = {}) {
    this.winston.http(message, { category: LogCategory.API, ...meta });
  }

  /**
   * Log debug message
   */
  debug(message: string, meta: LogMetadata = {}) {
    this.winston.debug(message, { category: LogCategory.SYSTEM, ...meta });
  }

  /**
   * Log database operations
   */
  database(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.DATABASE, ...meta });
  }

  /**
   * Log cache operations
   */
  cache(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.CACHE, ...meta });
  }

  /**
   * Log WebSocket events
   */
  websocket(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.WEBSOCKET, ...meta });
  }

  /**
   * Log authentication events
   */
  auth(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.AUTH, ...meta });
  }

  /**
   * Log API requests
   */
  api(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.API, ...meta });
  }

  /**
   * Log analytics operations
   */
  analytics(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.ANALYTICS, ...meta });
  }

  /**
   * Log event processing
   */
  events(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.EVENTS, ...meta });
  }

  /**
   * Log report operations
   */
  reports(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.REPORTS, ...meta });
  }

  /**
   * Log performance metrics
   */
  performance(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.PERFORMANCE, ...meta });
  }

  /**
   * Log security events
   */
  security(level: LogLevel, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category: LogCategory.SECURITY, ...meta });
  }

  /**
   * Log with custom category
   */
  log(level: LogLevel, category: LogCategory, message: string, meta: LogMetadata = {}) {
    this.winston.log(level, message, { category, ...meta });
  }
}

/**
 * Request logging middleware
 */
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Log request start
  logger.http('Request started', {
    category: LogCategory.API,
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    barId: req.user?.barId
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - start;
    
    logger.http('Request completed', {
      category: LogCategory.API,
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      barId: req.user?.barId
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Error logging helper
 */
export const logError = (error: Error, context: LogMetadata = {}) => {
  logger.error('Error occurred', {
    category: LogCategory.SYSTEM,
    error: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  });
};

/**
 * Performance logging helper
 */
export const logPerformance = (operation: string, duration: number, meta: LogMetadata = {}) => {
  const level = duration > 1000 ? LogLevel.WARN : LogLevel.INFO;
  
  logger.log(level, `Performance: ${operation}`, {
    category: LogCategory.PERFORMANCE,
    operation,
    duration,
    ...meta
  });
};

/**
 * Security logging helper
 */
export const logSecurity = (event: string, meta: LogMetadata = {}) => {
  logger.warn(`Security event: ${event}`, {
    category: LogCategory.SECURITY,
    event,
    timestamp: new Date().toISOString(),
    ...meta
  });
};

/**
 * Database query logging helper
 */
export const logQuery = (query: string, duration: number, meta: LogMetadata = {}) => {
  const level = duration > 500 ? LogLevel.WARN : LogLevel.DEBUG;
  
  logger.log(level, 'Database query executed', {
    category: LogCategory.DATABASE,
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    duration,
    ...meta
  });
};

/**
 * Cache operation logging helper
 */
export const logCache = (operation: string, key: string, hit: boolean, meta: LogMetadata = {}) => {
  logger.debug(`Cache ${operation}`, {
    category: LogCategory.CACHE,
    operation,
    key,
    hit,
    ...meta
  });
};

/**
 * WebSocket event logging helper
 */
export const logWebSocket = (event: string, socketId: string, meta: LogMetadata = {}) => {
  logger.debug(`WebSocket event: ${event}`, {
    category: LogCategory.WEBSOCKET,
    event,
    socketId,
    ...meta
  });
};

/**
 * Analytics operation logging helper
 */
export const logAnalytics = (operation: string, meta: LogMetadata = {}) => {
  logger.info(`Analytics: ${operation}`, {
    category: LogCategory.ANALYTICS,
    operation,
    ...meta
  });
};

/**
 * Event processing logging helper
 */
export const logEvent = (eventType: string, eventId: string, meta: LogMetadata = {}) => {
  logger.info(`Event processed: ${eventType}`, {
    category: LogCategory.EVENTS,
    eventType,
    eventId,
    ...meta
  });
};

/**
 * Report operation logging helper
 */
export const logReport = (operation: string, reportId: string, meta: LogMetadata = {}) => {
  logger.info(`Report ${operation}`, {
    category: LogCategory.REPORTS,
    operation,
    reportId,
    ...meta
  });
};

/**
 * Create child logger with default metadata
 */
export const createChildLogger = (defaultMeta: LogMetadata) => {
  return {
    error: (message: string, meta: LogMetadata = {}) => 
      logger.error(message, { ...defaultMeta, ...meta }),
    warn: (message: string, meta: LogMetadata = {}) => 
      logger.warn(message, { ...defaultMeta, ...meta }),
    info: (message: string, meta: LogMetadata = {}) => 
      logger.info(message, { ...defaultMeta, ...meta }),
    http: (message: string, meta: LogMetadata = {}) => 
      logger.http(message, { ...defaultMeta, ...meta }),
    debug: (message: string, meta: LogMetadata = {}) => 
      logger.debug(message, { ...defaultMeta, ...meta })
  };
};

/**
 * Log stream for Morgan HTTP logger
 */
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim(), { category: LogCategory.API });
  }
};

/**
 * Graceful shutdown logging
 */
export const gracefulShutdown = () => {
  logger.info('Shutting down gracefully', {
    category: LogCategory.SYSTEM,
    timestamp: new Date().toISOString()
  });
  
  // Wait for logs to be written
  return new Promise<void>((resolve) => {
    logger.end(() => {
      resolve();
    });
  });
};

// Export enhanced logger instance
export const enhancedLogger = new Logger();

// Export default logger
export default logger;

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      category: LogCategory.SYSTEM,
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
      category: LogCategory.SYSTEM,
      reason: reason?.message || reason,
      stack: reason?.stack
    });
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received', { category: LogCategory.SYSTEM });
    gracefulShutdown().then(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received', { category: LogCategory.SYSTEM });
    gracefulShutdown().then(() => process.exit(0));
  });
}