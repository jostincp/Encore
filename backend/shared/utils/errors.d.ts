import { Response } from 'express';
import { ValidationError } from '../types';
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number, isOperational?: boolean);
}
export declare class ValidationError extends AppError {
    validationErrors: ValidationError[];
    constructor(message: string, validationErrors?: ValidationError[]);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
export declare class BadRequestError extends AppError {
    constructor(message?: string);
}
export declare const sendSuccess: <T>(res: Response, data: T, message?: string, statusCode?: number) => void;
export declare const sendError: (res: Response, error: string, statusCode?: number, data?: any) => void;
export declare const sendValidationError: (res: Response, message: string, validationErrors: ValidationError[]) => void;
export declare const errorHandler: (error: Error, req: any, res: Response, next: any) => void;
export declare const asyncHandler: (fn: Function) => (req: any, res: Response, next: any) => void;
export declare const handleUncaughtExceptions: () => void;
export declare const throwValidationError: (validationResult: {
    isValid: boolean;
    errors: ValidationError[];
}) => void;
//# sourceMappingURL=errors.d.ts.map