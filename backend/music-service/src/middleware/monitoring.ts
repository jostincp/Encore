import { Request, Response, NextFunction } from 'express';
import logger from '@shared/utils/logger';
import { performance } from 'perf_hooks';
import { getRedisClient } from '@shared/utils/redis';

// Performance metrics interface
interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  userId?: string;
  barId?: string;
}

// Memory usage tracking
interface MemoryMetrics {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

// Request metrics storage
const requestMetrics: PerformanceMetrics[] = [];
const MAX_METRICS_STORAGE = 1000;

// Performance monitoring middleware
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  // Add request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage();
    
    // Calculate memory delta
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
      arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
    };
    
    // Create performance metric
    const metric: PerformanceMetrics = {
      endpoint: req.route?.path || req.path,
      method: req.method,
      duration,
      statusCode: res.statusCode,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
      barId: req.params?.barId || req.body?.bar_id
    };
    
    // Store metric (with rotation)
    requestMetrics.push(metric);
    if (requestMetrics.length > MAX_METRICS_STORAGE) {
      requestMetrics.shift();
    }
    
    // Log response with performance data
    const logLevel = res.statusCode >= 500 ? 'error' : 
                    res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      memoryDelta: {
        heapUsed: `${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(memoryDelta.rss / 1024 / 1024).toFixed(2)}MB`
      },
      userId: req.user?.id,
      barId: req.params?.barId || req.body?.bar_id,
      timestamp: new Date().toISOString()
    });
    
    // Store metrics in Redis for aggregation
    storeMetricsInRedis(metric).catch(error => {
      logger.warn('Failed to store metrics in Redis', { error: error.message });
    });
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Store metrics in Redis for aggregation and analysis
const storeMetricsInRedis = async (metric: PerformanceMetrics) => {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    
    const key = `metrics:${new Date().toISOString().split('T')[0]}`; // Daily metrics
    const metricData = {
      ...metric,
      timestamp: metric.timestamp.toISOString()
    };
    
    // Store individual metric
    await redis.lpush(key, JSON.stringify(metricData));
    await redis.expire(key, 7 * 24 * 60 * 60); // Keep for 7 days
    
    // Update aggregated counters
    const counterKey = `counters:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(counterKey, `${metric.method}:${metric.endpoint}`, 1);
    await redis.hincrby(counterKey, `status:${metric.statusCode}`, 1);
    await redis.expire(counterKey, 7 * 24 * 60 * 60);
    
    // Track slow requests (>1000ms)
    if (metric.duration > 1000) {
      const slowKey = `slow_requests:${new Date().toISOString().split('T')[0]}`;
      await redis.lpush(slowKey, JSON.stringify(metricData));
      await redis.expire(slowKey, 7 * 24 * 60 * 60);
    }
    
  } catch (error) {
    logger.error('Error storing metrics in Redis', { error: error.message });
  }
};

// Error tracking middleware
export const errorTracking = (error: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  
  // Log detailed error information
  logger.error('Request error', {
    requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    },
    user: {
      id: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    },
    timestamp: new Date().toISOString()
  });
  
  // Store error in Redis for alerting
  storeErrorInRedis(error, req).catch(err => {
    logger.warn('Failed to store error in Redis', { error: err.message });
  });
  
  next(error);
};

// Store errors in Redis for alerting
const storeErrorInRedis = async (error: Error, req: Request) => {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      endpoint: req.route?.path || req.path,
      method: req.method,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    };
    
    const key = `errors:${new Date().toISOString().split('T')[0]}`;
    await redis.lpush(key, JSON.stringify(errorData));
    await redis.expire(key, 7 * 24 * 60 * 60);
    
    // Increment error counter
    const counterKey = `error_counters:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(counterKey, error.name, 1);
    await redis.expire(counterKey, 7 * 24 * 60 * 60);
    
  } catch (err) {
    logger.error('Error storing error in Redis', { error: err.message });
  }
};

// Health check with detailed metrics
export const detailedHealthCheck = async (req: Request, res: Response) => {
  const startTime = performance.now();
  
  try {
    // System metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Redis health check
    let redisStatus = 'disconnected';
    let redisLatency = 0;
    try {
      const redis = getRedisClient();
      if (redis) {
        const redisStart = performance.now();
        await redis.ping();
        redisLatency = performance.now() - redisStart;
        redisStatus = 'connected';
      }
    } catch (error) {
      redisStatus = 'error';
    }
    
    // Recent performance metrics
    const recentMetrics = requestMetrics.slice(-100);
    const avgResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0;
    
    const errorRate = recentMetrics.length > 0
      ? (recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length) * 100
      : 0;
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: {
        memory: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      services: {
        redis: {
          status: redisStatus,
          latency: `${redisLatency.toFixed(2)}ms`
        }
      },
      metrics: {
        totalRequests: requestMetrics.length,
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        errorRate: `${errorRate.toFixed(2)}%`,
        recentRequests: recentMetrics.length
      },
      checkDuration: `${(performance.now() - startTime).toFixed(2)}ms`
    };
    
    res.status(200).json(healthData);
    
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      checkDuration: `${(performance.now() - startTime).toFixed(2)}ms`
    });
  }
};

// Get performance metrics endpoint
export const getMetrics = async (req: Request, res: Response) => {
  try {
    const { days = 1 } = req.query;
    const redis = getRedisClient();
    
    if (!redis) {
      return res.status(503).json({ error: 'Redis not available' });
    }
    
    const metrics = [];
    const now = new Date();
    
    // Get metrics for the specified number of days
    for (let i = 0; i < Number(days); i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = `metrics:${date.toISOString().split('T')[0]}`;
      
      const dayMetrics = await redis.lrange(key, 0, -1);
      const parsedMetrics = dayMetrics.map(m => JSON.parse(m));
      metrics.push(...parsedMetrics);
    }
    
    // Calculate aggregated statistics
    const stats = {
      totalRequests: metrics.length,
      avgResponseTime: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length 
        : 0,
      errorRate: metrics.length > 0
        ? (metrics.filter(m => m.statusCode >= 400).length / metrics.length) * 100
        : 0,
      statusCodes: metrics.reduce((acc, m) => {
        acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
        return acc;
      }, {} as Record<number, number>),
      endpoints: metrics.reduce((acc, m) => {
        const key = `${m.method} ${m.endpoint}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      slowRequests: metrics.filter(m => m.duration > 1000).length
    };
    
    res.json({
      period: `${days} day(s)`,
      statistics: stats,
      recentMetrics: metrics.slice(-50) // Last 50 requests
    });
    
  } catch (error) {
    logger.error('Error retrieving metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
};

// Export current in-memory metrics
export const getCurrentMetrics = () => {
  return {
    totalRequests: requestMetrics.length,
    recentMetrics: requestMetrics.slice(-10),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };
};