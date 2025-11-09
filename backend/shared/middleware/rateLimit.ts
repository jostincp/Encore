import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { basicRateLimit } from './index';

// Exponer un factory compatible si algunos servicios esperan rateLimitMiddleware
export const rateLimitMiddleware = (options: Parameters<typeof rateLimit>[0]): RequestHandler => {
  return rateLimit(options);
};

// Exportar alias por compatibilidad
export const rateLimiters: { basic: RequestHandler; auth: RequestHandler } = {
  basic: basicRateLimit,
  auth: rateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many auth requests'
  })
};