/**
 * =============================================================================
 * MusicBar Analytics Service - Event Model
 * =============================================================================
 * Description: MongoDB model for event tracking and analytics
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Schema, model, Document, Types } from 'mongoose';

// =============================================================================
// Interfaces
// =============================================================================

export interface IEvent extends Document {
  _id: Types.ObjectId;
  bar_id: string;
  user_id?: string;
  session_id?: string;
  event_type: string;
  event_name: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
  metadata: {
    ip_address?: string;
    user_agent?: string;
    device_type?: string;
    platform?: string;
    location?: {
      country?: string;
      city?: string;
      coordinates?: [number, number];
    };
    referrer?: string;
    timestamp?: Date;
    request_id?: string;
    [key: string]: any;
  };
  context: {
    source: string;
    version?: string;
    environment?: string;
    service?: string;
    [key: string]: any;
  };
  tags: string[];
  created_at: Date;
  updated_at: Date;
  processed_at?: Date;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  processing_duration?: number;
  
  // Instance methods
  markAsProcessing(): Promise<IEvent>;
  markAsProcessed(duration?: number): Promise<IEvent>;
  markAsFailed(error: string): Promise<IEvent>;
  canRetry(): boolean;
  retry(): Promise<IEvent>;
  isRealTime(): boolean;
  getProcessingAge(): number;
  validateEventData(): void;
  validateMusicEventData(eventName: string, data: any): void;
  validateMenuEventData(eventName: string, data: any): void;
  validateUserEventData(eventName: string, data: any): void;
  validateQueueEventData(eventName: string, data: any): void;
  validatePaymentEventData(eventName: string, data: any): void;
}

// =============================================================================
// Schema Definition
// =============================================================================

const EventSchema = new Schema<IEvent>({
  bar_id: {
    type: String,
    required: true,
    index: true
  },
  user_id: {
    type: String,
    index: true,
    sparse: true
  },
  session_id: {
    type: String,
    index: true,
    sparse: true
  },
  event_type: {
    type: String,
    required: true,
    enum: [
      'music',
      'menu',
      'user',
      'queue',
      'payment',
      'system',
      'analytics',
      'notification',
      'error'
    ],
    index: true
  },
  event_name: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'processed', 'failed'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  data: {
    type: Schema.Types.Mixed,
    required: true,
    default: {}
  },
  metadata: {
    ip_address: String,
    user_agent: String,
    device_type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown']
    },
    platform: {
      type: String,
      enum: ['web', 'ios', 'android', 'api', 'unknown']
    },
    location: {
      country: String,
      city: String,
      coordinates: {
        type: [Number],
        validate: {
          validator: function(v: number[]) {
            return v.length === 2 && 
                   v[0] >= -180 && v[0] <= 180 && 
                   v[1] >= -90 && v[1] <= 90;
          },
          message: 'Coordinates must be [longitude, latitude] with valid ranges'
        }
      }
    },
    referrer: String,
    timestamp: Date,
    request_id: String,
    type: Schema.Types.Mixed,
    default: {}
  },
  context: {
    source: {
      type: String,
      required: true,
      enum: ['web', 'mobile', 'api', 'system', 'webhook', 'cron']
    },
    version: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'production'
    },
    service: String,
    type: Schema.Types.Mixed,
    default: {}
  },
  tags: {
    type: [String],
    default: [],
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  processed_at: {
    type: Date,
    index: true,
    sparse: true
  },
  retry_count: {
    type: Number,
    default: 0,
    min: 0
  },
  max_retries: {
    type: Number,
    default: 3,
    min: 0,
    max: 10
  },
  error_message: {
    type: String,
    maxlength: 1000
  },
  processing_duration: {
    type: Number,
    min: 0
  }
}, {
  timestamps: false, // We handle timestamps manually
  collection: 'events',
  versionKey: false
});

// =============================================================================
// Indexes
// =============================================================================

// Compound indexes for common queries
EventSchema.index({ bar_id: 1, event_type: 1, created_at: -1 });
EventSchema.index({ bar_id: 1, status: 1, priority: -1, created_at: 1 });
EventSchema.index({ bar_id: 1, user_id: 1, created_at: -1 });
EventSchema.index({ status: 1, priority: -1, created_at: 1 }); // For processing queue
EventSchema.index({ event_type: 1, event_name: 1, created_at: -1 });
EventSchema.index({ created_at: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

// Text index for searching
EventSchema.index({
  event_name: 'text',
  'data.title': 'text',
  'data.description': 'text',
  tags: 'text'
});

// =============================================================================
// Pre-save Middleware
// =============================================================================

EventSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  // Set metadata timestamp if not provided
  if (!this.metadata.timestamp) {
    this.metadata.timestamp = new Date();
  }
  
  // Validate event data based on type
  if (this.isModified('data') || this.isNew) {
    try {
      this.validateEventData();
    } catch (error: any) {
      return next(error);
    }
  }
  
  next();
});

// =============================================================================
// Instance Methods
// =============================================================================

/**
 * Mark event as processing
 */
EventSchema.methods.markAsProcessing = function(): Promise<IEvent> {
  this.status = 'processing';
  this.updated_at = new Date();
  return this.save();
};

/**
 * Mark event as processed
 */
EventSchema.methods.markAsProcessed = function(duration?: number): Promise<IEvent> {
  this.status = 'processed';
  this.processed_at = new Date();
  this.updated_at = new Date();
  
  if (duration !== undefined) {
    this.processing_duration = duration;
  }
  
  return this.save();
};

/**
 * Mark event as failed
 */
EventSchema.methods.markAsFailed = function(error: string): Promise<IEvent> {
  this.status = 'failed';
  this.error_message = error.substring(0, 1000); // Truncate to max length
  this.updated_at = new Date();
  return this.save();
};

/**
 * Check if event can be retried
 */
EventSchema.methods.canRetry = function(): boolean {
  return this.status === 'failed' && this.retry_count < this.max_retries;
};

/**
 * Retry failed event
 */
EventSchema.methods.retry = function(): Promise<IEvent> {
  if (!this.canRetry()) {
    throw new Error('Event cannot be retried');
  }
  
  this.status = 'pending';
  this.retry_count += 1;
  this.error_message = undefined;
  this.updated_at = new Date();
  
  return this.save();
};

/**
 * Check if event is real-time
 */
EventSchema.methods.isRealTime = function(): boolean {
  const realTimeEvents = [
    'song_played',
    'song_requested',
    'user_joined',
    'user_left',
    'queue_updated',
    'payment_completed',
    'order_placed'
  ];
  
  return realTimeEvents.includes(this.event_name) || this.priority === 'critical';
};

/**
 * Get processing age in milliseconds
 */
EventSchema.methods.getProcessingAge = function(): number {
  return Date.now() - this.created_at.getTime();
};

/**
 * Validate event data based on event type
 */
EventSchema.methods.validateEventData = function(): void {
  const { event_type, event_name, data } = this;
  
  switch (event_type) {
    case 'music':
      this.validateMusicEventData(event_name, data);
      break;
    case 'menu':
      this.validateMenuEventData(event_name, data);
      break;
    case 'user':
      this.validateUserEventData(event_name, data);
      break;
    case 'queue':
      this.validateQueueEventData(event_name, data);
      break;
    case 'payment':
      this.validatePaymentEventData(event_name, data);
      break;
    default:
      // Generic validation for other event types
      break;
  }
};

/**
 * Validate music event data
 */
EventSchema.methods.validateMusicEventData = function(eventName: string, data: any): void {
  const musicEvents = {
    'song_played': ['song_id', 'title', 'artist'],
    'song_requested': ['song_id', 'title', 'artist', 'user_id'],
    'song_voted': ['song_id', 'vote_type', 'user_id'],
    'song_skipped': ['song_id', 'reason'],
    'playlist_updated': ['playlist_id', 'action']
  };
  
  const requiredFields = musicEvents[eventName as keyof typeof musicEvents];
  if (requiredFields) {
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field '${field}' for music event '${eventName}'`);
      }
    }
  }
};

/**
 * Validate menu event data
 */
EventSchema.methods.validateMenuEventData = function(eventName: string, data: any): void {
  const menuEvents = {
    'product_ordered': ['product_id', 'name', 'quantity', 'price'],
    'product_sold': ['product_id', 'name', 'quantity', 'revenue'],
    'order_placed': ['order_id', 'items', 'total_amount'],
    'order_completed': ['order_id', 'completion_time'],
    'order_cancelled': ['order_id', 'reason']
  };
  
  const requiredFields = menuEvents[eventName as keyof typeof menuEvents];
  if (requiredFields) {
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field '${field}' for menu event '${eventName}'`);
      }
    }
  }
};

/**
 * Validate user event data
 */
EventSchema.methods.validateUserEventData = function(eventName: string, data: any): void {
  const userEvents = {
    'user_registered': ['user_id', 'email'],
    'user_login': ['user_id'],
    'user_logout': ['user_id'],
    'points_spent': ['user_id', 'amount', 'item_type'],
    'points_earned': ['user_id', 'amount', 'source'],
    'profile_updated': ['user_id', 'fields_updated']
  };
  
  const requiredFields = userEvents[eventName as keyof typeof userEvents];
  if (requiredFields) {
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field '${field}' for user event '${eventName}'`);
      }
    }
  }
};

/**
 * Validate queue event data
 */
EventSchema.methods.validateQueueEventData = function(eventName: string, data: any): void {
  const queueEvents = {
    'song_added_to_queue': ['song_id', 'user_id', 'position'],
    'song_removed_from_queue': ['song_id', 'user_id', 'reason'],
    'priority_play_purchased': ['song_id', 'user_id', 'cost'],
    'queue_reordered': ['user_id', 'new_order'],
    'queue_cleared': ['reason']
  };
  
  const requiredFields = queueEvents[eventName as keyof typeof queueEvents];
  if (requiredFields) {
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field '${field}' for queue event '${eventName}'`);
      }
    }
  }
};

/**
 * Validate payment event data
 */
EventSchema.methods.validatePaymentEventData = function(eventName: string, data: any): void {
  const paymentEvents = {
    'payment_initiated': ['payment_id', 'amount', 'currency', 'user_id'],
    'payment_completed': ['payment_id', 'amount', 'currency', 'user_id'],
    'payment_failed': ['payment_id', 'amount', 'currency', 'user_id', 'error_code'],
    'refund_processed': ['payment_id', 'refund_amount', 'reason']
  };
  
  const requiredFields = paymentEvents[eventName as keyof typeof paymentEvents];
  if (requiredFields) {
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field '${field}' for payment event '${eventName}'`);
      }
    }
  }
};

// =============================================================================
// Static Methods
// =============================================================================

/**
 * Get processing queue
 */
EventSchema.statics.getProcessingQueue = function(
  limit: number = 100,
  priority?: string
) {
  const query: any = { status: 'pending' };
  
  if (priority) {
    query.priority = priority;
  }
  
  return this.find(query)
    .sort({ priority: -1, created_at: 1 })
    .limit(limit);
};

/**
 * Get failed events that can be retried
 */
EventSchema.statics.getRetryableEvents = function(limit: number = 50) {
  return this.find({
    status: 'failed',
    $expr: { $lt: ['$retry_count', '$max_retries'] }
  })
  .sort({ updated_at: 1 })
  .limit(limit);
};

/**
 * Get events by bar and date range
 */
EventSchema.statics.getEventsByBarAndDateRange = function(
  barId: string,
  startDate: Date,
  endDate: Date,
  eventType?: string
) {
  const query: any = {
    bar_id: barId,
    created_at: { $gte: startDate, $lte: endDate }
  };
  
  if (eventType) {
    query.event_type = eventType;
  }
  
  return this.find(query).sort({ created_at: -1 });
};

/**
 * Get real-time events
 */
EventSchema.statics.getRealTimeEvents = function(
  barId: string,
  limit: number = 100
) {
  const realTimeEventNames = [
    'song_played',
    'song_requested',
    'user_joined',
    'user_left',
    'queue_updated',
    'payment_completed',
    'order_placed'
  ];
  
  return this.find({
    bar_id: barId,
    $or: [
      { event_name: { $in: realTimeEventNames } },
      { priority: 'critical' }
    ],
    created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
  })
  .sort({ created_at: -1 })
  .limit(limit);
};

/**
 * Clean up old processed events
 */
EventSchema.statics.cleanupOldEvents = function(
  daysOld: number = 30,
  statuses: string[] = ['processed']
) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  return this.deleteMany({
    status: { $in: statuses },
    created_at: { $lt: cutoffDate }
  });
};

/**
 * Get event statistics
 */
EventSchema.statics.getEventStatistics = function(
  barId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: any = {};
  
  if (barId) {
    matchStage.bar_id = barId;
  }
  
  if (startDate || endDate) {
    matchStage.created_at = {};
    if (startDate) matchStage.created_at.$gte = startDate;
    if (endDate) matchStage.created_at.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        byType: {
          $push: {
            type: '$event_type',
            count: 1
          }
        },
        byPriority: {
          $push: {
            priority: '$priority',
            count: 1
          }
        },
        avgProcessingTime: {
          $avg: {
            $cond: {
              if: { $ne: ['$processing_duration', null] },
              then: '$processing_duration',
              else: 0
            }
          }
        }
      }
    }
  ]);
};

// =============================================================================
// Model Export
// =============================================================================

export const Event = model<IEvent>('Event', EventSchema);
export default Event;