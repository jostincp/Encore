import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../../shared/config';
import { logger } from '../../../shared/utils/logger';
import { redisClient } from '../../../shared/cache';
import { QueueModel } from '../models/Queue';
import { BarModel } from '../../../shared/models/Bar';
import Redis from 'ioredis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  barId?: string;
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

/**
 * Handle queue events from Redis pub/sub
 */
async function handleQueueEvent(io: SocketIOServer, eventData: any) {
  const { barId, eventType, data } = eventData;

  logger.debug('Processing queue event', { barId, eventType });

  try {
    switch (eventType) {
      case 'song_added':
        // Emit to all clients in the bar
        io.to(`bar_${barId}`).emit('queue_updated', {
          type: 'song_added',
          data: data.queueEntry
        });
        break;

      case 'song_status_updated':
        // Emit to all clients in the bar
        io.to(`bar_${barId}`).emit('queue_updated', {
          type: 'song_status_updated',
          data: {
            queueEntry: data.queueEntry,
            oldStatus: data.oldStatus,
            newStatus: data.newStatus
          }
        });
        break;

      case 'song_removed':
        // Emit to all clients in the bar
        io.to(`bar_${barId}`).emit('queue_updated', {
          type: 'song_removed',
          data: { queueId: data.queueId }
        });
        break;

      case 'queue_reordered':
        // Emit to all clients in the bar
        io.to(`bar_${barId}`).emit('queue_updated', {
          type: 'queue_reordered',
          data: { newOrder: data.newOrder }
        });
        break;

      case 'queue_cleared':
        // Emit to all clients in the bar
        io.to(`bar_${barId}`).emit('queue_updated', {
          type: 'queue_cleared',
          data: { clearedCount: data.clearedCount }
        });
        break;

      default:
        logger.warn('Unknown queue event type', { eventType });
    }
  } catch (error) {
    logger.error('Failed to handle queue event', error);
  }
}

export function initializeSocketIO(io: SocketIOServer) {
  // Initialize Redis subscriber for queue events
  const redisSubscriber = new Redis(config.redis.url);

  redisSubscriber.subscribe('queue:events', (err) => {
    if (err) {
      logger.error('Failed to subscribe to queue events', err);
    } else {
      logger.info('Subscribed to queue events');
    }
  });

  redisSubscriber.on('message', async (channel, message) => {
    if (channel === 'queue:events') {
      try {
        const eventData = JSON.parse(message);
        await handleQueueEvent(io, eventData);
      } catch (error) {
        logger.error('Failed to process queue event', error);
      }
    }
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      socket.barId = decoded.barId;

      logger.info(`Socket authenticated for user ${socket.userId} with role ${socket.userRole}`);
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Client connected: ${socket.id}, User: ${socket.userId}, Role: ${socket.userRole}`);

    // Handle joining bar room
    socket.on('join_bar', async (barId: string) => {
      try {
        // Verify bar exists and user has access
        const bar = await BarModel.findById(barId);
        if (!bar) {
          socket.emit('error', { message: 'Bar not found' });
          return;
        }

        // Check if user has access to this bar
        if (socket.userRole !== 'admin' && socket.userRole !== 'bar_owner' && socket.userRole !== 'staff' && socket.barId !== barId) {
          socket.emit('error', { message: 'Access denied to this bar' });
          return;
        }

        // Join the bar room
        socket.join(`bar_${barId}`);
        
        // Track connection
        if (!barConnections.has(barId)) {
          barConnections.set(barId, new Set());
        }
        barConnections.get(barId)!.add(socket.id);
        userConnections.set(socket.id, barId);

        logger.info(`User ${socket.userId} joined bar ${barId}`);
        
        // Send current queue state
        const currentQueue = await QueueModel.findByBarId(barId, {
          status: ['pending', 'playing'],
          includeDetails: true
        });
        
        const currentlyPlaying = await QueueModel.getCurrentlyPlaying(barId);
        
        socket.emit('queue_state', {
          queue: currentQueue.data,
          currentlyPlaying,
          totalCount: currentQueue.total
        });

        // Notify others in the bar about new connection
        socket.to(`bar_${barId}`).emit('user_joined', {
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error joining bar:', error);
        socket.emit('error', { message: 'Failed to join bar' });
      }
    });

    // Handle leaving bar room
    socket.on('leave_bar', (barId: string) => {
      socket.leave(`bar_${barId}`);
      
      // Remove from tracking
      if (barConnections.has(barId)) {
        barConnections.get(barId)!.delete(socket.id);
        if (barConnections.get(barId)!.size === 0) {
          barConnections.delete(barId);
        }
      }
      userConnections.delete(socket.id);

      logger.info(`User ${socket.userId} left bar ${barId}`);
      
      // Notify others in the bar
      socket.to(`bar_${barId}`).emit('user_left', {
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle queue position request
    socket.on('get_queue_position', async (data: { barId: string }) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        const position = await QueueModel.getUserQueuePosition(data.barId, socket.userId);
        socket.emit('queue_position', {
          position,
          barId: data.barId,
          userId: socket.userId
        });
      } catch (error) {
        logger.error('Error getting queue position:', error);
        socket.emit('error', { message: 'Failed to get queue position' });
      }
    });

    // Handle queue stats request (admin/bar owner/staff only)
    socket.on('get_queue_stats', async (data: { barId: string }) => {
      try {
        if (socket.userRole !== 'admin' && socket.userRole !== 'bar_owner' && socket.userRole !== 'staff') {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        const stats = await QueueModel.getQueueStats(data.barId);
        socket.emit('queue_stats', {
          stats,
          barId: data.barId
        });
      } catch (error) {
        logger.error('Error getting queue stats:', error);
        socket.emit('error', { message: 'Failed to get queue stats' });
      }
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, User: ${socket.userId}, Reason: ${reason}`);
      
      // Clean up tracking
      const barId = userConnections.get(socket.id);
      if (barId && barConnections.has(barId)) {
        barConnections.get(barId)!.delete(socket.id);
        if (barConnections.get(barId)!.size === 0) {
          barConnections.delete(barId);
        }
        
        // Notify others in the bar
        socket.to(`bar_${barId}`).emit('user_disconnected', {
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
      userConnections.delete(socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  // Store io instance for use in other parts of the application
  (global as any).socketIO = io;

  logger.info('WebSocket server initialized successfully');
}

// Helper functions to emit events to specific bars or users
export function emitToBar(barId: string, event: string, data: any) {
  const io = (global as any).socketIO as SocketIOServer;
  if (io) {
    io.to(`bar_${barId}`).emit(event, data);
    logger.debug(`Emitted ${event} to bar ${barId}:`, data);
  }
}

export function emitToUser(userId: string, event: string, data: any) {
  const io = (global as any).socketIO as SocketIOServer;
  if (io) {
    // Find user's socket and emit
    for (const [socketId, barId] of userConnections.entries()) {
      const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket && socket.userId === userId) {
        socket.emit(event, data);
        logger.debug(`Emitted ${event} to user ${userId}:`, data);
        break;
      }
    }
  }
}

export function getBarConnectionCount(barId: string): number {
  return barConnections.get(barId)?.size || 0;
}

export function getAllConnectedBars(): string[] {
  return Array.from(barConnections.keys());
}

export function isUserConnected(userId: string): boolean {
  const io = (global as any).socketIO as SocketIOServer;
  if (!io) return false;
  
  for (const [socketId] of userConnections.entries()) {
    const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
    if (socket && socket.userId === userId) {
      return true;
    }
  }
  return false;
}