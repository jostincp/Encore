import { body, param, query } from 'express-validator';

// Menu Item Validations
export const validateCreateMenuItem = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('category_id')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('image_url')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  body('is_available')
    .optional()
    .isBoolean()
    .withMessage('is_available must be a boolean'),
  
  body('preparation_time')
    .optional()
    .isInt({ min: 0, max: 300 })
    .withMessage('Preparation time must be between 0 and 300 minutes'),
  
  body('ingredients')
    .optional()
    .isArray()
    .withMessage('Ingredients must be an array')
    .custom((ingredients) => {
      if (ingredients && ingredients.length > 0) {
        for (const ingredient of ingredients) {
          if (typeof ingredient !== 'string' || ingredient.trim().length === 0) {
            throw new Error('Each ingredient must be a non-empty string');
          }
        }
      }
      return true;
    }),
  
  body('allergens')
    .optional()
    .isArray()
    .withMessage('Allergens must be an array')
    .custom((allergens) => {
      if (allergens && allergens.length > 0) {
        const validAllergens = [
          'gluten', 'dairy', 'eggs', 'fish', 'shellfish', 'tree_nuts',
          'peanuts', 'soy', 'sesame', 'sulfites', 'mustard', 'celery'
        ];
        for (const allergen of allergens) {
          if (!validAllergens.includes(allergen)) {
            throw new Error(`Invalid allergen: ${allergen}`);
          }
        }
      }
      return true;
    }),
  
  body('nutritional_info')
    .optional()
    .isObject()
    .withMessage('Nutritional info must be an object')
    .custom((nutritionalInfo) => {
      if (nutritionalInfo) {
        const allowedFields = ['calories', 'protein', 'carbs', 'fat'];
        for (const [key, value] of Object.entries(nutritionalInfo)) {
          if (!allowedFields.includes(key)) {
            throw new Error(`Invalid nutritional info field: ${key}`);
          }
          if (typeof value !== 'number' || value < 0) {
            throw new Error(`${key} must be a positive number`);
          }
        }
      }
      return true;
    }),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags && tags.length > 0) {
        if (tags.length > 10) {
          throw new Error('Maximum 10 tags allowed');
        }
        for (const tag of tags) {
          if (typeof tag !== 'string' || tag.trim().length === 0 || tag.length > 30) {
            throw new Error('Each tag must be a non-empty string with max 30 characters');
          }
        }
      }
      return true;
    }),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer')
];

export const validateUpdateMenuItem = [
  param('itemId')
    .isUUID()
    .withMessage('Item ID must be a valid UUID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('image_url')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  body('is_available')
    .optional()
    .isBoolean()
    .withMessage('is_available must be a boolean'),
  
  body('preparation_time')
    .optional()
    .isInt({ min: 0, max: 300 })
    .withMessage('Preparation time must be between 0 and 300 minutes'),
  
  body('ingredients')
    .optional()
    .isArray()
    .withMessage('Ingredients must be an array')
    .custom((ingredients) => {
      if (ingredients && ingredients.length > 0) {
        for (const ingredient of ingredients) {
          if (typeof ingredient !== 'string' || ingredient.trim().length === 0) {
            throw new Error('Each ingredient must be a non-empty string');
          }
        }
      }
      return true;
    }),
  
  body('allergens')
    .optional()
    .isArray()
    .withMessage('Allergens must be an array')
    .custom((allergens) => {
      if (allergens && allergens.length > 0) {
        const validAllergens = [
          'gluten', 'dairy', 'eggs', 'fish', 'shellfish', 'tree_nuts',
          'peanuts', 'soy', 'sesame', 'sulfites', 'mustard', 'celery'
        ];
        for (const allergen of allergens) {
          if (!validAllergens.includes(allergen)) {
            throw new Error(`Invalid allergen: ${allergen}`);
          }
        }
      }
      return true;
    }),
  
  body('nutritional_info')
    .optional()
    .isObject()
    .withMessage('Nutritional info must be an object')
    .custom((nutritionalInfo) => {
      if (nutritionalInfo) {
        const allowedFields = ['calories', 'protein', 'carbs', 'fat'];
        for (const [key, value] of Object.entries(nutritionalInfo)) {
          if (!allowedFields.includes(key)) {
            throw new Error(`Invalid nutritional info field: ${key}`);
          }
          if (typeof value !== 'number' || value < 0) {
            throw new Error(`${key} must be a positive number`);
          }
        }
      }
      return true;
    }),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags && tags.length > 0) {
        if (tags.length > 10) {
          throw new Error('Maximum 10 tags allowed');
        }
        for (const tag of tags) {
          if (typeof tag !== 'string' || tag.trim().length === 0 || tag.length > 30) {
            throw new Error('Each tag must be a non-empty string with max 30 characters');
          }
        }
      }
      return true;
    }),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer')
];

export const validateGetMenuItems = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  query('category_id')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  query('is_available')
    .optional()
    .isBoolean()
    .withMessage('is_available must be a boolean'),
  
  query('min_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min price must be a positive number'),
  
  query('max_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

export const validateGetMenuItem = [
  param('itemId')
    .isUUID()
    .withMessage('Item ID must be a valid UUID')
];

export const validateDeleteMenuItem = [
  param('itemId')
    .isUUID()
    .withMessage('Item ID must be a valid UUID')
];

// Category Validations
export const validateCreateCategory = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must not exceed 200 characters'),
  
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

export const validateUpdateCategory = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must not exceed 200 characters'),
  
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

export const validateGetCategories = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID')
];

export const validateDeleteCategory = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID')
];

// Bulk Operations Validations
export const validateBulkUpdateAvailability = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('item_ids')
    .isArray({ min: 1, max: 50 })
    .withMessage('item_ids must be an array with 1-50 items')
    .custom((itemIds) => {
      for (const id of itemIds) {
        if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error('Each item ID must be a valid UUID');
        }
      }
      return true;
    }),
  
  body('is_available')
    .isBoolean()
    .withMessage('is_available must be a boolean')
];

export const validateReorderItems = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('item_orders')
    .isArray({ min: 1, max: 100 })
    .withMessage('item_orders must be an array with 1-100 items')
    .custom((itemOrders) => {
      for (const order of itemOrders) {
        if (!order.id || !order.sort_order === undefined) {
          throw new Error('Each item order must have id and sort_order');
        }
        if (typeof order.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(order.id)) {
          throw new Error('Each item ID must be a valid UUID');
        }
        if (typeof order.sort_order !== 'number' || order.sort_order < 0) {
          throw new Error('Each sort_order must be a non-negative number');
        }
      }
      return true;
    })
];

export const validateReorderCategories = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('category_orders')
    .isArray({ min: 1, max: 50 })
    .withMessage('category_orders must be an array with 1-50 items')
    .custom((categoryOrders) => {
      for (const order of categoryOrders) {
        if (!order.id || order.sort_order === undefined) {
          throw new Error('Each category order must have id and sort_order');
        }
        if (typeof order.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(order.id)) {
          throw new Error('Each category ID must be a valid UUID');
        }
        if (typeof order.sort_order !== 'number' || order.sort_order < 0) {
          throw new Error('Each sort_order must be a non-negative number');
        }
      }
      return true;
    })
];

export const validateToggleCategoryStatus = [
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('is_active')
    .isBoolean()
    .withMessage('is_active must be a boolean')
];

// Stats Validations
export const validateGetMenuStats = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID')
];

// Common validation for UUID parameters
export const validateUUIDParam = (paramName: string) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`)
];

// Validation for pagination
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Custom validation middleware for checking if at least one field is provided for updates
export const validateAtLeastOneField = (fields: string[]) => {
  return (req: any, res: any, next: any) => {
    const hasAtLeastOneField = fields.some(field => req.body[field] !== undefined);
    
    if (!hasAtLeastOneField) {
      return res.status(400).json({
        success: false,
        message: `At least one of the following fields must be provided: ${fields.join(', ')}`
      });
    }
    
    next();
  };
};