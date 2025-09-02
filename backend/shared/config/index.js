"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTesting = exports.isDevelopment = exports.isProduction = exports.getEnvironmentDefaults = exports.getServiceConfig = exports.validateServiceConfig = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getConfig = () => {
    const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'REDIS_URL'
    ];
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }
    return {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development',
        serviceName: process.env.SERVICE_NAME || 'encore-service',
        databaseUrl: process.env.DATABASE_URL,
        redisUrl: process.env.REDIS_URL,
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
        youtubeApiKey: process.env.YOUTUBE_API_KEY,
        spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
        spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        stripeSecretKey: process.env.STRIPE_SECRET_KEY,
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        logLevel: process.env.LOG_LEVEL || 'info',
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    };
};
exports.config = getConfig();
const validateServiceConfig = (serviceName) => {
    switch (serviceName) {
        case 'music-service':
            if (!exports.config.youtubeApiKey && !exports.config.spotifyClientId) {
                throw new Error('Music service requires either YOUTUBE_API_KEY or SPOTIFY_CLIENT_ID');
            }
            break;
        case 'points-service':
            if (!exports.config.stripeSecretKey) {
                console.warn('Points service: STRIPE_SECRET_KEY not configured, payment features will be disabled');
            }
            break;
        default:
            break;
    }
};
exports.validateServiceConfig = validateServiceConfig;
const getServiceConfig = (serviceName) => {
    (0, exports.validateServiceConfig)(serviceName);
    return { ...exports.config, serviceName };
};
exports.getServiceConfig = getServiceConfig;
const getEnvironmentDefaults = () => {
    const defaults = {
        development: {
            logLevel: 'debug',
            corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
            rateLimitMaxRequests: 1000
        },
        production: {
            logLevel: 'info',
            corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
            rateLimitMaxRequests: 100
        },
        test: {
            logLevel: 'error',
            corsOrigins: ['http://localhost:3000'],
            rateLimitMaxRequests: 1000
        }
    };
    return defaults[exports.config.nodeEnv] || defaults.development;
};
exports.getEnvironmentDefaults = getEnvironmentDefaults;
const isProduction = () => {
    return exports.config.nodeEnv === 'production';
};
exports.isProduction = isProduction;
const isDevelopment = () => {
    return exports.config.nodeEnv === 'development';
};
exports.isDevelopment = isDevelopment;
const isTesting = () => {
    return exports.config.nodeEnv === 'test';
};
exports.isTesting = isTesting;
//# sourceMappingURL=index.js.map