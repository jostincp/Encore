import { Request, Response, NextFunction } from 'express';
import { getRedisClient, getPool } from '../config/database';
import { logger } from '../utils/logger';

// Re-export database clients for compatibility
export const redisClient = getRedisClient;
export const sequelize = getPool; // Note: This is actually PostgreSQL pool, not Sequelize

/**
 * Health Check Middleware
 * Checks the health status of the analytics service and its dependencies
 */

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  dependencies: {
    database: {
      status: 'connected' | 'disconnected' | 'error';
      responseTime?: number;
      error?: string;
    };
    redis: {
      status: 'connected' | 'disconnected' | 'error';
      responseTime?: number;
      error?: string;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
  services: {
    eventProcessing: boolean;
    analyticsProcessing: boolean;
    reportGeneration: boolean;
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  responseTime?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();
    const pool = getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'connected',
      responseTime
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  responseTime?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();
    const redis = getRedisClient();
    await redis.ping();
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'connected',
      responseTime
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown Redis error'
    };
  }
}

/**
 * Get memory usage information
 */
function getMemoryUsage() {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const percentage = (usedMemory / totalMemory) * 100;
  
  return {
    used: Math.round(usedMemory / 1024 / 1024), // MB
    total: Math.round(totalMemory / 1024 / 1024), // MB
    percentage: Math.round(percentage * 100) / 100
  };
}

/**
 * Get CPU usage (simplified)
 */
function getCpuUsage(): number {
  const cpuUsage = process.cpuUsage();
  const totalUsage = cpuUsage.user + cpuUsage.system;
  // Convert to percentage (simplified calculation)
  return Math.round((totalUsage / 1000000) * 100) / 100;
}

/**
 * Check service status
 */
function checkServices() {
  // These would typically check if background processes are running
  // For now, we'll assume they're running if the service is up
  return {
    eventProcessing: true,
    analyticsProcessing: true,
    reportGeneration: true
  };
}

/**
 * Determine overall health status
 */
function determineOverallStatus(
  dbStatus: string,
  redisStatus: string,
  memoryPercentage: number
): 'healthy' | 'unhealthy' | 'degraded' {
  // Unhealthy if critical services are down
  if (dbStatus === 'error' || redisStatus === 'error') {
    return 'unhealthy';
  }
  
  // Degraded if memory usage is high or services are disconnected
  if (memoryPercentage > 90 || dbStatus === 'disconnected' || redisStatus === 'disconnected') {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * Health check middleware
 */
export const healthCheckMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Perform health checks
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ]);
    
    const memoryUsage = getMemoryUsage();
    const cpuUsage = getCpuUsage();
    const services = checkServices();
    
    // Determine overall status
    const overallStatus = determineOverallStatus(
      dbHealth.status,
      redisHealth.status,
      memoryUsage.percentage
    );
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      dependencies: {
        database: dbHealth,
        redis: redisHealth,
        memory: memoryUsage,
        cpu: {
          usage: cpuUsage
        }
      },
      services
    };
    
    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: overallStatus !== 'unhealthy',
      data: healthStatus,
      message: `Service is ${overallStatus}`
    });
    
    // Log health check results
    if (overallStatus !== 'healthy') {
      logger.warn('Health check detected issues:', {
        status: overallStatus,
        database: dbHealth.status,
        redis: redisHealth.status,
        memory: memoryUsage.percentage
      });
    }
    
  } catch (error) {
    logger.error('Health check middleware error:', error);
    
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: 'Unable to perform health check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Detailed health check (for admin endpoints)
 */
export const detailedHealthCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Include additional checks for detailed health
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ]);
    
    const memoryUsage = getMemoryUsage();
    const cpuUsage = getCpuUsage();
    const services = checkServices();
    
    // Additional system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      ppid: process.ppid
    };
    
    const overallStatus = determineOverallStatus(
      dbHealth.status,
      redisHealth.status,
      memoryUsage.percentage
    );
    
    const detailedHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: systemInfo,
      dependencies: {
        database: dbHealth,
        redis: redisHealth,
        memory: memoryUsage,
        cpu: {
          usage: cpuUsage
        }
      },
      services,
      recommendations: generateRecommendations(dbHealth, redisHealth, memoryUsage)
    };
    
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: overallStatus !== 'unhealthy',
      data: detailedHealth,
      message: `Detailed health check completed - service is ${overallStatus}`
    });
    
  } catch (error) {
    logger.error('Detailed health check error:', error);
    
    res.status(503).json({
      success: false,
      error: 'Detailed health check failed',
      message: 'Unable to perform detailed health check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Generate health recommendations
 */
function generateRecommendations(
  dbHealth: any,
  redisHealth: any,
  memoryUsage: any
): string[] {
  const recommendations: string[] = [];
  
  if (dbHealth.status === 'error') {
    recommendations.push('Database connection failed - check database server status');
  } else if (dbHealth.responseTime && dbHealth.responseTime > 1000) {
    recommendations.push('Database response time is high - consider optimizing queries');
  }
  
  if (redisHealth.status === 'error') {
    recommendations.push('Redis connection failed - check Redis server status');
  } else if (redisHealth.responseTime && redisHealth.responseTime > 500) {
    recommendations.push('Redis response time is high - check Redis server performance');
  }
  
  if (memoryUsage.percentage > 80) {
    recommendations.push('Memory usage is high - consider increasing available memory or optimizing memory usage');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All systems are operating normally');
  }
  
  return recommendations;
}

export default healthCheckMiddleware;