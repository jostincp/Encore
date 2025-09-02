import { BaseEntity, FilterParams, TimeInterval, AggregationType, MetricType } from './common';

// Analytics Types
export interface AnalyticsData extends BaseEntity {
  barId: string;
  userId?: string;
  metricType: MetricType;
  metricName: string;
  value: number;
  dimensions: Record<string, any>;
  timestamp: Date;
  aggregatedAt?: Date;
}

export interface AnalyticsQuery extends FilterParams {
  metrics: string[];
  dimensions?: string[];
  aggregation?: AggregationType;
  interval?: TimeInterval;
  groupBy?: string[];
}

export interface AnalyticsResult {
  metric: string;
  value: number;
  dimensions: Record<string, any>;
  timestamp: Date;
  aggregation: AggregationType;
  interval?: TimeInterval;
}

export interface PaginatedAnalyticsResult {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalSongs: number;
  songsPlayed: number;
  totalOrders: number;
  revenue: number;
  averageOrderValue: number;
  topSongs: TopSong[];
  topArtists: TopArtist[];
  userActivity: UserActivityMetric[];
  revenueByHour: RevenueMetric[];
  popularCategories: CategoryMetric[];
}

export interface TopSong {
  songId: string;
  title: string;
  artist: string;
  playCount: number;
  requestCount: number;
  likeCount: number;
  skipCount: number;
}

export interface TopArtist {
  artist: string;
  playCount: number;
  songCount: number;
  likeCount: number;
  skipCount: number;
}

export interface UserActivityMetric {
  timestamp: Date;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
}

export interface RevenueMetric {
  timestamp: Date;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface CategoryMetric {
  category: string;
  orderCount: number;
  revenue: number;
  itemCount: number;
}

export interface TrendingMetrics {
  songs: TrendingSong[];
  artists: TrendingArtist[];
  genres: TrendingGenre[];
  menuItems: TrendingMenuItem[];
}

export interface TrendingSong {
  songId: string;
  title: string;
  artist: string;
  genre?: string;
  currentRank: number;
  previousRank?: number;
  rankChange: number;
  playCount: number;
  requestCount: number;
  trendScore: number;
}

export interface TrendingArtist {
  artist: string;
  currentRank: number;
  previousRank?: number;
  rankChange: number;
  playCount: number;
  songCount: number;
  trendScore: number;
}

export interface TrendingGenre {
  genre: string;
  currentRank: number;
  previousRank?: number;
  rankChange: number;
  playCount: number;
  songCount: number;
  trendScore: number;
}

export interface TrendingMenuItem {
  menuItemId: string;
  name: string;
  category: string;
  currentRank: number;
  previousRank?: number;
  rankChange: number;
  orderCount: number;
  revenue: number;
  trendScore: number;
}

export interface RealTimeMetrics {
  timestamp: Date;
  activeUsers: number;
  currentSong?: {
    songId: string;
    title: string;
    artist: string;
    startedAt: Date;
    duration: number;
  };
  queueLength: number;
  ongoingOrders: number;
  revenue: {
    today: number;
    thisHour: number;
  };
  topRequests: {
    songId: string;
    title: string;
    artist: string;
    requestCount: number;
  }[];
}

export interface AnalyticsFilter {
  barId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  metricTypes?: MetricType[];
  metricNames?: string[];
  dimensions?: Record<string, any>;
}

export interface AnalyticsAggregation {
  field: string;
  operation: AggregationType;
  groupBy?: string[];
  interval?: TimeInterval;
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  dimensions: string[];
  aggregations: AggregationType[];
  retention: {
    raw: number; // days
    aggregated: number; // days
  };
}

export interface AnalyticsConfig {
  metrics: MetricDefinition[];
  aggregationIntervals: TimeInterval[];
  retentionPolicies: {
    raw: number;
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
  realTimeEnabled: boolean;
  batchSize: number;
  processingInterval: number;
}

export interface UserBehaviorAnalytics {
  userId: string;
  barId: string;
  sessionCount: number;
  totalTimeSpent: number; // minutes
  averageSessionDuration: number; // minutes
  songsRequested: number;
  songsLiked: number;
  songsSkipped: number;
  ordersPlaced: number;
  totalSpent: number;
  favoriteGenres: string[];
  favoriteArtists: string[];
  peakActivityHours: number[];
  lastActivity: Date;
  loyaltyScore: number;
}

export interface BarPerformanceAnalytics {
  barId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    uniqueCustomers: number;
    averageOrderValue: number;
    customerRetentionRate: number;
    songPlayCount: number;
    songRequestCount: number;
    averageWaitTime: number; // minutes
    peakHours: {
      hour: number;
      orderCount: number;
      revenue: number;
    }[];
    topPerformingItems: {
      menuItemId: string;
      name: string;
      orderCount: number;
      revenue: number;
    }[];
    musicEngagement: {
      totalPlays: number;
      totalRequests: number;
      totalLikes: number;
      totalSkips: number;
      engagementRate: number;
    };
  };
}

export interface PredictiveAnalytics {
  barId: string;
  predictions: {
    nextHourRevenue: number;
    nextHourOrders: number;
    peakTimeToday: {
      hour: number;
      confidence: number;
    };
    recommendedStaffing: number;
    inventoryAlerts: {
      menuItemId: string;
      name: string;
      predictedDemand: number;
      currentStock?: number;
      recommendedRestock: number;
    }[];
    musicRecommendations: {
      songId: string;
      title: string;
      artist: string;
      predictedPopularity: number;
      reason: string;
    }[];
  };
  confidence: number;
  generatedAt: Date;
}

export interface AnalyticsExport {
  id: string;
  barId: string;
  userId: string;
  query: AnalyticsQuery;
  format: 'json' | 'csv' | 'excel' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
  requestedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

// Additional types for controller compatibility
export interface AnalyticsFilters {
  barId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  sessionId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  dimensions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AggregationOptions {
  barId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: string;
  metrics?: string[];
  field?: string;
  operation?: AggregationType;
  interval?: TimeInterval;
  filters?: Record<string, any>;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  dimensions?: Record<string, any>;
  metadata?: Record<string, any>;
}