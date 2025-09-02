import { Response } from 'express';
import { ApiResponse, ValidationError } from '../types';
import { logError } from './logger';

// Clases de error personalizadas
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public validationErrors: ValidationError[];

  constructor(message: string, validationErrors: ValidationError[] = []) {
    super(message, 400);
    this.validationErrors = validationErrors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
  }
}

// Funciones de utilidad para respuestas HTTP
export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode: number = 200): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message
  };
  res.status(statusCode).json(response);
};

export const sendError = (res: Response, error: string, statusCode: number = 500, data?: any): void => {
  const response: ApiResponse = {
    success: false,
    error,
    data
  };
  res.status(statusCode).json(response);
};

export const sendValidationError = (res: Response, message: string, validationErrors: ValidationError[]): void => {
  const response: ApiResponse = {
    success: false,
    error: message,
    data: { validationErrors }
  };
  res.status(400).json(response);
};

// Middleware de manejo de errores global
export const errorHandler = (error: Error, req: any, res: Response, next: any): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let data: any = undefined;

  // Log del error
  logError('Error occurred', error, {
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;

    if (error instanceof ValidationError) {
      data = { validationErrors: error.validationErrors };
    }
  } else if (error.name === 'ValidationError') {
    // Error de validación de Mongoose/Sequelize
    statusCode = 400;
    message = 'Validation error';
    data = { validationErrors: extractValidationErrors(error) };
  } else if (error.name === 'CastError') {
    // Error de cast de MongoDB/Mongoose
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (error.code === 11000) {
    // Error de duplicado en MongoDB
    statusCode = 409;
    message = 'Resource already exists';
  }

  // En desarrollo, incluir stack trace
  if (process.env.NODE_ENV === 'development') {
    data = { ...data, stack: error.stack };
  }

  sendError(res, message, statusCode, data);
};

// Función para extraer errores de validación de diferentes ORMs
const extractValidationErrors = (error: any): ValidationError[] => {
  const validationErrors: ValidationError[] = [];

  if (error.errors) {
    // Mongoose validation errors
    Object.keys(error.errors).forEach(key => {
      validationErrors.push({
        field: key,
        message: error.errors[key].message
      });
    });
  }

  return validationErrors;
};

// Wrapper para funciones async que maneja errores automáticamente
export const asyncHandler = (fn: Function) => {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Función para manejar errores no capturados
export const handleUncaughtExceptions = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logError('Uncaught Exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logError('Unhandled Rejection', new Error(reason), { promise });
    process.exit(1);
  });
};

// Función para validar y lanzar errores de validación
export const throwValidationError = (validationResult: { isValid: boolean; errors: ValidationError[] }): void => {
  if (!validationResult.isValid) {
    throw new ValidationError('Validation failed', validationResult.errors);
  }
};