import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
export declare const securityMiddleware: any;
export declare const corsMiddleware: (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const compressionMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const basicRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const advancedRateLimit: (options: {
    maxRequests: number;
    windowMs: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const authRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const musicApiRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const songRequestRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const validateContentType: (allowedTypes: string[]) => (req: Request, res: Response, next: NextFunction) => any;
export declare const validateApiKey: (req: Request, res: Response, next: NextFunction) => any;
export declare const validateBarId: (req: Request, res: Response, next: NextFunction) => any;
export declare const validateTableId: (req: Request, res: Response, next: NextFunction) => any;
export declare const paginationMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestLoggingMiddleware: (req: any, res: any, next: any) => void;
export declare const healthCheckMiddleware: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const timeoutMiddleware: (timeoutMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateJsonMiddleware: (req: Request, res: Response, next: NextFunction) => any;
export declare const basicMiddleware: any[];
export declare const protectedApiMiddleware: any[];
export declare const authApiMiddleware: any[];
//# sourceMappingURL=index.d.ts.map