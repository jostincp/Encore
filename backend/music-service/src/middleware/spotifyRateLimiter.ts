import { Request, Response, NextFunction } from 'express';
import { enhancedSpotifyService } from '../services/enhancedSpotifyService';
import logger from '../../../shared/utils/logger';

// Rate limiter específico para Spotify API
export class SpotifyAPIRateLimiter {
  private static instance: SpotifyAPIRateLimiter;
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  // Límites de rate limiting por endpoint
  private readonly limits = {
    search: { requests: 50, windowMs: 60000 }, // 50 búsquedas por minuto
    trackDetails: { requests: 100, windowMs: 60000 }, // 100 detalles de track por minuto
    recommendations: { requests: 20, windowMs: 60000 }, // 20 recomendaciones por minuto
    playlists: { requests: 30, windowMs: 60000 }, // 30 operaciones de playlist por minuto
    general: { requests: 200, windowMs: 60000 } // 200 requests generales por minuto
  };

  private constructor() {
    // Limpiar contadores expirados cada minuto
    setInterval(() => this.cleanup(), 60000);
  }

  public static getInstance(): SpotifyAPIRateLimiter {
    if (!SpotifyAPIRateLimiter.instance) {
      SpotifyAPIRateLimiter.instance = new SpotifyAPIRateLimiter();
    }
    return SpotifyAPIRateLimiter.instance;
  }

  /**
   * Middleware para rate limiting de Spotify API
   */
  public middleware(endpointType: keyof typeof SpotifyAPIRateLimiter.prototype.limits = 'general') {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientId = this.getClientIdentifier(req);
      const limit = this.limits[endpointType];

      if (!this.checkLimit(clientId, limit)) {
        logger.warn('Spotify API rate limit exceeded', {
          clientId,
          endpointType,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          service: 'music-service'
        });

        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for Spotify API',
          retryAfter: Math.ceil(limit.windowMs / 1000)
        });
      }

      // Añadir headers de rate limiting
      const remaining = this.getRemainingRequests(clientId, limit);
      res.set({
        'X-RateLimit-Limit': limit.requests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': (Date.now() + limit.windowMs).toString()
      });

      next();
    };
  }

  /**
   * Verificar si el cliente puede hacer una request
   */
  private checkLimit(clientId: string, limit: { requests: number; windowMs: number }): boolean {
    const now = Date.now();
    const clientData = this.requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      // Primer request o ventana expirada
      this.requestCounts.set(clientId, {
        count: 1,
        resetTime: now + limit.windowMs
      });
      return true;
    }

    if (clientData.count >= limit.requests) {
      return false;
    }

    clientData.count++;
    return true;
  }

  /**
   * Obtener requests restantes para el cliente
   */
  private getRemainingRequests(clientId: string, limit: { requests: number; windowMs: number }): number {
    const clientData = this.requestCounts.get(clientId);
    if (!clientData) return limit.requests;

    const now = Date.now();
    if (now > clientData.resetTime) {
      return limit.requests;
    }

    return Math.max(0, limit.requests - clientData.count);
  }

  /**
   * Obtener identificador único del cliente
   */
  private getClientIdentifier(req: Request): string {
    // Usar IP + User-Agent para identificar clientes
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Crear hash simple para el identificador
    const crypto = require('crypto');
    return crypto.createHash('md5')
      .update(`${ip}:${userAgent}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Limpiar contadores expirados
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [clientId, data] of this.requestCounts.entries()) {
      if (now > data.resetTime) {
        this.requestCounts.delete(clientId);
      }
    }
  }

  /**
   * Obtener estadísticas de rate limiting
   */
  public getStats() {
    const now = Date.now();
    const activeClients = Array.from(this.requestCounts.entries())
      .filter(([, data]) => now <= data.resetTime)
      .length;

    return {
      activeClients,
      totalTrackedClients: this.requestCounts.size,
      limits: this.limits
    };
  }
}

// Instancia singleton
const spotifyRateLimiter = SpotifyAPIRateLimiter.getInstance();

// Middlewares pre-configurados
export const spotifySearchLimiter = spotifyRateLimiter.middleware('search');
export const spotifyTrackLimiter = spotifyRateLimiter.middleware('trackDetails');
export const spotifyRecommendationsLimiter = spotifyRateLimiter.middleware('recommendations');
export const spotifyPlaylistsLimiter = spotifyRateLimiter.middleware('playlists');
export const spotifyGeneralLimiter = spotifyRateLimiter.middleware('general');

// Función para obtener estadísticas
export const getSpotifyRateLimitStats = () => spotifyRateLimiter.getStats();

export default spotifyRateLimiter;