import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import logger from './logger';
import config from '../config';
import { CacheManager } from './cache';

/**
 * WebSocket event types
 */
export enum WebSocketEvent {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  
  // Authentication events
  AUTHENTICATE = 'authenticate',
  AUTHENTICATED = 'authenticated',
  AUTHENTICATION_ERROR = 'authentication_error',
  
  // Analytics events
  ANALYTICS_UPDATE = 'analytics_update',
  REALTIME_METRICS = 'realtime_metrics',
  DASHBOARD_UPDATE = 'dashboard_update',
  
  // Event tracking
  NEW_EVENT = 'new_event',
  EVENT_PROCESSED = 'event_processed',
  
  // Report events
  REPORT_GENERATED = 'report_generated',
  REPORT_PROGRESS = 'report_progress',
  REPORT_ERROR = 'report_error',
  
  // System events
  SYSTEM_STATUS = 'system_status',
  HEALTH_CHECK = 'health_check'
}

/**
 * WebSocket message interface
 */
export interface WebSocketMessage {
  event: WebSocketEvent;
  data: any;
  timestamp: number;
  barId?: string;
  userId?: string;
}

/**
 * Authenticated socket interface
 */
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  barId?: string;
  role?: string;
  isAuthenticated: boolean;
}

/**
 * WebSocket room types
 */
export enum RoomType {
  BAR = 'bar',
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system'
}

/**
 * WebSocket statistics
 */
export interface WebSocketStats {
  totalConnections: number;
  authenticatedConnections: number;
  roomCounts: Record<string, number>;
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  errors: number;
}

/**
 * WebSocket Manager class
 */
export class WebSocketManager {
  private static instance: WebSocketManager;
  private io: SocketIOServer;
  private cache: CacheManager;
  private stats: WebSocketStats = {
    totalConnections: 0,
    authenticatedConnections: 0,
    roomCounts: {},
    messagesSent: 0,
    messagesReceived: 0,
    averageLatency: 0,
    errors: 0
  };
  private latencySum: number = 0;
  private latencyCount: number = 0;

  private constructor() {
    // Initialize cache with a dummy Redis instance for now
    this.cache = new CacheManager(null as any);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('WebSocket server initialized', {
      cors: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      transports: ['websocket', 'polling']
    });
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          socket.isAuthenticated = false;
          return next(); // Allow unauthenticated connections for public data
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        
        // Check if token is blacklisted
        const isBlacklisted = await this.cache.sismember('auth:blacklist', decoded.jti || '');
        if (isBlacklisted) {
          return next(new Error('Token is blacklisted'));
        }

        socket.userId = decoded.userId;
        socket.barId = decoded.barId;
        socket.role = decoded.role;
        socket.isAuthenticated = true;
        
        logger.debug('Socket authenticated', {
          socketId: socket.id,
          userId: socket.userId,
          barId: socket.barId,
          role: socket.role
        });
        
        next();
      } catch (error) {
        logger.error('Socket authentication failed', {
          socketId: socket.id,
          error: {
            code: 'AUTH_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        });
        socket.isAuthenticated = false;
        next(); // Allow connection but mark as unauthenticated
      }
    });

    // Rate limiting middleware
    this.io.use(async (socket, next) => {
      const clientId = socket.handshake.address;
      const rateLimitKey = `ws_rate_limit:${clientId}`;
      
      try {
        const currentCount = (await this.cache.get(rateLimitKey) || 0) as number;
        const newCount = currentCount + 1;
        await this.cache.set(rateLimitKey, newCount, 60); // 1 minute window
        
        const rateLimitPerMinute = 60; // Default rate limit per minute
        if (newCount > rateLimitPerMinute) {
          logger.warn('WebSocket rate limit exceeded', {
            clientId,
            currentCount: newCount,
            limit: rateLimitPerMinute
          });
          return next(new Error('Rate limit exceeded'));
        }
        
        next();
      } catch (error) {
        logger.error('WebSocket rate limiting error', {
          clientId,
          error: {
            code: 'RATE_LIMIT_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        });
        next();
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on(WebSocketEvent.CONNECTION, (socket: AuthenticatedSocket) => {
      this.stats.totalConnections++;
      
      if (socket.isAuthenticated) {
        this.stats.authenticatedConnections++;
      }
      
      logger.info('Client connected', {
        socketId: socket.id,
        userId: socket.userId,
        barId: socket.barId,
        authenticated: socket.isAuthenticated,
        totalConnections: this.stats.totalConnections
      });

      // Join appropriate rooms
      this.joinRooms(socket);

      // Handle authentication after connection
      socket.on(WebSocketEvent.AUTHENTICATE, async (data) => {
        await this.handleAuthentication(socket, data);
      });

      // Handle health check
      socket.on(WebSocketEvent.HEALTH_CHECK, (callback) => {
        const latency = Date.now() - socket.handshake.issued;
        this.updateLatency(latency);
        
        if (callback) {
          callback({
            status: 'healthy',
            latency,
            timestamp: Date.now()
          });
        }
      });

      // Handle disconnect
      socket.on(WebSocketEvent.DISCONNECT, (reason) => {
        this.stats.totalConnections--;
        
        if (socket.isAuthenticated) {
          this.stats.authenticatedConnections--;
        }
        
        logger.info('Client disconnected', {
          socketId: socket.id,
          userId: socket.userId,
          reason,
          totalConnections: this.stats.totalConnections
        });
        
        this.updateRoomCounts();
      });

      // Handle errors
      socket.on(WebSocketEvent.ERROR, (error) => {
        this.stats.errors++;
        logger.error('Socket error', {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message || error
        });
      });

      this.updateRoomCounts();
    });
  }

  /**
   * Handle authentication
   */
  private async handleAuthentication(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { token } = data;
      
      if (!token) {
        socket.emit(WebSocketEvent.AUTHENTICATION_ERROR, {
          message: 'Token is required'
        });
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      
      // Check if token is blacklisted
      const isBlacklisted = await this.cache.sismember('auth:blacklist', decoded.jti || '');
      if (isBlacklisted) {
        socket.emit(WebSocketEvent.AUTHENTICATION_ERROR, {
          message: 'Token is blacklisted'
        });
        return;
      }

      // Update socket authentication
      if (!socket.isAuthenticated) {
        this.stats.authenticatedConnections++;
      }
      
      socket.userId = decoded.userId;
      socket.barId = decoded.barId;
      socket.role = decoded.role;
      socket.isAuthenticated = true;
      
      // Join authenticated rooms
      this.joinRooms(socket);
      
      socket.emit(WebSocketEvent.AUTHENTICATED, {
        userId: socket.userId,
        barId: socket.barId,
        role: socket.role
      });
      
      logger.info('Socket authenticated successfully', {
        socketId: socket.id,
        userId: socket.userId,
        barId: socket.barId,
        role: socket.role
      });
    } catch (error) {
      socket.emit(WebSocketEvent.AUTHENTICATION_ERROR, {
        message: 'Invalid token'
      });
      
      logger.error('Socket authentication failed', {
        socketId: socket.id,
        error: {
          code: 'AUTH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Join appropriate rooms
   */
  private joinRooms(socket: AuthenticatedSocket): void {
    if (socket.isAuthenticated) {
      // Join user room
      if (socket.userId) {
        const userRoom = this.getRoomName(RoomType.USER, socket.userId);
        socket.join(userRoom);
        logger.debug('Socket joined user room', {
          socketId: socket.id,
          room: userRoom
        });
      }
      
      // Join bar room
      if (socket.barId) {
        const barRoom = this.getRoomName(RoomType.BAR, socket.barId);
        socket.join(barRoom);
        logger.debug('Socket joined bar room', {
          socketId: socket.id,
          room: barRoom
        });
      }
      
      // Join admin room if admin
      if (socket.role === 'admin' || socket.role === 'super_admin') {
        const adminRoom = this.getRoomName(RoomType.ADMIN, 'all');
        socket.join(adminRoom);
        logger.debug('Socket joined admin room', {
          socketId: socket.id,
          room: adminRoom
        });
      }
    }
    
    // Join system room for system-wide notifications
    const systemRoom = this.getRoomName(RoomType.SYSTEM, 'all');
    socket.join(systemRoom);
  }

  /**
   * Get room name
   */
  private getRoomName(type: RoomType, id: string): string {
    return `${type}:${id}`;
  }

  /**
   * Update room counts
   */
  private updateRoomCounts(): void {
    const rooms = this.io.sockets.adapter.rooms;
    this.stats.roomCounts = {};
    
    rooms.forEach((room, roomName) => {
      if (!roomName.startsWith('socket:')) { // Exclude socket-specific rooms
        this.stats.roomCounts[roomName] = room.size;
      }
    });
  }

  /**
   * Update latency statistics
   */
  private updateLatency(latency: number): void {
    this.latencySum += latency;
    this.latencyCount++;
    this.stats.averageLatency = this.latencySum / this.latencyCount;
  }

  /**
   * Broadcast to all clients
   */
  public broadcast(event: WebSocketEvent, data: any): void {
    const message: WebSocketMessage = {
      event,
      data,
      timestamp: Date.now()
    };
    
    this.io.emit(event, message);
    this.stats.messagesSent++;
    
    logger.debug('Broadcast message sent', {
      event,
      recipientCount: this.io.sockets.sockets.size
    });
  }

  /**
   * Send to specific room
   */
  public sendToRoom(roomType: RoomType, roomId: string, event: WebSocketEvent, data: any): void {
    const roomName = this.getRoomName(roomType, roomId);
    const message: WebSocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      barId: roomType === RoomType.BAR ? roomId : undefined
    };
    
    this.io.to(roomName).emit(event, message);
    this.stats.messagesSent++;
    
    const room = this.io.sockets.adapter.rooms.get(roomName);
    const recipientCount = room ? room.size : 0;
    
    logger.debug('Room message sent', {
      event,
      roomName,
      recipientCount
    });
  }

  /**
   * Send to specific user
   */
  public sendToUser(userId: string, event: WebSocketEvent, data: any): void {
    this.sendToRoom(RoomType.USER, userId, event, data);
  }

  /**
   * Send to specific bar
   */
  public sendToBar(barId: string, event: WebSocketEvent, data: any): void {
    this.sendToRoom(RoomType.BAR, barId, event, data);
  }

  /**
   * Send to admins
   */
  public sendToAdmins(event: WebSocketEvent, data: any): void {
    this.sendToRoom(RoomType.ADMIN, 'all', event, data);
  }

  /**
   * Send system notification
   */
  public sendSystemNotification(event: WebSocketEvent, data: any): void {
    this.sendToRoom(RoomType.SYSTEM, 'all', event, data);
  }

  /**
   * Send analytics update
   */
  public sendAnalyticsUpdate(barId: string, data: any): void {
    this.sendToBar(barId, WebSocketEvent.ANALYTICS_UPDATE, data);
  }

  /**
   * Send realtime metrics
   */
  public sendRealtimeMetrics(barId: string, metrics: any): void {
    this.sendToBar(barId, WebSocketEvent.REALTIME_METRICS, metrics);
  }

  /**
   * Send dashboard update
   */
  public sendDashboardUpdate(barId: string, dashboard: any): void {
    this.sendToBar(barId, WebSocketEvent.DASHBOARD_UPDATE, dashboard);
  }

  /**
   * Send new event notification
   */
  public sendNewEvent(barId: string, event: any): void {
    this.sendToBar(barId, WebSocketEvent.NEW_EVENT, event);
  }

  /**
   * Send event processed notification
   */
  public sendEventProcessed(barId: string, eventId: string): void {
    this.sendToBar(barId, WebSocketEvent.EVENT_PROCESSED, { eventId });
  }

  /**
   * Send report generated notification
   */
  public sendReportGenerated(userId: string, report: any): void {
    this.sendToUser(userId, WebSocketEvent.REPORT_GENERATED, report);
  }

  /**
   * Send report progress update
   */
  public sendReportProgress(userId: string, progress: any): void {
    this.sendToUser(userId, WebSocketEvent.REPORT_PROGRESS, progress);
  }

  /**
   * Send report error
   */
  public sendReportError(userId: string, error: any): void {
    this.sendToUser(userId, WebSocketEvent.REPORT_ERROR, error);
  }

  /**
   * Send system status update
   */
  public sendSystemStatus(status: any): void {
    this.sendSystemNotification(WebSocketEvent.SYSTEM_STATUS, status);
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get authenticated clients count
   */
  public getAuthenticatedClientsCount(): number {
    return this.stats.authenticatedConnections;
  }

  /**
   * Get room client count
   */
  public getRoomClientCount(roomType: RoomType, roomId: string): number {
    const roomName = this.getRoomName(roomType, roomId);
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Get statistics
   */
  public getStats(): WebSocketStats {
    this.updateRoomCounts();
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalConnections: this.io.sockets.sockets.size,
      authenticatedConnections: 0,
      roomCounts: {},
      messagesSent: 0,
      messagesReceived: 0,
      averageLatency: 0,
      errors: 0
    };
    this.latencySum = 0;
    this.latencyCount = 0;
    
    // Recount authenticated connections
    this.io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
      if (socket.isAuthenticated) {
        this.stats.authenticatedConnections++;
      }
    });
    
    this.updateRoomCounts();
    logger.info('WebSocket statistics reset');
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    stats: WebSocketStats;
    uptime: number;
  }> {
    try {
      const stats = this.getStats();
      const uptime = process.uptime();
      
      return {
        status: 'healthy',
        stats,
        uptime
      };
    } catch (error) {
      logger.error('WebSocket health check failed', {
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        status: 'unhealthy',
        stats: this.getStats(),
        uptime: process.uptime()
      };
    }
  }

  /**
   * Disconnect all clients
   */
  public disconnectAll(): void {
    this.io.sockets.sockets.forEach((socket) => {
      socket.disconnect(true);
    });
    
    logger.info('All WebSocket clients disconnected');
  }

  /**
   * Get Socket.IO instance
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketManager;