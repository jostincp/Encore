import { Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from './logger';

/**
 * Send success response
 */
export const sendSuccess = <T = any>(
  res: Response,
  data?: T,
  message: string = 'Success',
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data
  };

  logger.debug('Sending success response', { statusCode, message });
  res.status(statusCode).json(response);
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  message: string = 'Error',
  statusCode: number = 500,
  errors?: string[]
): void => {
  const response: ApiResponse = {
    success: false,
    message,
    error: message,
    errors
  };

  logger.error('Sending error response', { statusCode, message, errors });
  res.status(statusCode).json(response);
};

/**
 * Send validation error response
 */
export const sendValidationError = (
  res: Response,
  errors: string[],
  message: string = 'Validation failed'
): void => {
  sendError(res, message, 400, errors);
};

/**
 * Send unauthorized response
 */
export const sendUnauthorized = (
  res: Response,
  message: string = 'Unauthorized'
): void => {
  sendError(res, message, 401);
};

/**
 * Send forbidden response
 */
export const sendForbidden = (
  res: Response,
  message: string = 'Forbidden'
): void => {
  sendError(res, message, 403);
};

/**
 * Send not found response
 */
export const sendNotFound = (
  res: Response,
  message: string = 'Not found'
): void => {
  sendError(res, message, 404);
};

/**
 * Send conflict response
 */
export const sendConflict = (
  res: Response,
  message: string = 'Conflict'
): void => {
  sendError(res, message, 409);
};

/**
 * Send internal server error response
 */
export const sendInternalError = (
  res: Response,
  message: string = 'Internal server error'
): void => {
  sendError(res, message, 500);
};