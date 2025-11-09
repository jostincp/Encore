/**
 * =============================================================================
 * Encore Analytics Service - Reports Controller
 * =============================================================================
 * Description: Controller for report generation and management endpoints
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Request, Response } from 'express';
import { ReportService } from '../services/reportService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

// =============================================================================
// Reports Controller Class
// =============================================================================

export class ReportsController {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create new report
   * POST /api/reports
   */
  async createReport(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const reportData = req.body;
      const result = await this.reportService.createReport(reportData);

      res.status(201).json({
        success: true,
        message: 'Report created successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error creating report', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to create report',
        error: error.message
      });
    }
  }

  /**
   * Get all reports with filtering and pagination
   * GET /api/reports
   */
  async getReports(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const filters = {
        bar_id: req.query.bar_id as string,
        report_type: req.query.report_type as 'analytics' | 'events' | 'dashboard' | 'custom',
        status: req.query.status as 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled',
        created_by: req.query.created_by as string,
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        sort_by: req.query.sort_by as string || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
        include_parameters: req.query.include_parameters === 'true',
        include_metadata: req.query.include_metadata === 'true'
      };

      const result = await this.reportService.getReports(filters, options);

      res.json({
        success: true,
        message: 'Reports retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve reports',
        error: error.message
      });
    }
  }

  /**
   * Get report by ID
   * GET /api/reports/:id
   */
  async getReportById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.reportService.getReportById(id);

      res.json({
        success: true,
        message: 'Report retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting report by ID', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found') {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve report',
          error: error.message
        });
      }
    }
  }

  /**
   * Update report
   * PUT /api/reports/:id
   */
  async updateReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const updateData = req.body;
      const result = await this.reportService.updateReport(id, updateData);

      res.json({
        success: true,
        message: 'Report updated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error updating report', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found') {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update report',
          error: error.message
        });
      }
    }
  }

  /**
   * Delete report
   * DELETE /api/reports/:id
   */
  async deleteReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.reportService.deleteReport(id);

      res.json({
        success: true,
        message: 'Report deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting report', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found') {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete report',
          error: error.message
        });
      }
    }
  }

  // ===========================================================================
  // Report Generation
  // ===========================================================================

  /**
   * Generate report
   * POST /api/reports/:id/generate
   */
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const options = {
        force_regenerate: req.body.force_regenerate === true,
        async_generation: req.body.async_generation !== false,
        notify_on_completion: req.body.notify_on_completion === true
      };

      const result = await this.reportService.generateReport(id, options);

      res.json({
        success: true,
        message: 'Report generation started successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error generating report', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found') {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to generate report',
          error: error.message
        });
      }
    }
  }

  /**
   * Cancel report generation
   * POST /api/reports/:id/cancel
   */
  async cancelReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.reportService.cancelReport(id);

      res.json({
        success: true,
        message: 'Report generation cancelled successfully'
      });

    } catch (error) {
      logger.error('Error cancelling report', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found') {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to cancel report',
          error: error.message
        });
      }
    }
  }

  /**
   * Retry report generation
   * POST /api/reports/:id/retry
   */
  async retryReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.reportService.retryReport(id);

      res.json({
        success: true,
        message: 'Report retry started successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error retrying report', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found') {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to retry report',
          error: error.message
        });
      }
    }
  }

  // ===========================================================================
  // Download and Access
  // ===========================================================================

  /**
   * Download report file
   * GET /api/reports/:id/download
   */
  async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.reportService.downloadReport(id);

      // Use Express response.download to stream file
      res.download(result.filePath, result.fileName);

    } catch (error) {
      logger.error('Error downloading report', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found' || error.message === 'Report file not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to download report',
          error: error.message
        });
      }
    }
  }

  /**
   * Get report download URL
   * GET /api/reports/:id/download-url
   */
  async getDownloadUrl(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const expiresIn = parseInt(req.query.expires_in as string) || 3600; // 1 hour default
      // ReportService exposes generateDownloadUrl; expire handling is not implemented for local files
      const url = this.reportService.generateDownloadUrl(id);

      res.json({
        success: true,
        message: 'Download URL generated successfully',
        data: { url, expires_in: expiresIn }
      });

    } catch (error) {
      logger.error('Error getting download URL', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found' || error.message === 'Report file not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to get download URL',
          error: error.message
        });
      }
    }
  }

  // ===========================================================================
  // Scheduled Reports
  // ===========================================================================

  /**
   * Get scheduled reports
   * GET /api/reports/scheduled/list
   */
  async getScheduledReports(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        report_type: req.query.report_type as 'analytics' | 'events' | 'dashboard' | 'custom',
        is_active: req.query.is_active === 'true'
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50
      };

      const result = await this.reportService.getScheduledReports(filters);

      res.json({
        success: true,
        message: 'Scheduled reports retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting scheduled reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve scheduled reports',
        error: error.message
      });
    }
  }

  /**
   * Process scheduled reports
   * POST /api/reports/scheduled/process
   */
  async processScheduledReports(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const options = {
        bar_id: req.body.bar_id,
        report_types: req.body.report_types,
        batch_size: req.body.batch_size || 10,
        dry_run: req.body.dry_run === true
      };

      const result = await this.reportService.processScheduledReports(options);

      res.json({
        success: true,
        message: 'Scheduled reports processing completed',
        data: result
      });

    } catch (error) {
      logger.error('Error processing scheduled reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to process scheduled reports',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Report Types and Validation
  // ===========================================================================

  /**
   * Get supported report types
   * GET /api/reports/types/supported
   */
  async getSupportedReportTypes(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.reportService.getSupportedReportTypes();

      res.json({
        success: true,
        message: 'Supported report types retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting supported report types', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve supported report types',
        error: error.message
      });
    }
  }

  /**
   * Validate report parameters
   * POST /api/reports/validate/parameters
   */
  async validateReportParameters(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { report_type, parameters } = req.body;
      const result = await this.reportService.validateReportParameters(report_type, parameters);

      res.json({
        success: true,
        message: 'Report parameters validation completed',
        data: result
      });

    } catch (error) {
      logger.error('Error validating report parameters', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to validate report parameters',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Statistics and Monitoring
  // ===========================================================================

  /**
   * Get report statistics overview
   * GET /api/reports/statistics/overview
   */
  async getReportStatistics(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const filters = {
        bar_id: req.query.bar_id as string,
        report_type: req.query.report_type as 'analytics' | 'events' | 'dashboard' | 'custom',
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined
      };

      const result = await this.reportService.getReportStatistics(filters);

      res.json({
        success: true,
        message: 'Report statistics retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting report statistics', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report statistics',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Maintenance and Cleanup
  // ===========================================================================

  /**
   * Clean up expired reports
   * DELETE /api/reports/cleanup/expired
   */
  async cleanupExpiredReports(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const options = {
        older_than_days: parseInt(req.query.older_than_days as string) || 30,
        report_types: req.query.report_types ? (req.query.report_types as string).split(',') : undefined,
        batch_size: parseInt(req.query.batch_size as string) || 100,
        dry_run: req.query.dry_run === 'true',
        delete_files: req.query.delete_files !== 'false'
      };

      const result = await this.reportService.cleanupExpiredReports(options);

      res.json({
        success: true,
        message: 'Expired reports cleanup completed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error cleaning up expired reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup expired reports',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  /**
   * Health check for reports service
   * GET /api/reports/health/check
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.reportService.healthCheck();

      const statusCode = result.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json({
        success: result.status === 'healthy',
        message: `Reports service is ${result.status}`,
        data: result
      });

    } catch (error) {
      logger.error('Reports health check failed', { error: error.message });
      res.status(503).json({
        success: false,
        message: 'Reports service is unhealthy',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Type-specific Reports
  // ===========================================================================

  /**
   * Get analytics reports
   * GET /api/reports/analytics/list
   */
  async getAnalyticsReports(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        report_type: 'analytics' as 'analytics' | 'events' | 'dashboard' | 'custom',
        status: req.query.status as 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50
      };

      const result = await this.reportService.getReports(filters, options);

      res.json({
        success: true,
        message: 'Analytics reports retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting analytics reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics reports',
        error: error.message
      });
    }
  }

  /**
   * Get events reports
   * GET /api/reports/events/list
   */
  async getEventsReports(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        report_type: 'events' as 'analytics' | 'events' | 'dashboard' | 'custom',
        status: req.query.status as 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50
      };

      const result = await this.reportService.getReports(filters, options);

      res.json({
        success: true,
        message: 'Events reports retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting events reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve events reports',
        error: error.message
      });
    }
  }

  /**
   * Get dashboard reports
   * GET /api/reports/dashboard/list
   */
  async getDashboardReports(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        report_type: 'dashboard' as 'analytics' | 'events' | 'dashboard' | 'custom',
        status: req.query.status as 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50
      };

      const result = await this.reportService.getReports(filters, options);

      res.json({
        success: true,
        message: 'Dashboard reports retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting dashboard reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard reports',
        error: error.message
      });
    }
  }

  /**
   * Get custom reports
   * GET /api/reports/custom/list
   */
  async getCustomReports(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        report_type: 'custom' as 'analytics' | 'events' | 'dashboard' | 'custom',
        status: req.query.status as 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50
      };

      const result = await this.reportService.getReports(filters, options);

      res.json({
        success: true,
        message: 'Custom reports retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting custom reports', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve custom reports',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Quick Report Generation
  // ===========================================================================

  /**
   * Generate quick analytics report
   * POST /api/reports/quick/analytics
   */
  async generateQuickAnalyticsReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const parameters = {
        bar_id: req.body.bar_id,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        metrics: req.body.metrics || ['all'],
        format: req.body.format || 'json'
      };

      const result = await this.reportService.generateQuickReport('analytics', parameters);

      res.json({
        success: true,
        message: 'Quick analytics report generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error generating quick analytics report', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to generate quick analytics report',
        error: error.message
      });
    }
  }

  /**
   * Generate quick events report
   * POST /api/reports/quick/events
   */
  async generateQuickEventsReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const parameters = {
        bar_id: req.body.bar_id,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        event_types: req.body.event_types || ['all'],
        format: req.body.format || 'json'
      };

      const result = await this.reportService.generateQuickReport('events', parameters);

      res.json({
        success: true,
        message: 'Quick events report generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error generating quick events report', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to generate quick events report',
        error: error.message
      });
    }
  }

  /**
   * Generate quick dashboard report
   * POST /api/reports/quick/dashboard
   */
  async generateQuickDashboardReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const parameters = {
        bar_id: req.body.bar_id,
        time_range: req.body.time_range || 'day',
        widgets: req.body.widgets || ['all'],
        format: req.body.format || 'json'
      };

      const result = await this.reportService.generateQuickReport('dashboard', parameters);

      res.json({
        success: true,
        message: 'Quick dashboard report generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error generating quick dashboard report', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to generate quick dashboard report',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Report Templates
  // ===========================================================================

  /**
   * Get report templates
   * GET /api/reports/templates/list
   */
  async getReportTemplates(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        report_type: req.query.report_type as string,
        is_active: req.query.is_active === 'true'
      };

      const result = await this.reportService.getReportTemplates(filters);

      res.json({
        success: true,
        message: 'Report templates retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting report templates', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report templates',
        error: error.message
      });
    }
  }

  /**
   * Create report from template
   * POST /api/reports/templates/:template_id/create
   */
  async createReportFromTemplate(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { template_id } = req.params;
      const parameters = req.body.parameters || {};
      const options = {
        auto_generate: req.body.auto_generate !== false,
        schedule: req.body.schedule
      };

      const result = await this.reportService.createReportFromTemplate(template_id, parameters, options);

      res.status(201).json({
        success: true,
        message: 'Report created from template successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error creating report from template', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to create report from template',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Generate multiple reports in bulk
   * POST /api/reports/bulk/generate
   */
  async bulkGenerateReports(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { report_ids } = req.body;
      const options = {
        batch_size: req.body.batch_size || 5,
        max_parallel: req.body.max_parallel || 3,
        force_regenerate: req.body.force_regenerate === true
      };

      // Bulk report generation functionality not implemented in service yet
      res.status(501).json({
        success: false,
        message: 'Bulk report generation functionality not implemented yet'
      });

    } catch (error) {
      logger.error('Error in bulk report generation', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to start bulk report generation',
        error: error.message
      });
    }
  }

  /**
   * Delete multiple reports in bulk
   * DELETE /api/reports/bulk/delete
   */
  async bulkDeleteReports(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { report_ids } = req.body;
      const options = {
        delete_files: req.body.delete_files !== false,
        batch_size: req.body.batch_size || 10
      };

      // Bulk report deletion functionality not implemented in service yet
      res.status(501).json({
        success: false,
        message: 'Bulk report deletion functionality not implemented yet'
      });

    } catch (error) {
      logger.error('Error in bulk report deletion', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to delete reports in bulk',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Sharing and Permissions
  // ===========================================================================

  /**
   * Share report
   * POST /api/reports/:id/share
   */
  async shareReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const shareOptions = {
        share_with: req.body.share_with,
        permissions: req.body.permissions || ['read'],
        expires_at: req.body.expires_at ? new Date(req.body.expires_at) : undefined,
        message: req.body.message
      };

      // Share report functionality not implemented in service yet
      res.status(501).json({
        success: false,
        message: 'Share report functionality not implemented yet'
      });

    } catch (error) {
      logger.error('Error sharing report', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to share report',
        error: error.message
      });
    }
  }

  /**
   * Get report permissions
   * GET /api/reports/:id/permissions
   */
  async getReportPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Get report permissions functionality not implemented in service yet
      res.status(501).json({
        success: false,
        message: 'Get report permissions functionality not implemented yet'
      });

    } catch (error) {
      logger.error('Error getting report permissions', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report permissions',
        error: error.message
      });
    }
  }

  /**
   * Update report permissions
   * PUT /api/reports/:id/permissions
   */
  async updateReportPermissions(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const permissions = req.body.permissions;
      // Update report permissions functionality not implemented in service yet
      res.status(501).json({
        success: false,
        message: 'Update report permissions functionality not implemented yet'
      });

    } catch (error) {
      logger.error('Error updating report permissions', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to update report permissions',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // History and Versions
  // ===========================================================================

  /**
   * Get report history
   * GET /api/reports/:id/history
   */
  async getReportHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      // Get report history functionality not implemented in service yet
      res.status(501).json({
        success: false,
        message: 'Get report history functionality not implemented yet'
      });

    } catch (error) {
      logger.error('Error getting report history', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report history',
        error: error.message
      });
    }
  }

  /**
   * Get report versions
   * GET /api/reports/:id/versions
   */
  async getReportVersions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Get report versions functionality not implemented in service yet
      res.status(501).json({
        success: false,
        message: 'Get report versions functionality not implemented yet'
      });

    } catch (error) {
      logger.error('Error getting report versions', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report versions',
        error: error.message
      });
    }
  }

  /**
   * Cancel report generation
   * POST /api/reports/:id/cancel
   */
  async cancelReportGeneration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.reportService.cancelReport(id);

      res.json({
        success: true,
        message: 'Report generation cancelled successfully'
      });

    } catch (error) {
      logger.error('Error cancelling report generation', { error: error.message, id: req.params.id });
      
      if (error.message === 'Report not found') {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      } else if (error.message === 'Report generation cannot be cancelled') {
        res.status(400).json({
          success: false,
          message: 'Report generation cannot be cancelled'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to cancel report generation',
          error: error.message
        });
      }
    }
  }

  /**
   * Generate quick report
   * POST /api/reports/quick
   */
  async generateQuickReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const reportData = {
        title: req.body.title || `Quick ${req.body.report_type} Report`,
        report_type: req.body.report_type,
        bar_id: req.body.bar_id,
        parameters: req.body.parameters || {},
        format: req.body.format || 'json'
      };

      // Create report first
      const report = await this.reportService.createReport(reportData);
      
      // Generate it immediately
      const result = await this.reportService.generateReport(report._id, { async_generation: false });
      
      res.json({
        success: true,
        message: 'Quick report generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error generating quick report', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to generate quick report',
        error: error.message
      });
    }
  }

  // Default export compatibility
}

export default ReportsController;