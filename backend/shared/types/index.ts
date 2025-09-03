// Tipos compartidos entre microservicios

// Basic types
export type ID = string;
export type Timestamp = Date;

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface User {
  id: string;
  email: string;
  password?: string;
  role: 'admin' | 'customer';
  barId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bar {
  id: string;
  name: string;
  ownerId: string;
  address: string;
  phone?: string;
  email?: string;
  settings: BarSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface BarSettings {
  pointsPerEuro: number;
  songCostPoints: number;
  priorityPlayMultiplier: number;
  welcomeBonusPoints: number;
  musicProvider: 'youtube' | 'spotify';
  autoApproveRequests: boolean;
}

export interface Table {
  id: string;
  barId: string;
  number: number;
  qrCode: string;
  isActive: boolean;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl?: string;
  externalId: string;
  provider: 'youtube' | 'spotify';
  playUrl?: string;
}

export interface QueueItem {
  id: string;
  barId: string;
  tableId: string;
  songId: string;
  song: Song;
  requestedBy: string;
  pointsSpent: number;
  isPriority: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'playing' | 'played';
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  barId: string;
  name: string;
  description?: string;
  price: number;
  pointsReward: number;
  category: string;
  imageUrl?: string;
  model3dUrl?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  barId: string;
  tableId: string;
  items: OrderItem[];
  totalAmount: number;
  totalPointsEarned: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  pointsReward: number;
}

export interface PointsTransaction {
  id: string;
  barId: string;
  tableId: string;
  type: 'earned' | 'spent';
  amount: number;
  description: string;
  relatedOrderId?: string;
  relatedQueueItemId?: string;
  createdAt: Date;
}

export interface TableSession {
  id: string;
  tableId: string;
  barId: string;
  pointsBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsEvent {
  id: string;
  barId: string;
  eventType: 'song_request' | 'order_placed' | 'points_earned' | 'points_spent' | 'table_scan';
  eventData: Record<string, any>;
  tableId?: string;
  timestamp: Date;
}

// Tipos para respuestas de API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tipos para WebSocket events
export interface SocketEvent {
  type: string;
  data?: any;
  payload?: any;
  barId: string;
  tableId?: string;
  userId?: string;
  timestamp?: Date;
}

export interface QueueUpdateEvent extends SocketEvent {
  type: 'queue_updated';
  payload: {
    queue: QueueItem[];
    currentSong?: QueueItem;
  };
}

export interface SongRequestEvent extends SocketEvent {
  type: 'song_requested';
  payload: {
    queueItem: QueueItem;
  };
}

export interface PointsUpdateEvent extends SocketEvent {
  type: 'points_updated';
  userId?: string;
  payload: {
    pointsBalance: number;
    transaction: PointsTransaction;
  };
}

// Tipos para configuración de servicios
export interface ServiceConfig {
  port: number;
  dbUrl: string;
  redisUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
}

export interface MusicServiceConfig extends ServiceConfig {
  youtubeApiKey?: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
}

export interface PaymentServiceConfig extends ServiceConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}

// Tipos para validación
export interface ValidationError {
  name: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}