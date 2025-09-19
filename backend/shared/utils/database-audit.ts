import logger from './logger';
import { Request } from 'express';

export interface AuditLogEntry {
  timestamp: Date;
  service: string;
  userId?: string;
  action: string;
  table: string;
  recordId?: string;
  query: string;
  parameters: any[];
  ip?: string;
  userAgent?: string;
  success: boolean;
  duration: number;
  error?: string;
}

export class DatabaseAuditor {
  private static instance: DatabaseAuditor;
  private auditLogs: AuditLogEntry[] = [];
  private readonly maxLogsInMemory = 1000;

  private constructor() {}

  static getInstance(): DatabaseAuditor {
    if (!DatabaseAuditor.instance) {
      DatabaseAuditor.instance = new DatabaseAuditor();
    }
    return DatabaseAuditor.instance;
  }

  /**
   * Registra una consulta de base de datos en el log de auditoría
   */
  logQuery(
    service: string,
    action: string,
    table: string,
    query: string,
    parameters: any[] = [],
    options: {
      userId?: string;
      recordId?: string;
      req?: Request;
      success?: boolean;
      duration?: number;
      error?: string;
      ip?: string;
      userAgent?: string;
    } = {}
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      service,
      userId: options.userId,
      action,
      table,
      recordId: options.recordId,
      query: this.sanitizeQuery(query),
      parameters: this.sanitizeParameters(parameters),
      ip: options.req?.ip,
      userAgent: options.req?.get('User-Agent'),
      success: options.success ?? true,
      duration: options.duration ?? 0,
      error: options.error
    };

    // Añadir a logs en memoria
    this.auditLogs.push(entry);

    // Mantener solo los logs más recientes
    if (this.auditLogs.length > this.maxLogsInMemory) {
      this.auditLogs = this.auditLogs.slice(-this.maxLogsInMemory);
    }

    // Log según el nivel de importancia
    const logLevel = this.getLogLevel(action, table);
    const logData = {
      service: entry.service,
      userId: entry.userId,
      action: entry.action,
      table: entry.table,
      recordId: entry.recordId,
      duration: entry.duration,
      success: entry.success,
      ip: entry.ip,
      error: entry.error
    };

    switch (logLevel) {
      case 'error':
        logger.error('Database audit - Error', logData);
        break;
      case 'warn':
        logger.warn('Database audit - Warning', logData);
        break;
      case 'info':
        logger.info('Database audit - Info', logData);
        break;
      default:
        logger.debug('Database audit - Debug', logData);
    }
  }

  /**
   * Determina el nivel de log basado en la acción y tabla
   */
  private getLogLevel(action: string, table: string): 'error' | 'warn' | 'info' | 'debug' {
    // Acciones críticas que siempre se loguean como error o warn
    if (action === 'DELETE' && ['users', 'user_sessions', 'admin_actions'].includes(table)) {
      return 'error';
    }

    if (action === 'UPDATE' && table === 'users' && ['password_hash', 'role', 'is_active'].some(col => true)) {
      return 'warn';
    }

    if (['INSERT', 'UPDATE'].includes(action) && ['user_sessions', 'audit_logs'].includes(table)) {
      return 'info';
    }

    // Consultas de lectura normales
    if (action === 'SELECT') {
      return 'debug';
    }

    return 'info';
  }

  /**
   * Sanitiza la consulta SQL para logging (remueve datos sensibles)
   */
  private sanitizeQuery(query: string): string {
    // Remover valores sensibles de la consulta para logging
    return query
      .replace(/password_hash\s*=\s*[^,\s)]+/gi, 'password_hash = [REDACTED]')
      .replace(/token\s*=\s*[^,\s)]+/gi, 'token = [REDACTED]')
      .replace(/secret\s*=\s*[^,\s)]+/gi, 'secret = [REDACTED]')
      .replace(/key\s*=\s*[^,\s)]+/gi, 'key = [REDACTED]');
  }

  /**
   * Sanitiza los parámetros para logging
   */
  private sanitizeParameters(parameters: any[]): any[] {
    return parameters.map(param => {
      if (typeof param === 'string') {
        // Si parece una contraseña o token, censurarlo
        if (param.length > 20 && /[$&+,:;=?@#|'<>.^*()%!-]/.test(param)) {
          return '[REDACTED]';
        }
        // Si es un email, mantenerlo pero censurar parcialmente
        if (param.includes('@')) {
          const [user, domain] = param.split('@');
          return `${user.substring(0, 2)}***@${domain}`;
        }
      }
      return param;
    });
  }

  /**
   * Obtiene logs de auditoría filtrados
   */
  getAuditLogs(options: {
    service?: string;
    userId?: string;
    action?: string;
    table?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  } = {}): AuditLogEntry[] {
    let filteredLogs = [...this.auditLogs];

    if (options.service) {
      filteredLogs = filteredLogs.filter(log => log.service === options.service);
    }

    if (options.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === options.userId);
    }

    if (options.action) {
      filteredLogs = filteredLogs.filter(log => log.action === options.action);
    }

    if (options.table) {
      filteredLogs = filteredLogs.filter(log => log.table === options.table);
    }

    if (options.success !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.success === options.success);
    }

    // Ordenar por timestamp descendente
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    return filteredLogs.slice(offset, offset + limit);
  }

  /**
   * Limpia logs antiguos
   */
  clearOldLogs(maxAgeHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoffTime);
  }

  /**
   * Obtiene estadísticas de auditoría
   */
  getAuditStats(): {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageDuration: number;
    queriesByAction: Record<string, number>;
    queriesByTable: Record<string, number>;
  } {
    const totalQueries = this.auditLogs.length;
    const successfulQueries = this.auditLogs.filter(log => log.success).length;
    const failedQueries = totalQueries - successfulQueries;
    const totalDuration = this.auditLogs.reduce((sum, log) => sum + log.duration, 0);
    const averageDuration = totalQueries > 0 ? totalDuration / totalQueries : 0;

    const queriesByAction: Record<string, number> = {};
    const queriesByTable: Record<string, number> = {};

    this.auditLogs.forEach(log => {
      queriesByAction[log.action] = (queriesByAction[log.action] || 0) + 1;
      queriesByTable[log.table] = (queriesByTable[log.table] || 0) + 1;
    });

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageDuration,
      queriesByAction,
      queriesByTable
    };
  }
}

// Instancia singleton
export const databaseAuditor = DatabaseAuditor.getInstance();

// Funciones de utilidad para logging de consultas
export const auditQuery = (
  service: string,
  action: string,
  table: string,
  query: string,
  parameters: any[] = [],
  options: {
    userId?: string;
    recordId?: string;
    req?: Request;
    success?: boolean;
    duration?: number;
    error?: string;
    ip?: string;
    userAgent?: string;
  } = {}
) => {
  databaseAuditor.logQuery(service, action, table, query, parameters, options);
};

// Funciones específicas para tipos comunes de consultas
export const auditUserAction = (
  action: string,
  userId: string,
  table: string,
  recordId?: string,
  req?: Request,
  success: boolean = true,
  error?: string
) => {
  auditQuery('auth-service', action, table, `${action} on ${table}`, [], {
    userId,
    recordId,
    req,
    success,
    error
  });
};

export const auditAuthAttempt = (
  email: string,
  success: boolean,
  ip?: string,
  userAgent?: string,
  error?: string
) => {
  auditQuery('auth-service', 'AUTH_ATTEMPT', 'users', 'Login attempt', [email], {
    success,
    ip,
    userAgent,
    error
  });
};

export const auditPasswordChange = (
  userId: string,
  success: boolean,
  req?: Request,
  error?: string
) => {
  auditQuery('auth-service', 'PASSWORD_CHANGE', 'users', 'Password update', [], {
    userId,
    recordId: userId,
    req,
    success,
    error
  });
};

export const auditAdminAction = (
  adminId: string,
  action: string,
  table: string,
  recordId: string,
  req?: Request,
  success: boolean = true,
  error?: string
) => {
  auditQuery('auth-service', `ADMIN_${action}`, table, `Admin action: ${action}`, [], {
    userId: adminId,
    recordId,
    req,
    success,
    error
  });
};

export default databaseAuditor;