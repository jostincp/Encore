"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authApiMiddleware = exports.protectedApiMiddleware = exports.basicMiddleware = exports.validateJsonMiddleware = exports.timeoutMiddleware = exports.healthCheckMiddleware = exports.requestLoggingMiddleware = exports.paginationMiddleware = exports.validateTableId = exports.validateBarId = exports.validateApiKey = exports.validateContentType = exports.songRequestRateLimit = exports.musicApiRateLimit = exports.authRateLimit = exports.advancedRateLimit = exports.basicRateLimit = exports.compressionMiddleware = exports.corsMiddleware = exports.securityMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const config_1 = require("../config");
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
exports.securityMiddleware = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});
exports.corsMiddleware = (0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (config_1.config.corsOrigins.includes(origin) || config_1.config.corsOrigins.includes('*')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Bar-ID',
        'X-Table-ID'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Current-Page',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
    ]
});
exports.compressionMiddleware = (0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    threshold: 1024
});
exports.basicRateLimit = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimitWindowMs,
    max: config_1.config.rateLimitMaxRequests,
    message: {
        error: 'Too many requests',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config_1.config.rateLimitWindowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        (0, logger_1.logWarn)(`Rate limit exceeded for IP: ${req.ip}`, {
            ip: req.ip,
            url: req.url,
            method: req.method
        });
        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(config_1.config.rateLimitWindowMs / 1000)
        });
    }
});
const advancedRateLimit = (options) => {
    const { maxRequests, windowMs, keyGenerator = (req) => req.ip, skipSuccessfulRequests = false, skipFailedRequests = false } = options;
    return async (req, res, next) => {
        try {
            const key = keyGenerator(req);
            const result = await redis_1.rateLimitService.checkRateLimit(key, maxRequests, windowMs);
            res.set({
                'X-Rate-Limit-Limit': maxRequests.toString(),
                'X-Rate-Limit-Remaining': result.remaining.toString(),
                'X-Rate-Limit-Reset': new Date(result.resetTime).toISOString()
            });
            if (!result.allowed) {
                (0, logger_1.logWarn)(`Advanced rate limit exceeded for key: ${key}`, {
                    key,
                    url: req.url,
                    method: req.method
                });
                return res.status(429).json({
                    error: 'Too many requests',
                    message: 'Rate limit exceeded, please try again later.',
                    retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
                });
            }
            const originalSend = res.send;
            res.send = function (data) {
                const statusCode = res.statusCode;
                if (skipSuccessfulRequests && statusCode < 400) {
                    redis_1.rateLimitService.clearRateLimit(key);
                }
                else if (skipFailedRequests && statusCode >= 400) {
                    redis_1.rateLimitService.clearRateLimit(key);
                }
                return originalSend.call(this, data);
            };
            next();
        }
        catch (error) {
            (0, logger_1.logWarn)('Rate limit check failed, allowing request', error);
            next();
        }
    };
};
exports.advancedRateLimit = advancedRateLimit;
exports.authRateLimit = (0, exports.advancedRateLimit)({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    keyGenerator: (req) => `auth:${req.ip}`,
    skipSuccessfulRequests: true
});
exports.musicApiRateLimit = (0, exports.advancedRateLimit)({
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyGenerator: (req) => {
        return req.user ? `music:${req.user.userId}` : `music:${req.ip}`;
    }
});
exports.songRequestRateLimit = (0, exports.advancedRateLimit)({
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
    keyGenerator: (req) => {
        return req.user ? `song_request:${req.user.userId}` : `song_request:${req.ip}`;
    }
});
const validateContentType = (allowedTypes) => {
    return (req, res, next) => {
        if (req.method === 'GET' || req.method === 'DELETE') {
            return next();
        }
        const contentType = req.headers['content-type'];
        if (!contentType) {
            return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('Content-Type header is required', 400));
        }
        const isAllowed = allowedTypes.some(type => contentType.includes(type));
        if (!isAllowed) {
            return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError(`Invalid Content-Type. Allowed types: ${allowedTypes.join(', ')}`, 400));
        }
        next();
    };
};
exports.validateContentType = validateContentType;
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    if (!apiKey) {
        return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('API Key required', 401));
    }
    if (!validApiKeys.includes(apiKey)) {
        return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('Invalid API Key', 401));
    }
    next();
};
exports.validateApiKey = validateApiKey;
const validateBarId = (req, res, next) => {
    const barId = req.params.barId || req.headers['x-bar-id'] || req.body.barId;
    if (!barId) {
        return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('Bar ID is required', 400));
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(barId)) {
        return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('Invalid Bar ID format', 400));
    }
    req.barId = barId;
    next();
};
exports.validateBarId = validateBarId;
const validateTableId = (req, res, next) => {
    const tableId = req.params.tableId || req.headers['x-table-id'] || req.body.tableId;
    if (!tableId) {
        return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('Table ID is required', 400));
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tableId)) {
        return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('Invalid Table ID format', 400));
    }
    req.tableId = tableId;
    next();
};
exports.validateTableId = validateTableId;
const paginationMiddleware = (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = (page - 1) * limit;
    req.pagination = {
        page,
        limit,
        offset
    };
    next();
};
exports.paginationMiddleware = paginationMiddleware;
exports.requestLoggingMiddleware = logger_1.requestLogger;
const healthCheckMiddleware = (req, res, next) => {
    if (req.path === '/health' || req.path === '/ping') {
        return res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: config_1.config.serviceName,
            version: process.env.npm_package_version || '1.0.0'
        });
    }
    next();
};
exports.healthCheckMiddleware = healthCheckMiddleware;
const timeoutMiddleware = (timeoutMs = 30000) => {
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    error: 'Request Timeout',
                    message: 'Request took too long to process'
                });
            }
        }, timeoutMs);
        res.on('finish', () => {
            clearTimeout(timeout);
        });
        res.on('close', () => {
            clearTimeout(timeout);
        });
        next();
    };
};
exports.timeoutMiddleware = timeoutMiddleware;
const validateJsonMiddleware = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
    }
    const contentType = req.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
        if (Object.keys(req.body).length === 0) {
            return (0, errors_1.sendErrorResponse)(res, new errors_1.AppError('Request body cannot be empty', 400));
        }
    }
    next();
};
exports.validateJsonMiddleware = validateJsonMiddleware;
exports.basicMiddleware = [
    exports.healthCheckMiddleware,
    exports.securityMiddleware,
    exports.corsMiddleware,
    exports.compressionMiddleware,
    exports.requestLoggingMiddleware,
    (0, exports.timeoutMiddleware)(),
    exports.validateJsonMiddleware
];
exports.protectedApiMiddleware = [
    ...exports.basicMiddleware,
    exports.basicRateLimit,
    (0, exports.validateContentType)(['application/json'])
];
exports.authApiMiddleware = [
    ...exports.basicMiddleware,
    exports.authRateLimit,
    (0, exports.validateContentType)(['application/json'])
];
//# sourceMappingURL=index.js.map