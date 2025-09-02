/**
 * =============================================================================
 * MusicBar Analytics Service - Analytics Model
 * =============================================================================
 * Description: MongoDB model for processed analytics and metrics
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Schema, model, Model, Types, Document } from 'mongoose';

// =============================================================================
// Interfaces
// =============================================================================

export interface IAnalytics {
  bar_id: string;
  metric_type: string;
  metric_name: string;
  metric_category: string;
  value: number;
  unit: string;
  dimensions: Record<string, any>;
  filters: Record<string, any>;
  aggregation_type: string;
  aggregation_period: string;
  date: Date;
  period_start: Date;
  period_end: Date;
  tags: string[];
  metadata: {
    source_events?: number;
    calculation_method?: string;
    confidence_score?: number;
    data_quality?: string;
    last_updated?: Date;
    [key: string]: any;
  };
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IAnalyticsDocument extends IAnalytics, Document {
  _id: Types.ObjectId;
  aggregation_type: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'unique' | 'rate';
  aggregation_period: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  metadata: {
    source_events?: number;
    calculation_method?: string;
    confidence_score?: number;
    data_quality?: 'high' | 'medium' | 'low';
    last_updated?: Date;
    version?: string;
    [key: string]: any;
  };
  
  // Instance methods
  isExpired(): boolean;
  updateValue(newValue: number, metadata?: Record<string, any>): Promise<IAnalyticsDocument>;
  addDimension(key: string, value: any): Promise<IAnalyticsDocument>;
  getAgeInHours(): number;
  calculateExpirationDate(): Date;
  validateDimensions(): void;
}

// =============================================================================
// Static Methods Interface
// =============================================================================

export interface IAnalyticsModel extends Model<IAnalyticsDocument> {
  upsertMetric(
    barId: string,
    metricType: string,
    metricName: string,
    value: number,
    options?: {
      date?: Date;
      aggregationPeriod?: string;
      aggregationType?: string;
      dimensions?: Record<string, any>;
      metadata?: Record<string, any>;
      unit?: string;
      category?: string;
    }
  ): Promise<IAnalyticsDocument>;
  
  getByBarAndDateRange(
    barId: string,
    startDate: Date,
    endDate: Date,
    metricType?: string,
    aggregationPeriod?: string
  ): Promise<IAnalyticsDocument[]>;
  
  getLatestByMetric(
    barId: string,
    metricType: string,
    metricName: string,
    aggregationPeriod?: string
  ): Promise<IAnalyticsDocument | null>;
  
  calculatePeriodBoundaries(
    date: Date,
    period: string
  ): { periodStart: Date; periodEnd: Date };
  
  getAggregatedMetrics(
    barId: string,
    metricType: string,
    startDate: Date,
    endDate: Date,
    groupBy?: string[],
    aggregationType?: string
  ): Promise<any[]>;
  
  getTimeSeries(
    barId: string,
    metricName: string,
    startDate: Date,
    endDate: Date,
    aggregationPeriod?: string
  ): Promise<IAnalyticsDocument[]>;
  
  getTopMetrics(
    barId: string,
    metricType: string,
    startDate: Date,
    endDate: Date,
    limit?: number,
    dimensionKey?: string
  ): Promise<any[]>;
  
  cleanupExpired(): Promise<any>;
  
  getSummary(
    barId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]>;
}

// =============================================================================
// Schema Definition
// =============================================================================

const AnalyticsSchema = new Schema<IAnalyticsDocument>({
  bar_id: {
    type: String,
    required: true,
    index: true
  },
  metric_type: {
    type: String,
    required: true,
    enum: [
      'music',
      'menu',
      'user',
      'queue',
      'payment',
      'engagement',
      'performance',
      'revenue',
      'system',
      'custom'
    ],
    index: true
  },
  metric_name: {
    type: String,
    required: true,
    index: true
  },
  metric_category: {
    type: String,
    required: true,
    enum: [
      'activity',
      'behavior',
      'conversion',
      'engagement',
      'performance',
      'quality',
      'revenue',
      'usage',
      'satisfaction',
      'retention'
    ],
    index: true
  },
  value: {
    type: Number,
    required: true,
    index: true
  },
  unit: {
    type: String,
    required: true,
    enum: [
      'count',
      'percentage',
      'currency',
      'time_seconds',
      'time_minutes',
      'time_hours',
      'bytes',
      'rate_per_second',
      'rate_per_minute',
      'rate_per_hour',
      'score',
      'ratio',
      'custom'
    ],
    default: 'count'
  },
  dimensions: {
    type: Schema.Types.Mixed,
    default: {},
    index: true
  },
  filters: {
    type: Schema.Types.Mixed,
    default: {}
  },
  aggregation_type: {
    type: String,
    enum: ['sum', 'count', 'avg', 'min', 'max', 'unique', 'rate'],
    required: true,
    index: true
  },
  aggregation_period: {
    type: String,
    enum: ['minute', 'hour', 'day', 'week', 'month', 'year'],
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  period_start: {
    type: Date,
    required: true,
    index: true
  },
  period_end: {
    type: Date,
    required: true,
    index: true
  },
  tags: {
    type: [String],
    default: [],
    index: true
  },
  metadata: {
    source_events: {
      type: Number,
      min: 0
    },
    calculation_method: String,
    confidence_score: {
      type: Number,
      min: 0,
      max: 1
    },
    data_quality: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'high'
    },
    last_updated: Date,
    version: {
      type: String,
      default: '1.0.0'
    },
    type: Schema.Types.Mixed,
    default: {}
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
  expires_at: {
    type: Date,
    index: true,
    sparse: true
  }
}, {
  timestamps: false, // We handle timestamps manually
  collection: 'analytics',
  versionKey: false
});

// =============================================================================
// Indexes
// =============================================================================

// Compound indexes for common queries
AnalyticsSchema.index({ bar_id: 1, metric_type: 1, date: -1 });
AnalyticsSchema.index({ bar_id: 1, metric_name: 1, date: -1 });
AnalyticsSchema.index({ bar_id: 1, metric_category: 1, date: -1 });
AnalyticsSchema.index({ bar_id: 1, aggregation_period: 1, date: -1 });
AnalyticsSchema.index({ metric_type: 1, metric_name: 1, date: -1 });
AnalyticsSchema.index({ date: 1, aggregation_period: 1 });
AnalyticsSchema.index({ period_start: 1, period_end: 1 });

// Unique compound index to prevent duplicates
AnalyticsSchema.index({
  bar_id: 1,
  metric_type: 1,
  metric_name: 1,
  aggregation_period: 1,
  date: 1,
  'dimensions.key': 1
}, { unique: true, sparse: true });

// TTL index for automatic cleanup
AnalyticsSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Text index for searching
AnalyticsSchema.index({
  metric_name: 'text',
  metric_category: 'text',
  tags: 'text'
});

// =============================================================================
// Pre-save Middleware
// =============================================================================

AnalyticsSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  // Set metadata last_updated
  if (!this.metadata.last_updated) {
    this.metadata.last_updated = new Date();
  }
  
  // Validate period dates
  if (this.period_start >= this.period_end) {
    return next(new Error('period_start must be before period_end'));
  }
  
  // Set expires_at based on aggregation period if not set
  if (!this.expires_at) {
    this.expires_at = this.calculateExpirationDate();
  }
  
  // Validate dimensions
  if (this.isModified('dimensions') || this.isNew) {
    try {
      this.validateDimensions();
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
 * Check if analytics record is expired
 */
AnalyticsSchema.methods.isExpired = function(): boolean {
  return this.expires_at && this.expires_at < new Date();
};

/**
 * Update analytics value
 */
AnalyticsSchema.methods.updateValue = function(
  newValue: number,
  metadata?: Record<string, any>
): Promise<IAnalyticsDocument> {
  this.value = newValue;
  this.updated_at = new Date();
  this.metadata.last_updated = new Date();
  
  if (metadata) {
    Object.assign(this.metadata, metadata);
  }
  
  return this.save();
};

/**
 * Add dimension to analytics record
 */
AnalyticsSchema.methods.addDimension = function(
  key: string,
  value: any
): Promise<IAnalyticsDocument> {
  this.dimensions[key] = value;
  this.updated_at = new Date();
  return this.save();
};

/**
 * Get age of analytics record in hours
 */
AnalyticsSchema.methods.getAgeInHours = function(): number {
  return (Date.now() - this.created_at.getTime()) / (1000 * 60 * 60);
};

/**
 * Calculate expiration date based on aggregation period
 */
AnalyticsSchema.methods.calculateExpirationDate = function(): Date {
  const now = new Date();
  const expirationPeriods = {
    minute: 24 * 60 * 60 * 1000, // 1 day
    hour: 7 * 24 * 60 * 60 * 1000, // 7 days
    day: 90 * 24 * 60 * 60 * 1000, // 90 days
    week: 365 * 24 * 60 * 60 * 1000, // 1 year
    month: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
    year: 5 * 365 * 24 * 60 * 60 * 1000 // 5 years
  };
  
  const expirationMs = expirationPeriods[this.aggregation_period] || expirationPeriods.day;
  return new Date(now.getTime() + expirationMs);
};

/**
 * Validate dimensions based on metric type
 */
AnalyticsSchema.methods.validateDimensions = function(): void {
  const { metric_type, metric_name, dimensions } = this;
  
  // Define required dimensions for different metric types
  const requiredDimensions: Record<string, Record<string, string[]>> = {
    music: {
      song_plays: ['song_id'],
      genre_popularity: ['genre'],
      artist_plays: ['artist'],
      playlist_usage: ['playlist_id']
    },
    menu: {
      product_sales: ['product_id'],
      category_revenue: ['category'],
      order_value: [],
      item_popularity: ['product_id']
    },
    user: {
      user_activity: ['user_id'],
      registration_rate: [],
      engagement_score: ['user_id'],
      retention_rate: []
    },
    queue: {
      queue_length: [],
      wait_time: [],
      priority_usage: [],
      skip_rate: []
    },
    payment: {
      transaction_volume: [],
      payment_method_usage: ['payment_method'],
      revenue_by_source: ['source'],
      conversion_rate: []
    }
  };
  
  const typeRequirements = requiredDimensions[metric_type];
  if (typeRequirements) {
    const metricRequirements = typeRequirements[metric_name];
    if (metricRequirements) {
      for (const requiredDim of metricRequirements) {
        if (!dimensions[requiredDim]) {
          throw new Error(`Missing required dimension '${requiredDim}' for metric '${metric_name}'`);
        }
      }
    }
  }
};

// =============================================================================
// Static Methods
// =============================================================================

/**
 * Get analytics by bar and date range
 */
AnalyticsSchema.statics.getByBarAndDateRange = function(
  barId: string,
  startDate: Date,
  endDate: Date,
  metricType?: string,
  aggregationPeriod?: string
) {
  const query: any = {
    bar_id: barId,
    date: { $gte: startDate, $lte: endDate }
  };
  
  if (metricType) {
    query.metric_type = metricType;
  }
  
  if (aggregationPeriod) {
    query.aggregation_period = aggregationPeriod;
  }
  
  return this.find(query).sort({ date: -1 });
};

/**
 * Get latest analytics for a metric
 */
AnalyticsSchema.statics.getLatestByMetric = function(
  barId: string,
  metricType: string,
  metricName: string,
  aggregationPeriod: string = 'day'
) {
  return this.findOne({
    bar_id: barId,
    metric_type: metricType,
    metric_name: metricName,
    aggregation_period: aggregationPeriod
  }).sort({ date: -1 });
};

/**
 * Upsert analytics record
 */
AnalyticsSchema.statics.upsertMetric = function(
  barId: string,
  metricType: string,
  metricName: string,
  value: number,
  options: {
    date?: Date;
    aggregationPeriod?: string;
    aggregationType?: string;
    dimensions?: Record<string, any>;
    metadata?: Record<string, any>;
    unit?: string;
    category?: string;
  } = {}
) {
  const {
    date = new Date(),
    aggregationPeriod = 'day',
    aggregationType = 'sum',
    dimensions = {},
    metadata = {},
    unit = 'count',
    category = 'activity'
  } = options;
  
  // Calculate period boundaries
  const { periodStart, periodEnd } = (this.constructor as any).calculatePeriodBoundaries(date, aggregationPeriod);
  
  const query = {
    bar_id: barId,
    metric_type: metricType,
    metric_name: metricName,
    aggregation_period: aggregationPeriod,
    date: periodStart
  };
  
  const update = {
    $set: {
      metric_category: category,
      value: value,
      unit: unit,
      dimensions: dimensions,
      aggregation_type: aggregationType,
      period_start: periodStart,
      period_end: periodEnd,
      metadata: {
        ...metadata,
        last_updated: new Date()
      },
      updated_at: new Date()
    },
    $setOnInsert: {
      created_at: new Date(),
      tags: []
    }
  };
  
  return this.findOneAndUpdate(query, update, {
    upsert: true,
    new: true,
    runValidators: true
  });
};

/**
 * Calculate period boundaries
 */
AnalyticsSchema.statics.calculatePeriodBoundaries = function(
  date: Date,
  period: string
): { periodStart: Date; periodEnd: Date } {
  const d = new Date(date);
  let periodStart: Date;
  let periodEnd: Date;
  
  switch (period) {
    case 'minute':
      periodStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0);
      periodEnd = new Date(periodStart.getTime() + 60 * 1000 - 1);
      break;
    
    case 'hour':
      periodStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0);
      periodEnd = new Date(periodStart.getTime() + 60 * 60 * 1000 - 1);
      break;
    
    case 'day':
      periodStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;
    
    case 'week':
      const dayOfWeek = d.getDay();
      periodStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek, 0, 0, 0, 0);
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      break;
    
    case 'month':
      periodStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    
    case 'year':
      periodStart = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
      periodEnd = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    
    default:
      throw new Error(`Unsupported aggregation period: ${period}`);
  }
  
  return { periodStart, periodEnd };
};

/**
 * Get aggregated metrics
 */
AnalyticsSchema.statics.getAggregatedMetrics = function(
  barId: string,
  metricType: string,
  startDate: Date,
  endDate: Date,
  groupBy: string[] = ['metric_name'],
  aggregationType: string = 'sum'
) {
  const groupStage: any = {
    _id: {}
  };
  
  // Build group by fields
  groupBy.forEach(field => {
    if (field.startsWith('dimensions.')) {
      groupStage._id[field.replace('dimensions.', '')] = `$${field}`;
    } else {
      groupStage._id[field] = `$${field}`;
    }
  });
  
  // Build aggregation
  switch (aggregationType) {
    case 'sum':
      groupStage.total = { $sum: '$value' };
      break;
    case 'avg':
      groupStage.average = { $avg: '$value' };
      break;
    case 'count':
      groupStage.count = { $sum: 1 };
      break;
    case 'min':
      groupStage.minimum = { $min: '$value' };
      break;
    case 'max':
      groupStage.maximum = { $max: '$value' };
      break;
    default:
      groupStage.total = { $sum: '$value' };
  }
  
  return this.aggregate([
    {
      $match: {
        bar_id: barId,
        metric_type: metricType,
        date: { $gte: startDate, $lte: endDate }
      }
    },
    { $group: groupStage },
    { $sort: { total: -1 } }
  ]);
};

/**
 * Get time series data
 */
AnalyticsSchema.statics.getTimeSeries = function(
  barId: string,
  metricName: string,
  startDate: Date,
  endDate: Date,
  aggregationPeriod: string = 'day'
) {
  return this.find({
    bar_id: barId,
    metric_name: metricName,
    aggregation_period: aggregationPeriod,
    date: { $gte: startDate, $lte: endDate }
  })
  .sort({ date: 1 })
  .select('date value dimensions metadata');
};

/**
 * Get top metrics by value
 */
AnalyticsSchema.statics.getTopMetrics = function(
  barId: string,
  metricType: string,
  startDate: Date,
  endDate: Date,
  limit: number = 10,
  dimensionKey?: string
) {
  const matchStage: any = {
    bar_id: barId,
    metric_type: metricType,
    date: { $gte: startDate, $lte: endDate }
  };
  
  const groupStage: any = {
    _id: {
      metric_name: '$metric_name'
    },
    total_value: { $sum: '$value' },
    count: { $sum: 1 },
    avg_value: { $avg: '$value' }
  };
  
  if (dimensionKey) {
    groupStage._id[dimensionKey] = `$dimensions.${dimensionKey}`;
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $group: groupStage },
    { $sort: { total_value: -1 } },
    { $limit: limit }
  ]);
};

/**
 * Clean up expired analytics
 */
AnalyticsSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expires_at: { $lt: new Date() }
  });
};

/**
 * Get analytics summary
 */
AnalyticsSchema.statics.getSummary = function(
  barId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: any = {};
  
  if (barId) {
    matchStage.bar_id = barId;
  }
  
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = startDate;
    if (endDate) matchStage.date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total_records: { $sum: 1 },
        unique_metrics: { $addToSet: '$metric_name' },
        metric_types: { $addToSet: '$metric_type' },
        total_value: { $sum: '$value' },
        avg_value: { $avg: '$value' },
        date_range: {
          $min: '$date',
          $max: '$date'
        }
      }
    },
    {
      $project: {
        total_records: 1,
        unique_metrics_count: { $size: '$unique_metrics' },
        metric_types_count: { $size: '$metric_types' },
        metric_types: 1,
        total_value: 1,
        avg_value: 1,
        date_range: 1
      }
    }
  ]);
};

// =============================================================================
// Model Export
// =============================================================================

export const Analytics = model<IAnalyticsDocument, IAnalyticsModel>('Analytics', AnalyticsSchema);
export default Analytics;