import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { MenuModel } from '../models/Menu';
import { AuthenticatedRequest, ApiResponse, logInfo, logError, MenuFilters, CreateMenuItemData, UpdateMenuItemData } from '../types/shared';

export class MenuController {
  // Get menu items with filters and pagination
  static async getMenuItems(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
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
      
      const {
        category_id,
        is_available,
        min_price,
        max_price,
        tags,
        allergens,
        search,
        page = 1,
        limit = 20
      } = req.query;

      // Build filters
      const filters: MenuFilters = {};
      
      if (category_id) filters.category_id = category_id as string;
      if (is_available !== undefined) filters.is_available = is_available === 'true';
      if (min_price) filters.min_price = parseFloat(min_price as string);
      if (max_price) filters.max_price = parseFloat(max_price as string);
      if (tags) filters.tags = Array.isArray(tags) ? tags as string[] : [tags as string];
      if (allergens) filters.allergens = Array.isArray(allergens) ? allergens as string[] : [allergens as string];
      if (search) filters.search = search as string;

      const result = await MenuModel.getMenuItems(
        barId,
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });

      logInfo('Menu items retrieved:', {
        barId,
        filters,
        page,
        limit,
        total: result.total
      });
    } catch (error) {
      logError('Error getting menu items:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Get single menu item
  static async getMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { itemId } = req.params;
      
      if (!itemId) {
        res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
        return;
      }

      const menuItem = await MenuModel.getMenuItem(itemId);

      if (!menuItem) {
        res.status(404).json({
          success: false,
          message: 'Menu item not found'
        });
        return;
      }

      res.json({
        success: true,
        data: menuItem
      });

      logInfo('Menu item retrieved:', { itemId });
    } catch (error) {
      logError('Error getting menu item:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Create new menu item (Admin/Bar Owner only)
  static async createMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      // If bar owner, verify they own this bar
      if (userRole === 'bar_owner') {
        // This would typically involve checking bar ownership
        // For now, we'll assume the middleware handles this
      }

      const menuItemData: CreateMenuItemData = {
        bar_id: barId,
        category_id: req.body.category_id,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        image_url: req.body.image_url,
        is_available: req.body.is_available,
        preparation_time: req.body.preparation_time,
        ingredients: req.body.ingredients,
        allergens: req.body.allergens,
        nutritional_info: req.body.nutritional_info,
        tags: req.body.tags,
        sort_order: req.body.sort_order
      };

      const menuItem = await MenuModel.createMenuItem(menuItemData);

      res.status(201).json({
        success: true,
        message: 'Menu item created successfully',
        data: menuItem
      });

      logInfo('Menu item created:', {
        itemId: menuItem.id,
        barId,
        userId,
        name: menuItem.name
      });
    } catch (error) {
      logError('Error creating menu item:', error);
      
      if ((error as Error).message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
      }
    }
  }

  // Update menu item (Admin/Bar Owner only)
  static async updateMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { itemId } = req.params;
      
      if (!itemId) {
        res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
        return;
      }
      
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      const updateData: UpdateMenuItemData = {};
      
      // Only include fields that are provided
      const allowedFields = [
        'name', 'description', 'price', 'image_url', 'is_available',
        'preparation_time', 'ingredients', 'allergens', 'nutritional_info',
        'tags', 'sort_order'
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field as keyof UpdateMenuItemData] = req.body[field];
        }
      });

      const menuItem = await MenuModel.updateMenuItem(itemId, updateData);

      if (!menuItem) {
        res.status(404).json({
          success: false,
          message: 'Menu item not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Menu item updated successfully',
        data: menuItem
      });

      logInfo('Menu item updated:', {
        itemId,
        userId,
        updatedFields: Object.keys(updateData)
      });
    } catch (error) {
      logError('Error updating menu item:', error);
      res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
    }
  }

  // Delete menu item (Admin/Bar Owner only)
  static async deleteMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { itemId } = req.params;
      
      if (!itemId) {
        res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
        return;
      }
      
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      const deleted = await MenuModel.deleteMenuItem(itemId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Menu item not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Menu item deleted successfully'
      });

      logInfo('Menu item deleted:', { itemId, userId });
    } catch (error) {
      logError('Error deleting menu item:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Bulk update items availability (Admin/Bar Owner only)
  static async updateItemsAvailability(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
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
      const { item_ids, is_available } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
        return;
      }

      const updatedCount = await MenuModel.updateItemsAvailability(
        barId,
        item_ids,
        is_available
      );

      res.json({
        success: true,
        message: `${updatedCount} items updated successfully`,
        data: {
          updated_count: updatedCount,
          is_available
        }
      });

      logInfo('Bulk availability update:', {
        barId,
        userId,
        itemCount: item_ids.length,
        updatedCount,
        isAvailable: is_available
      });
    } catch (error) {
      logError('Error updating items availability:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Reorder menu items (Admin/Bar Owner only)
  static async reorderItems(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { barId, categoryId } = req.params;
      const { item_orders } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      if (!barId || !categoryId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID and Category ID are required'
        });
        return;
      }

      const success = await MenuModel.reorderItems(barId, categoryId, item_orders);

      if (!success) {
        res.status(400).json({
          success: false,
          message: 'Failed to reorder items'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Items reordered successfully'
      });

      logInfo('Menu items reordered:', {
        barId,
        categoryId,
        userId,
        itemCount: item_orders.length
      });
    } catch (error) {
      logError('Error reordering menu items:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Get menu statistics (Admin/Bar Owner only)
  static async getMenuStats(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const userRole = req.user?.role;

      // Check permissions
      if (userRole !== 'admin' && userRole !== 'bar_owner') {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      if (!barId) {
        res.status(400).json({
          success: false,
          message: 'Bar ID is required'
        });
        return;
      }

      const stats = await MenuModel.getMenuStats(barId);

      res.json({
        success: true,
        data: stats
      });

      logInfo('Menu stats retrieved:', { barId });
    } catch (error) {
      logError('Error getting menu stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }
}