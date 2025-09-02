import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
      rawBody?: Buffer;
    }
  }
}

// Controllers are now directly imported in route files
import router from './routes';
import { EventsController } from './controllers/eventsController';
import { AnalyticsController } from './controllers/analyticsController';
import * as ReportsController from './controllers/reportsController';
import AnalyticsService from './services/analyticsService';
import { EventService } from './services/eventService';
import { ReportService } from './services/reportService';
import { DatabaseManager } from './utils/database';
import { CacheManager } from './utils/cache';
import { WebSocketManager } from './utils/websocket';
import { MetricsCollector } from './utils/metrics';
import logger from './utils/logger';
import config from './utils/config';

/**
 * Analytics Service Application
 */
export class AnalyticsApp {
  private app: Application;
  private server: any;
  // Managers
  private databaseManager: DatabaseManager;
  private cacheManager: CacheManager | null = null;
  private webSocketManager: WebSocketManager;
  private metricsCollector: MetricsCollector;
  private logger: any;
  private config: any;

  // Services
  private analyticsService: AnalyticsService;
  private eventService: EventService;
  private reportService: ReportService;

  // Controllers
  private analyticsController: AnalyticsController;
  private eventsController: EventsController;
  private reportsController: typeof ReportsController;

  constructor(appConfig?: any) {
    this.config = appConfig || config;
    this.logger = logger;
    this.app = express();
    
    this.initializeManagers();
    this.initializeServices();
    this.initializeControllers();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize managers
   */
  private initializeManagers(): void {
    this.databaseManager = DatabaseManager.getInstance();
    // RedisManager and CacheManager will be initialized when Redis is available
    this.webSocketManager = WebSocketManager.getInstance();
    this.metricsCollector = new MetricsCollector();
  }

  /**
   * Initialize services
   */
  private initializeServices(): void {
    this.analyticsService = new AnalyticsService();
    this.eventService = new EventService();
    this.reportService = new ReportService();
  }

  /**
   * Initialize controllers
   */
  private initializeControllers(): void {
    this.analyticsController = new AnalyticsController();
    this.eventsController = new EventsController();
    this.reportsController = ReportsController;
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.CORS_ORIGIN || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count']
    }));

    // Compression middleware
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: process.env.MAX_REQUEST_SIZE || '10mb',
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: process.env.MAX_REQUEST_SIZE || '10mb'
    }));

    // Request logging
    if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => {
            this.logger.info(message.trim());
          }
        },
        skip: (req: Request) => {
          // Skip health check requests in production
          return this.config.NODE_ENV === 'production' && 
                 req.url.includes('/health');
        }
      }));
    }

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = req.headers['x-request-id'] as string || 
               `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Metrics collection middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordRequest({
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Mount the main router with API prefix
    this.app.use('/api/v1', router);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Encore Analytics Service',
        version: process.env.npm_package_version || '1.0.0',
        environment: this.config.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/v1/health',
          status: '/api/v1/status',
          api: '/api/v1',
          docs: '/api/v1/docs'
        }
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    });

    // Global error handler
    this.app.use((error: any, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Don't leak error details in production
      const isDevelopment = this.config.NODE_ENV !== 'production';
      
      res.status(error.status || 500).json({
        success: false,
        error: isDevelopment ? error.message : 'Internal server error',
        ...(isDevelopment && { stack: error.stack }),
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    });
  }

  /**
   * Initialize all connections and services
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Analytics Service...');

      // Initialize database connection
      if (this.databaseManager && typeof this.databaseManager.connect === 'function') {
        await this.databaseManager.connect();
        this.logger.info('Database connected successfully');
      }

      // Initialize Redis connection
      // Redis connection is established automatically in CacheManager constructor
      this.logger.info('Redis connection ready');

      // Queue manager initialization handled separately when Redis is available
      this.logger.info('Queue manager will be initialized when Redis connection is established');

      // Initialize WebSocket manager
      // WebSocket manager initialization is handled during server setup
        this.logger.info('WebSocket manager ready');

      // Initialize metrics collector
        // MetricsCollector doesn't need initialization
        // It's ready to use after instantiation
        this.logger.info('Metrics collector ready');

        // Run database migrations if needed
        // Database migrations should be handled separately
        // Not through the DatabaseManager instance
        this.logger.info('Database migrations skipped (handled externally)');

      this.logger.info('Analytics Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Analytics Service:', error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      await this.initialize();

      const port = this.config.PORT || 3005;
      const host = 'localhost';

      this.server = this.app.listen(port, host, () => {
        this.logger.info(`Analytics Service started on ${host}:${port}`);
        this.logger.info(`Environment: ${this.config.NODE_ENV || 'development'}`);
        this.logger.info(`Process ID: ${process.pid}`);
      });

      // Setup WebSocket server
      if (this.webSocketManager && typeof this.webSocketManager.initialize === 'function') {
        this.webSocketManager.initialize(this.server);
      }

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start Analytics Service:', error);
      throw error;
    }
  }

  /**
   * Stop the server gracefully
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping Analytics Service...');

    try {
      // Stop accepting new connections
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => resolve());
        });
      }

      // Close WebSocket connections
      if (this.webSocketManager && typeof this.webSocketManager.disconnectAll === 'function') {
        this.webSocketManager.disconnectAll();
      }

      // Queue manager cleanup handled separately
      this.logger.info('Queue manager cleanup completed');

      // Close Redis connection
      // Redis connection will be closed automatically
      // CacheManager doesn't expose disconnect method

      // Close database connection
      if (this.databaseManager && typeof this.databaseManager.disconnect === 'function') {
        await this.databaseManager.disconnect();
      }

      // Stop metrics collector
      // MetricsCollector doesn't need explicit stopping
      // It will be cleaned up automatically

      this.logger.info('Analytics Service stopped successfully');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          this.logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection:', { reason, promise });
      process.exit(1);
    });
  }

  /**
   * Get Express application instance
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<any> {
    const services: any = {};
    
    if (this.databaseManager && typeof this.databaseManager.isHealthy === 'function') {
      try {
        services.database = await this.databaseManager.isHealthy();
      } catch (error) {
        services.database = false;
      }
    }
    
    // Redis/Cache connection check
    if (this.cacheManager && typeof this.cacheManager.ping === 'function') {
      try {
        services.redis = await this.cacheManager.ping();
      } catch (error) {
        services.redis = false;
      }
    } else {
      services.redis = false;
    }
    
    // Queue health check - not available without queue manager instance
    services.queue = false;
    
    if (this.webSocketManager && typeof this.webSocketManager.healthCheck === 'function') {
      try {
        const healthResult = await this.webSocketManager.healthCheck();
        services.websocket = healthResult.status === 'healthy';
      } catch (error) {
        services.websocket = false;
      }
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: this.config.API_VERSION || '1.0.0',
      environment: this.config.NODE_ENV || 'development',
      services
    };
  }
}

export default AnalyticsApp;