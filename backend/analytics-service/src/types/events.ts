import { BaseEntity, EventType } from './common';

// Event Types
export interface BaseEvent extends BaseEntity {
  eventType: EventType;
  barId: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  processed: boolean;
  processedAt?: Date;
}

// Music Events
export interface SongPlayEvent extends BaseEvent {
  eventType: 'song_play';
  songId: string;
  title: string;
  artist: string;
  genre?: string;
  duration: number;
  playedDuration?: number;
  source: 'queue' | 'auto' | 'dj';
  queuePosition?: number;
}

export interface SongRequestEvent extends BaseEvent {
  eventType: 'song_request';
  songId: string;
  title: string;
  artist: string;
  genre?: string;
  requestedBy: string;
  priority: number;
  cost?: number;
  approved: boolean;
  queuePosition?: number;
}

export interface SongLikeEvent extends BaseEvent {
  eventType: 'song_like';
  songId: string;
  title: string;
  artist: string;
  liked: boolean;
}

export interface SongSkipEvent extends BaseEvent {
  eventType: 'song_skip';
  songId: string;
  title: string;
  artist: string;
  playedDuration: number;
  totalDuration: number;
  skipReason?: 'user_request' | 'auto_skip' | 'dj_skip';
  skipCount: number;
}

export interface PlaylistChangeEvent extends BaseEvent {
  eventType: 'playlist_change';
  playlistId: string;
  action: 'add' | 'remove' | 'reorder';
  songId?: string;
  position?: number;
  previousPosition?: number;
}

// User Events
export interface UserJoinEvent extends BaseEvent {
  eventType: 'user_join';
  userType: 'customer' | 'staff' | 'dj';
  deviceInfo?: {
    type: string;
    os: string;
    browser?: string;
  };
  location?: {
    table?: string;
    area?: string;
  };
}

export interface UserLeaveEvent extends BaseEvent {
  eventType: 'user_leave';
  sessionDuration: number;
  actionsPerformed: number;
  songsRequested: number;
  ordersPlaced: number;
}

export interface UserActionEvent extends BaseEvent {
  eventType: 'user_action';
  action: string;
  target?: string;
  details: Record<string, any>;
}

// Order Events
export interface OrderCreateEvent extends BaseEvent {
  eventType: 'order_create';
  orderId: string;
  items: {
    menuItemId: string;
    name: string;
    category: string;
    quantity: number;
    price: number;
    customizations?: Record<string, any>;
  }[];
  totalAmount: number;
  paymentMethod?: string;
  tableNumber?: string;
  specialInstructions?: string;
}

export interface OrderUpdateEvent extends BaseEvent {
  eventType: 'order_update';
  orderId: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  previousStatus: string;
  estimatedTime?: number;
  actualTime?: number;
}

export interface OrderCompleteEvent extends BaseEvent {
  eventType: 'order_complete';
  orderId: string;
  totalAmount: number;
  paymentMethod: string;
  preparationTime: number;
  deliveryTime: number;
  customerSatisfaction?: number;
  tip?: number;
}

export interface PaymentEvent extends BaseEvent {
  eventType: 'payment';
  orderId: string;
  amount: number;
  method: 'cash' | 'card' | 'digital' | 'split';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  tip?: number;
  currency: string;
}

// Menu Events
export interface MenuItemViewEvent extends BaseEvent {
  eventType: 'menu_item_view';
  menuItemId: string;
  name: string;
  category: string;
  price: number;
  viewDuration?: number;
}

export interface MenuItemOrderEvent extends BaseEvent {
  eventType: 'menu_item_order';
  menuItemId: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  customizations?: Record<string, any>;
  orderId: string;
}

export interface MenuSearchEvent extends BaseEvent {
  eventType: 'menu_search';
  query: string;
  resultsCount: number;
  selectedItem?: string;
  searchDuration?: number;
}

// System Events
export interface SystemErrorEvent extends BaseEvent {
  eventType: 'system_error';
  errorType: string;
  errorMessage: string;
  errorCode?: string;
  stackTrace?: string;
  affectedFeature: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemPerformanceEvent extends BaseEvent {
  eventType: 'system_performance';
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    activeConnections: number;
    queueSize: number;
  };
  thresholds: {
    cpuThreshold: number;
    memoryThreshold: number;
    latencyThreshold: number;
  };
}

export interface ApiRequestEvent extends BaseEvent {
  eventType: 'api_request';
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize?: number;
  responseSize?: number;
  userAgent?: string;
  ipAddress?: string;
}

// Queue Events
export interface QueueUpdateEvent extends BaseEvent {
  eventType: 'queue_update';
  action: 'add' | 'remove' | 'reorder' | 'clear';
  songId?: string;
  position?: number;
  previousPosition?: number;
  queueLength: number;
  estimatedWaitTime?: number;
}

export interface QueueVoteEvent extends BaseEvent {
  eventType: 'queue_vote';
  songId: string;
  voteType: 'up' | 'down';
  currentVotes: number;
  position: number;
  newPosition?: number;
}

// Notification Events
export interface NotificationEvent extends BaseEvent {
  eventType: 'notification';
  notificationType: 'order_ready' | 'song_playing' | 'promotion' | 'system_alert';
  title: string;
  message: string;
  targetUsers?: string[];
  channels: ('push' | 'email' | 'sms' | 'in_app')[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  delivered: boolean;
  deliveredAt?: Date;
}

// Promotion Events
export interface PromotionEvent extends BaseEvent {
  eventType: 'promotion';
  promotionId: string;
  promotionType: 'discount' | 'free_item' | 'happy_hour' | 'loyalty_reward';
  action: 'view' | 'apply' | 'redeem' | 'expire';
  discountAmount?: number;
  discountPercentage?: number;
  minimumOrder?: number;
  validUntil?: Date;
}

// Social Events
export interface SocialShareEvent extends BaseEvent {
  eventType: 'social_share';
  platform: 'facebook' | 'twitter' | 'instagram' | 'whatsapp' | 'other';
  contentType: 'song' | 'menu_item' | 'experience' | 'promotion';
  contentId: string;
  contentTitle?: string;
}

export interface ReviewEvent extends BaseEvent {
  eventType: 'review';
  reviewType: 'bar' | 'song' | 'menu_item' | 'service';
  targetId: string;
  rating: number;
  comment?: string;
  tags?: string[];
}

// Union type for all events
export type AnalyticsEvent = 
  | SongPlayEvent
  | SongRequestEvent
  | SongLikeEvent
  | SongSkipEvent
  | PlaylistChangeEvent
  | UserJoinEvent
  | UserLeaveEvent
  | UserActionEvent
  | OrderCreateEvent
  | OrderUpdateEvent
  | OrderCompleteEvent
  | PaymentEvent
  | MenuItemViewEvent
  | MenuItemOrderEvent
  | MenuSearchEvent
  | SystemErrorEvent
  | SystemPerformanceEvent
  | ApiRequestEvent
  | QueueUpdateEvent
  | QueueVoteEvent
  | NotificationEvent
  | PromotionEvent
  | SocialShareEvent
  | ReviewEvent;

// Event processing types
export interface EventBatch {
  id: string;
  events: AnalyticsEvent[];
  batchSize: number;
  createdAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface EventProcessor {
  eventType: EventType;
  handler: (event: AnalyticsEvent) => Promise<void>;
  batchSize?: number;
  processingInterval?: number;
  retryAttempts?: number;
  enabled: boolean;
}

export interface EventMetrics {
  eventType: EventType;
  count: number;
  avgProcessingTime: number;
  errorRate: number;
  lastProcessed: Date;
  throughput: number;
}

export interface EventFilter {
  eventTypes?: EventType[];
  barId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  processed?: boolean;
  metadata?: Record<string, any>;
}

export interface EventAggregation {
  eventType: EventType;
  count: number;
  uniqueUsers: number;
  uniqueBars: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  aggregatedAt: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  dimensions?: Record<string, any>;
  metadata?: Record<string, any>;
}

// Additional types for events controller compatibility
export interface EventFilters {
  barId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  sessionId?: string;
  status?: 'pending' | 'processing' | 'processed' | 'failed' | 'skipped';
  processed?: boolean;
}

export interface EventQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeMetadata?: boolean;
}

export interface ProcessingOptions {
  batchSize?: number;
  maxConcurrency?: number;
  forceReprocess?: boolean;
  generateAnalytics?: boolean;
  updateRealTime?: boolean;
  notifyWebSocket?: boolean;
  timeout?: number;
  parallel_workers?: number;
  max_retries?: number;
}