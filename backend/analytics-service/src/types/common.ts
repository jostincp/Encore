// Common types for the Analytics Service

// User roles enumeration
export enum UserRole {
  ADMIN = 'admin',
  BAR_OWNER = 'bar_owner',
  STAFF = 'staff',
  USER = 'user',
  GUEST = 'guest'
}

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterParams {
  startDate?: string | Date;
  endDate?: string | Date;
  barId?: string;
  userId?: string;
  [key: string]: any;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

export interface QueryParams extends PaginationParams, FilterParams {
  sort?: SortParams;
  search?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface QueueConfig {
  redis: RedisConfig;
  defaultJobOptions?: {
    removeOnComplete?: number;
    removeOnFail?: number;
    attempts?: number;
    backoff?: {
      type: string;
      delay: number;
    };
  };
}

export interface WebSocketConfig {
  enabled: boolean;
  port?: number;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
}

export interface MetricsConfig {
  enabled: boolean;
  port?: number;
  endpoint?: string;
}

export interface LoggingConfig {
  level: string;
  format: string;
  file?: {
    enabled: boolean;
    filename: string;
    maxSize: string;
    maxFiles: string;
  };
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration: string;
  bcryptRounds: number;
}

export interface CacheConfig {
  ttl: number;
  maxKeys: number;
  checkPeriod: number;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface CorsConfig {
  origin: string | string[] | boolean;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

export interface ServerConfig {
  port: number;
  host: string;
  env: string;
  requestSizeLimit: string;
}

export interface ExternalServicesConfig {
  userService: {
    baseUrl: string;
    timeout: number;
  };
  barService: {
    baseUrl: string;
    timeout: number;
  };
  musicService: {
    baseUrl: string;
    timeout: number;
  };
  menuService: {
    baseUrl: string;
    timeout: number;
  };
}

export interface FileStorageConfig {
  provider: 'local' | 's3' | 'gcs';
  local?: {
    uploadDir: string;
    maxFileSize: number;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  gcs?: {
    bucket: string;
    keyFilename: string;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  dependencies: {
    database: 'connected' | 'disconnected' | 'error';
    redis: 'connected' | 'disconnected' | 'error';
    queue: 'connected' | 'disconnected' | 'error';
    websocket: 'connected' | 'disconnected' | 'error';
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
    requestId?: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export type EventType = 
  | 'music_play'
  | 'music_request'
  | 'music_skip'
  | 'music_like'
  | 'music_dislike'
  | 'song_skip'
  | 'song_request'
  | 'song_like'
  | 'song_play'
  | 'playlist_change'
  | 'menu_view'
  | 'menu_item_view'
  | 'menu_item_order'
  | 'menu_search'
  | 'menu_order'
  | 'menu_favorite'
  | 'menu_search'
  | 'menu_item_view'
  | 'menu_item_order'
  | 'user_login'
  | 'user_logout'
  | 'user_register'
  | 'user_profile_update'
  | 'user_join'
  | 'user_leave'
  | 'user_action'
  | 'queue_join'
  | 'queue_leave'
  | 'queue_position_change'
  | 'queue_update'
  | 'queue_vote'
  | 'payment_process'
  | 'payment_complete'
  | 'payment_failed'
  | 'payment'
  | 'order_create'
  | 'order_update'
  | 'order_complete'
  | 'bar_checkin'
  | 'bar_checkout'
  | 'system_error'
  | 'system_performance'
  | 'api_request'
  | 'notification'
  | 'promotion'
  | 'social_share'
  | 'review'
  | 'custom';

export type ReportType = 
  | 'analytics'
  | 'events'
  | 'dashboard'
  | 'sales'
  | 'music'
  | 'customer'
  | 'operational'
  | 'financial'
  | 'custom';

export type ReportFormat = 
  | 'json'
  | 'csv'
  | 'pdf'
  | 'excel';

export type ReportStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type MetricType = 
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'summary';

export type AggregationType = 
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'distinct';

export type TimeInterval = 
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  barId?: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bar {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  isActive: boolean;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration: number;
  spotifyId?: string;
  youtubeId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isAvailable: boolean;
  barId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueEntry {
  id: string;
  userId: string;
  barId: string;
  songId: string;
  position: number;
  status: 'pending' | 'playing' | 'played' | 'skipped' | 'removed';
  requestedAt: Date;
  playedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  barId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'card' | 'cash' | 'digital_wallet';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  transactionId?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}