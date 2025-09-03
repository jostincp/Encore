import logger from '../../../shared/utils/logger';
import { getRedisClient } from '../../../shared/utils/redis';
import nodemailer from 'nodemailer';
import config from '../config/config';

// Alert types
export enum AlertType {
  CRITICAL_ERROR = 'critical_error',
  HIGH_ERROR_RATE = 'high_error_rate',
  SLOW_RESPONSE = 'slow_response',
  SERVICE_DOWN = 'service_down',
  MEMORY_HIGH = 'memory_high',
  REDIS_DOWN = 'redis_down'
}

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Alert interface
interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

// Alert thresholds configuration
interface AlertThresholds {
  errorRate: number; // Percentage
  responseTime: number; // Milliseconds
  memoryUsage: number; // Percentage
  errorCount: number; // Number of errors in time window
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRate: 10, // 10% error rate
  responseTime: 5000, // 5 seconds
  memoryUsage: 85, // 85% memory usage
  errorCount: 50 // 50 errors in 5 minutes
};

// Email transporter (configure based on your email service)
let emailTransporter: nodemailer.Transporter | null = null;

if (config.alerts?.email?.enabled) {
  emailTransporter = nodemailer.createTransporter({
    host: config.alerts.email.host,
    port: config.alerts.email.port,
    secure: config.alerts.email.secure,
    auth: {
      user: config.alerts.email.user,
      pass: config.alerts.email.password
    }
  });
}

class AlertService {
  private redis = getRedisClient();
  private thresholds: AlertThresholds;
  private alertCooldowns = new Map<string, number>();
  private readonly COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes

  constructor(thresholds: AlertThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
    this.startMonitoring();
  }

  // Create and send alert
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const alertId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check cooldown to prevent spam
    const cooldownKey = `${type}_${severity}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    const now = Date.now();
    
    if (lastAlert && (now - lastAlert) < this.COOLDOWN_PERIOD) {
      logger.debug('Alert suppressed due to cooldown', { type, severity, cooldownKey });
      return;
    }
    
    this.alertCooldowns.set(cooldownKey, now);
    
    const alert: Alert = {
      id: alertId,
      type,
      severity,
      title,
      message,
      timestamp: new Date(),
      metadata,
      resolved: false
    };
    
    // Store alert in Redis
    await this.storeAlert(alert);
    
    // Log alert
    logger.error('Alert created', {
      alertId,
      type,
      severity,
      title,
      message,
      metadata
    });
    
    // Send notifications based on severity
    await this.sendNotifications(alert);
  }

  // Store alert in Redis
  private async storeAlert(alert: Alert): Promise<void> {
    try {
      if (!this.redis) return;
      
      const key = `alerts:${new Date().toISOString().split('T')[0]}`;
      await this.redis.lpush(key, JSON.stringify(alert));
      await this.redis.expire(key, 30 * 24 * 60 * 60); // Keep for 30 days
      
      // Store in active alerts if not resolved
      if (!alert.resolved) {
        await this.redis.hset('active_alerts', alert.id, JSON.stringify(alert));
      }
      
    } catch (error) {
      logger.error('Failed to store alert in Redis', { error: error.message, alert });
    }
  }

  // Send notifications
  private async sendNotifications(alert: Alert): Promise<void> {
    try {
      // Send email for high and critical alerts
      if ((alert.severity === AlertSeverity.HIGH || alert.severity === AlertSeverity.CRITICAL) && emailTransporter) {
        await this.sendEmailAlert(alert);
      }
      
      // Send to webhook if configured
      if (config.alerts?.webhook?.url) {
        await this.sendWebhookAlert(alert);
      }
      
      // Send to Slack if configured
      if (config.alerts?.slack?.webhookUrl) {
        await this.sendSlackAlert(alert);
      }
      
    } catch (error) {
      logger.error('Failed to send alert notifications', { error: error.message, alert });
    }
  }

  // Send email alert
  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (!emailTransporter || !config.alerts?.email?.recipients) return;
    
    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const html = `
      <h2>Alert: ${alert.title}</h2>
      <p><strong>Severity:</strong> ${alert.severity}</p>
      <p><strong>Type:</strong> ${alert.type}</p>
      <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      ${alert.metadata ? `<p><strong>Metadata:</strong> <pre>${JSON.stringify(alert.metadata, null, 2)}</pre></p>` : ''}
    `;
    
    await emailTransporter.sendMail({
      from: config.alerts.email.from,
      to: config.alerts.email.recipients,
      subject,
      html
    });
  }

  // Send webhook alert
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    const response = await fetch(config.alerts.webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.alerts.webhook.headers || {})
      },
      body: JSON.stringify(alert)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  // Send Slack alert
  private async sendSlackAlert(alert: Alert): Promise<void> {
    const color = {
      [AlertSeverity.LOW]: '#36a64f',
      [AlertSeverity.MEDIUM]: '#ff9500',
      [AlertSeverity.HIGH]: '#ff4500',
      [AlertSeverity.CRITICAL]: '#ff0000'
    }[alert.severity];
    
    const payload = {
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Type', value: alert.type, short: true },
          { title: 'Time', value: alert.timestamp.toISOString(), short: false }
        ],
        footer: 'Encore Music Service',
        ts: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    };
    
    const response = await fetch(config.alerts.slack.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  // Resolve alert
  async resolveAlert(alertId: string): Promise<void> {
    try {
      if (!this.redis) return;
      
      const alertData = await this.redis.hget('active_alerts', alertId);
      if (!alertData) return;
      
      const alert: Alert = JSON.parse(alertData);
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      // Remove from active alerts
      await this.redis.hdel('active_alerts', alertId);
      
      // Store resolved alert
      const key = `alerts:${new Date().toISOString().split('T')[0]}`;
      await this.redis.lpush(key, JSON.stringify(alert));
      
      logger.info('Alert resolved', { alertId, resolvedAt: alert.resolvedAt });
      
    } catch (error) {
      logger.error('Failed to resolve alert', { error: error.message, alertId });
    }
  }

  // Get active alerts
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      if (!this.redis) return [];
      
      const alerts = await this.redis.hgetall('active_alerts');
      return Object.values(alerts).map(alertData => JSON.parse(alertData));
      
    } catch (error) {
      logger.error('Failed to get active alerts', { error: error.message });
      return [];
    }
  }

  // Start monitoring for automatic alerts
  private startMonitoring(): void {
    // Monitor error rates every minute
    setInterval(async () => {
      await this.checkErrorRate();
      await this.checkMemoryUsage();
      await this.checkRedisHealth();
    }, 60 * 1000);
    
    // Monitor response times every 30 seconds
    setInterval(async () => {
      await this.checkResponseTimes();
    }, 30 * 1000);
  }

  // Check error rate
  private async checkErrorRate(): Promise<void> {
    try {
      if (!this.redis) return;
      
      const today = new Date().toISOString().split('T')[0];
      const counterKey = `counters:${today}`;
      
      const counters = await this.redis.hgetall(counterKey);
      if (!counters) return;
      
      let totalRequests = 0;
      let errorRequests = 0;
      
      Object.entries(counters).forEach(([key, value]) => {
        const count = parseInt(value);
        if (key.startsWith('status:')) {
          const statusCode = parseInt(key.split(':')[1]);
          totalRequests += count;
          if (statusCode >= 400) {
            errorRequests += count;
          }
        }
      });
      
      if (totalRequests > 0) {
        const errorRate = (errorRequests / totalRequests) * 100;
        
        if (errorRate > this.thresholds.errorRate) {
          await this.createAlert(
            AlertType.HIGH_ERROR_RATE,
            errorRate > 25 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
            'High Error Rate Detected',
            `Error rate is ${errorRate.toFixed(2)}% (${errorRequests}/${totalRequests} requests)`,
            { errorRate, errorRequests, totalRequests }
          );
        }
      }
      
    } catch (error) {
      logger.error('Error checking error rate', { error: error.message });
    }
  }

  // Check memory usage
  private async checkMemoryUsage(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryPercentage = (usedMemory / totalMemory) * 100;
      
      if (memoryPercentage > this.thresholds.memoryUsage) {
        await this.createAlert(
          AlertType.MEMORY_HIGH,
          memoryPercentage > 95 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
          'High Memory Usage',
          `Memory usage is ${memoryPercentage.toFixed(2)}% (${(usedMemory / 1024 / 1024).toFixed(2)}MB/${(totalMemory / 1024 / 1024).toFixed(2)}MB)`,
          { memoryPercentage, usedMemory, totalMemory }
        );
      }
      
    } catch (error) {
      logger.error('Error checking memory usage', { error: error.message });
    }
  }

  // Check Redis health
  private async checkRedisHealth(): Promise<void> {
    try {
      if (!this.redis) {
        await this.createAlert(
          AlertType.REDIS_DOWN,
          AlertSeverity.CRITICAL,
          'Redis Connection Lost',
          'Redis client is not available',
          { timestamp: new Date().toISOString() }
        );
        return;
      }
      
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      if (latency > 1000) {
        await this.createAlert(
          AlertType.SLOW_RESPONSE,
          AlertSeverity.MEDIUM,
          'Redis High Latency',
          `Redis ping latency is ${latency}ms`,
          { latency }
        );
      }
      
    } catch (error) {
      await this.createAlert(
        AlertType.REDIS_DOWN,
        AlertSeverity.CRITICAL,
        'Redis Health Check Failed',
        `Redis health check failed: ${error.message}`,
        { error: error.message }
      );
    }
  }

  // Check response times
  private async checkResponseTimes(): Promise<void> {
    try {
      if (!this.redis) return;
      
      const today = new Date().toISOString().split('T')[0];
      const slowKey = `slow_requests:${today}`;
      
      const slowRequests = await this.redis.lrange(slowKey, 0, -1);
      const recentSlowRequests = slowRequests
        .map(req => JSON.parse(req))
        .filter(req => {
          const reqTime = new Date(req.timestamp);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          return reqTime > fiveMinutesAgo;
        });
      
      if (recentSlowRequests.length > 10) {
        const avgResponseTime = recentSlowRequests.reduce((sum, req) => sum + req.duration, 0) / recentSlowRequests.length;
        
        await this.createAlert(
          AlertType.SLOW_RESPONSE,
          AlertSeverity.MEDIUM,
          'Multiple Slow Requests Detected',
          `${recentSlowRequests.length} slow requests in the last 5 minutes (avg: ${avgResponseTime.toFixed(2)}ms)`,
          { slowRequestCount: recentSlowRequests.length, avgResponseTime }
        );
      }
      
    } catch (error) {
      logger.error('Error checking response times', { error: error.message });
    }
  }
}

// Export singleton instance
export const alertService = new AlertService();
export default alertService;