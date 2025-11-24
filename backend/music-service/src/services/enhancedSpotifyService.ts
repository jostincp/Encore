import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { redisHelpers } from '../config/redis';
import logger from '@shared/utils/logger';
import { getSecretsManager } from '@shared/utils/secrets';

// Interfaces para tipos de datos de Spotify
interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    release_date: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
  popularity?: number;
  audio_features?: {
    energy: number;
    danceability: number;
    valence: number;
    tempo: number;
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface SpotifyRecommendationsResponse {
  tracks: SpotifyTrack[];
}

// Clases de error personalizadas para Spotify
export class SpotifyError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'SpotifyError';
  }
}

export class SpotifyRateLimitError extends SpotifyError {
  constructor(message: string, public retryAfter: number) {
    super(message, 429, true);
    this.name = 'SpotifyRateLimitError';
  }
}

export class SpotifyAuthError extends SpotifyError {
  constructor(message: string) {
    super(message, 401, true);
    this.name = 'SpotifyAuthError';
  }
}

// Circuit Breaker para manejar fallos temporales
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000,
    private monitoringPeriod: number = 120000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened for Spotify API', {
        failures: this.failures,
        service: 'spotify-service'
      });
    }
  }

  getState() {
    return this.state;
  }
}

// Rate Limiter específico para Spotify
class SpotifyRateLimiter {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 30000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    // Limpiar requests fuera de la ventana
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }
}

// Servicio mejorado de Spotify
export class EnhancedSpotifyService {
  private static instance: EnhancedSpotifyService;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: SpotifyRateLimiter;
  private secretsManager = getSecretsManager();

  // Métricas
  private metrics = {
    requests: 0,
    errors: 0,
    rateLimits: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgResponseTime: 0
  };

  private constructor() {
    this.client = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      timeout: 15000,
      headers: {
        'User-Agent': 'Encore-Music-Service/1.0'
      }
    });

    this.circuitBreaker = new CircuitBreaker(5, 60000, 120000);
    this.rateLimiter = new SpotifyRateLimiter(30000, 10); // 10 requests por 30 segundos

    // Configurar interceptores
    this.setupInterceptors();
  }

  public static getInstance(): EnhancedSpotifyService {
    if (!EnhancedSpotifyService.instance) {
      EnhancedSpotifyService.instance = new EnhancedSpotifyService();
    }
    return EnhancedSpotifyService.instance;
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Rate limiting check
      if (!(await this.rateLimiter.checkLimit())) {
        throw new SpotifyRateLimitError('Rate limit exceeded', 1000);
      }

      this.metrics.requests++;
      // Store start time in headers for tracking
      config.headers['X-Request-Start'] = Date.now().toString();

      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const startTime = response.config.headers?.['X-Request-Start'];
        const duration = startTime ? Date.now() - parseInt(startTime as string) : 0;
        this.updateMetrics(duration, false);
        return response;
      },
      (error: AxiosError) => {
        const startTime = error.config?.headers?.['X-Request-Start'];
        const duration = startTime ? Date.now() - parseInt(startTime as string) : 0;
        this.updateMetrics(duration, true);

        return this.handleError(error);
      }
    );
  }

  private updateMetrics(responseTime: number, isError: boolean) {
    if (isError) {
      this.metrics.errors++;
    }

    // Actualizar promedio de tiempo de respuesta
    const totalRequests = this.metrics.requests;
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  private async handleError(error: AxiosError): Promise<never> {
    if (!error.response) {
      // Error de red
      logger.error('Spotify API network error', {
        error: error.message,
        service: 'spotify-service'
      });
      throw new SpotifyError('Network error connecting to Spotify API', 0, true);
    }

    const { status, data, headers } = error.response;

    switch (status) {
      case 401:
        // Token expirado o inválido
        this.accessToken = null;
        throw new SpotifyAuthError('Invalid or expired access token');

      case 403:
        throw new SpotifyError('Forbidden: Insufficient permissions', 403);

      case 404:
        throw new SpotifyError('Resource not found', 404);

      case 429:
        // Rate limit
        const retryAfter = parseInt(headers['retry-after'] || '1') * 1000;
        this.metrics.rateLimits++;
        throw new SpotifyRateLimitError('Rate limit exceeded', retryAfter);

      case 500:
      case 502:
      case 503:
      case 504:
        // Errores del servidor - retryable
        throw new SpotifyError(`Spotify server error: ${status}`, status, true);

      default:
        const errorMessage = (data as any)?.error?.message || 'Unknown error';
        throw new SpotifyError(`Spotify API error: ${errorMessage}`, status);
    }
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      // Check if current token is still valid
      if (this.accessToken && Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }

      // Check cache first
      const cachedToken = await redisHelpers.get('spotify:access_token_v2');
      if (cachedToken && cachedToken.expires_at > Date.now()) {
        this.accessToken = cachedToken.token;
        this.tokenExpiresAt = cachedToken.expires_at;
        return this.accessToken;
      }

      // Get credentials from AWS Secrets Manager
      const secrets = await this.secretsManager.getSecret('encore/spotify-api');
      const clientId = secrets?.clientId || process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = secrets?.clientSecret || process.env.SPOTIFY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        logger.error('Spotify credentials not configured', { service: 'spotify-service' });
        return null;
      }

      // Get new token using client credentials flow
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          timeout: 10000
        }
      );

      const { access_token, expires_in } = response.data;
      const expiresAt = Date.now() + (expires_in * 1000) - 60000; // 1 minute buffer

      this.accessToken = access_token;
      this.tokenExpiresAt = expiresAt;

      // Cache the token with enhanced metadata
      await redisHelpers.set(
        'spotify:access_token_v2',
        {
          token: access_token,
          expires_at: expiresAt,
          created_at: Date.now(),
          client_id: clientId.substring(0, 8) + '...' // Partial for logging
        },
        expires_in - 60
      );

      logger.info('Spotify access token refreshed', {
        expires_in: expires_in,
        service: 'spotify-service'
      });

      return access_token;
    } catch (error) {
      logger.error('Failed to get Spotify access token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'spotify-service'
      });
      return null;
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.circuitBreaker.execute(operation);
      } catch (error) {
        lastError = error as Error;

        // Don't retry non-retryable errors
        if (error instanceof SpotifyError && !error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        logger.warn(`Spotify API retry attempt ${attempt}/${maxRetries}`, {
          delay: Math.round(delay),
          error: error instanceof Error ? error.message : 'Unknown error',
          service: 'spotify-service'
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  public async searchTracks(
    query: string,
    options: { limit?: number; offset?: number; market?: string } = {}
  ): Promise<any[]> {
    const { limit = 20, offset = 0, market = 'US' } = options;

    return this.withRetry(async () => {
      const cacheKey = `spotify:search:${query}:${limit}:${offset}:${market}`;

      // Check cache
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get<SpotifySearchResponse>('/search', {
        params: {
          q: query,
          type: 'track',
          limit,
          offset,
          market,
        },
      });

      const tracks = response.data.tracks.items.map(track => ({
        id: `spotify:track:${track.id}`,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        external_url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url,
        source: 'spotify',
        release_date: track.album.release_date,
        popularity: track.popularity || 0,
      }));

      // Cache results for 10 minutes
      await redisHelpers.set(cacheKey, tracks, 600);

      return tracks;
    });
  }

  public async getTrackDetails(trackId: string): Promise<any> {
    return this.withRetry(async () => {
      const cacheKey = `spotify:track:${trackId}`;

      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const [trackResponse, featuresResponse] = await Promise.all([
        this.client.get<SpotifyTrack>(`/tracks/${trackId}`),
        this.client.get(`/audio-features/${trackId}`).catch(() => null),
      ]);

      const track = trackResponse.data;
      const features = featuresResponse?.data;

      const trackDetails = {
        id: `spotify:track:${track.id}`,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        external_url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url,
        source: 'spotify',
        release_date: track.album.release_date,
        popularity: track.popularity || 0,
        audio_features: features ? {
          energy: features.energy,
          danceability: features.danceability,
          valence: features.valence,
          tempo: features.tempo,
          loudness: features.loudness,
          speechiness: features.speechiness,
          acousticness: features.acousticness,
          instrumentalness: features.instrumentalness,
          liveness: features.liveness,
        } : undefined,
      };

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, trackDetails, 3600);

      return trackDetails;
    });
  }

  public async getRecommendations(
    seedTracks?: string[],
    seedArtists?: string[],
    seedGenres?: string[],
    audioFeatures?: Record<string, number>,
    limit: number = 20
  ): Promise<any[]> {
    return this.withRetry(async () => {
      const params: any = { limit, market: 'US' };

      if (seedTracks?.length) {
        params.seed_tracks = seedTracks.slice(0, 5).join(',');
      }
      if (seedArtists?.length) {
        params.seed_artists = seedArtists.slice(0, 5).join(',');
      }
      if (seedGenres?.length) {
        params.seed_genres = seedGenres.slice(0, 5).join(',');
      }

      // Add audio feature targets
      if (audioFeatures) {
        Object.entries(audioFeatures).forEach(([key, value]) => {
          params[`target_${key}`] = value;
        });
      }

      const cacheKey = `spotify:recommendations:${JSON.stringify(params)}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get<SpotifyRecommendationsResponse>(
        '/recommendations',
        { params }
      );

      const tracks = response.data.tracks.map(track => ({
        id: `spotify:track:${track.id}`,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        external_url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url,
        source: 'spotify',
        release_date: track.album.release_date,
        popularity: track.popularity || 0,
      }));

      // Cache for 30 minutes
      await redisHelpers.set(cacheKey, tracks, 1800);

      return tracks;
    });
  }

  public async getFeaturedPlaylists(limit: number = 20, country: string = 'US'): Promise<any[]> {
    return this.withRetry(async () => {
      const cacheKey = `spotify:featured:${limit}:${country}`;

      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get('/browse/featured-playlists', {
        params: { limit, country },
      });

      const playlists = response.data.playlists.items.map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        external_url: playlist.external_urls.spotify,
        thumbnail_url: playlist.images[0]?.url,
        tracks_count: playlist.tracks.total,
        owner: playlist.owner.display_name,
      }));

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, playlists, 3600);

      return playlists;
    });
  }

  public async getNewReleases(limit: number = 20, country: string = 'US'): Promise<any[]> {
    return this.withRetry(async () => {
      const cacheKey = `spotify:new_releases:${limit}:${country}`;

      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get('/browse/new-releases', {
        params: { limit, country },
      });

      const albums = response.data.albums.items.map((album: any) => ({
        id: album.id,
        name: album.name,
        artist: album.artists.map((a: any) => a.name).join(', '),
        external_url: album.external_urls.spotify,
        thumbnail_url: album.images[0]?.url,
        release_date: album.release_date,
        total_tracks: album.total_tracks,
        album_type: album.album_type,
      }));

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, albums, 3600);

      return albums;
    });
  }

  // Método para invalidar caché específico
  public async invalidateCache(pattern: string): Promise<void> {
    try {
      // Usar Redis SCAN para encontrar keys que coincidan con el patrón
      const keys = await this.scanKeys(`spotify:${pattern}*`);

      if (keys.length > 0) {
        await Promise.all(keys.map(key => redisHelpers.del(key)));
        logger.info(`Invalidated ${keys.length} Spotify cache entries`, {
          pattern,
          service: 'spotify-service'
        });
      }
    } catch (error) {
      logger.error('Error invalidating Spotify cache', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'spotify-service'
      });
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    // Implementación simplificada - en producción usarías Redis SCAN
    const keys: string[] = [];
    // Aquí iría la lógica para escanear keys con el patrón
    return keys;
  }

  // Método para obtener métricas
  public getMetrics() {
    return {
      ...this.metrics,
      circuitBreakerState: this.circuitBreaker.getState(),
      remainingRequests: this.rateLimiter.getRemainingRequests(),
      cacheHitRate: this.metrics.requests > 0 ?
        (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0
    };
  }

  // Método para resetear métricas
  public resetMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      rateLimits: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0
    };
  }
}

// Exportar instancia singleton
export const enhancedSpotifyService = EnhancedSpotifyService.getInstance();

// Funciones de utilidad para mantener compatibilidad
export const searchTracks = (query: string, options?: any) =>
  enhancedSpotifyService.searchTracks(query, options);

export const getTrackDetails = (trackId: string) =>
  enhancedSpotifyService.getTrackDetails(trackId);

export const getRecommendations = (
  seedTracks?: string[],
  seedArtists?: string[],
  seedGenres?: string[],
  audioFeatures?: Record<string, number>,
  limit?: number
) => enhancedSpotifyService.getRecommendations(seedTracks, seedArtists, seedGenres, audioFeatures, limit);

export const getFeaturedPlaylists = (limit?: number) =>
  enhancedSpotifyService.getFeaturedPlaylists(limit);

export const getNewReleases = (limit?: number) =>
  enhancedSpotifyService.getNewReleases(limit);

export default enhancedSpotifyService;