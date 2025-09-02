"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = exports.logDebug = exports.logWarn = exports.logError = exports.logInfo = void 0;
const winston_1 = require("winston");
const { combine, timestamp, errors, json, colorize, simple } = winston_1.format;
const logger = (0, winston_1.createLogger)({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(timestamp(), errors({ stack: true }), json()),
    defaultMeta: { service: process.env.SERVICE_NAME || 'encore-service' },
    transports: [
        new winston_1.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.transports.File({ filename: 'logs/combined.log' })
    ]
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.transports.Console({
        format: combine(colorize(), simple())
    }));
}
exports.default = logger;
const logInfo = (message, meta) => {
    logger.info(message, meta);
};
exports.logInfo = logInfo;
const logError = (message, error, meta) => {
    logger.error(message, { error: error?.stack, ...meta });
};
exports.logError = logError;
const logWarn = (message, meta) => {
    logger.warn(message, meta);
};
exports.logWarn = logWarn;
const logDebug = (message, meta) => {
    logger.debug(message, meta);
};
exports.logDebug = logDebug;
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
    });
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=logger.js.map