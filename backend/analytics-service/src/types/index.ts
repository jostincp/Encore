import { Request } from 'express';
import { UserRole } from './common';

// Base interfaces
export interface User {
  id: string;
  email: string;
  role: UserRole;
  bar_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  rateLimit?: {
    limit: number;
    current: number;
    remaining: number;
    resetTime: Date;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Event Types
export type EventType = 
  | 'music_request' 
  | 'music_play' 
  | 'music_vote' 
  | 'music_skip'
  | 'menu_order' 
  | 'menu_view' 
  | 'menu_search'
  | 'user_register' 
  | 'user_login' 
  | 'user_logout'
  | 'points_purchase' 
  | 'points_spend'
  | 'queue_add' 
  | 'queue_remove' 
  | 'priority_play'
  | 'bar_visit'
  | 'session_start'
  | 'session_end';

// Event Data Interfaces
export interface BaseEventData {
  event_type: EventType;
  user_id?: string;
  bar_id: string;
  session_id?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MusicEventData extends BaseEventData {
  event_type: 'music_request' | 'music_play' | 'music_vote' | 'music_skip';
  song_id: string;
  song_title: string;
  artist: string;
  genre?: string;
  duration?: number;
  position_in_queue?: number;
  vote_type?: 'up' | 'down';
}

export interface MenuEventData extends BaseEventData {
  event_type: 'menu_order' | 'menu_view' | 'menu_search';
  item_id?: string;
  item_name?: string;
  category_id?: string;
  price?: number;
  quantity?: number;
  search_term?: string;
}

export interface UserEventData extends BaseEventData {
  event_type: 'user_register' | 'user_login' | 'user_logout';
  user_role?: string;
  device_type?: string;
  ip_address?: string;
}

export interface PointsEventData extends BaseEventData {
  event_type: 'points_purchase' | 'points_spend';
  amount: number;
  points_balance?: number;
  transaction_type?: string;
  item_purchased?: string;
}

export interface QueueEventData extends BaseEventData {
  event_type: 'queue_add' | 'queue_remove' | 'priority_play';
  song_id: string;
  song_title: string;
  artist: string;
  queue_position?: number;
  priority_cost?: number;
}

export type EventData = 
  | MusicEventData 
  | MenuEventData 
  | UserEventData 
  | PointsEventData 
  | QueueEventData 
  | BaseEventData;

// Analytics Interfaces
export interface AnalyticsMetric {
  id: string;
  bar_id: string;
  metric_type: string;
  metric_name: string;
  value: number;
  period: 'hour' | 'day' | 'week' | 'month';
  date: Date;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface PopularSong {
  song_id: string;
  title: string;
  artist: string;
  genre?: string;
  play_count: number;
  request_count: number;
  vote_score: number;
  last_played?: Date;
}

export interface PopularMenuItem {
  item_id: string;
  name: string;
  category: string;
  order_count: number;
  revenue: number;
  avg_rating?: number;
  last_ordered?: Date;
}

export interface UserActivity {
  user_id: string;
  bar_id: string;
  session_count: number;
  total_time: number; // in minutes
  songs_requested: number;
  items_ordered: number;
  points_spent: number;
  last_visit: Date;
}

export interface BarMetrics {
  bar_id: string;
  date: Date;
  total_visitors: number;
  total_sessions: number;
  avg_session_duration: number;
  songs_played: number;
  orders_placed: number;
  revenue: number;
  points_sold: number;
  peak_hour: number;
}

// Report Interfaces
export interface ReportFilter {
  bar_id?: string;
  start_date?: Date;
  end_date?: Date;
  event_types?: EventType[];
  user_ids?: string[];
  period?: 'hour' | 'day' | 'week' | 'month';
}

export interface ReportData {
  id: string;
  title: string;
  type: 'summary' | 'detailed' | 'trend';
  period: string;
  generated_at: Date;
  data: any;
  filters: ReportFilter;
}

// Dashboard Interfaces
export interface DashboardMetrics {
  total_events_today: number;
  active_users: number;
  popular_songs: PopularSong[];
  popular_items: PopularMenuItem[];
  revenue_today: number;
  peak_hours: { hour: number; count: number }[];
  user_activity: UserActivity[];
}

// Database Interfaces
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

// Error Classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

// Utility Functions
export const logInfo = (message: string, meta?: any): void => {
  console.log(`[INFO] ${message}`, meta || '');
};

export const logError = (message: string, error?: any): void => {
  console.error(`[ERROR] ${message}`, error || '');
};

export const logWarn = (message: string, meta?: any): void => {
  console.warn(`[WARN] ${message}`, meta || '');
};

export const logDebug = (message: string, meta?: any): void => {
  console.debug(`[DEBUG] ${message}`, meta || '');
};