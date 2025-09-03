import { Request } from 'express';

/**
 * JWT Payload interface
 */
export interface JWTPayload {
  userId: string;
  email?: string;
  role: 'customer' | 'bar_owner' | 'admin';
  barId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Extended Request interface with user information
 */
export interface RequestWithUser extends Request {
  user?: JWTPayload;
}

/**
 * User roles enum
 */
export enum UserRole {
  CUSTOMER = 'customer',
  BAR_OWNER = 'bar_owner',
  ADMIN = 'admin'
}

/**
 * Database query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * API Response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: string[];
}

/**
 * Pagination interface
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Export model types
export * from './models';