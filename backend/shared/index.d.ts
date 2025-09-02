export * from './types';
export * from './config';
export * from './utils/logger';
export * from './utils/validation';
export * from './utils/errors';
export * from './utils/database';
export * from './utils/jwt';
export * from './utils/redis';
export * from './utils/socket';
export * from './middleware';
export { cacheService, sessionService, rateLimitService, CacheService, SessionService, RateLimitService } from './utils/redis';
export { SocketManager, initSocketManager, getSocketManager, emitQueueUpdate, emitSongApproved, emitSongRejected, emitPointsUpdated, emitMenuUpdated } from './utils/socket';
export declare const CONSTANTS: {
    USER_ROLES: {
        ADMIN: "admin";
        CUSTOMER: "customer";
    };
    QUEUE_STATUS: {
        PENDING: "pending";
        APPROVED: "approved";
        REJECTED: "rejected";
        PLAYING: "playing";
        PLAYED: "played";
    };
    ORDER_STATUS: {
        PENDING: "pending";
        CONFIRMED: "confirmed";
        PREPARING: "preparing";
        READY: "ready";
        DELIVERED: "delivered";
        CANCELLED: "cancelled";
    };
    POINTS_TRANSACTION_TYPES: {
        EARNED: "earned";
        SPENT: "spent";
        BONUS: "bonus";
        REFUND: "refund";
    };
    ANALYTICS_EVENT_TYPES: {
        SONG_REQUEST: "song_request";
        SONG_PLAY: "song_play";
        ORDER_PLACED: "order_placed";
        POINTS_EARNED: "points_earned";
        POINTS_SPENT: "points_spent";
        USER_LOGIN: "user_login";
        USER_REGISTER: "user_register";
        TABLE_SESSION_START: "table_session_start";
        TABLE_SESSION_END: "table_session_end";
    };
    LIMITS: {
        MAX_QUEUE_SIZE: number;
        MAX_SONG_REQUESTS_PER_USER: number;
        MAX_ORDER_ITEMS: number;
        MAX_POINTS_PER_TRANSACTION: number;
        MIN_POINTS_FOR_PRIORITY: number;
        SESSION_DURATION_HOURS: number;
    };
    CACHE_TTL: {
        USER_DATA: number;
        BAR_DATA: number;
        MENU_DATA: number;
        SONG_DATA: number;
        QUEUE_DATA: number;
        ANALYTICS_DATA: number;
        POINTS_DATA: number;
    };
    SOCKET_EVENTS: {
        SONG_REQUEST: string;
        SONG_APPROVED: string;
        SONG_REJECTED: string;
        QUEUE_UPDATE: string;
        QUEUE_UPDATED: string;
        POINTS_UPDATE: string;
        POINTS_UPDATED: string;
        MENU_UPDATE: string;
        MENU_UPDATED: string;
        ORDER_PLACED: string;
        ORDER_STATUS_CHANGED: string;
        USER_JOINED: string;
        USER_LEFT: string;
        ADMIN_MESSAGE: string;
        SYSTEM_NOTIFICATION: string;
    };
    HTTP_STATUS: {
        OK: number;
        CREATED: number;
        NO_CONTENT: number;
        BAD_REQUEST: number;
        UNAUTHORIZED: number;
        FORBIDDEN: number;
        NOT_FOUND: number;
        CONFLICT: number;
        UNPROCESSABLE_ENTITY: number;
        TOO_MANY_REQUESTS: number;
        INTERNAL_SERVER_ERROR: number;
        SERVICE_UNAVAILABLE: number;
    };
    VALIDATION_PATTERNS: {
        EMAIL: RegExp;
        UUID: RegExp;
        PHONE: RegExp;
        PASSWORD: RegExp;
        YOUTUBE_VIDEO_ID: RegExp;
        SPOTIFY_TRACK_ID: RegExp;
    };
};
export declare const utils: {
    generateId: () => string;
    formatDate: (date?: Date) => string;
    sanitizeForLog: (str: string) => string;
    calculatePoints: (price: number) => number;
    isValidUUID: (uuid: string) => boolean;
    isValidEmail: (email: string) => boolean;
    generateSlug: (text: string) => string;
    formatPrice: (price: number) => string;
    calculateQueueWaitTime: (position: number, avgSongDuration?: number) => number;
    formatDuration: (seconds: number) => string;
    generateTableCode: () => string;
    isValidDateRange: (startDate: Date, endDate: Date) => boolean;
    getDayBounds: (date?: Date) => {
        start: Date;
        end: Date;
    };
    getWeekBounds: (date?: Date) => {
        start: Date;
        end: Date;
    };
    getMonthBounds: (date?: Date) => {
        start: Date;
        end: Date;
    };
};
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
}[Keys];
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type ID = string;
export type Timestamp = Date;
export declare const initSharedServices: () => Promise<void>;
export declare const cleanupSharedServices: () => Promise<void>;
//# sourceMappingURL=index.d.ts.map