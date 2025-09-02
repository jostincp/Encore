import { body, param, query } from 'express-validator';

// Validation for getting menu items
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
    .withMessage('min_price must be a positive number'),
  
  query('max_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('max_price must be a positive number'),
  
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value) && value.every(tag => typeof tag === 'string')) {
        return true;
      }
      throw new Error('tags must be a string or array of strings');
    }),
  
  query('allergens')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value) && value.every(allergen => typeof allergen === 'string')) {
        return true;
      }
      throw new Error('allergens must be a string or array of strings');
    }),
  
  query('search')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('search must be a string between 1 and 100 characters'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
];

// Validation for getting single menu item
export const validateGetMenuItem = [
  param('itemId')
    .isUUID()
    .withMessage('Item ID must be a valid UUID')
];

// Validation for creating menu item
export const validateCreateMenuItem = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('category_id')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('name')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .isString()
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
      if (ingredients.every((ingredient: any) => typeof ingredient === 'string')) {
        return true;
      }
      throw new Error('All ingredients must be strings');
    }),
  
  body('allergens')
    .optional()
    .isArray()
    .withMessage('Allergens must be an array')
    .custom((allergens) => {
      if (allergens.every((allergen: any) => typeof allergen === 'string')) {
        return true;
      }
      throw new Error('All allergens must be strings');
    }),
  
  body('nutritional_info')
    .optional()
    .isObject()
    .withMessage('Nutritional info must be an object'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.every((tag: any) => typeof tag === 'string')) {
        return true;
      }
      throw new Error('All tags must be strings');
    }),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer')
];

// Validation for updating menu item
export const validateUpdateMenuItem = [
  param('itemId')
    .isUUID()
    .withMessage('Item ID must be a valid UUID'),
  
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
      if (ingredients.every((ingredient: any) => typeof ingredient === 'string')) {
        return true;
      }
      throw new Error('All ingredients must be strings');
    }),
  
  body('allergens')
    .optional()
    .isArray()
    .withMessage('Allergens must be an array')
    .custom((allergens) => {
      if (allergens.every((allergen: any) => typeof allergen === 'string')) {
        return true;
      }
      throw new Error('All allergens must be strings');
    }),
  
  body('nutritional_info')
    .optional()
    .isObject()
    .withMessage('Nutritional info must be an object'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.every((tag: any) => typeof tag === 'string')) {
        return true;
      }
      throw new Error('All tags must be strings');
    }),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  // Custom validation to ensure at least one field is provided
  body()
    .custom((body) => {
      const allowedFields = [
        'name', 'description', 'price', 'image_url', 'is_available',
        'preparation_time', 'ingredients', 'allergens', 'nutritional_info',
        'tags', 'sort_order'
      ];
      
      const providedFields = Object.keys(body).filter(key => 
        allowedFields.includes(key) && body[key] !== undefined
      );
      
      if (providedFields.length === 0) {
        throw new Error('At least one field must be provided for update');
      }
      
      return true;
    })
];

// Validation for deleting menu item
export const validateDeleteMenuItem = [
  param('itemId')
    .isUUID()
    .withMessage('Item ID must be a valid UUID')
];

// Validation for bulk updating items availability
export const validateUpdateItemsAvailability = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  body('item_ids')
    .isArray({ min: 1 })
    .withMessage('item_ids must be a non-empty array')
    .custom((itemIds) => {
      if (itemIds.every((id: any) => typeof id === 'string')) {
        return true;
      }
      throw new Error('All item IDs must be strings');
    }),
  
  body('is_available')
    .isBoolean()
    .withMessage('is_available must be a boolean')
];

// Validation for reordering items
export const validateReorderItems = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('item_orders')
    .isArray({ min: 1 })
    .withMessage('item_orders must be a non-empty array')
    .custom((orders) => {
      if (orders.every((order: any) => 
        typeof order === 'object' && 
        typeof order.item_id === 'string' && 
        typeof order.sort_order === 'number' &&
        order.sort_order >= 0
      )) {
        return true;
      }
      throw new Error('Each order must have item_id (string) and sort_order (non-negative number)');
    })
];

// Validation for getting menu stats
export const validateGetMenuStats = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID')
];

// Validation for toggling item availability
export const validateToggleItemAvailability = [
  param('itemId')
    .isUUID()
    .withMessage('Item ID must be a valid UUID')
];

// Validation for getting items by category
export const validateGetItemsByCategory = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  param('categoryId')
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  query('is_available')
    .optional()
    .isBoolean()
    .withMessage('is_available must be a boolean'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
];

// Validation for advanced search
export const validateAdvancedSearch = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  
  query('q')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('category_id')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  query('min_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('min_price must be a positive number'),
  
  query('max_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('max_price must be a positive number'),
  
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value) && value.every(tag => typeof tag === 'string')) {
        return true;
      }
      throw new Error('tags must be a string or array of strings');
    }),
  
  query('allergens')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value) && value.every(allergen => typeof allergen === 'string')) {
        return true;
      }
      throw new Error('allergens must be a string or array of strings');
    }),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
];