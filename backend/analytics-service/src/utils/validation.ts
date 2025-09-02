/**
 * =============================================================================
 * MusicBar Analytics Service - Validation Utilities
 * =============================================================================
 * Description: Common validation functions and utilities
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { ValidationError } from './errors';
import { z } from 'zod';

// =============================================================================
// Pagination Validation
// =============================================================================
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ValidatedPagination {
  page: number;
  limit: number;
  offset: number;
}

export function validatePagination(params: PaginationParams): ValidatedPagination {
  const { page, limit } = params;

  // Validate page
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError('Page must be a positive integer starting from 1');
  }

  // Validate limit
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be a positive integer between 1 and 100');
  }

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset
  };
}

// =============================================================================
// Date Range Validation
// =============================================================================
export interface DateRangeParams {
  start_date?: Date;
  end_date?: Date;
}

export function validateDateRange(params: DateRangeParams): void {
  const { start_date, end_date } = params;

  // Check if dates are valid
  if (start_date && isNaN(start_date.getTime())) {
    throw new ValidationError('Invalid start_date format');
  }

  if (end_date && isNaN(end_date.getTime())) {
    throw new ValidationError('Invalid end_date format');
  }

  // Check if start_date is before end_date
  if (start_date && end_date && start_date > end_date) {
    throw new ValidationError('start_date must be before end_date');
  }

  // Check if dates are not too far in the future
  const maxFutureDate = new Date();
  maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);

  if (start_date && start_date > maxFutureDate) {
    throw new ValidationError('start_date cannot be more than 1 year in the future');
  }

  if (end_date && end_date > maxFutureDate) {
    throw new ValidationError('end_date cannot be more than 1 year in the future');
  }

  // Check if date range is not too large (max 2 years)
  if (start_date && end_date) {
    const diffInMs = end_date.getTime() - start_date.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    if (diffInDays > 730) { // 2 years
      throw new ValidationError('Date range cannot exceed 2 years');
    }
  }
}

// =============================================================================
// UUID Validation
// =============================================================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUUID(uuid: string, fieldName: string = 'ID'): void {
  if (!uuid || typeof uuid !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  if (!UUID_REGEX.test(uuid)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
}

// =============================================================================
// String Validation
// =============================================================================
export function validateString(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
  } = {}
): void {
  const { required = false, minLength, maxLength, pattern, allowEmpty = false } = options;

  // Check if required
  if (required && (value === undefined || value === null)) {
    throw new ValidationError(`${fieldName} is required`);
  }

  // Skip validation if not required and value is undefined/null
  if (!required && (value === undefined || value === null)) {
    return;
  }

  // Check if string
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  // Check if empty when not allowed
  if (!allowEmpty && value.trim() === '') {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }

  // Check minimum length
  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
  }

  // Check maximum length
  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters long`);
  }

  // Check pattern
  if (pattern && !pattern.test(value)) {
    throw new ValidationError(`${fieldName} format is invalid`);
  }
}

// =============================================================================
// Number Validation
// =============================================================================
export function validateNumber(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
  } = {}
): void {
  const { required = false, min, max, integer = false, positive = false } = options;

  // Check if required
  if (required && (value === undefined || value === null)) {
    throw new ValidationError(`${fieldName} is required`);
  }

  // Skip validation if not required and value is undefined/null
  if (!required && (value === undefined || value === null)) {
    return;
  }

  // Check if number
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }

  // Check if integer
  if (integer && !Number.isInteger(value)) {
    throw new ValidationError(`${fieldName} must be an integer`);
  }

  // Check if positive
  if (positive && value <= 0) {
    throw new ValidationError(`${fieldName} must be positive`);
  }

  // Check minimum value
  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }

  // Check maximum value
  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`);
  }
}

// =============================================================================
// Array Validation
// =============================================================================
export function validateArray(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any, index: number) => void;
  } = {}
): void {
  const { required = false, minLength, maxLength, itemValidator } = options;

  // Check if required
  if (required && (value === undefined || value === null)) {
    throw new ValidationError(`${fieldName} is required`);
  }

  // Skip validation if not required and value is undefined/null
  if (!required && (value === undefined || value === null)) {
    return;
  }

  // Check if array
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  // Check minimum length
  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(`${fieldName} must have at least ${minLength} items`);
  }

  // Check maximum length
  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(`${fieldName} must have at most ${maxLength} items`);
  }

  // Validate each item
  if (itemValidator) {
    value.forEach((item, index) => {
      try {
        itemValidator(item, index);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(`${fieldName}[${index}]: ${error.message}`);
        }
        throw error;
      }
    });
  }
}

// =============================================================================
// Email Validation
// =============================================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string, fieldName: string = 'Email'): void {
  validateString(email, fieldName, { required: true });
  
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError(`${fieldName} format is invalid`);
  }
}

// =============================================================================
// URL Validation
// =============================================================================
export function validateURL(url: string, fieldName: string = 'URL'): void {
  validateString(url, fieldName, { required: true });
  
  try {
    new URL(url);
  } catch {
    throw new ValidationError(`${fieldName} format is invalid`);
  }
}

// =============================================================================
// JSON Validation
// =============================================================================
export function validateJSON(value: any, fieldName: string): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'string') {
    try {
      JSON.parse(value);
    } catch {
      throw new ValidationError(`${fieldName} must be valid JSON`);
    }
  } else if (typeof value !== 'object') {
    throw new ValidationError(`${fieldName} must be a valid JSON object or string`);
  }
}

// =============================================================================
// Enum Validation
// =============================================================================
export function validateEnum<T extends Record<string, string | number>>(
  value: any,
  enumObject: T,
  fieldName: string,
  required: boolean = false
): void {
  // Check if required
  if (required && (value === undefined || value === null)) {
    throw new ValidationError(`${fieldName} is required`);
  }

  // Skip validation if not required and value is undefined/null
  if (!required && (value === undefined || value === null)) {
    return;
  }

  const validValues = Object.values(enumObject);
  if (!validValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${validValues.join(', ')}`
    );
  }
}

// =============================================================================
// File Validation
// =============================================================================
export function validateFile(
  file: any,
  fieldName: string,
  options: {
    required?: boolean;
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): void {
  const { required = false, maxSize, allowedTypes, allowedExtensions } = options;

  // Check if required
  if (required && !file) {
    throw new ValidationError(`${fieldName} is required`);
  }

  // Skip validation if not required and file is not provided
  if (!required && !file) {
    return;
  }

  // Check file size
  if (maxSize && file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    throw new ValidationError(`${fieldName} size must be less than ${maxSizeMB}MB`);
  }

  // Check file type
  if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
    throw new ValidationError(
      `${fieldName} type must be one of: ${allowedTypes.join(', ')}`
    );
  }

  // Check file extension
  if (allowedExtensions) {
    const fileExtension = file.originalname?.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      throw new ValidationError(
        `${fieldName} extension must be one of: ${allowedExtensions.join(', ')}`
      );
    }
  }
}

// =============================================================================
// Zod Schema Validator
// =============================================================================
export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(err => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
        return `${path}${err.message}`;
      });
      throw new ValidationError(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
}

// =============================================================================
// Sanitization Functions
// =============================================================================
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/[<>"'&]/g, '');
}

export function sanitizeHTML(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;');
}

export function sanitizeSQL(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[';"\\]/g, '');
}

// =============================================================================
// Export All
// =============================================================================
export default {
  validatePagination,
  validateDateRange,
  validateUUID,
  validateString,
  validateNumber,
  validateArray,
  validateEmail,
  validateURL,
  validateJSON,
  validateEnum,
  validateFile,
  validateWithZod,
  sanitizeString,
  sanitizeHTML,
  sanitizeSQL
};