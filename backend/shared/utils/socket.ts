import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifyToken, verifyTableSessionToken, JwtPayload } from './jwt';
import { logInfo, logError, logWarn } from './logger';
import { config } from '../config';
import { getRedisClient } from './redis';
import { SocketEvent, QueueUpdateEvent, SongRequestEvent, PointsUpdateEvent } from '../types';

// Interface para socket autenticado
export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
  barId?: string;
  tableId?: string;
  isTableSession?: boolean;
  // Propiedades explícitas de Socket
  id: string;
  emit: (event: string, ...args: any[]) => boolean;
  on: (event: string, listener: (...args: any[]) => void) => this;
  join: (room: string | string[]) => Promise<void> | void;
  leave: (room: string) => Promise<void> | void;
  disconnect: (close?: boolean) => this;
}

// Configuración de Socket.IO
const SOCKET_CONFIG = {
  cors: {
    origin: config.websocket.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: config.websocket.transports as ('websocket' | 'polling')[],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6 // 1MB
};

// Clase principal para gestión de Socket.IO
export class SocketManager {
  private io: SocketIOServer;
  private redis: Redis | import('./memory-cache').MemoryCache;
  private connectedUsers: Map<string, Set<string>> = new Map(); // barId -> Set<socketId>
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, SOCKET_CONFIG);
    this.redis = getRedisClient();
    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  // Configurar adaptador Redis para múltiples instancias
  private async setupRedisAdapter(): Promise<void> {
    try {
      // Only configure adapter when using real Redis client
      if ('duplicate' in (this.redis as Redis)) {
        const pubClient = (this.redis as Redis).duplicate();
        const subClient = (this.redis as Redis).duplicate();
        this.io.adapter(createAdapter(pubClient, subClient));
        logInfo('Socket.IO Redis adapter configured');
      } else {
        logWarn('Socket.IO Redis adapter not configured (using memory cache)');
      }
    } catch (error) {
      logError('Failed to setup Socket.IO Redis adapter', error as Error);
    }
  }

  // Configurar middleware de autenticación
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Intentar verificar como token de usuario normal
        try {
          const user = verifyToken(token);
          socket.user = user;
          socket.barId = user.barId;
          socket.isTableSession = false;
        } catch (userTokenError) {
          // Si falla, intentar como token de sesión de mesa
          try {
            const tableSession = verifyTableSessionToken(token);
            socket.tableId = tableSession.tableId;
            socket.barId = tableSession.barId;
            socket.isTableSession = true;
            socket.user = {
              userId: `table_${tableSession.tableId}`,
              email: '',
              role: 'user',
              barId: tableSession.barId
            };
          } catch (tableTokenError) {
            return next(new Error('Invalid authentication token'));
          }
        }

        if (socket.user) {
          logInfo(`Socket authenticated: ${socket.user.userId} (${socket.user.role})`);
        } else {
          logWarn('Socket authenticated without user payload');
        }
        next();
      } catch (error) {
        logError('Socket authentication error', error as Error);
        next(new Error('Authentication failed'));
      }
    });
  }

  // Configurar manejadores de eventos
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  // Manejar nueva conexión
  private handleConnection(socket: AuthenticatedSocket): void {
    const { user, barId } = socket;
    
    if (!user || !barId) {
      socket.disconnect();
      return;
    }

    logInfo(`User connected: ${user.userId} to bar: ${barId}`);

    // Unir a la sala del bar
    socket.join(`bar:${barId}`);
    
    // Si es admin, unir a sala de admin
    if (user.role === 'admin') {
      socket.join(`admin:${barId}`);
    }
    
    // Si es sesión de mesa, unir a sala de mesa
    if (socket.isTableSession && socket.tableId) {
      socket.join(`table:${socket.tableId}`);
    }

    // Registrar conexión
    this.registerConnection(barId, socket.id, user.userId);

    // Configurar manejadores de eventos específicos
    this.setupSocketEventHandlers(socket);

    // Manejar desconexión
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  // Configurar manejadores de eventos específicos del socket
  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    // Evento de solicitud de canción
    socket.on('song:request', async (data: SongRequestEvent) => {
      try {
        await this.handleSongRequest(socket, data);
      } catch (error) {
        logError('Error handling song request', error as Error);
        socket.emit('error', { message: 'Failed to process song request' });
      }
    });

    // Evento de actualización de cola (solo admin)
    socket.on('queue:update', async (data: QueueUpdateEvent) => {
      if (socket.user?.role !== 'admin') {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }
      
      try {
        await this.handleQueueUpdate(socket, data);
      } catch (error) {
        logError('Error handling queue update', error as Error);
        socket.emit('error', { message: 'Failed to update queue' });
      }
    });

    // Evento de actualización de puntos
    socket.on('points:update', async (data: PointsUpdateEvent) => {
      try {
        await this.handlePointsUpdate(socket, data);
      } catch (error) {
        logError('Error handling points update', error as Error);
        socket.emit('error', { message: 'Failed to update points' });
      }
    });

    // Evento de ping para mantener conexión
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Evento de unirse a sala específica
    socket.on('join:room', (roomName: string) => {
      if (this.isValidRoom(roomName, socket)) {
        socket.join(roomName);
        socket.emit('room:joined', { room: roomName });
      } else {
        socket.emit('error', { message: 'Invalid room' });
      }
    });

    // Evento de salir de sala específica
    socket.on('leave:room', (roomName: string) => {
      socket.leave(roomName);
      socket.emit('room:left', { room: roomName });
    });
  }

  // Manejar solicitud de canción
  private async handleSongRequest(socket: AuthenticatedSocket, data: SongRequestEvent): Promise<void> {
    const event: SocketEvent = {
      type: 'song:request',
      data,
      timestamp: new Date(),
      userId: socket.user!.userId,
      barId: socket.barId!
    };

    // Emitir a todos los usuarios del bar
    this.io.to(`bar:${socket.barId}`).emit('song:requested', event);
    
    // Emitir específicamente a admins
    this.io.to(`admin:${socket.barId}`).emit('admin:song:requested', event);
    
    logInfo(`Song requested: ${data.payload?.queueItem?.songId || 'unknown'} by user: ${socket.user!.userId}`);
  }

  // Manejar actualización de cola
  private async handleQueueUpdate(socket: AuthenticatedSocket, data: QueueUpdateEvent): Promise<void> {
    const event: SocketEvent = {
      type: 'queue:update',
      data,
      timestamp: new Date(),
      userId: socket.user!.userId,
      barId: socket.barId!
    };

    // Emitir a todos los usuarios del bar
    this.io.to(`bar:${socket.barId}`).emit('queue:updated', event);
    
    logInfo(`Queue updated by admin: ${socket.user!.userId}`);
  }

  // Manejar actualización de puntos
  private async handlePointsUpdate(socket: AuthenticatedSocket, data: PointsUpdateEvent): Promise<void> {
    const event: SocketEvent = {
      type: 'points:update',
      data,
      timestamp: new Date(),
      userId: socket.user!.userId,
      barId: socket.barId!
    };

    // Emitir solo al usuario específico
    if (data.userId) {
      const targetSocketId = this.userSockets.get(data.userId);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit('points:updated', event);
      }
    }
    
    logInfo(`Points updated for user: ${data.userId}`);
  }

  // Validar si una sala es válida para el socket
  private isValidRoom(roomName: string, socket: AuthenticatedSocket): boolean {
    const { user, barId, tableId } = socket;
    
    // Salas permitidas para todos
    if (roomName === `bar:${barId}`) return true;
    
    // Salas de admin solo para admins
    if (roomName.startsWith('admin:') && user?.role === 'admin') {
      return roomName === `admin:${barId}`;
    }
    
    // Salas de mesa solo para sesiones de mesa
    if (roomName.startsWith('table:') && socket.isTableSession) {
      return roomName === `table:${tableId}`;
    }
    
    return false;
  }

  // Registrar conexión
  private registerConnection(barId: string, socketId: string, userId: string): void {
    if (!this.connectedUsers.has(barId)) {
      this.connectedUsers.set(barId, new Set());
    }
    
    this.connectedUsers.get(barId)!.add(socketId);
    this.userSockets.set(userId, socketId);
  }

  // Manejar desconexión
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const { user, barId } = socket;
    
    if (user && barId) {
      logInfo(`User disconnected: ${user.userId} from bar: ${barId}`);
      
      // Limpiar registros
      this.connectedUsers.get(barId)?.delete(socket.id);
      this.userSockets.delete(user.userId);
      
      // Si no quedan conexiones para este bar, limpiar
      if (this.connectedUsers.get(barId)?.size === 0) {
        this.connectedUsers.delete(barId);
      }
    }
  }

  // Métodos públicos para emitir eventos

  // Emitir a todos los usuarios de un bar
  public emitToBar(barId: string, event: string, data: any): void {
    this.io.to(`bar:${barId}`).emit(event, data);
  }

  // Emitir a todos los admins de un bar
  public emitToAdmins(barId: string, event: string, data: any): void {
    this.io.to(`admin:${barId}`).emit(event, data);
  }

  // Emitir a una mesa específica
  public emitToTable(tableId: string, event: string, data: any): void {
    this.io.to(`table:${tableId}`).emit(event, data);
  }

  // Emitir a un usuario específico
  public emitToUser(userId: string, event: string, data: any): void {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Obtener estadísticas de conexiones
  public getConnectionStats(): { totalConnections: number; barConnections: Record<string, number> } {
    const barConnections: Record<string, number> = {};
    let totalConnections = 0;

    for (const [barId, connections] of this.connectedUsers.entries()) {
      barConnections[barId] = connections.size;
      totalConnections += connections.size;
    }

    return { totalConnections, barConnections };
  }

  // Obtener instancia de Socket.IO
  public getIO(): SocketIOServer {
    return this.io;
  }

  // Cerrar todas las conexiones
  public async close(): Promise<void> {
    this.io.close();
    logInfo('Socket.IO server closed');
  }
}

// Instancia global del socket manager
let socketManager: SocketManager | null = null;

// Inicializar Socket Manager
export const initSocketManager = (server: HttpServer): SocketManager => {
  if (!socketManager) {
    socketManager = new SocketManager(server);
    logInfo('Socket Manager initialized');
  }
  return socketManager;
};

// Obtener Socket Manager
export const getSocketManager = (): SocketManager => {
  if (!socketManager) {
    throw new Error('Socket Manager not initialized. Call initSocketManager() first.');
  }
  return socketManager;
};

// Utilidades para eventos específicos
export const emitQueueUpdate = (barId: string, queueData: any): void => {
  const manager = getSocketManager();
  manager.emitToBar(barId, 'queue:updated', {
    type: 'queue:update',
    data: queueData,
    timestamp: new Date()
  });
};

export const emitSongApproved = (barId: string, songData: any): void => {
  const manager = getSocketManager();
  manager.emitToBar(barId, 'song:approved', {
    type: 'song:approved',
    data: songData,
    timestamp: new Date()
  });
};

export const emitSongRejected = (barId: string, songData: any): void => {
  const manager = getSocketManager();
  manager.emitToBar(barId, 'song:rejected', {
    type: 'song:rejected',
    data: songData,
    timestamp: new Date()
  });
};

export const emitPointsUpdated = (userId: string, pointsData: any): void => {
  const manager = getSocketManager();
  manager.emitToUser(userId, 'points:updated', {
    type: 'points:update',
    data: pointsData,
    timestamp: new Date()
  });
};

export const emitMenuUpdated = (barId: string, menuData: any): void => {
  const manager = getSocketManager();
  manager.emitToBar(barId, 'menu:updated', {
    type: 'menu:update',
    data: menuData,
    timestamp: new Date()
  });
};