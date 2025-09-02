#!/usr/bin/env node

import { AnalyticsApp } from './app';
import config from './utils/config';
import { Logger } from './utils/logger';

/**
 * Analytics Service Server Entry Point
 */
class Server {
  private app: AnalyticsApp;
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Initialize and start the server
   */
  public async start(): Promise<void> {
    try {
      // Log startup information
      this.logger.info('Starting Encore Analytics Service...');
      this.logger.info(`Environment: ${config.NODE_ENV}`);
      this.logger.info(`Version: ${process.env.npm_package_version || '1.0.0'}`);
      this.logger.info(`Node.js Version: ${process.version}`);
      this.logger.info(`Process ID: ${process.pid}`);

      // Configuration is already validated during load
      this.logger.info('Configuration loaded and validated successfully');

      // Create and start the application
      this.logger.info('Creating application instance...');
      this.app = new AnalyticsApp(config);
      
      this.logger.info('Starting application...');
      await this.app.start();
      
      this.logger.info('Analytics Service started successfully');
      this.logger.info(`Server listening on localhost:${config.PORT}`);
      
      // Log service endpoints
      this.logServiceEndpoints();
      
    } catch (error) {
      this.logger.error('Failed to start Analytics Service:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      console.error('Detailed error:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Analytics Service...');
      
      if (this.app) {
        await this.app.stop();
      }
      
      this.logger.info('Analytics Service stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Analytics Service:', error);
      throw error;
    }
  }

  /**
   * Log available service endpoints
   */
  private logServiceEndpoints(): void {
    const baseUrl = `http://localhost:${config.PORT}`;
    
    this.logger.info('Available endpoints:');
    this.logger.info(`  Health Check: ${baseUrl}/health`);
    this.logger.info(`  Metrics: ${baseUrl}/metrics`);
    this.logger.info(`  API Documentation: ${baseUrl}/api/v1`);
    this.logger.info('');
    this.logger.info('Analytics endpoints:');
    this.logger.info(`  Analytics Data: ${baseUrl}/api/v1/analytics`);
    this.logger.info(`  Dashboard: ${baseUrl}/api/v1/analytics/dashboard/data`);
    this.logger.info(`  Real-time Metrics: ${baseUrl}/api/v1/analytics/realtime/metrics`);
    this.logger.info('');
    this.logger.info('Events endpoints:');
    this.logger.info(`  Create Event: ${baseUrl}/api/v1/events`);
    this.logger.info(`  Event Statistics: ${baseUrl}/api/v1/events/statistics`);
    this.logger.info(`  Recent Events: ${baseUrl}/api/v1/events/recent`);
    this.logger.info('');
    this.logger.info('Reports endpoints:');
    this.logger.info(`  Generate Report: ${baseUrl}/api/v1/reports`);
    this.logger.info(`  Report Statistics: ${baseUrl}/api/v1/reports/statistics`);
    this.logger.info(`  Scheduled Reports: ${baseUrl}/api/v1/reports/scheduled`);
    
    this.logger.info('');
    this.logger.info('WebSocket endpoints:');
    this.logger.info(`  Real-time Updates: ws://localhost:${config.WEBSOCKET_PORT}`);
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Start the server if this file is run directly
 */
if (require.main === module) {
  const server = new Server();
  
  // Handle graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
      await server.stop();
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

  // Start the server
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { Server };
export default Server;