import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { MenuModel } from '../models/Menu';
import { AuthenticatedRequest, ApiResponse, logInfo, logError, CreateCategoryData, UpdateCategoryData } from '../types/shared';

export class CategoryController {
  // Get categories for a bar
  static async getCategories(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
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

      const categories = await MenuModel.getCategories(barId);

      res.json({
        success: true,
        data: categories
      });

      logInfo('Categories retrieved:', {
        barId,
        count: categories.length
      });
    } catch (error) {
      logError('Error getting categories:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Create new category (Admin/Bar Owner only)
  static async createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const categoryData: CreateCategoryData = {
        bar_id: barId,
        name: req.body.name,
        description: req.body.description,
        image_url: req.body.image_url,
        is_active: req.body.is_active,
        sort_order: req.body.sort_order
      };

      const category = await MenuModel.createCategory(categoryData);

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category
      });

      logInfo('Category created:', {
        categoryId: category.id,
        barId,
        userId,
        name: category.name
      });
    } catch (error) {
      logError('Error creating category:', error);
      
      if ((error as Error).message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      } else if ((error as Error).message.includes('duplicate') || (error as any).code === '23505') {
        res.status(409).json({
          success: false,
          message: 'Category with this name already exists'
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

  // Update category (Admin/Bar Owner only)
  static async updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { categoryId } = req.params;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
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

      const updateData: UpdateCategoryData = {};
      
      // Only include fields that are provided
      const allowedFields = [
        'name', 'description', 'image_url', 'is_active', 'sort_order'
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field as keyof UpdateCategoryData] = req.body[field];
        }
      });

      const category = await MenuModel.updateCategory(categoryId, updateData);

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: category
      });

      logInfo('Category updated:', {
        categoryId,
        userId,
        updatedFields: Object.keys(updateData)
      });
    } catch (error) {
      logError('Error updating category:', error);
      
      if ((error as Error).message.includes('duplicate') || (error as any).code === '23505') {
        res.status(409).json({
          success: false,
          message: 'Category with this name already exists'
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

  // Delete category (Admin/Bar Owner only)
  static async deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { categoryId } = req.params;

      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
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

      const deleted = await MenuModel.deleteCategory(categoryId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });

      logInfo('Category deleted:', { categoryId, userId });
    } catch (error) {
      logError('Error deleting category:', error);
      
      if ((error as Error).message.includes('existing items')) {
        res.status(409).json({
          success: false,
          message: 'Cannot delete category with existing menu items'
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

  // Reorder categories (Admin/Bar Owner only)
  static async reorderCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      
      const { category_orders } = req.body;
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

      // Validate category_orders format
      if (!Array.isArray(category_orders) || category_orders.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid category_orders format'
        });
        return;
      }

      // Update each category's sort order
      const updatePromises = category_orders.map(async (categoryOrder: { id: string; sort_order: number }) => {
        if (!categoryOrder.id || typeof categoryOrder.sort_order !== 'number') {
          throw new Error('Invalid category order format');
        }
        
        return MenuModel.updateCategory(categoryOrder.id, {
          sort_order: categoryOrder.sort_order
        });
      });

      await Promise.all(updatePromises);

      res.json({
        success: true,
        message: 'Categories reordered successfully'
      });

      logInfo('Categories reordered:', {
        barId,
        userId,
        categoryCount: category_orders.length
      });
    } catch (error) {
      logError('Error reordering categories:', error);
      
      if ((error as Error).message.includes('Invalid')) {
        res.status(400).json({
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

  // Toggle category status (Admin/Bar Owner only)
  static async toggleCategoryStatus(req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> {
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

      const { categoryId } = req.params;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }
      
      const { is_active } = req.body;
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

      const category = await MenuModel.updateCategory(categoryId, {
        is_active: is_active
      });

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }

      res.json({
        success: true,
        message: `Category ${is_active ? 'activated' : 'deactivated'} successfully`,
        data: category
      });

      logInfo('Category status toggled:', {
        categoryId,
        userId,
        isActive: is_active
      });
    } catch (error) {
      logError('Error toggling category status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Get category with items count
  static async getCategoryWithStats(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Get categories with item counts
      const categories = await MenuModel.getCategories(barId);
      
      // Get item counts for each category
      const categoriesWithStats = await Promise.all(
        categories.map(async (category) => {
          const itemsResult = await MenuModel.getMenuItems(
            barId,
            { category_id: category.id },
            1,
            1
          );
          
          return {
            ...category,
            items_count: itemsResult.total,
            available_items_count: await this.getAvailableItemsCount(barId, category.id)
          };
        })
      );

      res.json({
        success: true,
        data: categoriesWithStats
      });

      logInfo('Categories with stats retrieved:', {
        barId,
        count: categoriesWithStats.length
      });
    } catch (error) {
      logError('Error getting categories with stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Helper method to get available items count for a category
  private static async getAvailableItemsCount(barId: string, categoryId: string): Promise<number> {
    try {
      const result = await MenuModel.getMenuItems(
        barId,
        { category_id: categoryId, is_available: true },
        1,
        1
      );
      return result.total;
    } catch (error) {
      logError('Error getting available items count:', error);
      return 0;
    }
  }
}