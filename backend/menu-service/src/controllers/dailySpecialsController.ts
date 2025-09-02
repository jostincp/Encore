import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { MenuModel } from '../models/Menu';
import { AuthenticatedRequest, ApiResponse, logInfo, logError, CreateDailySpecialData, UpdateDailySpecialData } from '../types/shared';

export class DailySpecialsController {
  // Get daily specials for a bar
  static async getDailySpecials(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
        return;
      }

      const { barId } = req.params;
      
      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
        return;
      }
      
      const { active_only = 'true' } = req.query;
      const activeOnly = active_only === 'true';

      const specials = await MenuModel.getDailySpecials(barId, activeOnly);

      res.json({
        success: true,
        data: {
          specials,
          total: specials.length
        }
      });

      logInfo('Daily specials retrieved:', {
        barId,
        activeOnly,
        total: specials.length
      });
    } catch (error) {
      logError('Error getting daily specials:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get single daily special
  static async getDailySpecial(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
        return;
      }

      const { specialId } = req.params;

      if (!specialId) {
        res.status(400).json({
          success: false,
          message: 'Special ID is required'
        });
        return;
      }

      const special = await MenuModel.getDailySpecial(specialId);

      if (!special) {
        res.status(404).json({
          success: false,
          message: 'Daily special not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { special }
      });

      logInfo('Daily special retrieved:', { specialId });
    } catch (error) {
      logError('Error getting daily special:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Create daily special (Admin/Bar Owner only)
  static async createDailySpecial(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
        return;
      }

      // Check permissions
      if (!req.user || !['admin', 'bar_owner'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      const { barId } = req.params;
      
      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
        return;
      }
      
      const {
        menu_item_id,
        special_price,
        description,
        valid_from,
        valid_until
      } = req.body;

      // Validate dates
      const validFromDate = new Date(valid_from);
      const validUntilDate = new Date(valid_until);

      if (validFromDate >= validUntilDate) {
        res.status(400).json({
          success: false,
          message: 'Valid from date must be before valid until date'
        });
        return;
      }

      if (validUntilDate <= new Date()) {
        res.status(400).json({
          success: false,
          message: 'Valid until date must be in the future'
        });
        return;
      }

      const specialData: CreateDailySpecialData = {
        bar_id: barId,
        menu_item_id,
        special_price: special_price || undefined,
        description: description || undefined,
        start_date: validFromDate,
        end_date: validUntilDate
      };

      const special = await MenuModel.createDailySpecial(specialData);

      res.status(201).json({
        success: true,
        message: 'Daily special created successfully',
        data: { special }
      });

      logInfo('Daily special created:', {
        specialId: special.id,
        barId,
        menuItemId: menu_item_id,
        userId: req.user.id
      });
    } catch (error) {
      logError('Error creating daily special:', error);
      
      if ((error as Error).message.includes('Menu item not found')) {
        res.status(404).json({
          success: false,
          message: 'Menu item not found or does not belong to this bar'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update daily special (Admin/Bar Owner only)
  static async updateDailySpecial(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
        return;
      }

      // Check permissions
      if (!req.user || !['admin', 'bar_owner'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      const { specialId } = req.params;
      
      if (!specialId) {
        res.status(400).json({
          success: false,
          message: 'Special ID is required'
        });
        return;
      }
      
      const updateData: UpdateDailySpecialData = {};

      // Only include provided fields
      if (req.body.special_price !== undefined) {
        updateData.special_price = req.body.special_price;
      }
      if (req.body.description !== undefined) {
        updateData.description = req.body.description;
      }
      if (req.body.valid_from !== undefined) {
        updateData.start_date = new Date(req.body.valid_from);
      }
      if (req.body.valid_until !== undefined) {
        updateData.end_date = new Date(req.body.valid_until);
      }
      if (req.body.is_active !== undefined) {
        updateData.is_active = req.body.is_active;
      }

      // Validate date range if both dates are provided
      if (updateData.start_date && updateData.end_date) {
        if (updateData.start_date >= updateData.end_date) {
          res.status(400).json({
            success: false,
            message: 'Start date must be before end date'
          });
          return;
        }
      }

      const special = await MenuModel.updateDailySpecial(specialId, updateData);

      if (!special) {
        res.status(404).json({
          success: false,
          message: 'Daily special not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Daily special updated successfully',
        data: { special }
      });

      logInfo('Daily special updated:', {
        specialId,
        userId: req.user.id
      });
    } catch (error) {
      logError('Error updating daily special:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Delete daily special (Admin/Bar Owner only)
  static async deleteDailySpecial(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
        return;
      }

      // Check permissions
      if (!req.user || !['admin', 'bar_owner'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      const { specialId } = req.params;
      
      if (!specialId) {
        res.status(400).json({
          success: false,
          message: 'Special ID is required'
        });
        return;
      }

      const deleted = await MenuModel.deleteDailySpecial(specialId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Daily special not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Daily special deleted successfully'
      });

      logInfo('Daily special deleted:', {
        specialId,
        userId: req.user.id
      });
    } catch (error) {
      logError('Error deleting daily special:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Toggle daily special status (Admin/Bar Owner only)
  static async toggleDailySpecialStatus(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
        return;
      }

      // Check permissions
      if (!req.user || !['admin', 'bar_owner'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      const { specialId } = req.params;
      
      if (!specialId) {
        res.status(400).json({
          success: false,
          message: 'Special ID is required'
        });
        return;
      }
      
      const { is_active } = req.body;

      const special = await MenuModel.updateDailySpecial(specialId, { is_active });

      if (!special) {
        res.status(404).json({
          success: false,
          message: 'Daily special not found'
        });
        return;
      }

      res.json({
        success: true,
        message: `Daily special ${is_active ? 'activated' : 'deactivated'} successfully`,
        data: { special }
      });

      logInfo('Daily special status toggled:', {
        specialId,
        isActive: is_active,
        userId: req.user.id
      });
    } catch (error) {
      logError('Error toggling daily special status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get active daily specials
  static async getActiveDailySpecials(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { barId } = req.params;
      
      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
        return;
      }
      
      const specials = await MenuModel.getDailySpecials(barId, true);
      
      res.json({
        success: true,
        data: specials
      });

      logInfo('Active daily specials retrieved:', { barId, count: specials.length });
    } catch (error) {
      logError('Error getting active daily specials:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get expired daily specials
  static async getExpiredDailySpecials(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { barId } = req.params;
      
      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
        return;
      }
      
      const specials = await MenuModel.getDailySpecials(barId, false);
      
      res.json({
        success: true,
        data: specials
      });

      logInfo('Expired daily specials retrieved:', { barId, count: specials.length });
    } catch (error) {
      logError('Error getting expired daily specials:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get upcoming daily specials
  static async getUpcomingDailySpecials(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { barId } = req.params;
      
      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
        return;
      }
      
      const specials = await MenuModel.getDailySpecials(barId, false);
      
      res.json({
        success: true,
        data: specials
      });

      logInfo('Upcoming daily specials retrieved:', { barId, count: specials.length });
    } catch (error) {
      logError('Error getting upcoming daily specials:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}