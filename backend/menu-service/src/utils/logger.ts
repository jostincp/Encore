import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config';

// Ensure logs directory exists
const logsDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service = 'menu-service', ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      service,
      message,
      ...meta
    };
    
    // Clean up undefined values
    Object.keys(logEntry).forEach(key => {
      if (logEntry[key as keyof typeof logEntry] === undefined) {
        delete logEntry[key as keyof typeof logEntry];
      }
    });
    
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, service = 'menu-service', ...meta }) => {
    let logMessage = `${timestamp} [${service}] ${level}: ${message}`;
    
    // Add metadata if present
    const metaKeys = Object.keys(meta).filter(key => key !== 'timestamp' && key !== 'level' && key !== 'message' && key !== 'service');
    if (metaKeys.length > 0) {
      const metaString = metaKeys.map(key => `${key}=${JSON.stringify(meta[key])}`).join(' ');
      logMessage += ` | ${metaString}`;
    }
    
    return logMessage;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    format: config.NODE_ENV === 'production' ? logFormat : consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
);

// File transports (if enabled)
if (config.LOG_FILE_ENABLED) {
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'info',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );
  
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );
  
  // Debug log file (development only)
  if (config.NODE_ENV === 'development') {
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'debug.log'),
        level: 'debug',
        format: logFormat,
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
        tailable: true
      })
    );
  }
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'menu-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    pid: process.pid
  },
  transports,
  exitOnError: false
});

// Add request logging helper
export const logRequest = (req: any, res: any, responseTime?: number) => {
  const logData = {
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    requestId: req.requestId,
    userId: req.user?.id,
    barId: req.params?.barId,
    responseTime: responseTime ? `${responseTime}ms` : undefined
  };
  
  const level = res.statusCode >= 400 ? 'error' : 'info';
  logger[level]('HTTP Request', logData);
};

// Add database logging helper
export const logDatabase = (operation: string, table: string, duration?: number, error?: any) => {
  const logData = {
    operation,
    table,
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      message: error.message,
      code: error.code,
      stack: error.stack
    } : undefined
  };
  
  if (error) {
    logger.error('Database Error', logData);
  } else {
    logger.debug('Database Operation', logData);
  }
};

// Add cache logging helper
export const logCache = (operation: 'hit' | 'miss' | 'set' | 'del', key: string, ttl?: number) => {
  logger.debug('Cache Operation', {
    operation,
    key,
    ttl: ttl ? `${ttl}s` : undefined
  });
};

// Add authentication logging helper
export const logAuth = (event: string, userId?: string, details?: any) => {
  logger.info('Authentication Event', {
    event,
    userId,
    ...details
  });
};

// Add business logic logging helper
export const logBusiness = (event: string, details: any) => {
  logger.info('Business Event', {
    event,
    ...details
  });
};

// Add performance logging helper
export const logPerformance = (operation: string, duration: number, details?: any) => {
  const level = duration > 1000 ? 'warn' : 'debug'; // Warn if operation takes more than 1 second
  
  logger[level]('Performance', {
    operation,
    duration: `${duration}ms`,
    ...details
  });
};

// Add security logging helper
export const logSecurity = (event: string, severity: 'low' | 'medium' | 'high', details: any) => {
  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  
  logger[level]('Security Event', {
    event,
    severity,
    ...details
  });
};

// Add external API logging helper
export const logExternalAPI = (service: string, endpoint: string, method: string, statusCode?: number, duration?: number, error?: any) => {
  const logData = {
    service,
    endpoint,
    method,
    statusCode,
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      message: error.message,
      code: error.code
    } : undefined
  };
  
  if (error || (statusCode && statusCode >= 400)) {
    logger.error('External API Error', logData);
  } else {
    logger.debug('External API Call', logData);
  }
};

// Create child logger for specific modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Handle uncaught exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: logFormat
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    format: logFormat
  })
);

// Log startup information
logger.info('Logger initialized', {
  logLevel: config.LOG_LEVEL,
  fileLoggingEnabled: config.LOG_FILE_ENABLED,
  environment: config.NODE_ENV,
  logsDirectory: logsDir
});

export default logger;