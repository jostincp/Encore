/**
 * =============================================================================
 * Encore Analytics Service - Events Controller
 * =============================================================================
 * Description: Controller for event tracking and management endpoints
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Request, Response } from 'express';
import { EventService } from '../services/eventService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

// =============================================================================
// Events Controller Class
// =============================================================================

export class EventsController {
  private eventService: EventService;

  constructor() {
    this.eventService = new EventService();
  }

  // ===========================================================================
  // Event Operations
  // ===========================================================================

  /**
   * Create new event
   * POST /api/events
   */
  async createEvent(req: Request, res: Response): Promise<void> {
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

      const eventData = req.body;
      const result = await this.eventService.createEvent(eventData);

      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error creating event', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to create event',
        error: error.message
      });
    }
  }

  /**
   * Get events with filtering
   * GET /api/events
   */
  async getEvents(req: Request, res: Response): Promise<void> {
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
        event_type: req.query.event_type as any,
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        sort_by: req.query.sort_by as string || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc'
      };

      const result = await this.eventService.getEvents(filters, options);

      res.json({
        success: true,
        message: 'Events retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting events', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve events',
        error: error.message
      });
    }
  }

  /**
   * Get event by ID
   * GET /api/events/:id
   */
  async getEventById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.eventService.getEventById(id);

      res.json({
        success: true,
        message: 'Event retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting event by ID', { error: error.message, id: req.params.id });
      
      if (error.message === 'Event not found') {
        res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve event',
          error: error.message
        });
      }
    }
  }

  /**
   * Update event
   * PUT /api/events/:id
   */
  async updateEvent(req: Request, res: Response): Promise<void> {
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
      const result = await this.eventService.updateEvent(id, updateData);

      res.json({
        success: true,
        message: 'Event updated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error updating event', { error: error.message, id: req.params.id });
      
      if (error.message === 'Event not found') {
        res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update event',
          error: error.message
        });
      }
    }
  }

  /**
   * Delete event
   * DELETE /api/events/:id
   */
  async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.eventService.deleteEvent(id);

      res.json({
        success: true,
        message: 'Event deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting event', { error: error.message, id: req.params.id });
      
      if (error.message === 'Event not found') {
        res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete event',
          error: error.message
        });
      }
    }
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Create events in bulk
   * POST /api/events/bulk
   */
  async createEventsBulk(req: Request, res: Response): Promise<void> {
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

      const { events } = req.body;
      const result = await this.eventService.createEventsBulk(events);

      res.status(201).json({
        success: true,
        message: 'Events created in bulk successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error creating events in bulk', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to create events in bulk',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Event Processing
  // ===========================================================================

  /**
   * Process single event
   * POST /api/events/:id/process
   */
  async processEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.eventService.processEvent(id);

      res.json({
        success: true,
        message: 'Event processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error processing event', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to process event',
        error: error.message
      });
    }
  }

  /**
   * Process events in batch
   * POST /api/events/process-batch
   */
  async processEventsBatch(req: Request, res: Response): Promise<void> {
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

      const { options } = req.body;
      const result = await this.eventService.processEventsBatch(options);

      res.json({
        success: true,
        message: 'Events batch processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error processing events batch', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to process events batch',
        error: error.message
      });
    }
  }

  /**
   * Get processing queue status
   * GET /api/events/queue-status
   */
  async getProcessingQueueStatus(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.eventService.getProcessingQueueStatus();

      res.json({
        success: true,
        message: 'Processing queue status retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting processing queue status', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get processing queue status',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Statistics and Analytics
  // ===========================================================================

  /**
   * Get event statistics
   * GET /api/events/statistics
   */
  async getEventStatistics(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        event_type: req.query.event_type as any,
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined
      };

      const result = await this.eventService.getEventStatistics(filters);

      res.json({
        success: true,
        message: 'Event statistics retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting event statistics', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get event statistics',
        error: error.message
      });
    }
  }

  /**
   * Get real-time events
   * GET /api/events/real-time
   */
  async getRealTimeEvents(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        event_type: req.query.event_type as any,
        limit: parseInt(req.query.limit as string) || 100
      };

      const result = await this.eventService.getRealTimeEvents(filters.bar_id as string);

      res.json({
        success: true,
        message: 'Real-time events retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting real-time events', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get real-time events',
        error: error.message
      });
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get supported event types
   * GET /api/events/types
   */
  async getSupportedEventTypes(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.eventService.getSupportedEventTypes();

      res.json({
        success: true,
        message: 'Supported event types retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error getting supported event types', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get supported event types',
        error: error.message
      });
    }
  }

  /**
   * Validate event data
   * POST /api/events/validate
   */
  async validateEventData(req: Request, res: Response): Promise<void> {
    try {
      const eventData = req.body;
      const result = await this.eventService.validateEventData(eventData);

      res.json({
        success: true,
        message: 'Event data validated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error validating event data', { error: error.message });
      res.status(400).json({
        success: false,
        message: 'Event data validation failed',
        error: error.message
      });
    }
  }

  /**
   * Export events
   * GET /api/events/export
   */
  async exportEvents(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        bar_id: req.query.bar_id as string,
        event_type: req.query.event_type as any,
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        format: (req.query.format as 'json' | 'csv') || 'json'
      };

      const result = await this.eventService.exportEvents(filters);

      res.json({
        success: true,
        message: 'Events exported successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error exporting events', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to export events',
        error: error.message
      });
    }
  }

  /**
   * Cleanup old events
   * DELETE /api/events/cleanup
   */
  async cleanupOldEvents(req: Request, res: Response): Promise<void> {
    try {
      const options = {
        older_than_days: parseInt(req.query.older_than_days as string) || 90,
        batch_size: parseInt(req.query.batch_size as string) || 1000,
        dry_run: req.query.dry_run === 'true'
      };

      const result = await this.eventService.cleanupOldEvents(options);

      res.json({
        success: true,
        message: 'Old events cleanup completed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error cleaning up old events', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup old events',
        error: error.message
      });
    }
  }

  /**
   * Health check
   * GET /api/events/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.eventService.healthCheck();

      res.json({
        success: true,
        message: 'Events service health check completed',
        data: result
      });

    } catch (error) {
      logger.error('Error in events health check', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Events service health check failed',
        error: error.message
      });
    }
  }
}