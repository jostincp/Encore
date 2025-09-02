import { Router } from 'express';
import { MenuController } from '../controllers/menuController';
import { authenticateToken, requireMenuModifyAccess, requireBarAccess, optionalAuth } from '../middleware/auth';
import {
  validateGetMenuItems,
  validateGetMenuItem,
  validateCreateMenuItem,
  validateUpdateMenuItem,
  validateDeleteMenuItem,
  validateUpdateItemsAvailability,
  validateReorderItems,
  validateGetMenuStats,
  validateToggleItemAvailability,
  validateGetItemsByCategory,
  validateAdvancedSearch
} from '../validators/menuValidation';
import { handleValidationErrors, asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Public routes (no authentication required)
// GET /api/bars/:barId/menu - Get menu items for a bar (public access)
router.get(
  '/bars/:barId/menu',
  validateGetMenuItems,
  handleValidationErrors,
  optionalAuth, // Optional authentication to provide personalized experience
  requireBarAccess,
  asyncHandler(MenuController.getMenuItems)
);

// GET /api/bars/:barId/menu/:itemId - Get specific menu item (public access)
router.get(
  '/bars/:barId/menu/:itemId',
  validateGetMenuItem,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler(MenuController.getMenuItem)
);

// Protected routes (authentication required)
// POST /api/bars/:barId/menu - Create new menu item (admin/bar owner only)
router.post(
  '/bars/:barId/menu',
  authenticateToken,
  validateCreateMenuItem,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(MenuController.createMenuItem)
);

// PUT /api/bars/:barId/menu/:itemId - Update menu item (admin/bar owner only)
router.put(
  '/bars/:barId/menu/:itemId',
  authenticateToken,
  validateUpdateMenuItem,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(MenuController.updateMenuItem)
);

// DELETE /api/bars/:barId/menu/:itemId - Delete menu item (admin/bar owner only)
router.delete(
  '/bars/:barId/menu/:itemId',
  authenticateToken,
  validateDeleteMenuItem,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(MenuController.deleteMenuItem)
);

// PATCH /api/bars/:barId/menu/availability - Bulk update item availability (admin/bar owner only)
router.patch(
  '/bars/:barId/menu/availability',
  authenticateToken,
  validateUpdateItemsAvailability,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(MenuController.updateItemsAvailability)
);

// PATCH /api/bars/:barId/menu/categories/:categoryId/reorder - Reorder items in category (admin/bar owner only)
router.patch(
  '/bars/:barId/menu/categories/:categoryId/reorder',
  authenticateToken,
  validateReorderItems,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(MenuController.reorderItems)
);

// GET /api/bars/:barId/menu/stats - Get menu statistics (admin/bar owner only)
router.get(
  '/bars/:barId/menu/stats',
  authenticateToken,
  validateGetMenuStats,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(MenuController.getMenuStats)
);

// Additional utility routes

// GET /api/bars/:barId/menu/search - Advanced search for menu items
router.get(
  '/bars/:barId/menu/search',
  validateAdvancedSearch,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler(MenuController.getMenuItems) // Same controller method with search functionality
);

// GET /api/bars/:barId/menu/categories/:categoryId/items - Get items by category
router.get(
  '/bars/:barId/menu/categories/:categoryId/items',
  validateGetItemsByCategory,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler(MenuController.getMenuItems)
);

// GET /api/bars/:barId/menu/available - Get only available items
router.get(
  '/bars/:barId/menu/available',
  validateGetMenuItems,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler((req: any, res: any, next: any) => {
    // Force is_available to true
    req.query.is_available = 'true';
    return MenuController.getMenuItems(req, res, next);
  })
);

// GET /api/bars/:barId/menu/featured - Get featured items (items with specific tags)
router.get(
  '/bars/:barId/menu/featured',
  validateGetMenuItems,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler((req: any, res: any, next: any) => {
    // Add featured tag filter
    req.query.tags = 'featured';
    return MenuController.getMenuItems(req, res, next);
  })
);

// GET /api/bars/:barId/menu/popular - Get popular items
router.get(
  '/bars/:barId/menu/popular',
  validateGetMenuItems,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler((req: any, res: any, next: any) => {
    // Add popular tag filter
    req.query.tags = 'popular';
    return MenuController.getMenuItems(req, res, next);
  })
);

// GET /api/bars/:barId/menu/specials - Get daily specials
router.get(
  '/bars/:barId/menu/specials',
  validateGetMenuItems,
  handleValidationErrors,
  optionalAuth,
  requireBarAccess,
  asyncHandler((req: any, res: any, next: any) => {
    // Add special tag filter
    req.query.tags = 'special,daily-special';
    return MenuController.getMenuItems(req, res, next);
  })
);

// PATCH /api/bars/:barId/menu/:itemId/availability - Toggle single item availability
router.patch(
  '/bars/:barId/menu/:itemId/availability',
  authenticateToken,
  validateToggleItemAvailability,
  handleValidationErrors,
  requireMenuModifyAccess,
  asyncHandler(async (req: any, res: any, next: any) => {
    // Convert single item to bulk format
    req.body = {
      item_ids: [req.params.itemId],
      is_available: req.body.is_available
    };
    return MenuController.updateItemsAvailability(req, res, next);
  })
);

// GET /api/bars/:barId/menu/allergens - Get all allergens used in menu
router.get(
  '/bars/:barId/menu/allergens',
  optionalAuth,
  requireBarAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would be implemented in the controller to return unique allergens
    res.json({
      success: true,
      data: {
        allergens: [
          'gluten', 'dairy', 'eggs', 'fish', 'shellfish', 'tree_nuts',
          'peanuts', 'soy', 'sesame', 'sulfites', 'mustard', 'celery'
        ]
      }
    });
  })
);

// GET /api/bars/:barId/menu/tags - Get all tags used in menu
router.get(
  '/bars/:barId/menu/tags',
  optionalAuth,
  requireBarAccess,
  asyncHandler(async (req: any, res: any) => {
    // This would be implemented in the controller to return unique tags
    res.json({
      success: true,
      data: {
        tags: ['featured', 'popular', 'special', 'daily-special', 'vegetarian', 'vegan', 'spicy', 'healthy']
      }
    });
  })
);

export default router;