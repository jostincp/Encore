import { body, param, query } from 'express-validator';

// Validation for getting categories
export const validateGetCategories = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  query('include_item_count')
    .optional()
    .isBoolean()
    .withMessage('include_item_count must be a boolean'),
  
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
];

// Validation for getting single category
export const validateGetCategory = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID')
];

// Validation for creating category
export const validateCreateCategory = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('name')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('image_url')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer')
];

// Validation for updating category
export const validateUpdateCategory = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('name')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('image_url')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  // Custom validation to ensure at least one field is provided
  body()
    .custom((body) => {
      const allowedFields = ['name', 'description', 'image_url', 'is_active', 'sort_order'];
      
      const providedFields = Object.keys(body).filter(key => 
        allowedFields.includes(key) && body[key] !== undefined
      );
      
      if (providedFields.length === 0) {
        throw new Error('At least one field must be provided for update');
      }
      
      return true;
    })
];

// Validation for deleting category
export const validateDeleteCategory = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID')
];

// Validation for reordering categories
export const validateReorderCategories = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('category_orders')
    .isArray({ min: 1 })
    .withMessage('category_orders must be a non-empty array')
    .custom((orders) => {
      if (orders.every((order: any) => 
        typeof order === 'object' && 
        typeof order.category_id === 'string' && 
        typeof order.sort_order === 'number' &&
        order.sort_order >= 0
      )) {
        return true;
      }
      throw new Error('Each order must have category_id (string) and sort_order (non-negative number)');
    })
];

// Validation for toggling category status
export const validateToggleCategoryStatus = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID')
];

// Validation for getting category with stats
export const validateGetCategoryWithStats = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID')
];

// Validation for getting active categories
export const validateGetActiveCategories = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
];

// Validation for duplicating category
export const validateDuplicateCategory = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('new_name')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('New name must be between 1 and 100 characters')
];