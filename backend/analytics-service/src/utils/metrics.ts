/**
 * =============================================================================
 * MusicBar Analytics Service - Metrics Collector
 * =============================================================================
 * Description: Metrics collection and monitoring utilities
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import logger from './logger';

// =============================================================================
// Metrics Interfaces
// =============================================================================
export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  timestamp?: Date;
}

export interface EventMetric {
  eventType: string;
  barId?: string;
  userId?: string;
  duration?: number;
  success: boolean;
  timestamp?: Date;
}

export interface SystemMetric {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  activeConnections?: number;
  queueSize?: number;
  timestamp?: Date;
}

export interface DatabaseMetric {
  queryType: string;
  duration: number;
  rowCount?: number;
  success: boolean;
  timestamp?: Date;
}

export interface CacheMetric {
  operation: string;
  key: string;
  hit: boolean;
  duration: number;
  timestamp?: Date;
}

// =============================================================================
// Metrics Collector Class
// =============================================================================
export class MetricsCollector {
  private requestMetrics: RequestMetric[] = [];
  private eventMetrics: EventMetric[] = [];
  private systemMetrics: SystemMetric[] = [];
  private databaseMetrics: DatabaseMetric[] = [];
  private cacheMetrics: CacheMetric[] = [];
  
  private readonly maxMetricsPerType = 1000;
  private readonly metricsRetentionMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  // ===========================================================================
  // Request Metrics
  // ===========================================================================
  recordRequest(metric: RequestMetric): void {
    try {
      const requestMetric: RequestMetric = {
        ...metric,
        timestamp: new Date()
      };
      
      this.requestMetrics.push(requestMetric);
      this.trimMetrics(this.requestMetrics);
      
      // Log slow requests
      if (metric.duration > 1000) {
        logger.warn('Slow request detected', {
          method: metric.method,
          path: metric.path,
          duration: metric.duration,
          statusCode: metric.statusCode
        });
      }
    } catch (error) {
      logger.error('Failed to record request metric', { error: error.message });
    }
  }

  getRequestMetrics(limit?: number): RequestMetric[] {
    return limit ? this.requestMetrics.slice(-limit) : [...this.requestMetrics];
  }

  getAverageRequestTime(timeWindowMs: number = 60000): number {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const recentMetrics = this.requestMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    if (recentMetrics.length === 0) return 0;
    
    const totalTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / recentMetrics.length;
  }

  getRequestsPerSecond(timeWindowMs: number = 60000): number {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const recentMetrics = this.requestMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    return recentMetrics.length / (timeWindowMs / 1000);
  }

  // ===========================================================================
  // Event Metrics
  // ===========================================================================
  recordEvent(metric: EventMetric): void {
    try {
      const eventMetric: EventMetric = {
        ...metric,
        timestamp: new Date()
      };
      
      this.eventMetrics.push(eventMetric);
      this.trimMetrics(this.eventMetrics);
    } catch (error) {
      logger.error('Failed to record event metric', { error: error.message });
    }
  }

  getEventMetrics(limit?: number): EventMetric[] {
    return limit ? this.eventMetrics.slice(-limit) : [...this.eventMetrics];
  }

  getEventsByType(eventType: string, timeWindowMs: number = 60000): EventMetric[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.eventMetrics.filter(
      m => m.eventType === eventType && m.timestamp && m.timestamp > cutoff
    );
  }

  // ===========================================================================
  // System Metrics
  // ===========================================================================
  recordSystem(metric: SystemMetric): void {
    try {
      const systemMetric: SystemMetric = {
        ...metric,
        timestamp: new Date()
      };
      
      this.systemMetrics.push(systemMetric);
      this.trimMetrics(this.systemMetrics);
    } catch (error) {
      logger.error('Failed to record system metric', { error: error.message });
    }
  }

  getSystemMetrics(limit?: number): SystemMetric[] {
    return limit ? this.systemMetrics.slice(-limit) : [...this.systemMetrics];
  }

  getCurrentSystemMetrics(): SystemMetric {
    const latest = this.systemMetrics[this.systemMetrics.length - 1];
    return latest || {};
  }

  // ===========================================================================
  // Database Metrics
  // ===========================================================================
  recordDatabase(metric: DatabaseMetric): void {
    try {
      const dbMetric: DatabaseMetric = {
        ...metric,
        timestamp: new Date()
      };
      
      this.databaseMetrics.push(dbMetric);
      this.trimMetrics(this.databaseMetrics);
      
      // Log slow queries
      if (metric.duration > 1000) {
        logger.warn('Slow database query detected', {
          queryType: metric.queryType,
          duration: metric.duration,
          rowCount: metric.rowCount
        });
      }
    } catch (error) {
      logger.error('Failed to record database metric', { error: error.message });
    }
  }

  getDatabaseMetrics(limit?: number): DatabaseMetric[] {
    return limit ? this.databaseMetrics.slice(-limit) : [...this.databaseMetrics];
  }

  getAverageDatabaseTime(timeWindowMs: number = 60000): number {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const recentMetrics = this.databaseMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    if (recentMetrics.length === 0) return 0;
    
    const totalTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / recentMetrics.length;
  }

  // ===========================================================================
  // Cache Metrics
  // ===========================================================================
  recordCache(metric: CacheMetric): void {
    try {
      const cacheMetric: CacheMetric = {
        ...metric,
        timestamp: new Date()
      };
      
      this.cacheMetrics.push(cacheMetric);
      this.trimMetrics(this.cacheMetrics);
    } catch (error) {
      logger.error('Failed to record cache metric', { error: error.message });
    }
  }

  getCacheMetrics(limit?: number): CacheMetric[] {
    return limit ? this.cacheMetrics.slice(-limit) : [...this.cacheMetrics];
  }

  getCacheHitRate(timeWindowMs: number = 60000): number {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const recentMetrics = this.cacheMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    if (recentMetrics.length === 0) return 0;
    
    const hits = recentMetrics.filter(m => m.hit).length;
    return hits / recentMetrics.length;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================
  private trimMetrics<T>(metrics: T[]): void {
    if (metrics.length > this.maxMetricsPerType) {
      metrics.splice(0, metrics.length - this.maxMetricsPerType);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.metricsRetentionMs);
    
    this.requestMetrics = this.requestMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    this.eventMetrics = this.eventMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    this.systemMetrics = this.systemMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    this.databaseMetrics = this.databaseMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    this.cacheMetrics = this.cacheMetrics.filter(
      m => m.timestamp && m.timestamp > cutoff
    );
    
    logger.debug('Cleaned up old metrics', {
      requestMetrics: this.requestMetrics.length,
      eventMetrics: this.eventMetrics.length,
      systemMetrics: this.systemMetrics.length,
      databaseMetrics: this.databaseMetrics.length,
      cacheMetrics: this.cacheMetrics.length
    });
  }

  // ===========================================================================
  // Summary Methods
  // ===========================================================================
  getSummary(): {
    requests: { total: number; avgTime: number; rps: number };
    events: { total: number };
    database: { total: number; avgTime: number };
    cache: { total: number; hitRate: number };
    system: SystemMetric;
  } {
    return {
      requests: {
        total: this.requestMetrics.length,
        avgTime: this.getAverageRequestTime(),
        rps: this.getRequestsPerSecond()
      },
      events: {
        total: this.eventMetrics.length
      },
      database: {
        total: this.databaseMetrics.length,
        avgTime: this.getAverageDatabaseTime()
      },
      cache: {
        total: this.cacheMetrics.length,
        hitRate: this.getCacheHitRate()
      },
      system: this.getCurrentSystemMetrics()
    };
  }

  reset(): void {
    this.requestMetrics = [];
    this.eventMetrics = [];
    this.systemMetrics = [];
    this.databaseMetrics = [];
    this.cacheMetrics = [];
    
    logger.info('Metrics collector reset');
  }
}

// =============================================================================
// Export
// =============================================================================
export default MetricsCollector;