"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwValidationError = exports.handleUncaughtExceptions = exports.asyncHandler = exports.errorHandler = exports.sendValidationError = exports.sendError = exports.sendSuccess = exports.BadRequestError = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.AppError = void 0;
const types_1 = require("../types");
const logger_1 = require("./logger");
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, validationErrors = []) {
        super(message, 400);
        this.validationErrors = validationErrors;
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
    }
}
exports.ConflictError = ConflictError;
class BadRequestError extends AppError {
    constructor(message = 'Bad request') {
        super(message, 400);
    }
}
exports.BadRequestError = BadRequestError;
const sendSuccess = (res, data, message, statusCode = 200) => {
    const response = {
        success: true,
        data,
        message
    };
    res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
const sendError = (res, error, statusCode = 500, data) => {
    const response = {
        success: false,
        error,
        data
    };
    res.status(statusCode).json(response);
};
exports.sendError = sendError;
const sendValidationError = (res, message, validationErrors) => {
    const response = {
        success: false,
        error: message,
        data: { validationErrors }
    };
    res.status(400).json(response);
};
exports.sendValidationError = sendValidationError;
const errorHandler = (error, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal server error';
    let data = undefined;
    (0, logger_1.logError)('Error occurred', error, {
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query
    });
    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
        if (error instanceof types_1.ValidationError) {
            data = { validationErrors: error.validationErrors };
        }
    }
    else if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
        data = { validationErrors: extractValidationErrors(error) };
    }
    else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    }
    else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    else if (error.code === 11000) {
        statusCode = 409;
        message = 'Resource already exists';
    }
    if (process.env.NODE_ENV === 'development') {
        data = { ...data, stack: error.stack };
    }
    (0, exports.sendError)(res, message, statusCode, data);
};
exports.errorHandler = errorHandler;
const extractValidationErrors = (error) => {
    const validationErrors = [];
    if (error.errors) {
        Object.keys(error.errors).forEach(key => {
            validationErrors.push({
                field: key,
                message: error.errors[key].message
            });
        });
    }
    return validationErrors;
};
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const handleUncaughtExceptions = () => {
    process.on('uncaughtException', (error) => {
        (0, logger_1.logError)('Uncaught Exception', error);
        process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        (0, logger_1.logError)('Unhandled Rejection', new Error(reason), { promise });
        process.exit(1);
    });
};
exports.handleUncaughtExceptions = handleUncaughtExceptions;
const throwValidationError = (validationResult) => {
    if (!validationResult.isValid) {
        throw new types_1.ValidationError('Validation failed', validationResult.errors);
    }
};
exports.throwValidationError = throwValidationError;
//# sourceMappingURL=errors.js.map