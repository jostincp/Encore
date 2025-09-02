"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitMenuUpdated = exports.emitPointsUpdated = exports.emitSongRejected = exports.emitSongApproved = exports.emitQueueUpdate = exports.getSocketManager = exports.initSocketManager = exports.SocketManager = void 0;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const jwt_1 = require("./jwt");
const logger_1 = require("./logger");
const config_1 = require("../config");
const redis_1 = require("./redis");
const SOCKET_CONFIG = {
    cors: {
        origin: config_1.config.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6
};
class SocketManager {
    constructor(server) {
        this.connectedUsers = new Map();
        this.userSockets = new Map();
        this.io = new socket_io_1.Server(server, SOCKET_CONFIG);
        this.redis = (0, redis_1.getRedisClient)();
        this.setupRedisAdapter();
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    async setupRedisAdapter() {
        try {
            const pubClient = this.redis.duplicate();
            const subClient = this.redis.duplicate();
            this.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            (0, logger_1.logInfo)('Socket.IO Redis adapter configured');
        }
        catch (error) {
            (0, logger_1.logError)('Failed to setup Socket.IO Redis adapter', error);
        }
    }
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
                if (!token) {
                    return next(new Error('Authentication token required'));
                }
                try {
                    const user = (0, jwt_1.verifyToken)(token);
                    socket.user = user;
                    socket.barId = user.barId;
                    socket.isTableSession = false;
                }
                catch (userTokenError) {
                    try {
                        const tableSession = (0, jwt_1.verifyTableSessionToken)(token);
                        socket.tableId = tableSession.tableId;
                        socket.barId = tableSession.barId;
                        socket.isTableSession = true;
                        socket.user = {
                            userId: `table_${tableSession.tableId}`,
                            email: '',
                            role: 'customer',
                            barId: tableSession.barId
                        };
                    }
                    catch (tableTokenError) {
                        return next(new Error('Invalid authentication token'));
                    }
                }
                (0, logger_1.logInfo)(`Socket authenticated: ${socket.user.userId} (${socket.user.role})`);
                next();
            }
            catch (error) {
                (0, logger_1.logError)('Socket authentication error', error);
                next(new Error('Authentication failed'));
            }
        });
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }
    handleConnection(socket) {
        const { user, barId } = socket;
        if (!user || !barId) {
            socket.disconnect();
            return;
        }
        (0, logger_1.logInfo)(`User connected: ${user.userId} to bar: ${barId}`);
        socket.join(`bar:${barId}`);
        if (user.role === 'admin') {
            socket.join(`admin:${barId}`);
        }
        if (socket.isTableSession && socket.tableId) {
            socket.join(`table:${socket.tableId}`);
        }
        this.registerConnection(barId, socket.id, user.userId);
        this.setupSocketEventHandlers(socket);
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
    }
    setupSocketEventHandlers(socket) {
        socket.on('song:request', async (data) => {
            try {
                await this.handleSongRequest(socket, data);
            }
            catch (error) {
                (0, logger_1.logError)('Error handling song request', error);
                socket.emit('error', { message: 'Failed to process song request' });
            }
        });
        socket.on('queue:update', async (data) => {
            if (socket.user?.role !== 'admin') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }
            try {
                await this.handleQueueUpdate(socket, data);
            }
            catch (error) {
                (0, logger_1.logError)('Error handling queue update', error);
                socket.emit('error', { message: 'Failed to update queue' });
            }
        });
        socket.on('points:update', async (data) => {
            try {
                await this.handlePointsUpdate(socket, data);
            }
            catch (error) {
                (0, logger_1.logError)('Error handling points update', error);
                socket.emit('error', { message: 'Failed to update points' });
            }
        });
        socket.on('ping', () => {
            socket.emit('pong');
        });
        socket.on('join:room', (roomName) => {
            if (this.isValidRoom(roomName, socket)) {
                socket.join(roomName);
                socket.emit('room:joined', { room: roomName });
            }
            else {
                socket.emit('error', { message: 'Invalid room' });
            }
        });
        socket.on('leave:room', (roomName) => {
            socket.leave(roomName);
            socket.emit('room:left', { room: roomName });
        });
    }
    async handleSongRequest(socket, data) {
        const event = {
            type: 'song:request',
            data,
            timestamp: new Date(),
            userId: socket.user.userId,
            barId: socket.barId
        };
        this.io.to(`bar:${socket.barId}`).emit('song:requested', event);
        this.io.to(`admin:${socket.barId}`).emit('admin:song:requested', event);
        (0, logger_1.logInfo)(`Song requested: ${data.songId} by user: ${socket.user.userId}`);
    }
    async handleQueueUpdate(socket, data) {
        const event = {
            type: 'queue:update',
            data,
            timestamp: new Date(),
            userId: socket.user.userId,
            barId: socket.barId
        };
        this.io.to(`bar:${socket.barId}`).emit('queue:updated', event);
        (0, logger_1.logInfo)(`Queue updated by admin: ${socket.user.userId}`);
    }
    async handlePointsUpdate(socket, data) {
        const event = {
            type: 'points:update',
            data,
            timestamp: new Date(),
            userId: socket.user.userId,
            barId: socket.barId
        };
        if (data.userId) {
            const targetSocketId = this.userSockets.get(data.userId);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit('points:updated', event);
            }
        }
        (0, logger_1.logInfo)(`Points updated for user: ${data.userId}`);
    }
    isValidRoom(roomName, socket) {
        const { user, barId, tableId } = socket;
        if (roomName === `bar:${barId}`)
            return true;
        if (roomName.startsWith('admin:') && user?.role === 'admin') {
            return roomName === `admin:${barId}`;
        }
        if (roomName.startsWith('table:') && socket.isTableSession) {
            return roomName === `table:${tableId}`;
        }
        return false;
    }
    registerConnection(barId, socketId, userId) {
        if (!this.connectedUsers.has(barId)) {
            this.connectedUsers.set(barId, new Set());
        }
        this.connectedUsers.get(barId).add(socketId);
        this.userSockets.set(userId, socketId);
    }
    handleDisconnection(socket) {
        const { user, barId } = socket;
        if (user && barId) {
            (0, logger_1.logInfo)(`User disconnected: ${user.userId} from bar: ${barId}`);
            this.connectedUsers.get(barId)?.delete(socket.id);
            this.userSockets.delete(user.userId);
            if (this.connectedUsers.get(barId)?.size === 0) {
                this.connectedUsers.delete(barId);
            }
        }
    }
    emitToBar(barId, event, data) {
        this.io.to(`bar:${barId}`).emit(event, data);
    }
    emitToAdmins(barId, event, data) {
        this.io.to(`admin:${barId}`).emit(event, data);
    }
    emitToTable(tableId, event, data) {
        this.io.to(`table:${tableId}`).emit(event, data);
    }
    emitToUser(userId, event, data) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }
    getConnectionStats() {
        const barConnections = {};
        let totalConnections = 0;
        for (const [barId, connections] of this.connectedUsers.entries()) {
            barConnections[barId] = connections.size;
            totalConnections += connections.size;
        }
        return { totalConnections, barConnections };
    }
    getIO() {
        return this.io;
    }
    async close() {
        this.io.close();
        (0, logger_1.logInfo)('Socket.IO server closed');
    }
}
exports.SocketManager = SocketManager;
let socketManager = null;
const initSocketManager = (server) => {
    if (!socketManager) {
        socketManager = new SocketManager(server);
        (0, logger_1.logInfo)('Socket Manager initialized');
    }
    return socketManager;
};
exports.initSocketManager = initSocketManager;
const getSocketManager = () => {
    if (!socketManager) {
        throw new Error('Socket Manager not initialized. Call initSocketManager() first.');
    }
    return socketManager;
};
exports.getSocketManager = getSocketManager;
const emitQueueUpdate = (barId, queueData) => {
    const manager = (0, exports.getSocketManager)();
    manager.emitToBar(barId, 'queue:updated', {
        type: 'queue:update',
        data: queueData,
        timestamp: new Date()
    });
};
exports.emitQueueUpdate = emitQueueUpdate;
const emitSongApproved = (barId, songData) => {
    const manager = (0, exports.getSocketManager)();
    manager.emitToBar(barId, 'song:approved', {
        type: 'song:approved',
        data: songData,
        timestamp: new Date()
    });
};
exports.emitSongApproved = emitSongApproved;
const emitSongRejected = (barId, songData) => {
    const manager = (0, exports.getSocketManager)();
    manager.emitToBar(barId, 'song:rejected', {
        type: 'song:rejected',
        data: songData,
        timestamp: new Date()
    });
};
exports.emitSongRejected = emitSongRejected;
const emitPointsUpdated = (userId, pointsData) => {
    const manager = (0, exports.getSocketManager)();
    manager.emitToUser(userId, 'points:updated', {
        type: 'points:update',
        data: pointsData,
        timestamp: new Date()
    });
};
exports.emitPointsUpdated = emitPointsUpdated;
const emitMenuUpdated = (barId, menuData) => {
    const manager = (0, exports.getSocketManager)();
    manager.emitToBar(barId, 'menu:updated', {
        type: 'menu:update',
        data: menuData,
        timestamp: new Date()
    });
};
exports.emitMenuUpdated = emitMenuUpdated;
//# sourceMappingURL=socket.js.map