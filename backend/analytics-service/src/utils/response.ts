/**
 * =============================================================================
 * Encore Analytics Service - Response Utilities
 * =============================================================================
 * Description: Standardized HTTP response utilities
 * Version: 1.0.0
 * Created: 2024-01-20
 * =============================================================================
 */

import { Response } from 'express';
import { BaseError } from './errors';
import { logger } from './logger';

// =============================================================================
// Response Interfaces
// =============================================================================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters?: Record<string, any>;
    sort?: {
      field: string;
      order: 'asc' | 'desc';
    };
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface QueryMeta {
  filters?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  search?: string;
}

// =============================================================================
// Success Response Functions
// =============================================================================
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: Partial<ApiResponse['meta']>
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };

  return res.status(statusCode).json(response);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendUpdated<T>(
  res: Response,
  data: T,
  message: string = 'Resource updated successfully'
): Response {
  return sendSuccess(res, data, message, 200);
}

export function sendDeleted(
  res: Response,
  message: string = 'Resource deleted successfully'
): Response {
  return sendSuccess(res, null, message, 200);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

// =============================================================================
// Paginated Response Function
// =============================================================================
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message?: string,
  queryMeta?: QueryMeta
): Response {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    message,
    meta: {
      pagination,
      ...queryMeta,
      timestamp: new Date().toISOString()
    }
  };

  return res.status(200).json(response);
}

// =============================================================================
// Error Response Functions
// =============================================================================
export function sendError(
  res: Response,
  error: BaseError | Error,
  requestId?: string
): Response {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  if (error instanceof BaseError) {
    statusCode = error.statusCode;
    errorCode = error.name;
    message = error.message;
    details = error.context;
  } else {
    // Log unexpected errors
    logger.error('Unexpected error:', {
      error: error.message,
      stack: error.stack,
      requestId
    });
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return res.status(statusCode).json(response);
}

export function sendValidationError(
  res: Response,
  message: string,
  details?: any
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(400).json(response);
}

export function sendNotFound(
  res: Response,
  resource: string = 'Resource'
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `${resource} not found`,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(404).json(response);
}

export function sendUnauthorized(
  res: Response,
  message: string = 'Authentication required'
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(401).json(response);
}

export function sendForbidden(
  res: Response,
  message: string = 'Access denied'
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(403).json(response);
}

export function sendConflict(
  res: Response,
  message: string = 'Resource already exists'
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'CONFLICT',
      message,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(409).json(response);
}

export function sendRateLimit(
  res: Response,
  message: string = 'Rate limit exceeded'
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(429).json(response);
}

export function sendServiceUnavailable(
  res: Response,
  message: string = 'Service temporarily unavailable'
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(503).json(response);
}

// =============================================================================
// Utility Functions
// =============================================================================
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

export function createQueryMeta(
  filters?: Record<string, any>,
  sort?: { field: string; order: 'asc' | 'desc' },
  search?: string
): QueryMeta {
  const meta: QueryMeta = {};
  
  if (filters && Object.keys(filters).length > 0) {
    meta.filters = filters;
  }
  
  if (sort) {
    meta.sort = sort;
  }
  
  if (search) {
    meta.search = search;
  }
  
  return meta;
}

// =============================================================================
// Health Check Response
// =============================================================================
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    redis: 'connected' | 'disconnected' | 'error';
    queue: 'active' | 'inactive' | 'error';
  };
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export function sendHealthCheck(
  res: Response,
  healthData: HealthCheckResponse
): Response {
  const statusCode = healthData.status === 'healthy' ? 200 : 
                    healthData.status === 'degraded' ? 200 : 503;
  
  return res.status(statusCode).json(healthData);
}

// =============================================================================
// File Download Response
// =============================================================================
export function sendFile(
  res: Response,
  filePath: string,
  fileName?: string,
  mimeType?: string
): void {
  if (fileName) {
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  }
  
  if (mimeType) {
    res.setHeader('Content-Type', mimeType);
  }
  
  res.sendFile(filePath);
}

export function sendBuffer(
  res: Response,
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Response {
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', buffer.length.toString());
  
  return res.send(buffer);
}

// =============================================================================
// Streaming Response
// =============================================================================
export function sendStream(
  res: Response,
  stream: NodeJS.ReadableStream,
  fileName?: string,
  mimeType?: string
): void {
  if (fileName) {
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  }
  
  if (mimeType) {
    res.setHeader('Content-Type', mimeType);
  }
  
  stream.pipe(res);
}

// =============================================================================
// Export All
// =============================================================================
export default {
  sendSuccess,
  sendCreated,
  sendUpdated,
  sendDeleted,
  sendNoContent,
  sendPaginated,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendConflict,
  sendRateLimit,
  sendServiceUnavailable,
  sendHealthCheck,
  sendFile,
  sendBuffer,
  sendStream,
  createPaginationMeta,
  createQueryMeta
};