// Exportar tipos
export * from './types';

// Exportar configuración
export * from './config';

// Exportar utilidades
export * from './utils/logger';
export * from './utils/validation';
export * from './utils/secrets';
export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
  sendSuccess,
  sendError,
  sendValidationError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleUncaughtExceptions,
  throwValidationError
} from './utils/errors';
export * from './utils/jwt';
export * from './utils/redis';
export * from './utils/socket';

// Exportar funciones específicas
export { logInfo, logError } from './utils/logger';
export { closeRedis, initRedis } from './utils/redis';

// Exportar middleware
export * from './middleware';

// Exportar servicios principales
export {
  getCacheService,
  getSessionService,
  getRateLimitService,
  CacheService,
  SessionService,
  RateLimitService,
  initRedis,
  closeRedis
} from './utils/redis';

// Mantener compatibilidad con las exportaciones anteriores
export const cacheService = {
  get: () => getCacheService()
};
export const sessionService = {
  get: () => getSessionService()
};
export const rateLimitService = {
  get: () => getRateLimitService()
};

export {
  SocketManager,
  initSocketManager,
  getSocketManager,
  emitQueueUpdate,
  emitSongApproved,
  emitSongRejected,
  emitPointsUpdated,
  emitMenuUpdated
} from './utils/socket';

// Constantes útiles
export const CONSTANTS = {
  // Roles de usuario
  USER_ROLES: {
    ADMIN: 'admin' as const,
    BAR_OWNER: 'bar_owner' as const,
    STAFF: 'staff' as const,
    USER: 'user' as const,
    GUEST: 'guest' as const
  },
  
  // Estados de cola
  QUEUE_STATUS: {
    PENDING: 'pending' as const,
    APPROVED: 'approved' as const,
    REJECTED: 'rejected' as const,
    PLAYING: 'playing' as const,
    PLAYED: 'played' as const
  },
  
  // Estados de pedidos
  ORDER_STATUS: {
    PENDING: 'pending' as const,
    CONFIRMED: 'confirmed' as const,
    PREPARING: 'preparing' as const,
    READY: 'ready' as const,
    DELIVERED: 'delivered' as const,
    CANCELLED: 'cancelled' as const
  },
  
  // Tipos de transacciones de puntos
  POINTS_TRANSACTION_TYPES: {
    EARNED: 'earned' as const,
    SPENT: 'spent' as const,
    BONUS: 'bonus' as const,
    REFUND: 'refund' as const
  },
  
  // Tipos de eventos de analíticas
  ANALYTICS_EVENT_TYPES: {
    SONG_REQUEST: 'song_request' as const,
    SONG_PLAY: 'song_play' as const,
    ORDER_PLACED: 'order_placed' as const,
    POINTS_EARNED: 'points_earned' as const,
    POINTS_SPENT: 'points_spent' as const,
    USER_LOGIN: 'user_login' as const,
    USER_REGISTER: 'user_register' as const,
    TABLE_SESSION_START: 'table_session_start' as const,
    TABLE_SESSION_END: 'table_session_end' as const
  },
  
  // Límites de la aplicación
  LIMITS: {
    MAX_QUEUE_SIZE: 50,
    MAX_SONG_REQUESTS_PER_USER: 5,
    MAX_ORDER_ITEMS: 20,
    MAX_POINTS_PER_TRANSACTION: 10000,
    MIN_POINTS_FOR_PRIORITY: 100,
    SESSION_DURATION_HOURS: 12
  },
  
  // Configuraciones de caché (TTL en segundos)
  CACHE_TTL: {
    USER_DATA: 3600, // 1 hora
    BAR_DATA: 7200, // 2 horas
    MENU_DATA: 1800, // 30 minutos
    SONG_DATA: 86400, // 24 horas
    QUEUE_DATA: 300, // 5 minutos
    ANALYTICS_DATA: 1800, // 30 minutos
    POINTS_DATA: 600 // 10 minutos
  },
  
  // Configuraciones de Socket.IO
  SOCKET_EVENTS: {
    // Eventos de cola
    SONG_REQUEST: 'song:request',
    SONG_APPROVED: 'song:approved',
    SONG_REJECTED: 'song:rejected',
    QUEUE_UPDATE: 'queue:update',
    QUEUE_UPDATED: 'queue:updated',
    
    // Eventos de puntos
    POINTS_UPDATE: 'points:update',
    POINTS_UPDATED: 'points:updated',
    
    // Eventos de menú
    MENU_UPDATE: 'menu:update',
    MENU_UPDATED: 'menu:updated',
    
    // Eventos de pedidos
    ORDER_PLACED: 'order:placed',
    ORDER_STATUS_CHANGED: 'order:status_changed',
    
    // Eventos de sistema
    USER_JOINED: 'user:joined',
    USER_LEFT: 'user:left',
    ADMIN_MESSAGE: 'admin:message',
    SYSTEM_NOTIFICATION: 'system:notification'
  },
  
  // Códigos de error HTTP
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
  
  // Patrones de validación
  VALIDATION_PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    PHONE: /^\+?[1-9]\d{1,14}$/,
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    YOUTUBE_VIDEO_ID: /^[a-zA-Z0-9_-]{11}$/,
    SPOTIFY_TRACK_ID: /^[0-9A-Za-z]{22}$/
  }
};

// Funciones de utilidad comunes
export const utils = {
  // Generar ID único
  generateId: (): string => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },
  
  // Formatear fecha para logs
  formatDate: (date: Date = new Date()): string => {
    return date.toISOString();
  },
  
  // Sanitizar string para logs
  sanitizeForLog: (str: string): string => {
    return str.replace(/[\r\n\t]/g, ' ').trim();
  },
  
  // Calcular puntos basados en precio
  calculatePoints: (price: number): number => {
    return Math.floor(price * 0.1); // 10% del precio en puntos
  },
  
  // Validar si es un UUID válido
  isValidUUID: (uuid: string): boolean => {
    return CONSTANTS.VALIDATION_PATTERNS.UUID.test(uuid);
  },
  
  // Validar si es un email válido
  isValidEmail: (email: string): boolean => {
    return CONSTANTS.VALIDATION_PATTERNS.EMAIL.test(email);
  },
  
  // Generar slug desde texto
  generateSlug: (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  },
  
  // Formatear precio
  formatPrice: (price: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  },
  
  // Calcular tiempo estimado de espera en cola
  calculateQueueWaitTime: (position: number, avgSongDuration: number = 210): number => {
    return position * avgSongDuration; // en segundos
  },
  
  // Formatear duración en formato legible
  formatDuration: (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  },
  
  // Generar código de mesa aleatorio
  generateTableCode: (): string => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },
  
  // Validar rango de fechas
  isValidDateRange: (startDate: Date, endDate: Date): boolean => {
    return startDate < endDate && startDate <= new Date();
  },
  
  // Obtener inicio y fin del día
  getDayBounds: (date: Date = new Date()) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  },
  
  // Obtener inicio y fin de la semana
  getWeekBounds: (date: Date = new Date()) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Lunes como primer día
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  },
  
  // Obtener inicio y fin del mes
  getMonthBounds: (date: Date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return { start, end };
  }
};

// Tipos de utilidad para TypeScript
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys];

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type ID = string;
export type Timestamp = Date;

// Función de inicialización para servicios compartidos
export const initSharedServices = async (): Promise<void> => {
  const { logInfo, logError } = await import('./utils/logger');
  const { initRedis } = await import('./utils/redis');
  
  try {
    // Inicializar Redis
    await initRedis();
    logInfo('Shared services initialized successfully');
  } catch (error) {
    logError('Failed to initialize shared services', error as Error);
    throw error;
  }
};

// Función de limpieza para servicios compartidos
export const cleanupSharedServices = async (): Promise<void> => {
  const { logInfo, logError } = await import('./utils/logger');
  const { closeRedis } = await import('./utils/redis');
  
  try {
    await closeRedis();
    logInfo('Shared services cleaned up successfully');
  } catch (error) {
    logError('Error during shared services cleanup', error as Error);
  }
};