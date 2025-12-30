import { Server as SocketIOServer, Socket } from 'socket.io';
import Redis from 'ioredis';
// import logger from '../../../shared/utils/logger';
// TODO: Fix shared logger - temporarily using console
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args)
};

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  barId?: string;
  heartbeatInterval?: NodeJS.Timeout;
  heartbeatTimeout?: NodeJS.Timeout;
}

// ... rest of imports/interfaces ...

// Add startHeartbeat logic at the end of file (outside initializeSocketIO)

// Heartbeat function
function startHeartbeat(socket: AuthenticatedSocket) {
  // Clear existing if any
  if (socket.heartbeatInterval) clearInterval(socket.heartbeatInterval);
  if (socket.heartbeatTimeout) clearTimeout(socket.heartbeatTimeout);

  socket.heartbeatInterval = setInterval(() => {
    socket.emit('ping-check');

    // Wait for pong
    socket.heartbeatTimeout = setTimeout(() => {
      logger.warn(`Client ${socket.id} failed heartbeat, disconnecting`);
      socket.disconnect(true);
    }, 5000); // 5s timeout
  }, 25000); // 25s interval
}

interface SocketData {
  userId: string;
  userRole: string;
  barId?: string;
}

// Store active connections by bar
const barConnections = new Map<string, Set<string>>();
// Store user connections
const userConnections = new Map<string, string>();

// Redis Subscriber
let redisSubscriber: Redis | null = null;

export function initializeSocketIO(io: SocketIOServer) {
  logger.info('Socket.IO handler initialized');

  // Initialize Redis Subscriber
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisSubscriber = new Redis(redisUrl);

    redisSubscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
      // Subscribe to queue events channel
      // redisSubscriber!.subscribe('queue:events', (err, count) => {
      //   if (err) {
      //     logger.error('Failed to subscribe to queue:events', err);
      //   } else {
      //     logger.info(`Subscribed to queue:events. Count: ${count}`);
      //   }
      // });
    });

    redisSubscriber.on('message', (channel, message) => {
      if (channel === 'queue:events') {
        try {
          const event = JSON.parse(message);
          const { barId, eventType, data } = event;

          if (barId && eventType) {
            logger.info(`Received Redis event: ${eventType} for bar ${barId}`);
            // Broadcast to bar room
            io.to(`bar-${barId}`).emit(eventType.replace(/_/g, '-'), data);
            // Also emit generic queue-updated for compatibility
            io.to(`bar-${barId}`).emit('queue-updated', { type: eventType, data });
          }
        } catch (e) {
          logger.error('Error parsing Redis message:', e);
        }
      }
    });

    redisSubscriber.on('error', (err) => {
      logger.error('Redis subscriber error:', err);
    });

  } catch (error) {
    logger.error('Failed to initialize Redis subscriber:', error);
  }

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Extract barId and tableNumber from handshake query
    const barId = socket.handshake.query.barId as string;
    const tableNumber = socket.handshake.query.tableNumber as string;

    logger.info(`Client connection params - BarId: ${barId}, TableNumber: ${tableNumber}`);

    // Auto-join bar room if parameters provided
    if (barId) {
      socket.barId = barId;
      socket.join(`bar-${barId}`);

      // Add to bar connections
      if (!barConnections.has(barId)) {
        barConnections.set(barId, new Set());
      }
      barConnections.get(barId)!.add(socket.id);

      socket.emit('joined-bar', { barId, tableNumber });
      logger.info(`Socket ${socket.id} auto-joined bar ${barId} at table ${tableNumber || 'unknown'}`);

      // Start Heartbeat for this client
      startHeartbeat(socket);
    }

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
      // Clean up connection tracking
      if (socket.barId && barConnections.has(socket.barId)) {
        barConnections.get(socket.barId)!.delete(socket.id);
        if (barConnections.get(socket.barId)!.size === 0) {
          barConnections.delete(socket.barId);
        }
      }

      // Stop heartbeat
      if (socket.heartbeatInterval) {
        clearInterval(socket.heartbeatInterval);
      }
      if (socket.heartbeatTimeout) {
        clearTimeout(socket.heartbeatTimeout);
      }
      userConnections.delete(socket.id); // Keep this from original disconnect
    });

    // Pong handler
    socket.on('pong-check', () => {
      if (socket.heartbeatTimeout) {
        clearTimeout(socket.heartbeatTimeout);
        socket.heartbeatTimeout = undefined; // Use undefined instead of null for consistency with TS
        // logger.debug(`Pong received from ${socket.id}`);
      }
    });

    // Handle manual joining a bar room (fallback)
    socket.on('join-bar', (data: { barId: string; tableNumber?: string }) => {
      try {
        const { barId: requestedBarId, tableNumber } = data;

        // Leave previous rooms
        if (socket.barId && socket.barId !== requestedBarId) {
          socket.leave(`bar-${socket.barId}`);
          if (barConnections.has(socket.barId)) {
            barConnections.get(socket.barId)!.delete(socket.id);
            if (barConnections.get(socket.barId)!.size === 0) {
              barConnections.delete(socket.barId);
            }
          }
        }

        socket.barId = requestedBarId;
        socket.join(`bar-${requestedBarId}`);

        if (!barConnections.has(requestedBarId)) {
          barConnections.set(requestedBarId, new Set());
        }
        barConnections.get(requestedBarId)!.add(socket.id);

        socket.emit('joined-bar', { barId: requestedBarId, tableNumber });
        logger.info(`Socket ${socket.id} joined bar ${requestedBarId}`);

        // Ensure heartbeat is running if not already started
        if (!socket.heartbeatInterval) {
          startHeartbeat(socket);
        }
      } catch (error) {
        logger.error('Error joining bar:', error);
        socket.emit('error', { message: 'Failed to join bar' });
      }
    });

    socket.on('leave-bar', (data: { barId: string }) => {
      const { barId } = data;
      socket.leave(`bar-${barId}`);
      if (barConnections.has(barId)) {
        barConnections.get(barId)!.delete(socket.id);
        if (barConnections.get(barId)!.size === 0) {
          barConnections.delete(barId);
        }
      }
      socket.barId = undefined;
      logger.info(`Socket ${socket.id} left bar ${barId}`);
    });

    // Handle adding song to queue (simplified)
    socket.on('add-to-queue', async (data: { song: any; priority?: boolean }) => {
      try {
        if (!socket.barId) {
          socket.emit('error', { message: 'Not connected to a bar' });
          return;
        }

        logger.info(`Song added to queue for bar ${socket.barId}:`, data.song.title);

        // Broadcast to all clients in the bar (including sender)
        io.to(`bar-${socket.barId}`).emit('queue-updated', {
          type: 'song_added',
          data: {
            song: data.song,
            addedBy: socket.userId || 'anonymous',
            timestamp: new Date().toISOString()
          }
        });

        socket.emit('song-added-success', {
          song: data.song,
          message: 'Song added to queue successfully'
        });

      } catch (error) {
        logger.error('Error adding song to queue:', error);
        socket.emit('error', { message: 'Failed to add song to queue' });
      }
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);

      // Clean up tracking
      if (socket.barId && barConnections.has(socket.barId)) {
        barConnections.get(socket.barId)!.delete(socket.id);
        if (barConnections.get(socket.barId)!.size === 0) {
          barConnections.delete(socket.barId);
        }
      }
      userConnections.delete(socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error:`, error);
    });
  });

  // Store io instance for use in other parts of the application
  (global as any).socketIO = io;

  logger.info('WebSocket server initialized successfully');
}

// Helper functions to emit events to specific bars
export function emitToBar(barId: string, event: string, data: any) {
  const io = (global as any).socketIO as SocketIOServer;
  if (io) {
    io.to(`bar-${barId}`).emit(event, data);
    logger.debug(`Emitted ${event} to bar ${barId}:`, data);
  }
}

export function getBarConnectionCount(barId: string): number {
  return barConnections.get(barId)?.size || 0;
}

export function getAllConnectedBars(): string[] {
  return Array.from(barConnections.keys());
}
