import { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
export declare const securityMiddleware: RequestHandler;
export declare const corsMiddleware: (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const compressionMiddleware: RequestHandler;
export declare const basicRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const advancedRateLimit: (options: {
    maxRequests: number;
    windowMs: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const authRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const musicApiRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const songRequestRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const validateContentType: (allowedTypes: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateApiKey: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateBarId: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateTableId: (req: Request, res: Response, next: NextFunction) => void;
export declare const paginationMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestLoggingMiddleware: (req: any, res: any, next: any) => void;
export declare const healthCheckMiddleware: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const timeoutMiddleware: (timeoutMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateJsonMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const basicMiddleware: RequestHandler[];
export declare const protectedApiMiddleware: RequestHandler[];
export declare const authApiMiddleware: RequestHandler[];
//# sourceMappingURL=index.d.ts.map