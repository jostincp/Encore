import { app, initializeConnections } from './app';
import { logger } from './utils/logger';
import { config } from './utils/config';

const PORT = config.PORT || 3005;
const HOST = config.HOST || '0.0.0.0';

// Start server function
const startServer = async () => {
  try {
    // Initialize database and Redis connections
    const connectionsInitialized = await initializeConnections();

    if (!connectionsInitialized) {
      logger.error('Failed to initialize connections, exiting...');
      process.exit(1);
    }

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Menu service started successfully`, {
        port: PORT,
        host: HOST,
        environment: config.NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid,
        timestamp: new Date().toISOString()
      });

      // Log service endpoints
      logger.info('Available endpoints:', {
        health: `http://${HOST}:${PORT}/health`,
        info: `http://${HOST}:${PORT}/api/info`,
        docs: `http://${HOST}:${PORT}/api/docs`,
        menu: `http://${HOST}:${PORT}/api/bars/:barId/menu`,
        categories: `http://${HOST}:${PORT}/api/bars/:barId/categories`
      });
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else if (error.code === 'EACCES') {
        logger.error(`Permission denied to bind to port ${PORT}`);
      } else {
        logger.error('Server error', { error });
      }
      process.exit(1);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown', { error: err });
          process.exit(1);
        }

        logger.info('HTTP server closed successfully');

        // Close database and Redis connections here
        // This would be implemented in the respective utility files

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle process warnings
    process.on('warning', (warning) => {
      logger.warn('Process warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });

    return server;

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception - shutting down', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection - shutting down', {
    reason,
    promise
  });
  process.exit(1);
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export { startServer };
export default startServer;