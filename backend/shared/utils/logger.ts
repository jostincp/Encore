/**
 * Encore Platform - Advanced Logging System
 * Sistema de logging avanzado con Winston y soporte para ELK Stack
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { format } from 'logform';
import path from 'path';
import os from 'os';

// Configuración de niveles de log personalizados
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    critical: 5,
    security: 6,
    audit: 7
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    critical: 'redBG',
    security: 'red',
    audit: 'yellow'
  }
};

// Añadir colores personalizados
winston.addColors(customLevels.colors);

// Formato personalizado para logs
const customFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, service, userId, sessionId, requestId, ip, userAgent, method, url, statusCode, responseTime, error, stack, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: service || 'encore-platform',
      message,
      hostname: os.hostname(),
      pid: process.pid,

      // Contexto de usuario
      userId,
      sessionId,

      // Contexto HTTP
      requestId,
      ip,
      userAgent,
      method,
      url,
      statusCode,
      responseTime,

      // Error details
      error: error ? {
        name: (error as any)?.name || 'UnknownError',
        message: (error as any)?.message || 'No message',
        stack: (error as any)?.stack || 'No stack',
        code: (error as any)?.code || 'NO_CODE'
      } : undefined,

      // Metadata adicional
      ...meta
    };

    return JSON.stringify(logEntry);
  })
);

// Transportes de archivo con rotación diaria
const fileTransports = [
  // Logs generales
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'encore-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info',
    format: customFormat
  }),

  // Logs de error
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: customFormat
  }),

  // Logs de seguridad
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '90d',
    level: 'security',
    format: customFormat
  }),

  // Logs de auditoría
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'audit-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '365d',
    level: 'audit',
    format: customFormat
  })
];

// Configuración del logger principal
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'encore-platform',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Consola para desarrollo
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: format.combine(
          format.colorize({ colors: customLevels.colors }),
          format.simple(),
          format.printf(({ timestamp, level, message, service }) => {
            return `${timestamp} [${service}] ${level}: ${message}`;
          })
        )
      })
    ] : []),

    // Archivos con rotación
    ...fileTransports
  ],

  // Manejo de excepciones no capturadas
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d'
    })
  ],

  // Manejo de rechazos de promesas no manejadas
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d'
    })
  ]
});

// Logger específico para HTTP requests
export const httpLogger = winston.createLogger({
  levels: customLevels.levels,
  level: 'http',
  format: customFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'encore-platform',
    type: 'http'
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD-HH',
      maxSize: '50m',
      maxFiles: '7d',
      format: customFormat
    })
  ]
});

// Logger específico para métricas de performance
export const performanceLogger = winston.createLogger({
  levels: customLevels.levels,
  level: 'info',
  format: customFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'encore-platform',
    type: 'performance'
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: customFormat
    })
  ]
});

// Logger específico para auditoría
export const auditLogger = winston.createLogger({
  levels: customLevels.levels,
  level: 'audit',
  format: customFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'encore-platform',
    type: 'audit'
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '365d',
      format: customFormat
    })
  ]
});

// Funciones de utilidad para logging
export const logError = (message: string, error?: any, meta?: any) => {
  logger.error(message, {
    error,
    stack: error?.stack,
    ...meta
  });
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

// Logging de seguridad
export const logSecurity = (message: string, meta?: any) => {
  logger.log('security', message, meta);
};

// Logging de auditoría
export const logAudit = (message: string, meta?: any) => {
  auditLogger.log('audit', message, meta);
};

// Logging de performance
export const logPerformance = (message: string, meta?: any) => {
  performanceLogger.info(message, meta);
};

// Función para crear child loggers con contexto adicional
export const createChildLogger = (context: any) => {
  return logger.child(context);
};

// Función para crear logger específico de servicio
export const createServiceLogger = (serviceName: string) => {
  return winston.createLogger({
    levels: customLevels.levels,
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development'
    },
    transports: [
      new DailyRotateFile({
        filename: path.join(process.cwd(), 'logs', `${serviceName}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: customFormat
      })
    ]
  });
};

// Middleware para logging HTTP
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Añadir request ID a la request
  req.requestId = requestId;

  // Log de request entrante
  httpLogger.http('Request received', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    sessionId: req.session?.id
  });

  // Log de response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    httpLogger.log(level, 'Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: duration,
      ip: req.ip,
      userId: req.user?.id,
      sessionId: req.session?.id
    });
  });

  next();
};

// Función para logging de errores con contexto
export const logErrorWithContext = (error: any, context: any = {}) => {
  const errorContext = {
    error: {
      name: error?.name || 'UnknownError',
      message: error?.message || 'No message',
      stack: error?.stack || 'No stack',
      code: error?.code || 'NO_CODE'
    },
    ...context
  };

  // Determinar nivel basado en el tipo de error
  let level: keyof typeof customLevels.levels = 'error';

  if (error?.message?.includes('authentication') || error?.message?.includes('authorization')) {
    level = 'security';
  } else if (error?.message?.includes('database') || error?.message?.includes('connection')) {
    level = 'critical';
  }

  logger.log(level, `Error: ${error?.message || 'Unknown error'}`, errorContext);
};

// Función para logging de métricas
export const logMetrics = (metrics: any) => {
  logger.info('Metrics collected', {
    type: 'metrics',
    ...metrics
  });
};

// Función para logging de eventos de negocio
export const logBusinessEvent = (event: string, data: any) => {
  logger.info(`Business event: ${event}`, {
    type: 'business_event',
    event,
    ...data
  });
};

// Función para inicializar logging
export const initializeLogging = () => {
  // Crear directorio de logs si no existe
  const fs = require('fs');
  const logsDir = path.join(process.cwd(), 'logs');

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  logger.info('Logging system initialized', {
    logLevel: process.env.LOG_LEVEL || 'info',
    environment: process.env.NODE_ENV || 'development',
    logDirectory: logsDir
  });
};

// Función para cerrar loggers (para graceful shutdown)
export const closeLoggers = async () => {
  logger.info('Closing loggers...');

  logger.end();
  httpLogger.end();
  performanceLogger.end();
  auditLogger.end();
};

// Exportar logger por defecto
export default logger;