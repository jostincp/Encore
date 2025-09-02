/**
 * =============================================================================
 * MusicBar Analytics Service - Event Service
 * =============================================================================
 * Description: Business logic for event collection and processing
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Event } from '../models/Event';
import { Analytics } from '../models/Analytics';
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
  }
};
import { EventEmitter } from 'events';
import { Types } from 'mongoose';
import { AnalyticsEvent, EventFilter, EventBatch, EventProcessor } from '../types/events';
import { EventType } from '../types/common';

// =============================================================================
// Interfaces and Types
// =============================================================================

export interface EventFilters {
  bar_id?: string;
  user_id?: string;
  session_id?: string;
  event_type?: EventType;
  event_name?: string;
  status?: 'pending' | 'processing' | 'processed' | 'failed' | 'skipped';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  start_date?: Date;
  end_date?: Date;
  tags?: string[];
  processed?: boolean;
  real_time?: boolean;
}

export interface EventQueryOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  include_data?: boolean;
  include_metadata?: boolean;
}

export interface EventResult {
  events: any[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface EventData {
  bar_id: string;
  event_type: EventType;
  event_name: string;
  user_id?: string;
  session_id?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  real_time?: boolean;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
}

export interface ProcessingOptions {
  batch_size?: number;
  max_retries?: number;
  parallel_workers?: number;
  timeout?: number;
}

export interface ProcessingResult {
  processed: number;
  failed: number;
  skipped: number;
  errors: string[];
  processing_time: number;
}

export interface EventStatistics {
  total_events: number;
  events_by_type: Record<string, number>;
  events_by_status: Record<string, number>;
  events_by_priority: Record<string, number>;
  processing_stats: {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    success_rate: number;
    avg_processing_time: number;
  };
  real_time_stats: {
    active_sessions: number;
    events_per_minute: number;
    peak_events_per_minute: number;
  };
  date_range: {
    start_date: Date;
    end_date: Date;
  };
}

export interface CleanupOptions {
  older_than_days?: number;
  status_filter?: string[];
  batch_size?: number;
  dry_run?: boolean;
}

export interface CleanupResult {
  deleted_count: number;
  processed_batches: number;
  total_time: number;
  errors: string[];
}

export interface SupportedEventType {
  type: string;
  description: string;
  example_events: string[];
  required_fields: string[];
  optional_fields: string[];
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Event Service Class
// =============================================================================

export class EventService extends EventEmitter {
  private processingQueue: Map<string, any> = new Map();
  private processingStats: Map<string, any> = new Map();
  private realTimeMetrics: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeRealTimeTracking();
  }

  // ===========================================================================
  // Event CRUD Operations
  // ===========================================================================

  /**
   * Create a single event
   */
  async createEvent(eventData: EventData): Promise<any> {
    try {
      logger.info('Creating new event', { 
        bar_id: eventData.bar_id, 
        event_type: eventData.event_type,
        event_name: eventData.event_name 
      });

      // Validate event data
      const validation = this.validateEventData(eventData);
      if (!validation.is_valid) {
        throw new Error(`Invalid event data: ${validation.errors.join(', ')}`);
      }

      // Enrich event with metadata
      const enrichedEvent = this.enrichEventData(eventData);

      // Create event document
      const event = new Event({
        ...enrichedEvent,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedEvent = await event.save();

      // Update real-time metrics
      this.updateRealTimeMetrics(savedEvent);

      // Emit event for real-time processing
      if (eventData.real_time) {
        this.emit('realtime_event', savedEvent);
      }

      // Clear related caches
      this.clearEventCaches(eventData.bar_id);

      logger.info('Event created successfully', { event_id: savedEvent._id });
      return savedEvent;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating event', { error: errorMessage, eventData });
      throw error;
    }
  }

  /**
   * Create multiple events in bulk
   */
  async createEventsBulk(events: EventData[]): Promise<ProcessingResult> {
    try {
      const startTime = Date.now();
      logger.info('Creating bulk events', { count: events.length });

      const validEvents = [];
      const errors = [];

      // Validate and enrich all events
      for (let i = 0; i < events.length; i++) {
        const eventData = events[i];
        const validation = this.validateEventData(eventData);
        
        if (validation.is_valid) {
          const enrichedEvent = this.enrichEventData(eventData);
          validEvents.push({
            ...enrichedEvent,
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          });
        } else {
          errors.push({ index: i, errors: validation.errors });
        }
      }

      if (validEvents.length === 0) {
        throw new Error('No valid events to create');
      }

      // Bulk insert valid events
      const savedEvents = await Event.insertMany(validEvents, { ordered: false });

      // Update real-time metrics for all events
      savedEvents.forEach(event => {
        this.updateRealTimeMetrics(event);
        if (event.isRealTime()) {
          this.emit('realtime_event', event);
        }
      });

      // Clear caches for all affected bars
      const barIds = [...new Set(validEvents.map(e => e.bar_id))];
      barIds.forEach(barId => this.clearEventCaches(barId));

      logger.info('Bulk events created', { 
        created: savedEvents.length, 
        errors: errors.length 
      });

      return {
        processed: savedEvents.length,
        failed: errors.length,
        skipped: 0,
        errors: errors.map(e => `Event ${e.index}: ${e.errors.join(', ')}`),
        processing_time: Date.now() - startTime
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating bulk events', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get events with filtering and pagination
   */
  async getEvents(filters: EventFilters = {}, options: EventQueryOptions = {}): Promise<EventResult> {
    try {
      const cacheKey = `events:${JSON.stringify({ filters, options })}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as EventResult;
      }

      const {
        page = 1,
        limit = 50,
        sort_by = 'created_at',
        sort_order = 'desc',
        include_data = true,
        include_metadata = false
      } = options;

      // Build query
      const query = this.buildEventQuery(filters);

      // Build projection
      const projection: any = {
        _id: 1,
        bar_id: 1,
        event_type: 1,
        event_name: 1,
        user_id: 1,
        session_id: 1,
        status: 1,
        priority: 1,
        tags: 1,
        created_at: 1,
        updated_at: 1,
        processed_at: 1
      };

      if (include_data) projection.data = 1;
      if (include_metadata) projection.metadata = 1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const sortOrder = sort_order === 'desc' ? -1 : 1;

      const [events, total] = await Promise.all([
        Event.find(query, projection)
          .sort({ [sort_by]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Event.countDocuments(query)
      ]);

      const result: EventResult = {
        events,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1
      };

      // Cache result for 5 minutes
      await cache.set(cacheKey, result, 300);

      return result;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting events', { error: errorMessage, filters });
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<any> {
    try {
      const cacheKey = `event:${eventId}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as EventStatistics;
      }

      const event = await Event.findById(eventId).lean();
      if (!event) {
        throw new Error('Event not found');
      }

      // Cache for 10 minutes
      await cache.set(cacheKey, event, 600);

      return event;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting event by ID', { error: errorMessage, eventId });
      throw error;
    }
  }

  /**
   * Update event
   */
  async updateEvent(eventId: string, updateData: Partial<EventData>): Promise<any> {
    try {
      logger.info('Updating event', { event_id: eventId });

      const event = await Event.findByIdAndUpdate(
        eventId,
        {
          ...updateData,
          updated_at: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!event) {
        throw new Error('Event not found');
      }

      // Clear caches
      await cache.del(`event:${eventId}`);
      this.clearEventCaches(event.bar_id);

      logger.info('Event updated successfully', { event_id: eventId });
      return event;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error updating event', { error: errorMessage, eventId });
      throw error;
    }
  }

  /**
   * Delete event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      logger.info('Deleting event', { event_id: eventId });

      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      await Event.findByIdAndDelete(eventId);

      // Clear caches
      await cache.del(`event:${eventId}`);
      this.clearEventCaches(event.bar_id);

      logger.info('Event deleted successfully', { event_id: eventId });
      return true;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error deleting event', { error: errorMessage, eventId });
      throw error;
    }
  }

  // ===========================================================================
  // Event Processing
  // ===========================================================================

  /**
   * Process a single event
   */
  async processEvent(eventId: string): Promise<any> {
    try {
      logger.info('Processing event', { event_id: eventId });

      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status === 'processed') {
        logger.info('Event already processed', { event_id: eventId });
        return event;
      }

      // Update status to processing
      await Event.findByIdAndUpdate(eventId, {
        status: 'processing',
        processing_started_at: new Date()
      });

      try {
        // Process event based on type
        const result = await this.processEventByType(event);

        // Update status to processed
        const processedEvent = await Event.findByIdAndUpdate(eventId, {
          status: 'processed',
          processing_completed_at: new Date(),
          processing_result: result
        }, { new: true });

        // Generate analytics from event
        await this.generateAnalyticsFromEvent(processedEvent);

        // Clear caches
        this.clearEventCaches(event.bar_id);

        logger.info('Event processed successfully', { event_id: eventId });
        return processedEvent;

      } catch (processingError: unknown) {
        const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown processing error';
        // Update status to failed
        await Event.findByIdAndUpdate(eventId, {
          status: 'failed',
          processing_error: errorMessage,
          processing_completed_at: new Date()
        });

        throw processingError;
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing event', { error: errorMessage, eventId });
      throw error;
    }
  }

  /**
   * Process events in batch
   */
  async processEventsBatch(options: ProcessingOptions = {}): Promise<ProcessingResult> {
    try {
      const {
        batch_size = 100,
        max_retries = 3,
        parallel_workers = 5,
        timeout = 30000
      } = options;

      logger.info('Starting batch event processing', { batch_size, parallel_workers });

      const startTime = Date.now();
      let processed = 0;
      let failed = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Get pending events
      const pendingEvents = await Event.find(
        { status: 'pending' },
        { _id: 1 }
      )
      .sort({ priority: -1, created_at: 1 })
      .limit(batch_size)
      .lean();

      if (pendingEvents.length === 0) {
        logger.info('No pending events to process');
        return { processed: 0, failed: 0, skipped: 0, errors: [], processing_time: 0 };
      }

      // Process events in parallel batches
      const eventIds = pendingEvents.map(e => e._id.toString());
      const chunks = this.chunkArray(eventIds, parallel_workers);

      for (const chunk of chunks) {
        const promises = chunk.map(async (eventId) => {
          try {
            await this.processEvent(eventId);
            processed++;
          } catch (error: unknown) {
            failed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Event ${eventId}: ${errorMessage}`);
          }
        });

        await Promise.allSettled(promises);
      }

      const processingTime = Date.now() - startTime;

      logger.info('Batch processing completed', {
        processed,
        failed,
        skipped,
        processing_time: processingTime
      });

      return {
        processed,
        failed,
        skipped,
        errors,
        processing_time: processingTime
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in batch processing', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get processing queue status
   */
  async getProcessingQueueStatus(): Promise<any> {
    try {
      const [pending, processing, processed, failed] = await Promise.all([
        Event.countDocuments({ status: 'pending' }),
        Event.countDocuments({ status: 'processing' }),
        Event.countDocuments({ status: 'processed' }),
        Event.countDocuments({ status: 'failed' })
      ]);

      const total = pending + processing + processed + failed;
      const successRate = total > 0 ? (processed / total) * 100 : 0;

      return {
        queue_status: {
          pending,
          processing,
          processed,
          failed,
          total,
          success_rate: Math.round(successRate * 100) / 100
        },
        processing_stats: Object.fromEntries(this.processingStats),
        last_updated: new Date()
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting queue status', { error: errorMessage });
      throw error;
    }
  }

  // ===========================================================================
  // Statistics and Analytics
  // ===========================================================================

  /**
   * Get event statistics
   */
  async getEventStatistics(filters: EventFilters = {}): Promise<EventStatistics> {
    try {
      const cacheKey = `event_stats:${JSON.stringify(filters)}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as EventStatistics;
      }

      const query = this.buildEventQuery(filters);

      // Get basic counts
      const [totalEvents, eventsByType, eventsByStatus, eventsByPriority] = await Promise.all([
        Event.countDocuments(query),
        Event.aggregate([
          { $match: query },
          { $group: { _id: '$event_type', count: { $sum: 1 } } }
        ]),
        Event.aggregate([
          { $match: query },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Event.aggregate([
          { $match: query },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ])
      ]);

      // Get processing stats
      const processingStats = await this.getProcessingStatistics(query);
      const realTimeStats = await this.getRealTimeStatistics(filters.bar_id);

      // Get date range
      const dateRange = await Event.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            start_date: { $min: '$created_at' },
            end_date: { $max: '$created_at' }
          }
        }
      ]);

      const statistics: EventStatistics = {
        total_events: totalEvents,
        events_by_type: this.arrayToObject(eventsByType),
        events_by_status: this.arrayToObject(eventsByStatus),
        events_by_priority: this.arrayToObject(eventsByPriority),
        processing_stats: processingStats,
        real_time_stats: realTimeStats,
        date_range: dateRange[0] || { start_date: new Date(), end_date: new Date() }
      };

      // Cache for 5 minutes
      await cache.set(cacheKey, statistics, 300);

      return statistics;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting event statistics', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get real-time events
   */
  async getRealTimeEvents(barId: string): Promise<any[]> {
    try {
      const events = await Event.find(
        {
          bar_id: barId,
          real_time: true,
          created_at: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
        },
        {
          _id: 1,
          event_type: 1,
          event_name: 1,
          user_id: 1,
          data: 1,
          created_at: 1
        }
      )
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

      return events;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting real-time events', { error: errorMessage, barId });
      throw error;
    }
  }

  // ===========================================================================
  // Event Types and Validation
  // ===========================================================================

  /**
   * Get supported event types
   */
  getSupportedEventTypes(): SupportedEventType[] {
    return [
      {
        type: 'music',
        description: 'Music-related events like song requests, plays, votes',
        example_events: ['song_requested', 'song_played', 'song_voted', 'song_skipped', 'playlist_updated'],
        required_fields: ['bar_id', 'event_name'],
        optional_fields: ['user_id', 'session_id', 'data.song_id', 'data.artist', 'data.title']
      },
      {
        type: 'menu',
        description: 'Menu and product-related events',
        example_events: ['product_ordered', 'product_served', 'menu_viewed', 'category_browsed'],
        required_fields: ['bar_id', 'event_name'],
        optional_fields: ['user_id', 'data.product_id', 'data.category', 'data.price', 'data.quantity']
      },
      {
        type: 'user',
        description: 'User account and activity events',
        example_events: ['user_registered', 'user_login', 'user_logout', 'points_earned', 'points_spent'],
        required_fields: ['bar_id', 'event_name', 'user_id'],
        optional_fields: ['session_id', 'data.points', 'data.level', 'data.achievement']
      },
      {
        type: 'queue',
        description: 'Music queue management events',
        example_events: ['song_added_to_queue', 'song_removed_from_queue', 'queue_reordered', 'priority_play'],
        required_fields: ['bar_id', 'event_name'],
        optional_fields: ['user_id', 'data.song_id', 'data.position', 'data.priority']
      },
      {
        type: 'payment',
        description: 'Payment and transaction events',
        example_events: ['payment_initiated', 'payment_completed', 'payment_failed', 'refund_processed'],
        required_fields: ['bar_id', 'event_name', 'user_id'],
        optional_fields: ['data.amount', 'data.currency', 'data.payment_method', 'data.transaction_id']
      },
      {
        type: 'system',
        description: 'System and administrative events',
        example_events: ['system_startup', 'system_shutdown', 'error_occurred', 'maintenance_started'],
        required_fields: ['bar_id', 'event_name'],
        optional_fields: ['data.component', 'data.error_code', 'data.severity']
      }
    ];
  }

  /**
   * Validate event data
   */
  validateEventData(eventData: EventData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!eventData.bar_id) {
      errors.push('bar_id is required');
    }

    if (!eventData.event_type) {
      errors.push('event_type is required');
    } else if (!['music', 'menu', 'user', 'queue', 'payment', 'system'].includes(eventData.event_type)) {
      errors.push('event_type must be one of: music, menu, user, queue, payment, system');
    }

    if (!eventData.event_name) {
      errors.push('event_name is required');
    }

    // Type-specific validation
    if (eventData.event_type.startsWith('user_') || eventData.event_type.startsWith('payment_')) {
      if (!eventData.user_id) {
        errors.push(`user_id is required for ${eventData.event_type} events`);
      }
    }

    // Priority validation
    if (eventData.priority && !['low', 'medium', 'high', 'critical'].includes(eventData.priority)) {
      errors.push('priority must be one of: low, medium, high, critical');
    }

    // Data validation
    if (eventData.data && typeof eventData.data !== 'object') {
      errors.push('data must be an object');
    }

    // Warnings for best practices
    if (!eventData.user_id && !eventData.event_type.startsWith('system_')) {
      warnings.push('user_id is recommended for better analytics');
    }

    if (!eventData.session_id) {
      warnings.push('session_id is recommended for session tracking');
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ===========================================================================
  // Export and Cleanup
  // ===========================================================================

  /**
   * Export events data
   */
  async exportEvents(filters: EventFilters, format: 'json' | 'csv' = 'json'): Promise<any> {
    try {
      logger.info('Exporting events', { filters, format });

      const query = this.buildEventQuery(filters);
      const events = await Event.find(query).lean();

      if (format === 'csv') {
        return this.convertToCSV(events);
      }

      return {
        events,
        total: events.length,
        exported_at: new Date(),
        filters
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error exporting events', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Clean up old events
   */
  async cleanupOldEvents(options: CleanupOptions = {}): Promise<CleanupResult> {
    try {
      const {
        older_than_days = 90,
        status_filter = ['processed', 'failed'],
        batch_size = 1000,
        dry_run = false
      } = options;

      logger.info('Starting event cleanup', { older_than_days, status_filter, dry_run });

      const cutoffDate = new Date(Date.now() - (older_than_days * 24 * 60 * 60 * 1000));
      const query = {
        created_at: { $lt: cutoffDate },
        status: { $in: status_filter }
      };

      const startTime = Date.now();
      let deletedCount = 0;
      let processedBatches = 0;
      const errors: string[] = [];

      if (dry_run) {
        deletedCount = await Event.countDocuments(query);
        logger.info('Dry run completed', { would_delete: deletedCount });
      } else {
        // Process in batches
        let hasMore = true;
        while (hasMore) {
          try {
            const result = await Event.deleteMany(query).limit(batch_size);
            deletedCount += result.deletedCount;
            processedBatches++;
            
            hasMore = result.deletedCount === batch_size;
            
            if (hasMore) {
              // Small delay between batches
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Batch ${processedBatches}: ${errorMessage}`);
            break;
          }
        }
      }

      const totalTime = Date.now() - startTime;

      logger.info('Event cleanup completed', {
        deleted_count: deletedCount,
        processed_batches: processedBatches,
        total_time: totalTime
      });

      return {
        deleted_count: deletedCount,
        processed_batches: processedBatches,
        total_time: totalTime,
        errors
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in event cleanup', { error: errorMessage });
      throw error;
    }
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  /**
   * Health check for event service
   */
  async healthCheck(): Promise<any> {
    try {
      const [totalEvents, pendingEvents, processingEvents] = await Promise.all([
        Event.countDocuments(),
        Event.countDocuments({ status: 'pending' }),
        Event.countDocuments({ status: 'processing' })
      ]);

      const queueHealth = pendingEvents < 10000 ? 'healthy' : 'warning';
      const processingHealth = processingEvents < 100 ? 'healthy' : 'warning';

      return {
        status: 'healthy',
        timestamp: new Date(),
        service: 'event-service',
        version: '1.0.0',
        metrics: {
          total_events: totalEvents,
          pending_events: pendingEvents,
          processing_events: processingEvents,
          queue_health: queueHealth,
          processing_health: processingHealth
        },
        real_time_metrics: Object.fromEntries(this.realTimeMetrics)
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Health check failed', { error: errorMessage });
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: errorMessage
      };
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Build MongoDB query from filters
   */
  private buildEventQuery(filters: EventFilters): any {
    const query: any = {};

    if (filters.bar_id) query.bar_id = filters.bar_id;
    if (filters.user_id) query.user_id = filters.user_id;
    if (filters.session_id) query.session_id = filters.session_id;
    if (filters.event_type) query.event_type = filters.event_type;
    if (filters.event_name) query.event_name = filters.event_name;
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.processed !== undefined) {
      query.status = filters.processed ? 'processed' : { $ne: 'processed' };
    }
    if (filters.real_time !== undefined) query.real_time = filters.real_time;

    // Date range
    if (filters.start_date || filters.end_date) {
      query.created_at = {};
      if (filters.start_date) query.created_at.$gte = filters.start_date;
      if (filters.end_date) query.created_at.$lte = filters.end_date;
    }

    // Tags
    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    return query;
  }

  /**
   * Enrich event data with metadata
   */
  private enrichEventData(eventData: EventData): EventData {
    const enriched = { ...eventData };

    // Add default priority if not specified
    if (!enriched.priority) {
      enriched.priority = 'medium';
    }

    // Add timestamp to metadata
    if (!enriched.metadata) {
      enriched.metadata = {};
    }

    enriched.metadata.received_at = new Date();
    enriched.metadata.source = 'analytics-service';

    // Add request metadata if available
    if (eventData.ip_address) {
      enriched.metadata.ip_address = eventData.ip_address;
    }
    if (eventData.user_agent) {
      enriched.metadata.user_agent = eventData.user_agent;
    }
    if (eventData.request_id) {
      enriched.metadata.request_id = eventData.request_id;
    }

    return enriched;
  }

  /**
   * Process event based on its type
   */
  private async processEventByType(event: any): Promise<any> {
    switch (event.event_type) {
      case 'music':
        return this.processMusicEvent(event);
      case 'menu':
        return this.processMenuEvent(event);
      case 'user':
        return this.processUserEvent(event);
      case 'queue':
        return this.processQueueEvent(event);
      case 'payment':
        return this.processPaymentEvent(event);
      case 'system':
        return this.processSystemEvent(event);
      default:
        throw new Error(`Unknown event type: ${event.event_type}`);
    }
  }

  /**
   * Process music event
   */
  private async processMusicEvent(event: any): Promise<any> {
    // Music event processing logic
    const result = {
      processed_at: new Date(),
      type: 'music',
      metrics_generated: []
    };

    // Generate music-specific metrics
    if (event.event_name === 'song_played') {
      result.metrics_generated.push('song_play_count', 'artist_popularity', 'genre_stats');
    } else if (event.event_name === 'song_requested') {
      result.metrics_generated.push('song_request_count', 'user_activity');
    }

    return result;
  }

  /**
   * Process menu event
   */
  private async processMenuEvent(event: any): Promise<any> {
    // Menu event processing logic
    const result = {
      processed_at: new Date(),
      type: 'menu',
      metrics_generated: []
    };

    if (event.event_name === 'product_ordered') {
      result.metrics_generated.push('product_sales', 'revenue_tracking', 'category_performance');
    }

    return result;
  }

  /**
   * Process user event
   */
  private async processUserEvent(event: any): Promise<any> {
    // User event processing logic
    const result = {
      processed_at: new Date(),
      type: 'user',
      metrics_generated: []
    };

    if (event.event_name === 'user_login') {
      result.metrics_generated.push('user_activity', 'session_tracking');
    } else if (event.event_name === 'points_earned') {
      result.metrics_generated.push('points_distribution', 'user_engagement');
    }

    return result;
  }

  /**
   * Process queue event
   */
  private async processQueueEvent(event: any): Promise<any> {
    // Queue event processing logic
    return {
      processed_at: new Date(),
      type: 'queue',
      metrics_generated: ['queue_length', 'wait_times', 'queue_activity']
    };
  }

  /**
   * Process payment event
   */
  private async processPaymentEvent(event: any): Promise<any> {
    // Payment event processing logic
    return {
      processed_at: new Date(),
      type: 'payment',
      metrics_generated: ['revenue_tracking', 'payment_methods', 'transaction_success_rate']
    };
  }

  /**
   * Process system event
   */
  private async processSystemEvent(event: any): Promise<any> {
    // System event processing logic
    return {
      processed_at: new Date(),
      type: 'system',
      metrics_generated: ['system_health', 'error_rates', 'performance_metrics']
    };
  }

  /**
   * Generate analytics from processed event
   */
  private async generateAnalyticsFromEvent(event: any): Promise<void> {
    try {
      // Create analytics record based on event
      const analyticsData = {
        bar_id: event.bar_id,
        metric_type: event.event_type,
        metric_name: `${event.event_name}_count`,
        metric_value: 1,
        dimensions: {
          event_type: event.event_type,
          event_name: event.event_name,
          user_id: event.user_id,
          session_id: event.session_id
        },
        metadata: {
          source_event_id: event._id,
          generated_at: new Date()
        },
        timestamp: event.created_at
      };

      await Analytics.create(analyticsData);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error generating analytics from event', {
        error: errorMessage,
        event_id: event._id
      });
    }
  }

  /**
   * Update real-time metrics
   */
  private updateRealTimeMetrics(event: any): void {
    const barId = event.bar_id;
    const currentMinute = Math.floor(Date.now() / 60000);
    
    // Update events per minute
    const eventsPerMinuteKey = `${barId}:events_per_minute:${currentMinute}`;
    const currentCount = this.realTimeMetrics.get(eventsPerMinuteKey) || 0;
    this.realTimeMetrics.set(eventsPerMinuteKey, currentCount + 1);

    // Update active sessions
    if (event.session_id) {
      const activeSessionsKey = `${barId}:active_sessions`;
      const sessions = this.realTimeMetrics.get(activeSessionsKey) || new Set();
      sessions.add(event.session_id);
      this.realTimeMetrics.set(activeSessionsKey, sessions);
    }

    // Clean up old metrics (keep only last 10 minutes)
    const tenMinutesAgo = currentMinute - 10;
    for (const [key] of this.realTimeMetrics) {
      if (key.includes('events_per_minute') && key.includes(`:${tenMinutesAgo}`)) {
        this.realTimeMetrics.delete(key);
      }
    }
  }

  /**
   * Initialize real-time tracking
   */
  private initializeRealTimeTracking(): void {
    // Clean up old real-time metrics every minute
    setInterval(() => {
      const currentMinute = Math.floor(Date.now() / 60000);
      const tenMinutesAgo = currentMinute - 10;
      
      for (const [key] of this.realTimeMetrics) {
        if (key.includes('events_per_minute')) {
          const minute = parseInt(key.split(':').pop() || '0');
          if (minute < tenMinutesAgo) {
            this.realTimeMetrics.delete(key);
          }
        }
      }
    }, 60000);
  }

  /**
   * Get processing statistics
   */
  private async getProcessingStatistics(query: any): Promise<any> {
    const [pending, processing, processed, failed] = await Promise.all([
      Event.countDocuments({ ...query, status: 'pending' }),
      Event.countDocuments({ ...query, status: 'processing' }),
      Event.countDocuments({ ...query, status: 'processed' }),
      Event.countDocuments({ ...query, status: 'failed' })
    ]);

    const total = pending + processing + processed + failed;
    const successRate = total > 0 ? (processed / total) * 100 : 0;

    // Get average processing time
    const avgProcessingTime = await Event.aggregate([
      {
        $match: {
          ...query,
          status: 'processed',
          processing_started_at: { $exists: true },
          processing_completed_at: { $exists: true }
        }
      },
      {
        $project: {
          processing_time: {
            $subtract: ['$processing_completed_at', '$processing_started_at']
          }
        }
      },
      {
        $group: {
          _id: null,
          avg_time: { $avg: '$processing_time' }
        }
      }
    ]);

    return {
      pending,
      processing,
      processed,
      failed,
      success_rate: Math.round(successRate * 100) / 100,
      avg_processing_time: avgProcessingTime[0]?.avg_time || 0
    };
  }

  /**
   * Get real-time statistics
   */
  private async getRealTimeStatistics(barId?: string): Promise<any> {
    const currentMinute = Math.floor(Date.now() / 60000);
    let activeSessions = 0;
    let eventsPerMinute = 0;
    let peakEventsPerMinute = 0;

    if (barId) {
      // Get active sessions for specific bar
      const activeSessionsKey = `${barId}:active_sessions`;
      const sessions = this.realTimeMetrics.get(activeSessionsKey);
      activeSessions = sessions ? sessions.size : 0;

      // Get events per minute for specific bar
      const eventsPerMinuteKey = `${barId}:events_per_minute:${currentMinute}`;
      eventsPerMinute = this.realTimeMetrics.get(eventsPerMinuteKey) || 0;

      // Get peak events per minute (last 10 minutes)
      for (let i = 0; i < 10; i++) {
        const minute = currentMinute - i;
        const key = `${barId}:events_per_minute:${minute}`;
        const count = this.realTimeMetrics.get(key) || 0;
        peakEventsPerMinute = Math.max(peakEventsPerMinute, count);
      }
    } else {
      // Aggregate across all bars
      for (const [key, value] of this.realTimeMetrics) {
        if (key.includes('active_sessions')) {
          activeSessions += value.size || 0;
        } else if (key.includes(`events_per_minute:${currentMinute}`)) {
          eventsPerMinute += value || 0;
        }
      }

      // Calculate peak across all bars
      for (let i = 0; i < 10; i++) {
        const minute = currentMinute - i;
        let minuteTotal = 0;
        for (const [key, value] of this.realTimeMetrics) {
          if (key.includes(`events_per_minute:${minute}`)) {
            minuteTotal += value || 0;
          }
        }
        peakEventsPerMinute = Math.max(peakEventsPerMinute, minuteTotal);
      }
    }

    return {
      active_sessions: activeSessions,
      events_per_minute: eventsPerMinute,
      peak_events_per_minute: peakEventsPerMinute
    };
  }

  /**
   * Clear event-related caches
   */
  private clearEventCaches(barId: string): void {
    // Clear pattern-based cache keys
    const patterns = [
      `events:*${barId}*`,
      `event_stats:*${barId}*`,
      `realtime_events:${barId}*`
    ];

    patterns.forEach(pattern => {
      cache.deletePattern(pattern).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Error clearing cache pattern', { pattern, error: errorMessage });
      });
    });
  }

  /**
   * Convert aggregation result array to object
   */
  private arrayToObject(arr: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    arr.forEach(item => {
      result[item._id] = item.count;
    });
    return result;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Convert events to CSV format
   */
  private convertToCSV(events: any[]): string {
    if (events.length === 0) {
      return 'No events to export';
    }

    // Get all unique keys from all events
    const allKeys = new Set<string>();
    events.forEach(event => {
      Object.keys(event).forEach(key => {
        if (key !== 'data' && key !== 'metadata') {
          allKeys.add(key);
        }
      });
      
      // Add data fields
      if (event.data) {
        Object.keys(event.data).forEach(key => {
          allKeys.add(`data.${key}`);
        });
      }
    });

    const headers = Array.from(allKeys).sort();
    const csvRows = [headers.join(',')];

    events.forEach(event => {
      const row = headers.map(header => {
        if (header.startsWith('data.')) {
          const dataKey = header.substring(5);
          const value = event.data?.[dataKey];
          return this.escapeCsvValue(value);
        } else {
          const value = event[header];
          return this.escapeCsvValue(value);
        }
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }
}