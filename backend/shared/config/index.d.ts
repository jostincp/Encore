export interface Config {
    port: number;
    nodeEnv: string;
    serviceName: string;
    databaseUrl: string;
    redisUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;
    corsOrigins: string[];
    youtubeApiKey?: string;
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    logLevel: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
}
export declare const config: Config;
export declare const validateServiceConfig: (serviceName: string) => void;
export declare const getServiceConfig: (serviceName: string) => Config;
export declare const getEnvironmentDefaults: () => {
    logLevel: string;
    corsOrigins: string[];
    rateLimitMaxRequests: number;
} | {
    logLevel: string;
    corsOrigins: string[];
    rateLimitMaxRequests: number;
} | {
    logLevel: string;
    corsOrigins: string[];
    rateLimitMaxRequests: number;
};
export declare const isProduction: () => boolean;
export declare const isDevelopment: () => boolean;
export declare const isTesting: () => boolean;
//# sourceMappingURL=index.d.ts.map