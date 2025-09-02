/**
 * =============================================================================
 * MusicBar Analytics Service - Analytics Service
 * =============================================================================
 * Description: Business logic for analytics and metrics management
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Analytics, IAnalyticsDocument } from '../models/Analytics';
import { Event, IEvent } from '../models/Event';
import { AnalyticsFilter, PaginatedAnalyticsResult } from '../types/analytics';
import { MetricType } from '../types/common';
import { logger } from '../utils/logger';
import { CacheManager } from '../utils/cache';

// Create a simple cache implementation for now
const cache = {
  async get<T>(key: string): Promise<T | null> {
    // Simple memory cache or return null for now
    return null;
  },
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Simple memory cache implementation or no-op for now
  },
  async setex(key: string, ttl: number, value: string): Promise<void> {
    // Simple memory cache implementation or no-op for now
  },
  async del(key: string): Promise<void> {
    // Simple memory cache implementation or no-op for now
  },
  async deletePattern(pattern: string): Promise<void> {
    // Simple memory cache implementation or no-op for now
  },
  async ping(): Promise<string> {
    // Simple memory cache implementation - return 'PONG' for now
    return 'PONG';
  }
};
import { Types } from 'mongoose';

// =============================================================================
// Interfaces
// =============================================================================

// AnalyticsFilter is imported from types/analytics.ts

export interface AnalyticsQueryOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  select?: string;
  populate?: string[];
}

export interface AnalyticsResult {
  analytics: IAnalyticsDocument[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface MetricData {
  bar_id: string;
  metric_type: string;
  metric_name: string;
  metric_category?: string;
  value: number;
  unit?: string;
  dimensions?: Record<string, any>;
  filters?: Record<string, any>;
  aggregation_type?: string;
  aggregation_period?: string;
  date?: Date;
  period_start?: Date;
  period_end?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface AggregationOptions {
  group_by?: string[];
  time_bucket?: string;
  functions?: string[];
  filters?: Record<string, any>;
  limit?: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  dimensions?: Record<string, any>;
}

export interface DashboardData {
  summary: {
    total_events: number;
    active_users: number;
    revenue: number;
    top_songs: any[];
    top_products: any[];
  };
  charts: {
    hourly_activity: TimeSeriesData[];
    daily_revenue: TimeSeriesData[];
    genre_distribution: any[];
    user_engagement: any[];
  };
  real_time: {
    current_song: any;
    queue_length: number;
    active_sessions: number;
    recent_orders: any[];
  };
}

export interface TrendingMetric {
  metric_name: string;
  current_value: number;
  previous_value: number;
  change_percent: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

export interface AnalyticsStatistics {
  total_metrics: number;
  metrics_by_type: Record<string, number>;
  metrics_by_category: Record<string, number>;
  recent_metrics_count: number;
  average_value: number;
  data_freshness: {
    latest_metric: Date;
    oldest_metric: Date;
    coverage_hours: number;
  };
  performance: {
    query_time_ms: number;
    cache_hit_rate: number;
  };
}

export interface CleanupOptions {
  older_than_days?: number;
  metric_types?: string[];
  batch_size?: number;
  dry_run?: boolean;
}

export interface CleanupResult {
  deleted_count: number;
  processed_count: number;
  duration_ms: number;
  dry_run: boolean;
  errors: string[];
}

// =============================================================================
// Service Class
// =============================================================================

export class AnalyticsService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'analytics:';

  // ==========================================================================
  // Analytics Management
  // ==========================================================================

  /**
   * Create a new analytics record
   */
  async createAnalytics(data: MetricData): Promise<IAnalyticsDocument> {
    try {
      // Validate required fields
      if (!data.bar_id || !data.metric_type || !data.metric_name) {
        throw new Error('Missing required fields: bar_id, metric_type, metric_name');
      }

      // Set defaults
      const analyticsData = {
        ...data,
        date: data.date || new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      const analytics = new Analytics(analyticsData);
      await analytics.save();

      // Clear related caches
      await this.clearAnalyticsCache(data.bar_id, data.metric_type);

      logger.debug('Analytics record created', {
        analytics_id: analytics._id,
        bar_id: data.bar_id,
        metric_type: data.metric_type,
        metric_name: data.metric_name
      });

      return analytics;
    } catch (error) {
      logger.error('Error creating analytics record', {
        error: error.message,
        data
      });
      throw error;
    }
  }

  /**
   * Create multiple analytics records
   */
  async createAnalyticsBatch(records: MetricData[]): Promise<{ successful: number; failed: number; errors: any[] }> {
    try {
      const results = {
        successful: 0,
        failed: 0,
        errors: [] as any[]
      };

      for (const record of records) {
        try {
          await this.createAnalytics(record);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            record,
            error: {
              code: 'PROCESSING_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      logger.info('Analytics batch processed', {
        total: records.length,
        successful: results.successful,
        failed: results.failed
      });

      return results;
    } catch (error) {
      logger.error('Error processing analytics batch', {
        error: error.message,
        recordCount: records.length
      });
      throw error;
    }
  }

  /**
   * Get analytics with filtering and pagination
   */
  async getAnalytics(filters: AnalyticsFilter = {}, options: AnalyticsQueryOptions = {}): Promise<AnalyticsResult> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}list:${JSON.stringify({ filters, options })}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build query
      const query = this.buildQuery(filters);
      
      // Build options
      const {
        page = 1,
        limit = 50,
        sort = { created_at: -1 },
        select,
        populate
      } = options;

      const skip = (page - 1) * limit;

      // Execute query
      let analyticsQuery = Analytics.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      if (select) {
        analyticsQuery = analyticsQuery.select(select);
      }

      if (populate) {
        populate.forEach(field => {
          analyticsQuery = analyticsQuery.populate(field);
        });
      }

      const [analytics, total] = await Promise.all([
        analyticsQuery.exec(),
        Analytics.countDocuments(query)
      ]);

      const result: AnalyticsResult = {
        analytics,
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      };

      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Error getting analytics', {
        error: error.message,
        filters,
        options
      });
      throw error;
    }
  }

  /**
   * Get analytics by ID
   */
  async getAnalyticsById(id: string): Promise<IAnalyticsDocument | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}id:${id}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const analytics = await Analytics.findById(id);
      
      if (analytics) {
        await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(analytics));
      }

      return analytics;
    } catch (error) {
      logger.error('Error getting analytics by ID', {
        error: error.message,
        id
      });
      throw error;
    }
  }

  /**
   * Update analytics record
   */
  async updateAnalytics(id: string, updateData: Partial<IAnalyticsDocument>): Promise<IAnalyticsDocument | null> {
    try {
      const analytics = await Analytics.findByIdAndUpdate(
        id,
        { ...updateData, updated_at: new Date() },
        { new: true, runValidators: true }
      );

      if (analytics) {
        // Clear caches
        await this.clearAnalyticsCache(analytics.bar_id, analytics.metric_type);
        await cache.del(`${this.CACHE_PREFIX}id:${id}`);
      }

      return analytics;
    } catch (error) {
      logger.error('Error updating analytics', {
        error: error.message,
        id,
        updateData
      });
      throw error;
    }
  }

  /**
   * Delete analytics record
   */
  async deleteAnalytics(id: string): Promise<boolean> {
    try {
      const analytics = await Analytics.findById(id);
      if (!analytics) {
        return false;
      }

      await Analytics.findByIdAndDelete(id);

      // Clear caches
      await this.clearAnalyticsCache(analytics.bar_id, analytics.metric_type);
      await cache.del(`${this.CACHE_PREFIX}id:${id}`);

      return true;
    } catch (error) {
      logger.error('Error deleting analytics', {
        error: error.message,
        id
      });
      throw error;
    }
  }

  // ==========================================================================
  // Metrics and Aggregation
  // ==========================================================================

  /**
   * Upsert metric (create or update)
   */
  async upsertMetric(data: MetricData): Promise<IAnalyticsDocument> {
    try {
      const result = await Analytics.upsertMetric(
        data.bar_id,
        data.metric_type,
        data.metric_name,
        data.value,
        {
          category: data.metric_category,
          unit: data.unit,
          dimensions: data.dimensions,
          aggregationType: data.aggregation_type,
          aggregationPeriod: data.aggregation_period,
          date: data.date,
          metadata: data.metadata
        }
      );

      // Clear related caches
      await this.clearAnalyticsCache(data.bar_id, data.metric_type);

      return result;
    } catch (error) {
      logger.error('Error upserting metric', {
        error: error.message,
        data
      });
      throw error;
    }
  }

  /**
   * Get aggregated metrics
   */
  async getAggregatedMetrics(
    barId: string,
    metricType: string,
    startDate: Date,
    endDate: Date,
    options: AggregationOptions = {}
  ): Promise<any[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}agg:${barId}:${metricType}:${startDate.getTime()}:${endDate.getTime()}:${JSON.stringify(options)}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const matchStage: any = {
        bar_id: barId,
        created_at: { $gte: startDate, $lte: endDate }
      };
      
      if (metricType !== 'all') {
        matchStage.metric_type = metricType;
      }

      const pipeline: any[] = [
        { $match: matchStage },
        {
          $group: {
            _id: options.group_by ? 
              options.group_by.reduce((acc, field) => ({ ...acc, [field]: `$${field}` }), {}) : 
              null,
            total_value: { $sum: '$value' },
            count: { $sum: 1 },
            avg_value: { $avg: '$value' }
          }
        },
        { $sort: { total_value: -1 } }
      ];

      const result = await Analytics.aggregate(pipeline);

      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Error getting aggregated metrics', {
        error: error.message,
        barId,
        metricType,
        startDate,
        endDate,
        options
      });
      throw error;
    }
  }

  /**
   * Get time series data
   */
  async getTimeSeries(
    barId: string,
    metricName: string,
    startDate: Date,
    endDate: Date,
    interval: string = 'hour'
  ): Promise<TimeSeriesData[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}timeseries:${barId}:${metricName}:${startDate.getTime()}:${endDate.getTime()}:${interval}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const intervalMap: { [key: string]: any } = {
        'hour': { $dateToString: { format: '%Y-%m-%d %H:00:00', date: '$created_at' } },
        'day': { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
        'week': { $dateToString: { format: '%Y-%U', date: '$created_at' } },
        'month': { $dateToString: { format: '%Y-%m', date: '$created_at' } }
      };

      const result = await Analytics.aggregate([
        {
          $match: {
            bar_id: barId,
            metric_name: metricName,
            created_at: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: intervalMap[interval] || intervalMap['hour'],
            total_value: { $sum: '$value' },
            count: { $sum: 1 },
            dimensions: { $first: '$dimensions' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const timeSeries: TimeSeriesData[] = result.map(item => ({
        timestamp: item._id,
        value: item.total_value,
        dimensions: item.dimensions
      }));

      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(timeSeries));

      return timeSeries;
    } catch (error) {
      logger.error('Error getting time series', {
        error: error.message,
        barId,
        metricName,
        startDate,
        endDate,
        interval
      });
      throw error;
    }
  }

  /**
   * Get top metrics
   */
  async getTopMetrics(
    barId: string,
    metricType: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}top:${barId}:${metricType}:${startDate.getTime()}:${endDate.getTime()}:${limit}`;
      const cached = await cache.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

      const matchStage: any = {
        bar_id: barId,
        created_at: { $gte: startDate, $lte: endDate }
      };
      
      if (metricType !== 'all') {
        matchStage.metric_type = metricType;
      }

      const result = await Analytics.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              metric_name: '$metric_name',
              metric_type: '$metric_type'
            },
            total_value: { $sum: '$value' },
            count: { $sum: 1 },
            avg_value: { $avg: '$value' }
          }
        },
        { $sort: { total_value: -1 } },
        { $limit: limit }
      ]);

      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Error getting top metrics', {
        error: error.message,
        barId,
        metricType,
        startDate,
        endDate,
        limit
      });
      throw error;
    }
  }

  // ==========================================================================
  // Dashboard and Real-time Data
  // ==========================================================================

  /**
   * Get dashboard data
   */
  async getDashboardData(barId: string, timeRange: string = '24h'): Promise<DashboardData> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}dashboard:${barId}:${timeRange}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const now = new Date();
      const startDate = this.getStartDateForRange(now, timeRange);

      // Get summary data
      const [totalEvents, activeUsers, revenue, topSongs, topProducts] = await Promise.all([
        this.getTotalEvents(barId, startDate, now),
        this.getActiveUsers(barId, startDate, now),
        this.getTotalRevenue(barId, startDate, now),
        this.getTopSongs(barId, startDate, now, 5),
        this.getTopProducts(barId, startDate, now, 5)
      ]);

      // Get chart data
      const [hourlyActivity, dailyRevenue, genreDistribution, userEngagement] = await Promise.all([
        this.getTimeSeries(barId, 'user_activity', startDate, now, 'hour'),
        this.getTimeSeries(barId, 'revenue', startDate, now, 'day'),
        this.getGenreDistribution(barId, startDate, now),
        this.getUserEngagement(barId, startDate, now)
      ]);

      // Get real-time data
      const [currentSong, queueLength, activeSessions, recentOrders] = await Promise.all([
        this.getCurrentSong(barId),
        this.getQueueLength(barId),
        this.getActiveSessions(barId),
        this.getRecentOrders(barId, 10)
      ]);

      const dashboardData: DashboardData = {
        summary: {
          total_events: totalEvents,
          active_users: activeUsers,
          revenue: revenue,
          top_songs: topSongs,
          top_products: topProducts
        },
        charts: {
          hourly_activity: hourlyActivity,
          daily_revenue: dailyRevenue,
          genre_distribution: genreDistribution,
          user_engagement: userEngagement
        },
        real_time: {
          current_song: currentSong,
          queue_length: queueLength,
          active_sessions: activeSessions,
          recent_orders: recentOrders
        }
      };

      // Cache result for shorter time (real-time data)
      await cache.setex(cacheKey, 60, JSON.stringify(dashboardData)); // 1 minute

      return dashboardData;
    } catch (error) {
      logger.error('Error getting dashboard data', {
        error: error.message,
        barId,
        timeRange
      });
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(barId: string, metrics?: string[]): Promise<any> {
    try {
      const metricsKey = metrics ? metrics.join(',') : 'all';
      const cacheKey = `${this.CACHE_PREFIX}realtime:${barId}:${metricsKey}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const query: any = {
        bar_id: barId,
        created_at: { $gte: fiveMinutesAgo },
        tags: 'realtime'
      };

      // Filter by specific metrics if provided
      if (metrics && metrics.length > 0) {
        query.metric_name = { $in: metrics };
      }

      const realtimeData = await Analytics.find(query)
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

      // Cache for very short time
      await cache.setex(cacheKey, 30, JSON.stringify(realtimeData)); // 30 seconds

      return realtimeData;
    } catch (error) {
      logger.error('Error getting real-time metrics', {
        error: error.message,
        barId,
        metrics
      });
      throw error;
    }
  }

  /**
   * Get trending metrics
   */
  async getTrendingMetrics(barId: string, period: string = '24h'): Promise<TrendingMetric[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}trending:${barId}:${period}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const now = new Date();
      const currentPeriodStart = this.getStartDateForRange(now, period);
      const previousPeriodStart = this.getStartDateForRange(currentPeriodStart, period);

      // Get current and previous period metrics
      const [currentMetrics, previousMetrics] = await Promise.all([
        Analytics.aggregate([
          {
            $match: {
              bar_id: barId,
              created_at: { $gte: currentPeriodStart, $lte: now }
            }
          },
          {
            $group: {
              _id: { metric_name: '$metric_name' },
              total_value: { $sum: '$value' }
            }
          }
        ]),
        Analytics.aggregate([
          {
            $match: {
              bar_id: barId,
              created_at: { $gte: previousPeriodStart, $lt: currentPeriodStart }
            }
          },
          {
            $group: {
              _id: { metric_name: '$metric_name' },
              total_value: { $sum: '$value' }
            }
          }
        ])
      ]);

      // Calculate trends
      const trending: TrendingMetric[] = currentMetrics.map(current => {
        const previous = previousMetrics.find(p => p._id.metric_name === current._id.metric_name);
        const previousValue = previous ? previous.total_value : 0;
        const changePercent = previousValue > 0 ? ((current.total_value - previousValue) / previousValue) * 100 : 0;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (changePercent > 5) trend = 'up';
        else if (changePercent < -5) trend = 'down';

        return {
          metric_name: current._id.metric_name,
          current_value: current.total_value,
          previous_value: previousValue,
          change_percent: changePercent,
          trend,
          period
        };
      });

      // Sort by change percentage
      trending.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));

      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(trending));

      return trending;
    } catch (error) {
      logger.error('Error getting trending metrics', {
        error: error.message,
        barId,
        period
      });
      throw error;
    }
  }

  // ==========================================================================
  // Event Processing
  // ==========================================================================

  /**
   * Process events into analytics
   */
  async processEventsToAnalytics(barId: string, batchSize: number = 100): Promise<{ processed: number; errors: number }> {
    try {
      let processed = 0;
      let errors = 0;
      let skip = 0;

      while (true) {
        // Get unprocessed events
        const events = await Event.find({
          bar_id: barId,
          processed_at: { $exists: false }
        })
        .sort({ created_at: 1 })
        .skip(skip)
        .limit(batchSize);

        if (events.length === 0) {
          break;
        }

        // Process each event
        for (const event of events) {
          try {
            await this.processEventToAnalytics(event);
            
            // Mark event as processed
            await Event.findByIdAndUpdate(event._id, {
              processed_at: new Date()
            });
            
            processed++;
          } catch (error) {
            logger.error('Error processing event to analytics', {
              error: error.message,
              event_id: event._id
            });
            errors++;
          }
        }

        skip += batchSize;
      }

      logger.info('Events to analytics processing completed', {
        bar_id: barId,
        processed,
        errors
      });

      return { processed, errors };
    } catch (error) {
      logger.error('Error processing events to analytics', {
        error: error.message,
        barId
      });
      throw error;
    }
  }

  /**
   * Process single event to analytics
   */
  private async processEventToAnalytics(event: IEvent): Promise<void> {
    try {
      const metrics = this.extractMetricsFromEvent(event);
      
      for (const metric of metrics) {
        await this.upsertMetric({
          bar_id: event.bar_id,
          ...metric
        });
      }
    } catch (error) {
      logger.error('Error processing single event to analytics', {
        error: error.message,
        event_id: event._id
      });
      throw error;
    }
  }

  /**
   * Extract metrics from event
   */
  private extractMetricsFromEvent(event: IEvent): MetricData[] {
    const metrics: MetricData[] = [];
    const baseMetric = {
      bar_id: event.bar_id,
      metric_type: event.event_type,
      date: event.created_at,
      dimensions: {
        event_name: event.event_name,
        user_id: event.user_id,
        session_id: event.session_id
      },
      tags: event.tags || []
    };

    switch (event.event_type) {
      case 'music':
        metrics.push({
          ...baseMetric,
          metric_name: 'song_plays',
          metric_category: 'music_consumption',
          value: 1,
          unit: 'count',
          dimensions: {
            ...baseMetric.dimensions,
            song_id: event.data?.song_id,
            genre: event.data?.genre,
            artist: event.data?.artist
          }
        });
        break;

      case 'menu':
        metrics.push({
          ...baseMetric,
          metric_name: 'product_orders',
          metric_category: 'menu_performance',
          value: event.data?.quantity || 1,
          unit: 'count',
          dimensions: {
            ...baseMetric.dimensions,
            product_id: event.data?.product_id,
            category: event.data?.category,
            price: event.data?.price
          }
        });
        break;

      case 'user':
        metrics.push({
          ...baseMetric,
          metric_name: 'user_activities',
          metric_category: 'user_engagement',
          value: 1,
          unit: 'count',
          dimensions: {
            ...baseMetric.dimensions,
            activity_type: event.event_name,
            points_spent: event.data?.points_spent
          }
        });
        break;

      case 'payment':
        metrics.push({
          ...baseMetric,
          metric_name: 'revenue',
          metric_category: 'financial',
          value: event.data?.amount || 0,
          unit: 'currency',
          dimensions: {
            ...baseMetric.dimensions,
            payment_method: event.data?.payment_method,
            transaction_id: event.data?.transaction_id
          }
        });
        break;
    }

    return metrics;
  }

  // ==========================================================================
  // Statistics and Monitoring
  // ==========================================================================

  /**
   * Get analytics statistics
   */
  async getAnalyticsStatistics(barId?: string, startDate?: Date, endDate?: Date): Promise<AnalyticsStatistics> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}stats:${barId || 'all'}:${startDate?.getTime() || 'all'}:${endDate?.getTime() || 'all'}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const query: any = {};
      if (barId) query.bar_id = barId;
      if (startDate || endDate) {
        query.created_at = {};
        if (startDate) query.created_at.$gte = startDate;
        if (endDate) query.created_at.$lte = endDate;
      }

      const [summaryResult, metricsByType, metricsByCategory, dataFreshness] = await Promise.all([
        Analytics.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              total_records: { $sum: 1 },
              average_value: { $avg: '$value' },
              recent_count: {
                $sum: {
                  $cond: [
                    { $gte: ['$created_at', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]),
        this.getMetricsByType(query),
        this.getMetricsByCategory(query),
        this.getDataFreshness(query)
      ]);
      
      const summary = summaryResult[0] || {
        total_records: 0,
        average_value: 0,
        recent_count: 0
      };

      const statistics: AnalyticsStatistics = {
        total_metrics: summary.total_records,
        metrics_by_type: metricsByType,
        metrics_by_category: metricsByCategory,
        recent_metrics_count: summary.recent_count,
        average_value: summary.average_value,
        data_freshness: dataFreshness,
        performance: {
          query_time_ms: 0, // Will be set by caller
          cache_hit_rate: 0  // Will be calculated separately
        }
      };

      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(statistics));

      return statistics;
    } catch (error) {
      logger.error('Error getting analytics statistics', {
        error: error.message,
        barId,
        startDate,
        endDate
      });
      throw error;
    }
  }

  // ==========================================================================
  // Cleanup and Maintenance
  // ==========================================================================

  /**
   * Clean up old analytics data
   */
  async cleanupOldAnalytics(options: CleanupOptions = {}): Promise<CleanupResult> {
    try {
      const {
        older_than_days = 90,
        metric_types = [],
        batch_size = 1000,
        dry_run = false
      } = options;

      const startTime = Date.now();
      const cutoffDate = new Date(Date.now() - older_than_days * 24 * 60 * 60 * 1000);
      
      const query: any = {
        created_at: { $lt: cutoffDate }
      };
      
      if (metric_types.length > 0) {
        query.metric_type = { $in: metric_types };
      }

      let deleted_count = 0;
      let processed_count = 0;
      const errors: string[] = [];

      if (dry_run) {
        // Just count what would be deleted
        deleted_count = await Analytics.countDocuments(query);
      } else {
        // Delete in batches
        while (true) {
          const batch = await Analytics.find(query)
            .select('_id bar_id metric_type')
            .limit(batch_size);

          if (batch.length === 0) {
            break;
          }

          try {
            const ids = batch.map(doc => doc._id);
            await Analytics.deleteMany({ _id: { $in: ids } });
            
            deleted_count += batch.length;
            processed_count += batch.length;

            // Clear related caches
            const barIds = [...new Set(batch.map(doc => doc.bar_id))];
            for (const barId of barIds) {
              await this.clearAnalyticsCache(barId);
            }
          } catch (error) {
            errors.push(`Batch deletion error: ${error.message}`);
          }
        }
      }

      const duration_ms = Date.now() - startTime;

      logger.info('Analytics cleanup completed', {
        deleted_count,
        processed_count,
        duration_ms,
        dry_run,
        errors: errors.length
      });

      return {
        deleted_count,
        processed_count,
        duration_ms,
        dry_run,
        errors
      };
    } catch (error) {
      logger.error('Error cleaning up analytics', {
        error: error.message,
        options
      });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    try {
      const startTime = Date.now();
      
      // Check database connectivity
      const dbCheck = await Analytics.findOne().limit(1);
      const dbStatus = dbCheck !== null ? 'connected' : 'empty';
      
      // Check cache connectivity
      const cacheCheck = await cache.ping();
      const cacheStatus = cacheCheck === 'PONG' ? 'connected' : 'disconnected';
      
      // Get basic stats
      const totalMetrics = await Analytics.countDocuments();
      const recentMetrics = await Analytics.countDocuments({
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      const responseTime = Date.now() - startTime;
      
      const status = dbStatus === 'connected' && cacheStatus === 'connected' ? 'healthy' : 'degraded';
      
      return {
        status,
        timestamp: new Date(),
        services: {
          database: {
            status: dbStatus,
            total_metrics: totalMetrics
          },
          cache: {
            status: cacheStatus
          }
        },
        metrics: {
          total_analytics: totalMetrics,
          recent_analytics: recentMetrics,
          response_time_ms: responseTime
        }
      };
    } catch (error) {
      logger.error('Health check failed', {
        error: error.message
      });
      
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Build MongoDB query from filters
   */
  private buildQuery(filters: AnalyticsFilter): any {
    const query: any = {};
    
    if (filters.barId) {
      query.bar_id = filters.barId;
    }
    
    if (filters.metricTypes && filters.metricTypes.length > 0) {
      query.metric_type = { $in: filters.metricTypes };
    }
    
    if (filters.metricNames && filters.metricNames.length > 0) {
      query.metric_name = { $in: filters.metricNames };
    }
    
    // Note: These properties are not defined in AnalyticsFilter interface
    // if (filters.metricName) {
    //   query.metric_name = filters.metricName;
    // }
    // 
    // if (filters.metricCategory) {
    //   query.metric_category = filters.metricCategory;
    // }
    // 
    // if (filters.aggregationType) {
    //   query.aggregation_type = filters.aggregationType;
    // }
    // 
    // if (filters.aggregationPeriod) {
    //   query.aggregation_period = filters.aggregationPeriod;
    // }
    
    // if (filters.date) {
    //   query.date = filters.date;
    // }
    
    if (filters.startDate || filters.endDate) {
      query.created_at = {};
      if (filters.startDate) {
        query.created_at.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.created_at.$lte = filters.endDate;
      }
    }
    
    // if (filters.periodStart || filters.periodEnd) {
    //   if (filters.periodStart) {
    //     query.period_start = { $gte: filters.periodStart };
    //   }
    //   if (filters.periodEnd) {
    //     query.period_end = { $lte: filters.periodEnd };
    //   }
    // }
    // 
    // if (filters.tags && filters.tags.length > 0) {
    //   query.tags = { $in: filters.tags };
    // }
    // 
    if (filters.dimensions) {
      Object.keys(filters.dimensions).forEach(key => {
        query[`dimensions.${key}`] = filters.dimensions![key];
      });
    }
    
    return query;
  }

  /**
   * Clear analytics-related caches
   */
  private async clearAnalyticsCache(barId: string, metricType?: string): Promise<void> {
    try {
      const patterns = [
        `${this.CACHE_PREFIX}list:*`,
        `${this.CACHE_PREFIX}agg:${barId}:*`,
        `${this.CACHE_PREFIX}timeseries:${barId}:*`,
        `${this.CACHE_PREFIX}top:${barId}:*`,
        `${this.CACHE_PREFIX}dashboard:${barId}:*`,
        `${this.CACHE_PREFIX}realtime:${barId}`,
        `${this.CACHE_PREFIX}trending:${barId}:*`,
        `${this.CACHE_PREFIX}stats:*`
      ];
      
      if (metricType) {
        patterns.push(`${this.CACHE_PREFIX}agg:${barId}:${metricType}:*`);
      }
      
      for (const pattern of patterns) {
        await cache.deletePattern(pattern);
      }
    } catch (error) {
      logger.warn('Error clearing analytics cache', {
        error: error.message,
        barId,
        metricType
      });
    }
  }

  /**
   * Get start date for time range
   */
  private getStartDateForRange(endDate: Date, range: string): Date {
    const end = new Date(endDate);
    
    switch (range) {
      case '1h':
        return new Date(end.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(end.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  // Placeholder methods for dashboard data (to be implemented based on specific requirements)
  private async getTotalEvents(barId: string, startDate: Date, endDate: Date): Promise<number> {
    return Event.countDocuments({ bar_id: barId, created_at: { $gte: startDate, $lte: endDate } });
  }

  private async getActiveUsers(barId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await Event.distinct('user_id', { bar_id: barId, created_at: { $gte: startDate, $lte: endDate } });
    return result.length;
  }

  private async getTotalRevenue(barId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await Analytics.aggregate([
      {
        $match: {
          bar_id: barId,
          metric_name: 'revenue',
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$value' }
        }
      }
    ]);
    return result[0]?.total || 0;
  }

  private async getTopSongs(barId: string, startDate: Date, endDate: Date, limit: number): Promise<any[]> {
    return Analytics.aggregate([
      {
        $match: {
          bar_id: barId,
          metric_type: 'music',
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$dimensions.song_id',
          title: { $first: '$dimensions.title' },
          artist: { $first: '$dimensions.artist' },
          plays: { $sum: '$value' }
        }
      },
      { $sort: { plays: -1 } },
      { $limit: limit }
    ]);
  }

  private async getTopProducts(barId: string, startDate: Date, endDate: Date, limit: number): Promise<any[]> {
    return Analytics.aggregate([
      {
        $match: {
          bar_id: barId,
          metric_type: 'menu',
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$dimensions.product_id',
          name: { $first: '$dimensions.name' },
          category: { $first: '$dimensions.category' },
          orders: { $sum: '$value' }
        }
      },
      { $sort: { orders: -1 } },
      { $limit: limit }
    ]);
  }

  private async getGenreDistribution(barId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return Analytics.aggregate([
      {
        $match: {
          bar_id: barId,
          metric_type: 'music',
          'dimensions.genre': { $exists: true },
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$dimensions.genre',
          count: { $sum: '$value' }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  private async getUserEngagement(barId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return Analytics.aggregate([
      {
        $match: {
          bar_id: barId,
          metric_type: 'user_activities',
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: { $dayOfMonth: '$created_at' },
            hour: { $hour: '$created_at' }
          },
          value: { $sum: '$value' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);
  }

  private async getCurrentSong(barId: string): Promise<any> {
    const result = await Analytics.findOne({
      bar_id: barId,
      metric_name: 'current_song',
      tags: 'realtime'
    }).sort({ created_at: -1 });
    return result?.dimensions || null;
  }

  private async getQueueLength(barId: string): Promise<number> {
    const result = await Analytics.findOne({
      bar_id: barId,
      metric_name: 'queue_length',
      tags: 'realtime'
    }).sort({ created_at: -1 });
    return result?.value || 0;
  }

  private async getActiveSessions(barId: string): Promise<number> {
    const result = await Analytics.findOne({
      bar_id: barId,
      metric_name: 'active_sessions',
      tags: 'realtime'
    }).sort({ created_at: -1 });
    return result?.value || 0;
  }

  private async getRecentOrders(barId: string, limit: number): Promise<any[]> {
    return Event.find({
      bar_id: barId,
      event_type: 'menu',
      event_name: 'product_ordered'
    })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  }

  private async getMetricsByType(query: any): Promise<Record<string, number>> {
    const result = await Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$metric_type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const metricsByType: Record<string, number> = {};
    result.forEach(item => {
      metricsByType[item._id] = item.count;
    });
    
    return metricsByType;
  }

  private async getMetricsByCategory(query: any): Promise<Record<string, number>> {
    const result = await Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$metric_category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const metricsByCategory: Record<string, number> = {};
    result.forEach(item => {
      metricsByCategory[item._id || 'uncategorized'] = item.count;
    });
    
    return metricsByCategory;
  }

  private async getDataFreshness(query: any): Promise<any> {
    const result = await Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          latest: { $max: '$created_at' },
          oldest: { $min: '$created_at' }
        }
      }
    ]);
    
    if (result.length === 0) {
      return {
        latest_metric: null,
        oldest_metric: null,
        coverage_hours: 0
      };
    }
    
    const latest = result[0].latest;
    const oldest = result[0].oldest;
    const coverageHours = latest && oldest ? (latest.getTime() - oldest.getTime()) / (1000 * 60 * 60) : 0;
    
    return {
      latest_metric: latest,
      oldest_metric: oldest,
      coverage_hours: Math.round(coverageHours)
    };
  }

  /**
   * Get analytics by type with filters
   */
  async getAnalyticsByType(type: string, filters: AnalyticsFilter = {}, page: number = 1, limit: number = 20): Promise<PaginatedAnalyticsResult> {
    try {
      const query = this.buildQuery({ ...filters, metricNames: [type] });
      
      const skip = (page - 1) * limit;
      
      const [data, total] = await Promise.all([
        Analytics.find(query)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Analytics.countDocuments(query)
      ]);
      
      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting analytics by type', {
        error: error.message,
        type,
        filters
      });
      throw error;
    }
  }

  /**
   * Get monthly analytics for a specific bar
   */
  async getMonthlyAnalytics(barId: string, year: number, month: number): Promise<any> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      
      const cacheKey = `${this.CACHE_PREFIX}monthly:${barId}:${year}:${month}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const result = await Analytics.aggregate([
        {
          $match: {
            bar_id: barId,
            created_at: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              day: { $dayOfMonth: '$created_at' },
              metric_type: '$metric_type'
            },
            total_value: { $sum: '$value' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.day': 1, '_id.metric_type': 1 }
        }
      ]);
      
      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      
      return result;
    } catch (error) {
      logger.error('Error getting monthly analytics', {
        error: error.message,
        barId,
        year,
        month
      });
      throw error;
    }
  }

  /**
   * Get daily analytics for a specific bar
   */
  async getDailyAnalytics(barId: string, date: Date): Promise<any> {
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      const cacheKey = `${this.CACHE_PREFIX}daily:${barId}:${date.toISOString().split('T')[0]}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const result = await Analytics.aggregate([
        {
          $match: {
            bar_id: barId,
            created_at: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              hour: { $hour: '$created_at' },
              metric_type: '$metric_type'
            },
            total_value: { $sum: '$value' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.hour': 1, '_id.metric_type': 1 }
        }
      ]);
      
      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      
      return result;
    } catch (error) {
      logger.error('Error getting daily analytics', {
        error: error.message,
        barId,
        date
      });
      throw error;
    }
  }

  /**
   * Get weekly analytics for a specific bar
   */
  async getWeeklyAnalytics(barId: string, startDate: Date): Promise<any> {
    try {
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      
      const cacheKey = `${this.CACHE_PREFIX}weekly:${barId}:${startDate.toISOString().split('T')[0]}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const result = await Analytics.aggregate([
        {
          $match: {
            bar_id: barId,
            created_at: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              day: { $dayOfWeek: '$created_at' },
              metric_type: '$metric_type'
            },
            total_value: { $sum: '$value' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.day': 1, '_id.metric_type': 1 }
        }
      ]);
      
      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      
      return result;
    } catch (error) {
      logger.error('Error getting weekly analytics', {
        error: error.message,
        barId,
        startDate
      });
      throw error;
    }
  }

  /**
   * Get dashboard overview with key metrics
   */
  async getDashboardOverview(barId: string, timeRange: 'today' | 'week' | 'month' | 'year' = 'today'): Promise<any> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}dashboard:${barId}:${timeRange}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
      }

      const [totalMetrics, revenueMetrics, userMetrics, musicMetrics] = await Promise.all([
        // Total metrics count
        Analytics.countDocuments({
          bar_id: barId,
          created_at: { $gte: startDate, $lte: now }
        }),
        
        // Revenue metrics
        Analytics.aggregate([
          {
            $match: {
              bar_id: barId,
              metric_category: 'financial',
              created_at: { $gte: startDate, $lte: now }
            }
          },
          {
            $group: {
              _id: null,
              total_revenue: { $sum: '$value' },
              avg_transaction: { $avg: '$value' },
              transaction_count: { $sum: 1 }
            }
          }
        ]),
        
        // User engagement metrics
        Analytics.aggregate([
          {
            $match: {
              bar_id: barId,
              metric_category: 'user_engagement',
              created_at: { $gte: startDate, $lte: now }
            }
          },
          {
            $group: {
              _id: null,
              total_activities: { $sum: '$value' },
              unique_users: { $addToSet: '$dimensions.user_id' }
            }
          },
          {
            $project: {
              total_activities: 1,
              unique_users_count: { $size: '$unique_users' }
            }
          }
        ]),
        
        // Music consumption metrics
        Analytics.aggregate([
          {
            $match: {
              bar_id: barId,
              metric_category: 'music_consumption',
              created_at: { $gte: startDate, $lte: now }
            }
          },
          {
            $group: {
              _id: null,
              total_plays: { $sum: '$value' },
              unique_songs: { $addToSet: '$dimensions.song_id' }
            }
          },
          {
            $project: {
              total_plays: 1,
              unique_songs_count: { $size: '$unique_songs' }
            }
          }
        ])
      ]);

      const overview = {
        timeRange,
        period: {
          start: startDate,
          end: now
        },
        summary: {
          total_metrics: totalMetrics,
          total_revenue: revenueMetrics[0]?.total_revenue || 0,
          avg_transaction: revenueMetrics[0]?.avg_transaction || 0,
          transaction_count: revenueMetrics[0]?.transaction_count || 0,
          total_user_activities: userMetrics[0]?.total_activities || 0,
          unique_users: userMetrics[0]?.unique_users_count || 0,
          total_song_plays: musicMetrics[0]?.total_plays || 0,
          unique_songs_played: musicMetrics[0]?.unique_songs_count || 0
        }
      };

      // Cache result
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(overview));

      return overview;
    } catch (error) {
      logger.error('Error getting dashboard overview', {
        error: error.message,
        barId,
        timeRange
      });
      throw error;
    }
  }

  /**
   * Bulk upsert analytics records
   */
  async bulkUpsertAnalytics(records: any[], options: any = {}): Promise<any> {
    try {
      logger.info('Starting bulk upsert analytics', { count: records.length, options });
      
      let upserted = 0;
      let modified = 0;
      const errors: string[] = [];
      
      for (const record of records) {
        try {
          const query = {
            bar_id: record.bar_id,
            metric_type: record.metric_type,
            metric_name: record.metric_name,
            date: record.date
          };
          
          const update = {
            ...record,
            updated_at: new Date()
          };
          
          const result = await Analytics.updateOne(
            query,
            { $set: update },
            { upsert: true }
          );
          
          if (result.upsertedCount > 0) {
            upserted++;
          } else if (result.modifiedCount > 0) {
            modified++;
          }
        } catch (error) {
          errors.push(`Error processing record: ${error.message}`);
        }
      }
      
      logger.info('Bulk upsert completed', { upserted, modified, errors: errors.length });
      
      return {
        total: records.length,
        upserted,
        modified,
        errors
      };
    } catch (error) {
      logger.error('Error in bulk upsert analytics', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Aggregate metrics from events
   */
  async aggregateFromEvents(options: any): Promise<any> {
    try {
      logger.info('Aggregating metrics from events', { options });
      
      // This is a placeholder implementation
      // In a real scenario, this would process events and create analytics
      const result = {
        processed_events: 0,
        created_metrics: 0,
        duration_ms: 0
      };
      
      return result;
    } catch (error) {
      logger.error('Error aggregating from events', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportData(options: any): Promise<any> {
    try {
      logger.info('Exporting analytics data', { options });
      
      // This is a placeholder implementation
      // In a real scenario, this would export data in various formats
      const result = {
        export_url: null,
        format: options.format || 'json',
        record_count: 0,
        file_size: 0
      };
      
      return result;
    } catch (error) {
      logger.error('Error exporting data', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldData(options: CleanupOptions = {}): Promise<CleanupResult> {
    try {
      const startTime = Date.now();
      const {
        older_than_days = 90,
        metric_types = [],
        batch_size = 1000,
        dry_run = false
      } = options;

      logger.info('Starting analytics cleanup', { options });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - older_than_days);

      const query: any = {
        created_at: { $lt: cutoffDate }
      };

      if (metric_types.length > 0) {
        query.metric_type = { $in: metric_types };
      }

      let deletedCount = 0;
      let processedCount = 0;
      const errors: string[] = [];

      if (dry_run) {
        processedCount = await Analytics.countDocuments(query);
        logger.info('Dry run completed', { would_delete: processedCount });
      } else {
        const result = await Analytics.deleteMany(query);
        deletedCount = result.deletedCount || 0;
        processedCount = deletedCount;
        logger.info('Cleanup completed', { deleted: deletedCount });
      }

      const duration = Date.now() - startTime;

      return {
        deleted_count: deletedCount,
        processed_count: processedCount,
        duration_ms: duration,
        dry_run,
        errors
      };
    } catch (error) {
      logger.error('Error during cleanup', { error: error.message, options });
      throw error;
    }
  }
}

// =============================================================================
// Export
// =============================================================================

export default AnalyticsService;