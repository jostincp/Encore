/**
 * =============================================================================
 * Encore Analytics Service - Middleware Index
 * =============================================================================
 * Description: Central export for all middleware modules
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

// Import all middleware functions for internal use
import { authMiddleware as _authMiddleware, optionalAuthMiddleware as _optionalAuthMiddleware, requireRole as _requireRole, requireAdmin as _requireAdmin, requireManager as _requireManager, requireStaff as _requireStaff, requirePermission as _requirePermission, requireBarAccess as _requireBarAccess, blacklistToken as _blacklistToken, clearUserCache as _clearUserCache } from './auth';
import { eventsLimiter as _eventsLimiter, analyticsLimiter as _analyticsLimiter, reportsLimiter as _reportsLimiter, generalLimiter as _generalLimiter, strictLimiter as _strictLimiter, burstLimiter as _burstLimiter, createCustomLimiter as _createCustomLimiter, getRateLimitStatus as _getRateLimitStatus, resetRateLimit as _resetRateLimit, getRateLimitStats as _getRateLimitStats } from './rateLimiter';
import { validationMiddleware as _validationMiddleware, validateBody as _validateBody, validateQuery as _validateQuery, validateParams as _validateParams, validateHeaders as _validateHeaders, validateUUIDParam as _validateUUIDParam, validatePagination as _validatePagination, validateDateRange as _validateDateRange, validateSorting as _validateSorting, validateCommonQuery as _validateCommonQuery, validateData as _validateData, validateRequest as _validateRequest, conditionalValidation as _conditionalValidation, partialValidation as _partialValidation } from './validation';
import { loggingMiddleware as _loggingMiddleware, basicLogging as _basicLogging, detailedLogging as _detailedLogging, productionLogging as _productionLogging, apiLogging as _apiLogging, requestIdMiddleware as _requestIdMiddleware, errorLoggingMiddleware as _errorLoggingMiddleware, performanceMiddleware as _performanceMiddleware } from './logging';
import { errorHandler as _errorHandler, developmentErrorHandler as _developmentErrorHandler, productionErrorHandler as _productionErrorHandler, apiErrorHandler as _apiErrorHandler, notFoundHandler as _notFoundHandler, asyncHandler as _asyncHandler, setupGlobalErrorHandlers as _setupGlobalErrorHandlers } from './errorHandler';

// Authentication and Authorization
export {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireManager,
  requireStaff,
  requirePermission,
  requireBarAccess,
  blacklistToken,
  clearUserCache,
  type AuthenticatedUser,
  type AuthenticatedRequest
} from './auth';

// Rate Limiting
export {
  eventsLimiter,
  analyticsLimiter,
  reportsLimiter,
  generalLimiter,
  strictLimiter,
  burstLimiter,
  createCustomLimiter,
  rateLimiter,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimitStats
} from './rateLimiter';

// Request Validation
export {
  validationMiddleware,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validateUUIDParam,
  validatePagination,
  validateDateRange,
  validateSorting,
  validateCommonQuery,
  validateData,
  validateRequest,
  conditionalValidation,
  partialValidation,
  // Common schemas
  UUIDSchema,
  PaginationSchema,
  DateRangeSchema,
  SortingSchema,
  BarIdSchema,
  CommonQuerySchema,
  type ValidationTarget,
  type ValidationOptions,
  type ValidationResult,
  type ValidationError
} from './validation';

// HTTP Logging
export {
  loggingMiddleware,
  basicLogging,
  detailedLogging,
  productionLogging,
  apiLogging,
  requestIdMiddleware,
  errorLoggingMiddleware,
  performanceMiddleware,
  type LoggingOptions,
  type RequestLog,
  type ResponseLog
} from './logging';

// Error Handling
export {
  errorHandler,
  developmentErrorHandler,
  productionErrorHandler,
  apiErrorHandler,
  notFoundHandler,
  asyncHandler,
  setupGlobalErrorHandlers,
  type ErrorContext,
  type ErrorHandlerOptions
} from './errorHandler';

// =============================================================================
// Middleware Combinations
// =============================================================================

/**
 * Standard middleware stack for public routes
 */
export const publicMiddleware = [
  _requestIdMiddleware,
  _basicLogging
];

/**
 * Standard middleware stack for private routes
 */
export const privateMiddleware = [
  _requestIdMiddleware,
  _apiLogging,
  _authMiddleware,
  _generalLimiter
];

/**
 * Admin-only middleware stack
 */
export const adminMiddleware = [
  _requestIdMiddleware,
  _detailedLogging,
  _authMiddleware,
  _requireAdmin,
  _generalLimiter
];

/**
 * API middleware stack with validation
 */
export const apiMiddleware = [
  _requestIdMiddleware,
  _apiLogging,
  _authMiddleware,
  _generalLimiter
];

/**
 * Report generation middleware stack
 */
export const reportMiddleware = [
  _requestIdMiddleware,
  _apiLogging,
  _authMiddleware,
  _reportsLimiter
];

/**
 * Analytics query middleware stack
 */
export const analyticsMiddleware = [
  _requestIdMiddleware,
  _apiLogging,
  _authMiddleware,
  _analyticsLimiter
];

/**
 * Event creation middleware stack
 */
export const eventMiddleware = [
  _requestIdMiddleware,
  _basicLogging,
  _authMiddleware,
  _eventsLimiter
];

// =============================================================================
// Development vs Production Middleware
// =============================================================================

/**
 * Development middleware configuration
 */
export const developmentMiddleware = {
  logging: _detailedLogging,
  errorHandler: _developmentErrorHandler,
  rateLimit: _generalLimiter
};

/**
 * Production middleware configuration
 */
export const productionMiddleware = {
  logging: _productionLogging,
  errorHandler: _productionErrorHandler,
  rateLimit: _generalLimiter
};

// =============================================================================
// Middleware Factory Functions
// =============================================================================

/**
 * Create middleware stack based on environment
 */
export const createMiddlewareStack = (environment: 'development' | 'production' | 'test') => {
  const config = environment === 'production' ? productionMiddleware : developmentMiddleware;
  
  return {
    ...config,
    public: [
      _requestIdMiddleware,
      config.logging
    ],
    private: [
      _requestIdMiddleware,
      config.logging,
      _authMiddleware,
      config.rateLimit
    ],
    admin: [
      _requestIdMiddleware,
      config.logging,
      _authMiddleware,
      _requireAdmin,
      _generalLimiter
    ]
  };
};

/**
 * Create role-based middleware
 */
export const createRoleMiddleware = (role: 'admin' | 'manager' | 'staff') => {
  const roleMiddleware = {
    admin: _requireAdmin,
    manager: _requireManager,
    staff: _requireStaff
  };

  return [
    _requestIdMiddleware,
    _apiLogging,
    _authMiddleware,
    roleMiddleware[role],
    _generalLimiter
  ];
};

/**
 * Create permission-based middleware
 */
export const createPermissionMiddleware = (permission: string) => {
  return [
    _requestIdMiddleware,
    _apiLogging,
    _authMiddleware,
    _requirePermission(permission),
    _generalLimiter
  ];
};

/**
 * Create bar-specific middleware
 */
export const createBarMiddleware = (requireBarAccess: boolean = true) => {
  const middleware = [
    _requestIdMiddleware,
    _apiLogging,
    _authMiddleware,
    _generalLimiter
  ];

  if (requireBarAccess) {
    middleware.splice(-1, 0, _requireBarAccess);
  }

  return middleware;
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Apply middleware array to router
 */
export const applyMiddleware = (router: any, middleware: any[]) => {
  middleware.forEach(mw => router.use(mw));
  return router;
};

/**
 * Combine multiple middleware arrays
 */
export const combineMiddleware = (...middlewareArrays: any[][]) => {
  return middlewareArrays.flat();
};

/**
 * Create conditional middleware
 */
export const conditionalMiddleware = (condition: (req: any) => boolean, middleware: any) => {
  return (req: any, res: any, next: any) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
};

// =============================================================================
// Export Default Configuration
// =============================================================================

export default {
  // Individual middleware
  auth: _authMiddleware,
  rateLimit: _generalLimiter,
  validation: _validationMiddleware,
  logging: _apiLogging,
  errorHandler: _errorHandler,
  
  // Middleware stacks
  public: publicMiddleware,
  private: privateMiddleware,
  admin: adminMiddleware,
  api: apiMiddleware,
  report: reportMiddleware,
  analytics: analyticsMiddleware,
  event: eventMiddleware,
  
  // Factory functions
  createStack: createMiddlewareStack,
  createRole: createRoleMiddleware,
  createPermission: createPermissionMiddleware,
  createBar: createBarMiddleware,
  
  // Utilities
  apply: applyMiddleware,
  combine: combineMiddleware,
  conditional: conditionalMiddleware
};