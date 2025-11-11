import { Server as SocketIOServer, Socket } from 'socket.io';
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

export function initializeSocketIO(io: SocketIOServer) {
  logger.info('Socket.IO handler initialized (simplified version - no DB/Redis)');

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
      
      // Send mock empty queue for now
      socket.emit('queue-updated', { 
        queue: [], 
        currentlyPlaying: null,
        totalCount: 0 
      });
    }

    // Handle manual joining a bar room (fallback)
    socket.on('join-bar', async (data: { barId: string; tableNumber?: string }) => {
      try {
        const { barId, tableNumber } = data;

        socket.barId = barId;
        socket.join(`bar-${barId}`);
        
        // Add to bar connections
        if (!barConnections.has(barId)) {
          barConnections.set(barId, new Set());
        }
        barConnections.get(barId)!.add(socket.id);

        socket.emit('joined-bar', { barId, tableNumber });
        logger.info(`Socket ${socket.id} joined bar ${barId} at table ${tableNumber || 'unknown'}`);
        
        // Send mock empty queue for now
        socket.emit('queue-updated', { 
          queue: [], 
          currentlyPlaying: null,
          totalCount: 0 
        });
        
      } catch (error) {
        logger.error('Error joining bar:', error);
        socket.emit('error', { message: 'Failed to join bar' });
      }
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

  logger.info('WebSocket server initialized successfully (simplified version)');
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
