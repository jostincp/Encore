/**
 * =============================================================================
 * MusicBar Analytics Service - Validation Middleware
 * =============================================================================
 * Description: Request validation middleware using Zod schemas
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { z, ZodSchema, ZodError } from 'zod';
import { createValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

// =============================================================================
// Types and Interfaces
// =============================================================================

export type ValidationTarget = 'body' | 'query' | 'params' | 'headers';

export interface ValidationOptions {
  target?: ValidationTarget;
  stripUnknown?: boolean;
  allowUnknown?: boolean;
  abortEarly?: boolean;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: ValidationOptions = {
  target: 'body',
  stripUnknown: true,
  allowUnknown: false,
  abortEarly: false
};

// =============================================================================
// Main Validation Middleware
// =============================================================================

/**
 * Create validation middleware for Zod schemas
 */
export const validationMiddleware = <T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body',
  options: Partial<ValidationOptions> = {}
) => {
  const finalOptions: ValidationOptions = { ...DEFAULT_OPTIONS, target, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Get data to validate based on target
      const dataToValidate = getValidationData(req, finalOptions.target!);

      // Validate data using Zod schema
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const validationErrors = formatZodErrors(result.error);
        
        logger.warn('Validation failed', {
          target: finalOptions.target,
          errors: validationErrors,
          data: dataToValidate
        });

        const errorMessage = `Validation failed for ${finalOptions.target}: ${validationErrors.map(e => e.message).join(', ')}`;
        throw createValidationError(errorMessage, validationErrors);
      }

      // Replace request data with validated data
      setValidationData(req, finalOptions.target!, result.data);

      logger.debug('Validation successful', {
        target: finalOptions.target,
        dataKeys: Object.keys(result.data as object || {})
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

// =============================================================================
// Data Extraction and Setting
// =============================================================================

/**
 * Get data to validate from request based on target
 */
const getValidationData = (req: Request, target: ValidationTarget): any => {
  switch (target) {
    case 'body':
      return req.body;
    case 'query':
      return req.query;
    case 'params':
      return req.params;
    case 'headers':
      return req.headers;
    default:
      return req.body;
  }
};

/**
 * Set validated data back to request
 */
const setValidationData = (req: Request, target: ValidationTarget, data: any): void => {
  switch (target) {
    case 'body':
      req.body = data;
      break;
    case 'query':
      req.query = data;
      break;
    case 'params':
      req.params = data;
      break;
    case 'headers':
      // Don't modify headers
      break;
  }
};

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Format Zod validation errors into a more readable format
 */
const formatZodErrors = (zodError: ZodError): ValidationError[] => {
  return zodError.issues.map(error => ({
    field: error.path.join('.') || 'root',
    message: error.message,
    code: error.code,
    value: error.path.length > 0 ? getNestedValue({}, error.path as (string | number)[]) : undefined
  }));
};

/**
 * Get nested value from object using path array
 */
const getNestedValue = (obj: any, path: (string | number)[]): any => {
  return path.reduce((current, key) => current?.[key], obj);
};

// =============================================================================
// Common Validation Schemas
// =============================================================================

/**
 * UUID validation schema
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * Pagination validation schema
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20)
});

/**
 * Date range validation schema
 */
export const DateRangeSchema = z.object({
  start_date: z.string().datetime('Invalid start date format').optional(),
  end_date: z.string().datetime('Invalid end date format').optional()
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: 'Start date must be before or equal to end date',
    path: ['start_date']
  }
);

/**
 * Sorting validation schema
 */
export const SortingSchema = z.object({
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

/**
 * Bar ID validation schema
 */
export const BarIdSchema = z.object({
  bar_id: UUIDSchema.optional()
});

/**
 * Combined query schema for common parameters
 */
export const CommonQuerySchema = PaginationSchema
  .merge(DateRangeSchema)
  .merge(SortingSchema)
  .merge(BarIdSchema);

// =============================================================================
// Specialized Validation Middlewares
// =============================================================================

/**
 * Validate request body
 */
export const validateBody = <T>(schema: ZodSchema<T>) => {
  return validationMiddleware(schema, 'body');
};

/**
 * Validate query parameters
 */
export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return validationMiddleware(schema, 'query');
};

/**
 * Simple validation middleware for express-validator
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validate route parameters
 */
export const validateParams = <T>(schema: ZodSchema<T>) => {
  return validationMiddleware(schema, 'params');
};

/**
 * Validate headers
 */
export const validateHeaders = <T>(schema: ZodSchema<T>) => {
  return validationMiddleware(schema, 'headers');
};

// =============================================================================
// Common Parameter Validators
// =============================================================================

/**
 * Validate UUID parameter
 */
export const validateUUIDParam = (paramName: string = 'id') => {
  const schema = z.object({
    [paramName]: UUIDSchema
  });
  return validateParams(schema);
};

/**
 * Validate pagination query parameters
 */
export const validatePagination = validateQuery(PaginationSchema);

/**
 * Validate date range query parameters
 */
export const validateDateRange = validateQuery(DateRangeSchema);

/**
 * Validate sorting query parameters
 */
export const validateSorting = validateQuery(SortingSchema);

/**
 * Validate common query parameters
 */
export const validateCommonQuery = validateQuery(CommonQuerySchema);

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Manually validate data against a schema
 */
export const validateData = <T>(data: unknown, schema: ZodSchema<T>): ValidationResult<T> => {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        errors: formatZodErrors(result.error)
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'root',
        message: 'Validation error occurred',
        code: 'validation_error'
      }]
    };
  }
};

/**
 * Create a conditional validation middleware
 */
export const conditionalValidation = <T>(
  condition: (req: Request) => boolean,
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (condition(req)) {
      return validationMiddleware(schema, target)(req, res, next);
    }
    next();
  };
};

/**
 * Create validation middleware that allows partial data
 */
export const partialValidation = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  target: ValidationTarget = 'body'
) => {
  return validationMiddleware(schema.partial(), target);
};

// =============================================================================
// Export Default
// =============================================================================

export default {
  validationMiddleware,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validateRequest,
  validateUUIDParam,
  validatePagination,
  validateDateRange,
  validateSorting,
  validateCommonQuery,
  validateData,
  conditionalValidation,
  partialValidation,
  // Common schemas
  UUIDSchema,
  PaginationSchema,
  DateRangeSchema,
  SortingSchema,
  BarIdSchema,
  CommonQuerySchema
};