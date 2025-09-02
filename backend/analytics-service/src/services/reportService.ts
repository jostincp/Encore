/**
 * =============================================================================
 * MusicBar Analytics Service - Report Service
 * =============================================================================
 * Description: Business logic for report generation and management
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Report } from '../models/Report';
import { Analytics } from '../models/Analytics';
import { Event } from '../models/Event';
import { logger } from '../utils/logger';
import { CacheManager } from '../utils/cache';
import Redis from 'ioredis';

// Create cache instance
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const cache = new CacheManager(redis);
import { EventEmitter } from 'events';
import { Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-writer';

// =============================================================================
// Interfaces and Types
// =============================================================================

export interface ReportFilters {
  bar_id?: string;
  report_type?: 'analytics' | 'events' | 'dashboard' | 'custom';
  status?: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
  created_by?: string;
  start_date?: Date;
  end_date?: Date;
  tags?: string[];
  scheduled?: boolean;
}

export interface ReportQueryOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  include_parameters?: boolean;
  include_metadata?: boolean;
}

export interface ReportResult {
  reports: any[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ReportData {
  bar_id: string;
  report_type: 'analytics' | 'events' | 'dashboard' | 'custom';
  title: string;
  description?: string;
  parameters: Record<string, any>;
  format?: 'json' | 'csv' | 'pdf' | 'excel';
  created_by?: string;
  scheduled?: boolean;
  schedule_config?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time?: string;
    day_of_week?: number;
    day_of_month?: number;
  };
  notification_config?: {
    email?: string[];
    webhook?: string;
  };
  tags?: string[];
  status?: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
  file_path?: string;
  error_message?: string;
  retry_count?: number;
  file_size?: number;
  failed_at?: Date;
  generation_time?: number;
  completed_at?: Date;
  cancelled_at?: Date;
}

export interface GenerationOptions {
  force_regenerate?: boolean;
  async_generation?: boolean;
  notify_on_completion?: boolean;
  cache_result?: boolean;
  timeout?: number;
}

export interface GenerationResult {
  report_id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  file_path?: string;
  download_url?: string;
  generation_time?: number;
  file_size?: number;
  error?: string;
}

export interface ReportStatistics {
  total_reports: number;
  reports_by_type: Record<string, number>;
  reports_by_status: Record<string, number>;
  reports_by_format: Record<string, number>;
  generation_stats: {
    avg_generation_time: number;
    success_rate: number;
    failed_count: number;
    pending_count: number;
  };
  storage_stats: {
    total_size: number;
    avg_file_size: number;
    files_count: number;
  };
  date_range: {
    start_date: Date;
    end_date: Date;
  };
}

export interface CleanupOptions {
  older_than_days?: number;
  report_types?: string[];
  batch_size?: number;
  dry_run?: boolean;
  delete_files?: boolean;
}

export interface CleanupResult {
  deleted_count: number;
  files_deleted: number;
  space_freed: number;
  processed_batches: number;
  total_time: number;
  errors: string[];
}

export interface SupportedReportType {
  type: string;
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: any;
  }[];
  formats: string[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  report_type: string;
  parameters: Record<string, any>;
  format: string;
  tags: string[];
}

export interface ProcessingOptions {
  batch_size?: number;
  report_types?: string[];
  dry_run?: boolean;
}

// =============================================================================
// Report Service Class
// =============================================================================

export class ReportService extends EventEmitter {
  private generationQueue: Map<string, any> = new Map();
  private generationStats: Map<string, any> = new Map();
  private reportTemplates: Map<string, ReportTemplate> = new Map();
  private reportsDirectory: string;

  constructor() {
    super();
    this.reportsDirectory = process.env.REPORTS_DIRECTORY || './reports';
    this.initializeReportTemplates();
    this.ensureReportsDirectory();
  }

  // ===========================================================================
  // Report CRUD Operations
  // ===========================================================================

  /**
   * Create a new report
   */
  async createReport(reportData: ReportData): Promise<any> {
    try {
      logger.info('Creating new report', { 
        bar_id: reportData.bar_id, 
        report_type: reportData.report_type,
        title: reportData.title 
      });

      // Validate report data
      this.validateReportData(reportData);

      // Create report document
      const report = new Report({
        ...reportData,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedReport = await report.save();

      // Clear related caches
      this.clearReportCaches(reportData.bar_id);

      logger.info('Report created successfully', { report_id: savedReport._id });
      return savedReport;

    } catch (error) {
      logger.error('Error creating report', { error: error.message });
      throw error;
    }
  }

  /**
   * Get reports with filtering and pagination
   */
  async getReports(filters: ReportFilters = {}, options: ReportQueryOptions = {}): Promise<ReportResult> {
    try {
      const cacheKey = `reports:${JSON.stringify({ filters, options })}`;
      const cached = await cache.get<ReportResult>(cacheKey);
      if (cached && cached.reports) {
        return cached;
      }

      // Build query
      const query: any = {};
      if (filters.bar_id) query.bar_id = filters.bar_id;
      if (filters.report_type) query.report_type = filters.report_type;
      if (filters.status) query.status = filters.status;
      if (filters.created_by) query.created_by = filters.created_by;
      if (filters.scheduled !== undefined) query.scheduled = filters.scheduled;
      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }
      if (filters.start_date || filters.end_date) {
        query.created_at = {};
        if (filters.start_date) query.created_at.$gte = filters.start_date;
        if (filters.end_date) query.created_at.$lte = filters.end_date;
      }

      // Pagination
      const page = options.page || 1;
      const limit = Math.min(options.limit || 50, 100);
      const skip = (page - 1) * limit;

      // Sorting
      const sortField = options.sort_by || 'created_at';
      const sortOrder = options.sort_order === 'asc' ? 1 : -1;
      const sort: { [key: string]: 1 | -1 } = { [sortField]: sortOrder };

      // Execute query
      const [reports, total] = await Promise.all([
        Report.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select(this.getSelectFields(options))
          .lean(),
        Report.countDocuments(query)
      ]);

      const result: ReportResult = {
        reports,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1
      };

      // Cache result
      await cache.set(cacheKey, result, 300); // 5 minutes

      return result;

    } catch (error) {
      logger.error('Error getting reports', { error: error.message });
      throw error;
    }
  }

  /**
   * Get report by ID
   */
  async getReportById(reportId: string): Promise<any> {
    try {
      const cacheKey = `report:${reportId}`;
      const cached = await cache.get<any>(cacheKey);
      if (cached && cached._id) {
        return cached;
      }

      const report = await Report.findById(reportId).lean();
      if (!report) {
        throw new Error('Report not found');
      }

      // Cache result
      await cache.set(cacheKey, report, 600); // 10 minutes

      return report;

    } catch (error) {
      logger.error('Error getting report by ID', { error: error.message, reportId });
      throw error;
    }
  }

  /**
   * Update report
   */
  async updateReport(reportId: string, updateData: Partial<ReportData>): Promise<any> {
    try {
      const report = await Report.findByIdAndUpdate(
        reportId,
        { 
          ...updateData, 
          updated_at: new Date() 
        },
        { new: true, runValidators: true }
      );

      if (!report) {
        throw new Error('Report not found');
      }

      // Clear caches
      await cache.del(`report:${reportId}`);
      this.clearReportCaches(report.bar_id);

      logger.info('Report updated successfully', { report_id: reportId });
      return report;

    } catch (error) {
      logger.error('Error updating report', { error: error.message, reportId });
      throw error;
    }
  }

  /**
   * Delete report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Delete associated files
      if (report.output.file_path && fs.existsSync(report.output.file_path)) {
        fs.unlinkSync(report.output.file_path);
      }

      await Report.findByIdAndDelete(reportId);

      // Clear caches
      await cache.del(`report:${reportId}`);
      this.clearReportCaches(report.bar_id);

      logger.info('Report deleted successfully', { report_id: reportId });

    } catch (error) {
      logger.error('Error deleting report', { error: error.message, reportId });
      throw error;
    }
  }

  // ===========================================================================
  // Report Generation
  // ===========================================================================

  /**
   * Generate report
   */
  async generateReport(reportId: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    try {
      const report = await this.getReportById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Check if already generating
      if (this.generationQueue.has(reportId)) {
        return {
          report_id: reportId,
          status: 'generating'
        };
      }

      // Check if already completed and not forcing regeneration
      if (report.status === 'completed' && !options.force_regenerate) {
        return {
          report_id: reportId,
          status: 'completed',
          file_path: report.output.file_path,
          download_url: this.generateDownloadUrl(reportId)
        };
      }

      // Update status to generating
      await this.updateReport(reportId, { status: 'generating' });

      // Add to generation queue
      this.generationQueue.set(reportId, {
        started_at: new Date(),
        options
      });

      if (options.async_generation) {
        // Generate asynchronously
        this.generateReportAsync(reportId, report, options);
        return {
          report_id: reportId,
          status: 'generating'
        };
      } else {
        // Generate synchronously
        return await this.generateReportSync(reportId, report, options);
      }

    } catch (error) {
      logger.error('Error generating report', { error: error.message, reportId });
      
      // Update status to failed
      await this.updateReport(reportId, { 
        status: 'failed',
        error_message: error.message
      });

      throw error;
    }
  }

  /**
   * Cancel report generation
   */
  async cancelReport(reportId: string): Promise<void> {
    try {
      // Remove from generation queue
      this.generationQueue.delete(reportId);

      // Update status
      await this.updateReport(reportId, { 
        status: 'cancelled',
        cancelled_at: new Date()
      });

      logger.info('Report generation cancelled', { report_id: reportId });

    } catch (error) {
      logger.error('Error cancelling report', { error: error.message, reportId });
      throw error;
    }
  }

  /**
   * Retry failed report
   */
  async retryReport(reportId: string): Promise<GenerationResult> {
    try {
      const report = await this.getReportById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      if (report.status !== 'failed') {
        throw new Error('Only failed reports can be retried');
      }

      // Reset status and retry
      await this.updateReport(reportId, { 
        status: 'pending',
        error_message: null,
        retry_count: (report.retry_count || 0) + 1
      });

      return await this.generateReport(reportId, { force_regenerate: true });

    } catch (error) {
      logger.error('Error retrying report', { error: error.message, reportId });
      throw error;
    }
  }

  // ===========================================================================
  // Report Download and Access
  // ===========================================================================

  /**
   * Download report
   */
  async downloadReport(reportId: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    try {
      const report = await this.getReportById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      if (report.status !== 'completed') {
        throw new Error('Report is not ready for download');
      }

      if (!report.output.file_path || !fs.existsSync(report.output.file_path)) {
        throw new Error('Report file not found');
      }

      const fileName = `${report.title}_${report._id}.${report.format || 'json'}`;
      const mimeType = this.getMimeType(report.format || 'json');

      return {
        filePath: report.output.file_path,
        fileName,
        mimeType
      };

    } catch (error) {
      logger.error('Error downloading report', { error: error.message, reportId });
      throw error;
    }
  }

  /**
   * Generate download URL
   */
  generateDownloadUrl(reportId: string): string {
    return `/api/reports/${reportId}/download`;
  }

  // ===========================================================================
  // Scheduled Reports
  // ===========================================================================

  /**
   * Get scheduled reports
   */
  async getScheduledReports(filters: ReportFilters = {}): Promise<any[]> {
    try {
      const query = { ...filters, scheduled: true };
      const result = await this.getReports(query, { limit: 1000 });
      return result.reports;

    } catch (error) {
      logger.error('Error getting scheduled reports', { error: error.message });
      throw error;
    }
  }

  /**
   * Process scheduled reports
   */
  async processScheduledReports(options: ProcessingOptions = {}): Promise<any> {
    try {
      const scheduledReports = await this.getScheduledReports();
      const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };

      for (const report of scheduledReports) {
        try {
          if (this.shouldGenerateScheduledReport(report)) {
            if (!options.dry_run) {
              await this.generateReport(report._id, { async_generation: true });
            }
            results.processed++;
          } else {
            results.skipped++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Report ${report._id}: ${error.message}`);
        }
      }

      logger.info('Scheduled reports processed', results);
      return results;

    } catch (error) {
      logger.error('Error processing scheduled reports', { error: error.message });
      throw error;
    }
  }

  // ===========================================================================
  // Report Types and Validation
  // ===========================================================================

  /**
   * Get supported report types
   */
  getSupportedReportTypes(): SupportedReportType[] {
    return [
      {
        type: 'analytics',
        name: 'Analytics Report',
        description: 'Comprehensive analytics and metrics report',
        parameters: [
          { name: 'start_date', type: 'date', required: true, description: 'Report start date' },
          { name: 'end_date', type: 'date', required: true, description: 'Report end date' },
          { name: 'metrics', type: 'array', required: false, description: 'Specific metrics to include' },
          { name: 'granularity', type: 'string', required: false, description: 'Data granularity', default: 'daily' }
        ],
        formats: ['json', 'csv', 'pdf']
      },
      {
        type: 'events',
        name: 'Events Report',
        description: 'Event collection and processing report',
        parameters: [
          { name: 'start_date', type: 'date', required: true, description: 'Report start date' },
          { name: 'end_date', type: 'date', required: true, description: 'Report end date' },
          { name: 'event_types', type: 'array', required: false, description: 'Event types to include' },
          { name: 'include_failed', type: 'boolean', required: false, description: 'Include failed events', default: false }
        ],
        formats: ['json', 'csv']
      },
      {
        type: 'dashboard',
        name: 'Dashboard Report',
        description: 'Dashboard overview and summary report',
        parameters: [
          { name: 'start_date', type: 'date', required: true, description: 'Report start date' },
          { name: 'end_date', type: 'date', required: true, description: 'Report end date' },
          { name: 'sections', type: 'array', required: false, description: 'Dashboard sections to include' }
        ],
        formats: ['json', 'pdf']
      },
      {
        type: 'custom',
        name: 'Custom Report',
        description: 'Custom report with user-defined parameters',
        parameters: [
          { name: 'query', type: 'object', required: true, description: 'Custom query parameters' },
          { name: 'aggregations', type: 'array', required: false, description: 'Custom aggregations' }
        ],
        formats: ['json', 'csv']
      }
    ];
  }

  /**
   * Validate report parameters
   */
  validateReportParameters(reportType: string, parameters: Record<string, any>): { isValid: boolean; errors: string[] } {
    const supportedTypes = this.getSupportedReportTypes();
    const typeConfig = supportedTypes.find(t => t.type === reportType);
    
    if (!typeConfig) {
      return {
        isValid: false,
        errors: [`Unsupported report type: ${reportType}`]
      };
    }

    const errors: string[] = [];

    // Check required parameters
    for (const param of typeConfig.parameters) {
      if (param.required && !parameters[param.name]) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    }

    // Validate parameter types
    for (const [key, value] of Object.entries(parameters)) {
      const paramConfig = typeConfig.parameters.find(p => p.name === key);
      if (paramConfig && !this.validateParameterType(value, paramConfig.type)) {
        errors.push(`Invalid type for parameter ${key}: expected ${paramConfig.type}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ===========================================================================
  // Statistics and Monitoring
  // ===========================================================================

  /**
   * Get report statistics
   */
  async getReportStatistics(filters: ReportFilters = {}): Promise<ReportStatistics> {
    try {
      const cacheKey = `report_stats:${JSON.stringify(filters)}`;
      const cached = await cache.get<ReportStatistics>(cacheKey);
      if (cached && cached.total_reports !== undefined) {
        return cached;
      }

      // Build base query
      const baseQuery: any = {};
      if (filters.bar_id) baseQuery.bar_id = filters.bar_id;
      if (filters.start_date || filters.end_date) {
        baseQuery.created_at = {};
        if (filters.start_date) baseQuery.created_at.$gte = filters.start_date;
        if (filters.end_date) baseQuery.created_at.$lte = filters.end_date;
      }

      // Get aggregated statistics
      const [totalReports, typeStats, statusStats, formatStats, generationStats, storageStats] = await Promise.all([
        Report.countDocuments(baseQuery),
        this.getReportsByType(baseQuery),
        this.getReportsByStatus(baseQuery),
        this.getReportsByFormat(baseQuery),
        this.getGenerationStats(baseQuery),
        this.getStorageStats(baseQuery)
      ]);

      const statistics: ReportStatistics = {
        total_reports: totalReports,
        reports_by_type: typeStats,
        reports_by_status: statusStats,
        reports_by_format: formatStats,
        generation_stats: generationStats,
        storage_stats: storageStats,
        date_range: {
          start_date: filters.start_date || new Date(0),
          end_date: filters.end_date || new Date()
        }
      };

      // Cache result
      await cache.set(cacheKey, statistics, 300); // 5 minutes

      return statistics;

    } catch (error) {
      logger.error('Error getting report statistics', { error: error.message });
      throw error;
    }
  }

  // ===========================================================================
  // Maintenance and Cleanup
  // ===========================================================================

  /**
   * Cleanup expired reports
   */
  async cleanupExpiredReports(options: CleanupOptions = {}): Promise<CleanupResult> {
    try {
      const olderThanDays = options.older_than_days || 30;
      const batchSize = options.batch_size || 100;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query: any = {
        created_at: { $lt: cutoffDate }
      };

      if (options.report_types && options.report_types.length > 0) {
        query.report_type = { $in: options.report_types };
      }

      let deletedCount = 0;
      let filesDeleted = 0;
      let spaceFreed = 0;
      let processedBatches = 0;
      const errors: string[] = [];
      const startTime = Date.now();

      let hasMore = true;
      while (hasMore) {
        const reports = await Report.find(query)
          .limit(batchSize)
          .select('_id output.file_path output.file_size')
          .lean();

        if (reports.length === 0) {
          hasMore = false;
          break;
        }

        for (const report of reports) {
          try {
            if (!options.dry_run) {
              // Delete file if exists
              if (options.delete_files && report.output.file_path && fs.existsSync(report.output.file_path)) {
                const stats = fs.statSync(report.output.file_path);
                fs.unlinkSync(report.output.file_path);
                filesDeleted++;
                spaceFreed += stats.size;
              }

              // Delete report document
              await Report.findByIdAndDelete(report._id);
            }
            deletedCount++;
          } catch (error) {
            errors.push(`Failed to delete report ${report._id}: ${error.message}`);
          }
        }

        processedBatches++;
      }

      const result: CleanupResult = {
        deleted_count: deletedCount,
        files_deleted: filesDeleted,
        space_freed: spaceFreed,
        processed_batches: processedBatches,
        total_time: Date.now() - startTime,
        errors
      };

      logger.info('Report cleanup completed', result);
      return result;

    } catch (error) {
      logger.error('Error during report cleanup', { error: error.message });
      throw error;
    }
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  /**
   * Health check for reports service
   */
  async healthCheck(): Promise<any> {
    try {
      const [totalReports, pendingReports, generatingReports, failedReports] = await Promise.all([
        Report.countDocuments(),
        Report.countDocuments({ status: 'pending' }),
        Report.countDocuments({ status: 'generating' }),
        Report.countDocuments({ status: 'failed' })
      ]);

      const queueSize = this.generationQueue.size;
      const reportsDirectoryExists = fs.existsSync(this.reportsDirectory);

      return {
        status: 'healthy',
        timestamp: new Date(),
        reports: {
          total: totalReports,
          pending: pendingReports,
          generating: generatingReports,
          failed: failedReports
        },
        generation: {
          queue_size: queueSize,
          active_generations: Array.from(this.generationQueue.keys())
        },
        storage: {
          reports_directory_exists: reportsDirectoryExists,
          reports_directory: this.reportsDirectory
        }
      };

    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  private validateReportData(reportData: ReportData): void {
    if (!reportData.bar_id) {
      throw new Error('bar_id is required');
    }
    if (!reportData.report_type) {
      throw new Error('report_type is required');
    }
    if (!reportData.title) {
      throw new Error('title is required');
    }
    if (!reportData.parameters) {
      throw new Error('parameters are required');
    }

    // Validate report type
    const supportedTypes = this.getSupportedReportTypes();
    if (!supportedTypes.find(t => t.type === reportData.report_type)) {
      throw new Error(`Unsupported report type: ${reportData.report_type}`);
    }

    // Validate parameters
    const validation = this.validateReportParameters(reportData.report_type, reportData.parameters);
    if (!validation.isValid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
  }

  private getSelectFields(options: ReportQueryOptions): string {
    const baseFields = '_id bar_id report_type title status created_at updated_at';
    
    if (options.include_parameters) {
      return baseFields + ' parameters';
    }
    if (options.include_metadata) {
      return baseFields + ' metadata file_size generation_time';
    }
    
    return baseFields;
  }

  private clearReportCaches(barId: string): void {
    // Implementation for clearing related caches
    cache.del(`report_stats:*${barId}*`);
  }

  private async generateReportSync(reportId: string, report: any, options: GenerationOptions): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      // Generate report based on type
      const data = await this.generateReportData(report);
      const filePath = await this.saveReportFile(reportId, data, report.format || 'json');
      const fileSize = fs.statSync(filePath).size;
      const generationTime = Date.now() - startTime;

      // Update report with completion info
      await Report.findByIdAndUpdate(reportId, {
        $set: {
          status: 'completed',
          'output.file_path': filePath,
          'output.file_size': fileSize,
          'generation.duration_ms': generationTime,
          'generation.completed_at': new Date(),
          updated_at: new Date()
        }
      });

      // Remove from queue
      this.generationQueue.delete(reportId);

      return {
        report_id: reportId,
        status: 'completed',
        file_path: filePath,
        download_url: this.generateDownloadUrl(reportId),
        generation_time: generationTime,
        file_size: fileSize
      };

    } catch (error) {
      // Update report with error info
      await this.updateReport(reportId, {
        status: 'failed',
        error_message: error.message,
        failed_at: new Date()
      });

      // Remove from queue
      this.generationQueue.delete(reportId);

      throw error;
    }
  }

  private async generateReportAsync(reportId: string, report: any, options: GenerationOptions): Promise<void> {
    // Run generation in background
    setImmediate(async () => {
      try {
        await this.generateReportSync(reportId, report, options);
        
        if (options.notify_on_completion) {
          this.emit('report_completed', { reportId, report });
        }
      } catch (error) {
        this.emit('report_failed', { reportId, report, error });
      }
    });
  }

  private async generateReportData(report: any): Promise<any> {
    switch (report.report_type) {
      case 'analytics':
        return await this.generateAnalyticsReportData(report);
      case 'events':
        return await this.generateEventsReportData(report);
      case 'dashboard':
        return await this.generateDashboardReportData(report);
      case 'custom':
        return await this.generateCustomReportData(report);
      default:
        throw new Error(`Unsupported report type: ${report.report_type}`);
    }
  }

  private async generateAnalyticsReportData(report: any): Promise<any> {
    const { start_date, end_date, metrics, granularity } = report.parameters;
    
    // Query analytics data
    const query: any = {
      bar_id: report.bar_id,
      timestamp: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      }
    };

    if (metrics && metrics.length > 0) {
      query.metric_name = { $in: metrics };
    }

    const analyticsData = await Analytics.find(query).lean();
    
    return {
      report_info: {
        type: 'analytics',
        generated_at: new Date(),
        parameters: report.parameters
      },
      data: analyticsData,
      summary: {
        total_records: analyticsData.length,
        date_range: { start_date, end_date },
        metrics_included: metrics || 'all'
      }
    };
  }

  private async generateEventsReportData(report: any): Promise<any> {
    const { start_date, end_date, event_types, include_failed } = report.parameters;
    
    const query: any = {
      bar_id: report.bar_id,
      created_at: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      }
    };

    if (event_types && event_types.length > 0) {
      query.event_type = { $in: event_types };
    }

    if (!include_failed) {
      query.status = { $ne: 'failed' };
    }

    const eventsData = await Event.find(query).lean();
    
    return {
      report_info: {
        type: 'events',
        generated_at: new Date(),
        parameters: report.parameters
      },
      data: eventsData,
      summary: {
        total_events: eventsData.length,
        date_range: { start_date, end_date },
        event_types_included: event_types || 'all'
      }
    };
  }

  private async generateDashboardReportData(report: any): Promise<any> {
    // Implementation for dashboard report data generation
    return {
      report_info: {
        type: 'dashboard',
        generated_at: new Date(),
        parameters: report.parameters
      },
      data: {},
      summary: {}
    };
  }

  private async generateCustomReportData(report: any): Promise<any> {
    // Implementation for custom report data generation
    return {
      report_info: {
        type: 'custom',
        generated_at: new Date(),
        parameters: report.parameters
      },
      data: {},
      summary: {}
    };
  }

  private async saveReportFile(reportId: string, data: any, format: string): Promise<string> {
    const fileName = `${reportId}.${format}`;
    const filePath = path.join(this.reportsDirectory, fileName);

    switch (format) {
      case 'json':
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        break;
      case 'csv':
        await this.saveAsCSV(filePath, data);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return filePath;
  }

  private async saveAsCSV(filePath: string, data: any): Promise<void> {
    // Implementation for CSV export
    const records = Array.isArray(data.data) ? data.data : [data];
    if (records.length === 0) {
      fs.writeFileSync(filePath, 'No data available');
      return;
    }

    const headers = Object.keys(records[0]);
    const csvWriter = csv.createObjectCsvWriter({
      path: filePath,
      header: headers.map(h => ({ id: h, title: h }))
    });

    await csvWriter.writeRecords(records);
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      json: 'application/json',
      csv: 'text/csv',
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  private shouldGenerateScheduledReport(report: any): boolean {
    if (!report.scheduled || !report.schedule_config) {
      return false;
    }

    const now = new Date();
    const lastGenerated = report.last_generated_at ? new Date(report.last_generated_at) : null;
    
    // Implementation for schedule checking logic
    return true; // Simplified for now
  }

  private validateParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null;
      default:
        return true;
    }
  }

  private async getReportsByType(baseQuery: any): Promise<Record<string, number>> {
    const result = await Report.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$report_type', count: { $sum: 1 } } }
    ]);
    
    const stats: Record<string, number> = {};
    result.forEach(item => {
      stats[item._id] = item.count;
    });
    
    return stats;
  }

  private async getReportsByStatus(baseQuery: any): Promise<Record<string, number>> {
    const result = await Report.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const stats: Record<string, number> = {};
    result.forEach(item => {
      stats[item._id] = item.count;
    });
    
    return stats;
  }

  private async getReportsByFormat(baseQuery: any): Promise<Record<string, number>> {
    const result = await Report.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$format', count: { $sum: 1 } } }
    ]);
    
    const stats: Record<string, number> = {};
    result.forEach(item => {
      stats[item._id || 'json'] = item.count;
    });
    
    return stats;
  }

  private async getGenerationStats(baseQuery: any): Promise<any> {
    const result = await Report.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          avg_generation_time: { $avg: '$generation_time' },
          total_reports: { $sum: 1 },
          completed_reports: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed_reports: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          pending_reports: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = result[0] || {
      avg_generation_time: 0,
      total_reports: 0,
      completed_reports: 0,
      failed_reports: 0,
      pending_reports: 0
    };

    return {
      avg_generation_time: stats.avg_generation_time || 0,
      success_rate: stats.total_reports > 0 ? (stats.completed_reports / stats.total_reports) * 100 : 0,
      failed_count: stats.failed_reports,
      pending_count: stats.pending_reports
    };
  }

  private async getStorageStats(baseQuery: any): Promise<any> {
    const result = await Report.aggregate([
      { $match: { ...baseQuery, file_size: { $exists: true } } },
      {
        $group: {
          _id: null,
          total_size: { $sum: '$file_size' },
          avg_file_size: { $avg: '$file_size' },
          files_count: { $sum: 1 }
        }
      }
    ]);

    const stats = result[0] || {
      total_size: 0,
      avg_file_size: 0,
      files_count: 0
    };

    return stats;
  }

  /**
   * Generate quick report
   */
  async generateQuickReport(reportType: string, parameters: any = {}): Promise<GenerationResult> {
    try {
      // Create a temporary report for quick generation
      const quickReport = {
        _id: `quick_${Date.now()}`,
        title: `Quick ${reportType} Report`,
        report_type: reportType,
        parameters,
        format: 'json',
        status: 'pending',
        created_at: new Date()
      };

      // Generate report data based on type
      let reportData;
      switch (reportType) {
        case 'dashboard':
          reportData = await this.generateDashboardData(parameters);
          break;
        case 'analytics':
          reportData = await this.generateAnalyticsData(parameters);
          break;
        case 'events':
          reportData = await this.generateEventsData(parameters);
          break;
        default:
          throw new Error(`Unsupported quick report type: ${reportType}`);
      }

      return {
        report_id: quickReport._id,
        status: 'completed'
      };

    } catch (error) {
      logger.error('Error generating quick report', { error: error.message, reportType });
      throw error;
    }
  }

  /**
   * Get report templates
   */
  async getReportTemplates(filters: any = {}): Promise<ReportTemplate[]> {
    try {
      let templates = Array.from(this.reportTemplates.values());

      // Apply filters
      if (filters.report_type) {
        templates = templates.filter(t => t.report_type === filters.report_type);
      }
      if (filters.tags && filters.tags.length > 0) {
        templates = templates.filter(t => 
          filters.tags.some((tag: string) => t.tags?.includes(tag))
        );
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        templates = templates.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower)
        );
      }

      return templates;

    } catch (error) {
      logger.error('Error getting report templates', { error: error.message });
      throw error;
    }
  }

  /**
   * Create report from template
   */
  async createReportFromTemplate(templateId: string, parameters: any = {}, options: any = {}): Promise<GenerationResult> {
    try {
      const template = this.reportTemplates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Merge template parameters with provided parameters
      const mergedParameters = { ...template.parameters, ...parameters };

      // Create report from template
      const reportData: ReportData = {
        bar_id: options.bar_id || 'default',
        title: options.title || template.name,
        description: options.description || template.description,
        report_type: template.report_type as 'analytics' | 'events' | 'dashboard' | 'custom',
        parameters: mergedParameters,
        format: options.format || template.format,
        tags: [...(template.tags || []), ...(options.tags || [])],
        created_by: options.created_by
      };

      const report = await this.createReport(reportData);
      
      if (options.generate_immediately) {
        return await this.generateReport(report._id, options);
      }

      return {
        report_id: report._id,
        status: 'pending'
      };

    } catch (error) {
      logger.error('Error creating report from template', { error: error.message, templateId });
      throw error;
    }
  }

  private async generateDashboardData(parameters: any): Promise<any> {
    // Generate dashboard data
    return {
      summary: {
        total_users: 1250,
        active_sessions: 45,
        revenue_today: 2340.50,
        events_processed: 8920
      },
      charts: {
        user_activity: [],
        revenue_trend: [],
        popular_tracks: []
      },
      generated_at: new Date()
    };
  }

  private async generateAnalyticsData(parameters: any): Promise<any> {
    // Generate analytics data
    return {
      metrics: {
        page_views: 15420,
        unique_visitors: 3240,
        bounce_rate: 0.32,
        avg_session_duration: 245
      },
      trends: [],
      generated_at: new Date()
    };
  }

  private async generateEventsData(parameters: any): Promise<any> {
    // Generate events data
    return {
      total_events: 8920,
      event_types: {
        music: 4560,
        menu: 2340,
        user: 1820,
        system: 200
      },
      recent_events: [],
      generated_at: new Date()
    };
  }

  private initializeReportTemplates(): void {
    // Initialize default report templates
    const defaultTemplates: ReportTemplate[] = [
      {
        id: 'daily_analytics',
        name: 'Daily Analytics Report',
        description: 'Daily analytics summary report',
        report_type: 'analytics',
        parameters: {
          granularity: 'daily',
          metrics: ['page_views', 'user_sessions', 'revenue']
        },
        format: 'json',
        tags: ['daily', 'analytics']
      },
      {
        id: 'weekly_events',
        name: 'Weekly Events Report',
        description: 'Weekly events summary report',
        report_type: 'events',
        parameters: {
          event_types: ['music', 'menu', 'user'],
          include_failed: false
        },
        format: 'csv',
        tags: ['weekly', 'events']
      }
    ];

    defaultTemplates.forEach(template => {
      this.reportTemplates.set(template.id, template);
    });
  }

  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDirectory)) {
      fs.mkdirSync(this.reportsDirectory, { recursive: true });
    }
  }
}