import { body, param, query } from 'express-validator';

// Validation for getting daily specials
export const validateGetDailySpecials = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  query('active_only')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('active_only must be true or false')
];

// Validation for getting single daily special
export const validateGetDailySpecial = [
  param('specialId')
    .isUUID()
    .withMessage('Special ID must be a valid UUID')
];

// Validation for creating daily special
export const validateCreateDailySpecial = [
  param('barId')
    .isUUID()
    .withMessage('Bar ID must be a valid UUID'),
  body('menu_item_id')
    .isUUID()
    .withMessage('Menu item ID must be a valid UUID'),
  body('special_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Special price must be a positive number'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be a string with maximum 500 characters'),
  body('valid_from')
    .isISO8601()
    .withMessage('Valid from must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      // Allow creating specials that start in the past (for ongoing specials)
      if (date > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) { // 30 days in future
        throw new Error('Valid from date cannot be more than 30 days in the future');
      }
      return true;
    }),
  body('valid_until')
    .isISO8601()
    .withMessage('Valid until must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      const validUntil = new Date(value);
      const now = new Date();
      
      // Must be in the future
      if (validUntil <= now) {
        throw new Error('Valid until date must be in the future');
      }
      
      // Must be after valid_from
      if (req.body.valid_from) {
        const validFrom = new Date(req.body.valid_from);
        if (validUntil <= validFrom) {
          throw new Error('Valid until date must be after valid from date');
        }
        
        // Maximum duration of 30 days
        const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        if (validUntil.getTime() - validFrom.getTime() > maxDuration) {
          throw new Error('Special cannot be valid for more than 30 days');
        }
      }
      
      return true;
    })
];

// Validation for updating daily special
export const validateUpdateDailySpecial = [
  param('specialId')
    .isUUID()
    .withMessage('Special ID must be a valid UUID'),
  body('special_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Special price must be a positive number'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be a string with maximum 500 characters'),
  body('valid_from')
    .optional()
    .isISO8601()
    .withMessage('Valid from must be a valid ISO 8601 date'),
  body('valid_until')
    .optional()
    .isISO8601()
    .withMessage('Valid until must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (value) {
        const validUntil = new Date(value);
        const now = new Date();
        
        // Must be in the future
        if (validUntil <= now) {
          throw new Error('Valid until date must be in the future');
        }
        
        // Must be after valid_from if provided
        if (req.body.valid_from) {
          const validFrom = new Date(req.body.valid_from);
          if (validUntil <= validFrom) {
            throw new Error('Valid until date must be after valid from date');
          }
        }
      }
      return true;
    }),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
];

// Validation for deleting daily special
export const validateDeleteDailySpecial = [
  param('specialId')
    .isUUID()
    .withMessage('Special ID must be a valid UUID')
];

// Validation for toggling daily special status
export const validateToggleDailySpecialStatus = [
  param('specialId')
    .isUUID()
    .withMessage('Special ID must be a valid UUID'),
  body('is_active')
    .isBoolean()
    .withMessage('is_active must be a boolean')
];

// Custom validation to ensure at least one field is provided for updates
export const validateAtLeastOneSpecialField = (fields: string[]) => {
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