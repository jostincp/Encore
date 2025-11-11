import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
// import { config } from '../../shared/config';
// TODO: Fix shared config - temporarily using hardcoded values
// import logger from '../../shared/utils/logger';
// TODO: Fix shared logger - temporarily using console
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args)
};
// import routes from './routes';
// TODO: Fix routes - temporarily disabled
import { initializeSocketIO } from './websocket/socketHandlerSimple';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:3004', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Security middleware - CSP deshabilitado temporalmente para debugging WebSocket
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3004', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// General middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'queue-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    websocket: {
      connected_clients: io.engine.clientsCount,
      status: 'active'
    }
  });
});

// Queue endpoints
app.post('/api/queue/:barId/add', (req, res) => {
  try {
    const { barId } = req.params;
    const { song_id, priority_play, points_used, requested_by } = req.body;
    
    logger.info(`Adding song to queue - Bar: ${barId}, Song: ${song_id}, Priority: ${priority_play}`);
    
    // TODO: Implementar lógica real de base de datos
    // Por ahora, simulamos éxito y notificamos via WebSocket
    
    // Notificar a todos los clientes del bar sobre la nueva canción
    io.to(`bar-${barId}`).emit('song-added', {
      song_id,
      priority_play,
      points_used,
      requested_by,
      timestamp: new Date().toISOString()
    });
    
    // Actualizar la cola para todos los clientes
    io.to(`bar-${barId}`).emit('queue-updated', {
      queue: [], // TODO: Obtener cola real de la DB
      currentlyPlaying: null,
      totalCount: 1 // TODO: Calcular total real
    });
    
    res.json({
      success: true,
      message: 'Canción agregada a la cola exitosamente',
      data: {
        song_id,
        priority_play,
        points_used,
        requested_by,
        queue_position: priority_play ? 1 : 999 // TODO: Calcular posición real
      }
    });
    
  } catch (error) {
    logger.error('Error adding song to queue:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar canción a la cola'
    });
  }
});

// Get queue for a bar
app.get('/api/queue/:barId', (req, res) => {
  try {
    const { barId } = req.params;
    
    // TODO: Implementar lógica real de base de datos
    // Por ahora, devolvemos una cola vacía
    res.json({
      success: true,
      data: {
        queue: [],
        currentlyPlaying: null,
        totalCount: 0
      }
    });
    
  } catch (error) {
    logger.error('Error getting queue:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la cola'
    });
  }
});

// Routes
// app.use('/api', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    service: 'queue-service'
  });
});

// Initialize WebSocket handling
initializeSocketIO(io);

// Server startup
async function startServer() {
  try {
    // Start server
    const port = parseInt(process.env.PORT || '3003');
    server.listen(port, () => {
      logger.info(`Queue Service started on port ${port}`);
      logger.info(`Environment: development`);
      logger.info(`WebSocket server initialized`);
      logger.info(`Service: queue-service`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close WebSocket connections
  io.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Close WebSocket connections
  io.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export { app, server, io };