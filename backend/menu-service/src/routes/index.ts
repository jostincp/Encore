import { Router } from 'express';
import menuRoutes from './menuRoutes';
import categoryRoutes from './categoryRoutes';
import dailySpecialsRoutes from './dailySpecialsRoutes';
import { logger } from '../utils/logger';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Menu service is healthy',
    timestamp: new Date().toISOString(),
    service: 'menu-service',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Service info endpoint
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'menu-service',
      version: process.env.npm_package_version || '1.0.0',
      description: 'Encore Menu Management Service',
      endpoints: {
        menu: {
          'GET /api/bars/:barId/menu': 'Get menu items for a bar',
          'GET /api/bars/:barId/menu/:itemId': 'Get specific menu item',
          'POST /api/bars/:barId/menu': 'Create new menu item (auth required)',
          'PUT /api/bars/:barId/menu/:itemId': 'Update menu item (auth required)',
          'DELETE /api/bars/:barId/menu/:itemId': 'Delete menu item (auth required)',
          'PATCH /api/bars/:barId/menu/availability': 'Bulk update item availability (auth required)',
          'PATCH /api/bars/:barId/menu/categories/:categoryId/reorder': 'Reorder items in category (auth required)',
          'GET /api/bars/:barId/menu/stats': 'Get menu statistics (auth required)'
        },
        categories: {
          'GET /api/bars/:barId/categories': 'Get all categories for a bar',
          'POST /api/bars/:barId/categories': 'Create new category (auth required)',
          'PUT /api/bars/:barId/categories/:categoryId': 'Update category (auth required)',
          'DELETE /api/bars/:barId/categories/:categoryId': 'Delete category (auth required)',
          'PATCH /api/bars/:barId/categories/reorder': 'Reorder categories (auth required)',
          'PATCH /api/bars/:barId/categories/:categoryId/status': 'Toggle category status (auth required)'
        },
        utility: {
          'GET /api/health': 'Health check',
          'GET /api/info': 'Service information',
          'GET /api/bars/:barId/menu/search': 'Search menu items',
          'GET /api/bars/:barId/menu/available': 'Get available items only',
          'GET /api/bars/:barId/menu/featured': 'Get featured items',
          'GET /api/bars/:barId/menu/popular': 'Get popular items',
          'GET /api/bars/:barId/specials': 'Get daily specials',
          'POST /api/bars/:barId/specials': 'Create daily special (auth required)',
          'PUT /api/specials/:specialId': 'Update daily special (auth required)',
          'DELETE /api/specials/:specialId': 'Delete daily special (auth required)',
          'PATCH /api/specials/:specialId/toggle': 'Toggle daily special status (auth required)',
          'GET /api/bars/:barId/categories/active': 'Get active categories only'
        }
      },
      authentication: {
        required: 'Bearer token in Authorization header for protected endpoints',
        roles: ['admin', 'bar_owner', 'customer'],
        permissions: {
          admin: 'Full access to all bars and operations',
          bar_owner: 'Full access to own bar only',
          customer: 'Read-only access to menu items'
        }
      },
      features: [
        'Menu item CRUD operations',
        'Category management',
        'Bulk operations',
        'Search and filtering',
        'Availability management',
        'Item reordering',
        'Statistics and analytics',
        'Role-based access control',
        'Caching with Redis',
        'Input validation',
        'Error handling',
        'Audit logging'
      ]
    }
  });
});

// Mount route modules
router.use('/api', menuRoutes);
router.use('/api', categoryRoutes);
router.use('/api', dailySpecialsRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'Encore Menu Service API Documentation',
      version: '1.0.0',
      description: 'RESTful API for managing bar menus and categories',
      baseUrl: `${req.protocol}://${req.get('host')}/api`,
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization: Bearer <token>',
        description: 'JWT token required for protected endpoints'
      },
      endpoints: {
        menu_items: {
          list: {
            method: 'GET',
            path: '/bars/{barId}/menu',
            description: 'Get paginated list of menu items for a bar',
            parameters: {
              path: { barId: 'UUID of the bar' },
              query: {
                category_id: 'Filter by category UUID',
                is_available: 'Filter by availability (true/false)',
                min_price: 'Minimum price filter',
                max_price: 'Maximum price filter',
                search: 'Search in name and description',
                tags: 'Filter by tags (comma-separated)',
                allergens: 'Filter by allergens (comma-separated)',
                page: 'Page number (default: 1)',
                limit: 'Items per page (default: 20, max: 100)'
              }
            },
            response: {
              success: true,
              data: {
                items: 'Array of menu items',
                pagination: 'Pagination information',
                filters: 'Applied filters'
              }
            }
          },
          get: {
            method: 'GET',
            path: '/bars/{barId}/menu/{itemId}',
            description: 'Get specific menu item details',
            parameters: {
              path: {
                barId: 'UUID of the bar',
                itemId: 'UUID of the menu item'
              }
            }
          },
          create: {
            method: 'POST',
            path: '/bars/{barId}/menu',
            description: 'Create new menu item',
            authentication: 'Required (admin/bar_owner)',
            body: {
              category_id: 'UUID (required)',
              name: 'string (required, 1-100 chars)',
              description: 'string (optional, max 500 chars)',
              price: 'number (required, >= 0)',
              image_url: 'string (optional, valid URL)',
              is_available: 'boolean (optional, default: true)',
              preparation_time: 'number (optional, 0-300 minutes)',
              ingredients: 'array of strings (optional)',
              allergens: 'array of valid allergen strings (optional)',
              nutritional_info: 'object with calories, protein, carbs, fat (optional)',
              tags: 'array of strings (optional, max 10 tags)',
              sort_order: 'number (optional, >= 0)'
            }
          },
          update: {
            method: 'PUT',
            path: '/bars/{barId}/menu/{itemId}',
            description: 'Update existing menu item',
            authentication: 'Required (admin/bar_owner)',
            body: 'Same as create, all fields optional'
          },
          delete: {
            method: 'DELETE',
            path: '/bars/{barId}/menu/{itemId}',
            description: 'Delete menu item',
            authentication: 'Required (admin/bar_owner)'
          }
        },
        categories: {
          list: {
            method: 'GET',
            path: '/bars/{barId}/categories',
            description: 'Get all categories for a bar',
            parameters: {
              path: { barId: 'UUID of the bar' }
            }
          },
          create: {
            method: 'POST',
            path: '/bars/{barId}/categories',
            description: 'Create new category',
            authentication: 'Required (admin/bar_owner)',
            body: {
              name: 'string (required, 1-50 chars)',
              description: 'string (optional, max 200 chars)',
              image_url: 'string (optional, valid URL)',
              is_active: 'boolean (optional, default: true)',
              sort_order: 'number (optional, >= 0)'
            }
          },
          update: {
            method: 'PUT',
            path: '/bars/{barId}/categories/{categoryId}',
            description: 'Update existing category',
            authentication: 'Required (admin/bar_owner)'
          },
          delete: {
            method: 'DELETE',
            path: '/bars/{barId}/categories/{categoryId}',
            description: 'Delete category (only if no items exist)',
            authentication: 'Required (admin/bar_owner)'
          }
        },
        daily_specials: {
          list: {
            method: 'GET',
            path: '/bars/{barId}/specials',
            description: 'Get daily specials for a bar',
            parameters: {
              path: { barId: 'UUID of the bar' },
              query: {
                active_only: 'Filter active specials only (true/false)',
                expired_only: 'Filter expired specials only (true/false)',
                upcoming_only: 'Filter upcoming specials only (true/false)'
              }
            }
          },
          get: {
            method: 'GET',
            path: '/specials/{specialId}',
            description: 'Get specific daily special details'
          },
          create: {
            method: 'POST',
            path: '/bars/{barId}/specials',
            description: 'Create new daily special',
            authentication: 'Required (admin/bar_owner)',
            body: {
              menu_item_id: 'UUID (required)',
              special_price: 'number (optional, >= 0)',
              description: 'string (optional, max 500 chars)',
              valid_from: 'ISO 8601 date (required)',
              valid_until: 'ISO 8601 date (required, must be after valid_from)'
            }
          },
          update: {
            method: 'PUT',
            path: '/specials/{specialId}',
            description: 'Update existing daily special',
            authentication: 'Required (admin/bar_owner)',
            body: 'Same as create, all fields optional'
          },
          delete: {
            method: 'DELETE',
            path: '/specials/{specialId}',
            description: 'Delete daily special',
            authentication: 'Required (admin/bar_owner)'
          },
          toggle: {
            method: 'PATCH',
            path: '/specials/{specialId}/toggle',
            description: 'Toggle daily special active status',
            authentication: 'Required (admin/bar_owner)',
            body: {
              is_active: 'boolean (required)'
            }
          }
        },
        bulk_operations: {
          update_availability: {
            method: 'PATCH',
            path: '/bars/{barId}/menu/availability',
            description: 'Bulk update item availability',
            authentication: 'Required (admin/bar_owner)',
            body: {
              item_ids: 'array of UUIDs (1-50 items)',
              is_available: 'boolean'
            }
          },
          reorder_items: {
            method: 'PATCH',
            path: '/bars/{barId}/menu/categories/{categoryId}/reorder',
            description: 'Reorder items within a category',
            authentication: 'Required (admin/bar_owner)',
            body: {
              item_orders: 'array of {id: UUID, sort_order: number}'
            }
          },
          reorder_categories: {
            method: 'PATCH',
            path: '/bars/{barId}/categories/reorder',
            description: 'Reorder categories',
            authentication: 'Required (admin/bar_owner)',
            body: {
              category_orders: 'array of {id: UUID, sort_order: number}'
            }
          }
        }
      },
      error_codes: {
        400: 'Bad Request - Invalid input data',
        401: 'Unauthorized - Authentication required',
        403: 'Forbidden - Insufficient permissions',
        404: 'Not Found - Resource not found',
        409: 'Conflict - Resource already exists',
        422: 'Unprocessable Entity - Validation failed',
        429: 'Too Many Requests - Rate limit exceeded',
        500: 'Internal Server Error - Server error'
      },
      data_types: {
        allergens: [
          'gluten', 'dairy', 'eggs', 'fish', 'shellfish', 'tree_nuts',
          'peanuts', 'soy', 'sesame', 'sulfites', 'mustard', 'celery'
        ],
        common_tags: [
          'featured', 'popular', 'special', 'daily-special', 'vegetarian',
          'vegan', 'spicy', 'healthy', 'gluten-free', 'low-carb'
        ]
      }
    }
  });
});

// Middleware to log all API requests
router.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('API Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      user: (req as any).user?.id
    });
  });
  
  next();
});

export default router;