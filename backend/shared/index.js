"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupSharedServices = exports.initSharedServices = exports.utils = exports.CONSTANTS = exports.emitMenuUpdated = exports.emitPointsUpdated = exports.emitSongRejected = exports.emitSongApproved = exports.emitQueueUpdate = exports.getSocketManager = exports.initSocketManager = exports.SocketManager = exports.RateLimitService = exports.SessionService = exports.CacheService = exports.rateLimitService = exports.sessionService = exports.cacheService = void 0;
__exportStar(require("./types"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./utils/logger"), exports);
__exportStar(require("./utils/validation"), exports);
__exportStar(require("./utils/errors"), exports);
__exportStar(require("./utils/database"), exports);
__exportStar(require("./utils/jwt"), exports);
__exportStar(require("./utils/redis"), exports);
__exportStar(require("./utils/socket"), exports);
__exportStar(require("./middleware"), exports);
var redis_1 = require("./utils/redis");
Object.defineProperty(exports, "cacheService", { enumerable: true, get: function () { return redis_1.cacheService; } });
Object.defineProperty(exports, "sessionService", { enumerable: true, get: function () { return redis_1.sessionService; } });
Object.defineProperty(exports, "rateLimitService", { enumerable: true, get: function () { return redis_1.rateLimitService; } });
Object.defineProperty(exports, "CacheService", { enumerable: true, get: function () { return redis_1.CacheService; } });
Object.defineProperty(exports, "SessionService", { enumerable: true, get: function () { return redis_1.SessionService; } });
Object.defineProperty(exports, "RateLimitService", { enumerable: true, get: function () { return redis_1.RateLimitService; } });
var socket_1 = require("./utils/socket");
Object.defineProperty(exports, "SocketManager", { enumerable: true, get: function () { return socket_1.SocketManager; } });
Object.defineProperty(exports, "initSocketManager", { enumerable: true, get: function () { return socket_1.initSocketManager; } });
Object.defineProperty(exports, "getSocketManager", { enumerable: true, get: function () { return socket_1.getSocketManager; } });
Object.defineProperty(exports, "emitQueueUpdate", { enumerable: true, get: function () { return socket_1.emitQueueUpdate; } });
Object.defineProperty(exports, "emitSongApproved", { enumerable: true, get: function () { return socket_1.emitSongApproved; } });
Object.defineProperty(exports, "emitSongRejected", { enumerable: true, get: function () { return socket_1.emitSongRejected; } });
Object.defineProperty(exports, "emitPointsUpdated", { enumerable: true, get: function () { return socket_1.emitPointsUpdated; } });
Object.defineProperty(exports, "emitMenuUpdated", { enumerable: true, get: function () { return socket_1.emitMenuUpdated; } });
exports.CONSTANTS = {
    USER_ROLES: {
        ADMIN: 'admin',
        CUSTOMER: 'customer'
    },
    QUEUE_STATUS: {
        PENDING: 'pending',
        APPROVED: 'approved',
        REJECTED: 'rejected',
        PLAYING: 'playing',
        PLAYED: 'played'
    },
    ORDER_STATUS: {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        PREPARING: 'preparing',
        READY: 'ready',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled'
    },
    POINTS_TRANSACTION_TYPES: {
        EARNED: 'earned',
        SPENT: 'spent',
        BONUS: 'bonus',
        REFUND: 'refund'
    },
    ANALYTICS_EVENT_TYPES: {
        SONG_REQUEST: 'song_request',
        SONG_PLAY: 'song_play',
        ORDER_PLACED: 'order_placed',
        POINTS_EARNED: 'points_earned',
        POINTS_SPENT: 'points_spent',
        USER_LOGIN: 'user_login',
        USER_REGISTER: 'user_register',
        TABLE_SESSION_START: 'table_session_start',
        TABLE_SESSION_END: 'table_session_end'
    },
    LIMITS: {
        MAX_QUEUE_SIZE: 50,
        MAX_SONG_REQUESTS_PER_USER: 5,
        MAX_ORDER_ITEMS: 20,
        MAX_POINTS_PER_TRANSACTION: 10000,
        MIN_POINTS_FOR_PRIORITY: 100,
        SESSION_DURATION_HOURS: 12
    },
    CACHE_TTL: {
        USER_DATA: 3600,
        BAR_DATA: 7200,
        MENU_DATA: 1800,
        SONG_DATA: 86400,
        QUEUE_DATA: 300,
        ANALYTICS_DATA: 1800,
        POINTS_DATA: 600
    },
    SOCKET_EVENTS: {
        SONG_REQUEST: 'song:request',
        SONG_APPROVED: 'song:approved',
        SONG_REJECTED: 'song:rejected',
        QUEUE_UPDATE: 'queue:update',
        QUEUE_UPDATED: 'queue:updated',
        POINTS_UPDATE: 'points:update',
        POINTS_UPDATED: 'points:updated',
        MENU_UPDATE: 'menu:update',
        MENU_UPDATED: 'menu:updated',
        ORDER_PLACED: 'order:placed',
        ORDER_STATUS_CHANGED: 'order:status_changed',
        USER_JOINED: 'user:joined',
        USER_LEFT: 'user:left',
        ADMIN_MESSAGE: 'admin:message',
        SYSTEM_NOTIFICATION: 'system:notification'
    },
    HTTP_STATUS: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE_ENTITY: 422,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500,
        SERVICE_UNAVAILABLE: 503
    },
    VALIDATION_PATTERNS: {
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        PHONE: /^\+?[1-9]\d{1,14}$/,
        PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        YOUTUBE_VIDEO_ID: /^[a-zA-Z0-9_-]{11}$/,
        SPOTIFY_TRACK_ID: /^[0-9A-Za-z]{22}$/
    }
};
exports.utils = {
    generateId: () => {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    },
    formatDate: (date = new Date()) => {
        return date.toISOString();
    },
    sanitizeForLog: (str) => {
        return str.replace(/[\r\n\t]/g, ' ').trim();
    },
    calculatePoints: (price) => {
        return Math.floor(price * 0.1);
    },
    isValidUUID: (uuid) => {
        return exports.CONSTANTS.VALIDATION_PATTERNS.UUID.test(uuid);
    },
    isValidEmail: (email) => {
        return exports.CONSTANTS.VALIDATION_PATTERNS.EMAIL.test(email);
    },
    generateSlug: (text) => {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    },
    formatPrice: (price) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(price);
    },
    calculateQueueWaitTime: (position, avgSongDuration = 210) => {
        return position * avgSongDuration;
    },
    formatDuration: (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    },
    generateTableCode: () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    },
    isValidDateRange: (startDate, endDate) => {
        return startDate < endDate && startDate <= new Date();
    },
    getDayBounds: (date = new Date()) => {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    },
    getWeekBounds: (date = new Date()) => {
        const start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    },
    getMonthBounds: (date = new Date()) => {
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end };
    }
};
const initSharedServices = async () => {
    try {
        await initRedis();
        logInfo('Shared services initialized successfully');
    }
    catch (error) {
        logError('Failed to initialize shared services', error);
        throw error;
    }
};
exports.initSharedServices = initSharedServices;
const cleanupSharedServices = async () => {
    try {
        await closeRedis();
        logInfo('Shared services cleaned up successfully');
    }
    catch (error) {
        logError('Error during shared services cleanup', error);
    }
};
exports.cleanupSharedServices = cleanupSharedServices;
//# sourceMappingURL=index.js.map