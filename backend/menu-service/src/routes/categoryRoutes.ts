import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { authenticateToken, requireMenuModifyAccess, requireBarAccess, optionalAuth } from '../middleware/auth';
import {
  validateCreateCategory,
  validateUpdateCategory,
  validateGetCategories,
  validateDeleteCategory,
  validateReorderCategories,
  validateToggleCategoryStatus,
  validateGetCategory,
  validateGetCategoryWithStats,
  validateGetActiveCategories,
  validateDuplicateCategory
} from '../validators/categoryValidation';
import { handleValidationErrors, asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Public routes (no authentication required)
// GET /api/bars/:barId/categories - Get all categories for a bar (public access)
router.get(
  '/bars/:barId/categories',
  validateGetCategories,
  handleValidationErrors,
  optionalAuth, // Optional authentication for personalized experience
  requireBarAccess,
  asyncHandler(CategoryController.getCategories)
);

// GET /api/bars/:barId/categories/with-stats - Get categories with item counts
router.get(
  '/bars/:barId/categories/with-stats',
  validateGetCategories,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler(CategoryController.getCategoryWithStats)
);

// Protected routes (authentication required)
// POST /api/bars/:barId/categories - Create new category (admin/bar owner only)
router.post(
  '/bars/:barId/categories',
  authenticateToken,
  validateCreateCategory,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(CategoryController.createCategory)
);

// PUT /api/bars/:barId/categories/:categoryId - Update category (admin/bar owner only)
router.put(
  '/bars/:barId/categories/:categoryId',
  authenticateToken,
  validateUpdateCategory,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(CategoryController.updateCategory)
);

// DELETE /api/bars/:barId/categories/:categoryId - Delete category (admin/bar owner only)
router.delete(
  '/bars/:barId/categories/:categoryId',
  authenticateToken,
  validateDeleteCategory,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(CategoryController.deleteCategory)
);

// PATCH /api/bars/:barId/categories/reorder - Reorder categories (admin/bar owner only)
router.patch(
  '/bars/:barId/categories/reorder',
  authenticateToken,
  validateReorderCategories,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(CategoryController.reorderCategories)
);

// PATCH /api/bars/:barId/categories/:categoryId/status - Toggle category status (admin/bar owner only)
router.patch(
  '/bars/:barId/categories/:categoryId/status',
  authenticateToken,
  validateToggleCategoryStatus,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(CategoryController.toggleCategoryStatus)
);

// Additional utility routes

// GET /api/bars/:barId/categories/active - Get only active categories
router.get(
  '/bars/:barId/categories/active',
  validateGetActiveCategories,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler((req: any, res: any, next: any) => {
    // Force active status filter
    req.query.active_only = 'true';
    return CategoryController.getCategories(req, res, next);
  })
);

// GET /api/bars/:barId/categories/:categoryId - Get specific category details
router.get(
  '/bars/:barId/categories/:categoryId',
  validateGetCategory,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would get a single category with its details
    // For now, we'll use the existing controller method
    req.query.category_id = req.params.categoryId;
    return CategoryController.getCategories(req, res);
  })
);

// GET /api/bars/:barId/categories/:categoryId/items/count - Get item count for category
router.get(
  '/bars/:barId/categories/:categoryId/items/count',
  validateGetCategoryWithStats,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would return just the count of items in the category
    res.json({
      success: true,
      data: {
        category_id: req.params.categoryId,
        total_items: 0, // This would be calculated from the database
        available_items: 0
      }
    });
  })
);

// PATCH /api/bars/:barId/categories/:categoryId/activate - Activate category
router.patch(
  '/bars/:barId/categories/:categoryId/activate',
  authenticateToken,
  validateToggleCategoryStatus,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(async (req: any, res: any, next: any) => {
    // Set is_active to true
    req.body = { is_active: true };
    return CategoryController.toggleCategoryStatus(req, res, next);
  })
);

// PATCH /api/bars/:barId/categories/:categoryId/deactivate - Deactivate category
router.patch(
  '/bars/:barId/categories/:categoryId/deactivate',
  authenticateToken,
  validateToggleCategoryStatus,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(async (req: any, res: any, next: any) => {
    // Set is_active to false
    req.body = { is_active: false };
    return CategoryController.toggleCategoryStatus(req, res, next);
  })
);

// POST /api/bars/:barId/categories/:categoryId/duplicate - Duplicate category
router.post(
  '/bars/:barId/categories/:categoryId/duplicate',
  authenticateToken,
  validateDuplicateCategory,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would duplicate a category with a new name
    const newName = req.body.new_name || `Copy of ${req.params.categoryId}`;
    
    // Create new category based on existing one
    req.body = {
      name: newName,
      description: req.body.description || 'Duplicated category',
      image_url: req.body.image_url,
      is_active: true,
      sort_order: req.body.sort_order || 999
    };
    
    return CategoryController.createCategory(req, res);
  })
);

// GET /api/bars/:barId/categories/search - Search categories
router.get(
  '/bars/:barId/categories/search',
  validateGetCategories,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would implement category search functionality
    const searchTerm = req.query.q || req.query.search;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }
    
    // For now, return empty results
    res.json({
      success: true,
      data: {
        categories: [],
        total: 0,
        search_term: searchTerm
      }
    });
  })
);

// GET /api/bars/:barId/categories/export - Export categories (admin/bar owner only)
router.get(
  '/bars/:barId/categories/export',
  authenticateToken,
  validateGetCategories,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would export categories in various formats (JSON, CSV, etc.)
    const format = req.query.format || 'json';
    
    if (format === 'json') {
      // Get all categories and return as JSON
      return CategoryController.getCategories(req, res);
    } else if (format === 'csv') {
      // Return CSV format
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=categories.csv');
      res.send('id,name,description,is_active,sort_order,created_at\n');
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format. Use json or csv.'
      });
    }
  })
);

// POST /api/bars/:barId/categories/import - Import categories (admin/bar owner only)
router.post(
  '/bars/:barId/categories/import',
  authenticateToken,
  requireMenuModifyAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would import categories from uploaded file or JSON data
    const categories = req.body.categories;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Categories array is required'
      });
    }
    
    // Validate and import categories
    const results = {
      imported: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const category of categories) {
      try {
        // Validate category data
        if (!category.name) {
          results.failed++;
          results.errors.push(`Category missing name: ${JSON.stringify(category)}`);
          continue;
        }
        
        // Create category
        req.body = category;
        await CategoryController.createCategory(req, res);
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to import category ${category.name}: ${error}`);
      }
    }
    
    res.json({
      success: true,
      data: results
    });
  })
);

export default router;