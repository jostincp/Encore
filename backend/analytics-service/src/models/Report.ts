/**
 * =============================================================================
 * MusicBar Analytics Service - Report Model
 * =============================================================================
 * Description: MongoDB model for report generation and management
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Schema, model, Document, Types } from 'mongoose';
import path from 'path';
import fs from 'fs/promises';

// =============================================================================
// Interfaces
// =============================================================================

export interface IReport extends Document {
  _id: Types.ObjectId;
  bar_id: string;
  user_id?: string;
  name: string;
  description?: string;
  type: string;
  format: string;
  status: string;
  priority: string;
  parameters: {
    start_date?: Date;
    end_date?: Date;
    filters?: Record<string, any>;
    metrics?: string[];
    dimensions?: string[];
    aggregation?: string;
    timezone?: string;
    [key: string]: any;
  };
  schedule?: {
    enabled: boolean;
    frequency: string;
    interval: number;
    next_run?: Date;
    last_run?: Date;
    timezone?: string;
    recipients?: string[];
  };
  generation: {
    started_at?: Date;
    completed_at?: Date;
    duration_ms?: number;
    progress?: number;
    stage?: string;
    error_message?: string;
    retry_count?: number;
    max_retries?: number;
  };
  output: {
    file_path?: string;
    file_size?: number;
    download_url?: string;
    download_count?: number;
    expires_at?: Date;
    checksum?: string;
  };
  metadata: {
    total_records?: number;
    data_sources?: string[];
    query_performance?: {
      execution_time_ms?: number;
      records_processed?: number;
      cache_hits?: number;
    };
    version?: string;
    generator?: string;
    [key: string]: any;
  };
  tags: string[];
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
  
  // Instance methods
  isExpired(): boolean;
  canRetry(): boolean;
  markAsStarted(): Promise<IReport>;
  markAsCompleted(filePath: string, fileSize: number): Promise<IReport>;
  markAsFailed(errorMessage: string): Promise<IReport>;
  incrementRetry(): Promise<IReport>;
  updateProgress(progress: number, stage?: string): Promise<IReport>;
  generateDownloadUrl(): string;
  incrementDownloadCount(): Promise<IReport>;
  deleteFile(): Promise<void>;
  getEstimatedSize(): number;
  getDurationString(): string;
  validateParameters(): void;
  calculateNextRun(): void;
}

// =============================================================================
// Schema Definition
// =============================================================================

const ReportSchema = new Schema<IReport>({
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
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    required: true,
    enum: [
      'analytics_summary',
      'music_analytics',
      'menu_analytics',
      'user_analytics',
      'revenue_report',
      'events_log',
      'performance_report',
      'engagement_report',
      'custom_report'
    ],
    index: true
  },
  format: {
    type: String,
    required: true,
    enum: ['json', 'csv', 'pdf', 'xlsx', 'html'],
    default: 'json',
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: [
      'pending',
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled',
      'expired'
    ],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  parameters: {
    start_date: Date,
    end_date: Date,
    filters: {
      type: Schema.Types.Mixed,
      default: {}
    },
    metrics: {
      type: [String],
      default: []
    },
    dimensions: {
      type: [String],
      default: []
    },
    aggregation: {
      type: String,
      enum: ['sum', 'avg', 'count', 'min', 'max'],
      default: 'sum'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    type: Schema.Types.Mixed,
    default: {}
  },
  schedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'once'
    },
    interval: {
      type: Number,
      min: 1,
      default: 1
    },
    next_run: Date,
    last_run: Date,
    timezone: {
      type: String,
      default: 'UTC'
    },
    recipients: {
      type: [String],
      default: []
    }
  },
  generation: {
    started_at: Date,
    completed_at: Date,
    duration_ms: {
      type: Number,
      min: 0
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    stage: {
      type: String,
      enum: [
        'initializing',
        'querying_data',
        'processing_data',
        'formatting_output',
        'saving_file',
        'finalizing'
      ]
    },
    error_message: String,
    retry_count: {
      type: Number,
      min: 0,
      default: 0
    },
    max_retries: {
      type: Number,
      min: 0,
      default: 3
    }
  },
  output: {
    file_path: String,
    file_size: {
      type: Number,
      min: 0
    },
    download_url: String,
    download_count: {
      type: Number,
      min: 0,
      default: 0
    },
    expires_at: Date,
    checksum: String
  },
  metadata: {
    total_records: {
      type: Number,
      min: 0
    },
    data_sources: {
      type: [String],
      default: []
    },
    query_performance: {
      execution_time_ms: {
        type: Number,
        min: 0
      },
      records_processed: {
        type: Number,
        min: 0
      },
      cache_hits: {
        type: Number,
        min: 0
      }
    },
    version: {
      type: String,
      default: '1.0.0'
    },
    generator: {
      type: String,
      default: 'analytics-service'
    },
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
  expires_at: {
    type: Date,
    index: true,
    sparse: true
  }
}, {
  timestamps: false, // We handle timestamps manually
  collection: 'reports',
  versionKey: false
});

// =============================================================================
// Indexes
// =============================================================================

// Compound indexes for common queries
ReportSchema.index({ bar_id: 1, status: 1, created_at: -1 });
ReportSchema.index({ bar_id: 1, type: 1, created_at: -1 });
ReportSchema.index({ bar_id: 1, user_id: 1, created_at: -1 });
ReportSchema.index({ status: 1, priority: 1, created_at: 1 });
ReportSchema.index({ type: 1, status: 1, created_at: -1 });
ReportSchema.index({ 'schedule.enabled': 1, 'schedule.next_run': 1 });
ReportSchema.index({ 'generation.started_at': 1, status: 1 });

// TTL index for automatic cleanup
ReportSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Text index for searching
ReportSchema.index({
  name: 'text',
  description: 'text',
  tags: 'text'
});

// =============================================================================
// Pre-save Middleware
// =============================================================================

ReportSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  // Set default expires_at if not set
  if (!this.expires_at && this.status === 'completed') {
    // Reports expire after 30 days by default
    this.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  // Validate parameters based on report type
  if (this.isModified('parameters') || this.isNew) {
    try {
      this.validateParameters();
    } catch (error: any) {
      return next(error);
    }
  }
  
  // Update schedule next_run if schedule is enabled
  if (this.isModified('schedule') && this.schedule?.enabled) {
    try {
      this.calculateNextRun();
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
 * Check if report is expired
 */
ReportSchema.methods.isExpired = function(): boolean {
  return this.expires_at && this.expires_at < new Date();
};

/**
 * Check if report can be retried
 */
ReportSchema.methods.canRetry = function(): boolean {
  return this.status === 'failed' && 
         this.generation.retry_count < this.generation.max_retries;
};

/**
 * Mark report as started
 */
ReportSchema.methods.markAsStarted = function(): Promise<IReport> {
  this.status = 'processing';
  this.generation.started_at = new Date();
  this.generation.progress = 0;
  this.generation.stage = 'initializing';
  this.updated_at = new Date();
  return this.save();
};

/**
 * Mark report as completed
 */
ReportSchema.methods.markAsCompleted = function(
  filePath: string,
  fileSize: number
): Promise<IReport> {
  const now = new Date();
  this.status = 'completed';
  this.generation.completed_at = now;
  this.generation.progress = 100;
  this.generation.stage = 'finalizing';
  
  if (this.generation.started_at) {
    this.generation.duration_ms = now.getTime() - this.generation.started_at.getTime();
  }
  
  this.output.file_path = filePath;
  this.output.file_size = fileSize;
  this.output.download_url = this.generateDownloadUrl();
  
  // Set expiration date
  this.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  this.updated_at = now;
  return this.save();
};

/**
 * Mark report as failed
 */
ReportSchema.methods.markAsFailed = function(errorMessage: string): Promise<IReport> {
  this.status = 'failed';
  this.generation.error_message = errorMessage;
  this.updated_at = new Date();
  return this.save();
};

/**
 * Increment retry count
 */
ReportSchema.methods.incrementRetry = function(): Promise<IReport> {
  this.generation.retry_count += 1;
  this.status = 'pending';
  this.generation.error_message = undefined;
  this.generation.progress = 0;
  this.updated_at = new Date();
  return this.save();
};

/**
 * Update generation progress
 */
ReportSchema.methods.updateProgress = function(
  progress: number,
  stage?: string
): Promise<IReport> {
  this.generation.progress = Math.max(0, Math.min(100, progress));
  if (stage) {
    this.generation.stage = stage;
  }
  this.updated_at = new Date();
  return this.save();
};

/**
 * Generate download URL
 */
ReportSchema.methods.generateDownloadUrl = function(): string {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/api/analytics/reports/${this._id}/download`;
};

/**
 * Increment download count
 */
ReportSchema.methods.incrementDownloadCount = function(): Promise<IReport> {
  this.output.download_count += 1;
  this.updated_at = new Date();
  return this.save();
};

/**
 * Delete associated file
 */
ReportSchema.methods.deleteFile = async function(): Promise<void> {
  if (this.output.file_path) {
    try {
      await fs.unlink(this.output.file_path);
    } catch (error) {
      // File might not exist, ignore error
      console.warn(`Failed to delete report file: ${this.output.file_path}`, error);
    }
  }
};

/**
 * Get estimated file size based on parameters
 */
ReportSchema.methods.getEstimatedSize = function(): number {
  // Basic estimation based on report type and date range
  const baseSize = {
    analytics_summary: 50000, // 50KB
    music_analytics: 100000,  // 100KB
    menu_analytics: 75000,    // 75KB
    user_analytics: 80000,    // 80KB
    revenue_report: 60000,    // 60KB
    events_log: 200000,       // 200KB
    performance_report: 120000, // 120KB
    engagement_report: 90000,   // 90KB
    custom_report: 100000       // 100KB
  }[this.type] || 100000;
  
  // Adjust based on date range
  if (this.parameters.start_date && this.parameters.end_date) {
    const days = Math.ceil(
      (this.parameters.end_date.getTime() - this.parameters.start_date.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    return baseSize * Math.max(1, days / 7); // Scale by weeks
  }
  
  return baseSize;
};

/**
 * Get duration as human readable string
 */
ReportSchema.methods.getDurationString = function(): string {
  if (!this.generation.duration_ms) {
    return 'N/A';
  }
  
  const seconds = Math.floor(this.generation.duration_ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Validate report parameters
 */
ReportSchema.methods.validateParameters = function(): void {
  const { type, parameters } = this;
  
  // Basic parameter validation
  if (!parameters) {
    throw new Error('Report parameters are required');
  }
  
  // Date range validation
  if (parameters.start_date && parameters.end_date) {
    if (parameters.start_date >= parameters.end_date) {
      throw new Error('Start date must be before end date');
    }
    
    // Check if date range is reasonable (not more than 1 year)
    const daysDiff = Math.ceil(
      (parameters.end_date.getTime() - parameters.start_date.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    if (daysDiff > 365) {
      throw new Error('Date range cannot exceed 1 year');
    }
  }
  
  // Type-specific validations
  switch (type) {
    case 'music_analytics':
      if (parameters.metrics && parameters.metrics.length === 0) {
        throw new Error('Music analytics reports require at least one metric');
      }
      break;
    
    case 'revenue_report':
      if (!parameters.start_date || !parameters.end_date) {
        throw new Error('Revenue reports require start_date and end_date');
      }
      break;
    
    case 'events_log':
      if (!parameters.start_date) {
        throw new Error('Events log reports require start_date');
      }
      break;
  }
};

/**
 * Calculate next run time for scheduled reports
 */
ReportSchema.methods.calculateNextRun = function(): void {
  if (!this.schedule?.enabled) {
    return;
  }
  
  const now = new Date();
  const { frequency, interval } = this.schedule;
  let nextRun: Date;
  
  switch (frequency) {
    case 'daily':
      nextRun = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
      break;
    
    case 'weekly':
      nextRun = new Date(now.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
      break;
    
    case 'monthly':
      nextRun = new Date(now);
      nextRun.setMonth(nextRun.getMonth() + interval);
      break;
    
    case 'quarterly':
      nextRun = new Date(now);
      nextRun.setMonth(nextRun.getMonth() + interval * 3);
      break;
    
    case 'yearly':
      nextRun = new Date(now);
      nextRun.setFullYear(nextRun.getFullYear() + interval);
      break;
    
    default:
      return; // 'once' or invalid frequency
  }
  
  this.schedule.next_run = nextRun;
};

/**
 * Validate parameters based on report type
 */
ReportSchema.methods.validateParameters = function(): void {
  const { type, parameters } = this;
  
  // Common validations
  if (parameters.start_date && parameters.end_date) {
    if (parameters.start_date >= parameters.end_date) {
      throw new Error('start_date must be before end_date');
    }
    
    // Check if date range is not too large (max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in ms
    if (parameters.end_date.getTime() - parameters.start_date.getTime() > maxRange) {
      throw new Error('Date range cannot exceed 1 year');
    }
  }
  
  // Type-specific validations
  switch (type) {
    case 'music_analytics':
      if (parameters.metrics && parameters.metrics.length === 0) {
        throw new Error('Music analytics reports require at least one metric');
      }
      break;
    
    case 'revenue_report':
      if (!parameters.start_date || !parameters.end_date) {
        throw new Error('Revenue reports require start_date and end_date');
      }
      break;
    
    case 'events_log':
      if (!parameters.start_date) {
        throw new Error('Events log reports require start_date');
      }
      break;
  }
};

/**
 * Calculate next run time for scheduled reports
 */
ReportSchema.methods.calculateNextRun = function(): void {
  if (!this.schedule?.enabled) {
    return;
  }
  
  const now = new Date();
  const { frequency, interval } = this.schedule;
  let nextRun: Date;
  
  switch (frequency) {
    case 'daily':
      nextRun = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
      break;
    
    case 'weekly':
      nextRun = new Date(now.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
      break;
    
    case 'monthly':
      nextRun = new Date(now);
      nextRun.setMonth(nextRun.getMonth() + interval);
      break;
    
    case 'quarterly':
      nextRun = new Date(now);
      nextRun.setMonth(nextRun.getMonth() + interval * 3);
      break;
    
    case 'yearly':
      nextRun = new Date(now);
      nextRun.setFullYear(nextRun.getFullYear() + interval);
      break;
    
    default:
      return; // 'once' or invalid frequency
  }
  
  this.schedule.next_run = nextRun;
};

// =============================================================================
// Static Methods
// =============================================================================

/**
 * Get reports by status
 */
ReportSchema.statics.getByStatus = function(
  status: string,
  barId?: string,
  limit: number = 50
) {
  const query: any = { status };
  if (barId) {
    query.bar_id = barId;
  }
  
  return this.find(query)
    .sort({ created_at: -1 })
    .limit(limit);
};

/**
 * Get pending reports for processing
 */
ReportSchema.statics.getPendingReports = function(limit: number = 10) {
  return this.find({
    status: { $in: ['pending', 'queued'] }
  })
  .sort({ priority: 1, created_at: 1 }) // High priority first, then FIFO
  .limit(limit);
};

/**
 * Get scheduled reports due for execution
 */
ReportSchema.statics.getScheduledReportsDue = function() {
  return this.find({
    'schedule.enabled': true,
    'schedule.next_run': { $lte: new Date() },
    status: { $ne: 'processing' }
  });
};

/**
 * Get reports by bar and date range
 */
ReportSchema.statics.getByBarAndDateRange = function(
  barId: string,
  startDate: Date,
  endDate: Date,
  status?: string
) {
  const query: any = {
    bar_id: barId,
    created_at: { $gte: startDate, $lte: endDate }
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query).sort({ created_at: -1 });
};

/**
 * Get report statistics
 */
ReportSchema.statics.getStatistics = function(
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
        total_reports: { $sum: 1 },
        by_status: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        by_type: {
          $push: {
            type: '$type',
            count: 1
          }
        },
        by_format: {
          $push: {
            format: '$format',
            count: 1
          }
        },
        total_downloads: { $sum: '$output.download_count' },
        total_file_size: { $sum: '$output.file_size' },
        avg_generation_time: { $avg: '$generation.duration_ms' },
        failed_reports: {
          $sum: {
            $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        total_reports: 1,
        status_breakdown: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: {
                  $map: {
                    input: '$by_status',
                    as: 'item',
                    in: '$$item.status'
                  }
                }
              },
              as: 'status',
              in: {
                k: '$$status',
                v: {
                  $size: {
                    $filter: {
                      input: '$by_status',
                      cond: { $eq: ['$$this.status', '$$status'] }
                    }
                  }
                }
              }
            }
          }
        },
        type_breakdown: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: {
                  $map: {
                    input: '$by_type',
                    as: 'item',
                    in: '$$item.type'
                  }
                }
              },
              as: 'type',
              in: {
                k: '$$type',
                v: {
                  $size: {
                    $filter: {
                      input: '$by_type',
                      cond: { $eq: ['$$this.type', '$$type'] }
                    }
                  }
                }
              }
            }
          }
        },
        format_breakdown: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: {
                  $map: {
                    input: '$by_format',
                    as: 'item',
                    in: '$$item.format'
                  }
                }
              },
              as: 'format',
              in: {
                k: '$$format',
                v: {
                  $size: {
                    $filter: {
                      input: '$by_format',
                      cond: { $eq: ['$$this.format', '$$format'] }
                    }
                  }
                }
              }
            }
          }
        },
        total_downloads: 1,
        total_file_size: 1,
        avg_generation_time_ms: '$avg_generation_time',
        failed_reports: 1,
        success_rate: {
          $multiply: [
            {
              $divide: [
                { $subtract: ['$total_reports', '$failed_reports'] },
                '$total_reports'
              ]
            },
            100
          ]
        }
      }
    }
  ]);
};

/**
 * Clean up expired reports
 */
ReportSchema.statics.cleanupExpired = async function() {
  const expiredReports = await this.find({
    $or: [
      { expires_at: { $lt: new Date() } },
      {
        status: 'completed',
        created_at: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // 90 days old
      }
    ]
  });
  
  // Delete associated files
  for (const report of expiredReports) {
    await report.deleteFile();
  }
  
  // Delete reports from database
  const result = await this.deleteMany({
    _id: { $in: expiredReports.map(r => r._id) }
  });
  
  return {
    deleted_count: result.deletedCount,
    files_cleaned: expiredReports.length
  };
};

/**
 * Get recent reports
 */
ReportSchema.statics.getRecent = function(
  barId?: string,
  limit: number = 10,
  status?: string
) {
  const query: any = {};
  
  if (barId) {
    query.bar_id = barId;
  }
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .select('name type format status created_at generation.duration_ms output.file_size');
};

// =============================================================================
// Model Export
// =============================================================================

export const Report = model<IReport>('Report', ReportSchema);
export default Report;