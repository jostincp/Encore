import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { redisHelpers } from '../config/redis';
import logger from '../../../shared/utils/logger';
import { getSecretsManager } from '../../../shared/utils/secrets';

// Interfaces para tipos de datos de YouTube
interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  duration: string;
  viewCount: string;
  likeCount?: string;
  thumbnailUrl: string;
  tags?: string[];
}

interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      description: string;
      channelTitle: string;
      channelId: string;
      publishedAt: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
      tags?: string[];
    };
    contentDetails?: {
      duration: string;
    };
    statistics?: {
      viewCount: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeVideoDetailsResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      channelTitle: string;
      channelId: string;
      publishedAt: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
      tags?: string[];
    };
    contentDetails: {
      duration: string;
    };
    statistics: {
      viewCount: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

// Clases de error personalizadas para YouTube
export class YouTubeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

export class YouTubeRateLimitError extends YouTubeError {
  constructor(message: string, public retryAfter: number) {
    super(message, 429, true);
    this.name = 'YouTubeRateLimitError';
  }
}

export class YouTubeQuotaExceededError extends YouTubeError {
  constructor(message: string) {
    super(message, 403, false);
    this.name = 'YouTubeQuotaExceededError';
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
      logger.warn('Circuit breaker opened for YouTube API', {
        failures: this.failures,
        service: 'music-service'
      });
    }
  }

  getState() {
    return this.state;
  }
}

// Rate Limiter específico para YouTube
class YouTubeRateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  // Límites de rate limiting por endpoint (YouTube Data API v3)
  private readonly limits = {
    search: { requests: 100, windowMs: 86400000 }, // 100 búsquedas por día
    videoDetails: { requests: 1000, windowMs: 86400000 }, // 1000 detalles por día
    trending: { requests: 100, windowMs: 86400000 }, // 100 trending por día
    general: { requests: 10000, windowMs: 86400000 } // 10,000 requests por día
  };

  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Limpiar contadores expirados cada hora
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
  }

  async checkLimit(endpointType: keyof typeof YouTubeRateLimiter.prototype.limits = 'general'): Promise<boolean> {
    const clientId = 'youtube-service'; // Identificador único para el servicio
    const limit = this.limits[endpointType];

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

  getRemainingRequests(endpointType: keyof typeof YouTubeRateLimiter.prototype.limits = 'general'): number {
    const clientId = 'youtube-service';
    const limit = this.limits[endpointType];
    const clientData = this.requestCounts.get(clientId);

    if (!clientData) return limit.requests;

    const now = Date.now();
    if (now > clientData.resetTime) {
      return limit.requests;
    }

    return Math.max(0, limit.requests - clientData.count);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [clientId, data] of this.requestCounts.entries()) {
      if (now > data.resetTime) {
        this.requestCounts.delete(clientId);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Servicio mejorado de YouTube
export class EnhancedYouTubeService {
  private static instance: EnhancedYouTubeService;
  private client: AxiosInstance;
  private apiKey: string | null = null;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: YouTubeRateLimiter;
  private secretsManager = getSecretsManager();

  // Métricas
  private metrics = {
    requests: 0,
    errors: 0,
    quotaExceeded: 0,
    rateLimits: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgResponseTime: 0
  };

  private constructor() {
    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      timeout: 15000,
      headers: {
        'User-Agent': 'Encore-Music-Service/1.0'
      }
    });

    this.circuitBreaker = new CircuitBreaker(5, 60000, 120000);
    this.rateLimiter = new YouTubeRateLimiter();

    // Configurar interceptores
    this.setupInterceptors();
  }

  public static getInstance(): EnhancedYouTubeService {
    if (!EnhancedYouTubeService.instance) {
      EnhancedYouTubeService.instance = new EnhancedYouTubeService();
    }
    return EnhancedYouTubeService.instance;
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(async (config) => {
      const apiKey = await this.getApiKey();
      if (apiKey) {
        config.params = { ...config.params, key: apiKey };
      }

      // Rate limiting check
      const endpointType = this.getEndpointType(config.url || '');
      if (!(await this.rateLimiter.checkLimit(endpointType))) {
        throw new YouTubeRateLimitError('Rate limit exceeded', 86400000); // 24 horas
      }

      this.metrics.requests++;
      // Store start time for metrics
      (config as any).startTime = Date.now();

      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const startTime = (response.config as any).startTime;
        const duration = startTime ? Date.now() - startTime : 0;
        this.updateMetrics(duration, false);
        return response;
      },
      (error: AxiosError) => {
        const startTime = (error.config as any)?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;
        this.updateMetrics(duration, true);

        return this.handleError(error);
      }
    );
  }

  private getEndpointType(url: string): 'search' | 'videoDetails' | 'trending' | 'general' {
    if (url.includes('/search')) return 'search';
    if (url.includes('/videos')) return 'videoDetails';
    if (url.includes('/trending')) return 'trending';
    return 'general';
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
      logger.error('YouTube API network error', {
        error: error.message,
        service: 'music-service'
      });
      throw new YouTubeError('Network error connecting to YouTube API', 0, true);
    }

    const { status, data } = error.response;
    const errorData = data as any;

    switch (status) {
      case 400:
        throw new YouTubeError('Bad request to YouTube API', 400);

      case 401:
        throw new YouTubeError('Unauthorized: Invalid API key', 401);

      case 403:
        if (errorData?.error?.errors?.[0]?.reason === 'quotaExceeded') {
          this.metrics.quotaExceeded++;
          throw new YouTubeQuotaExceededError('YouTube API quota exceeded');
        }
        if (errorData?.error?.errors?.[0]?.reason === 'dailyLimitExceeded') {
          this.metrics.rateLimits++;
          throw new YouTubeRateLimitError('Daily limit exceeded', 86400000);
        }
        throw new YouTubeError('Forbidden: Access denied', 403);

      case 404:
        throw new YouTubeError('Resource not found', 404);

      case 429:
        // Rate limit
        this.metrics.rateLimits++;
        throw new YouTubeRateLimitError('Rate limit exceeded', 86400000);

      case 500:
      case 502:
      case 503:
      case 504:
        // Errores del servidor - retryable
        throw new YouTubeError(`YouTube server error: ${status}`, status, true);

      default:
        const message = errorData?.error?.message || 'Unknown error';
        throw new YouTubeError(`YouTube API error: ${message}`, status);
    }
  }

  private async getApiKey(): Promise<string | null> {
    try {
      // Check cache first
      const cachedKey = await redisHelpers.get('youtube:api_key_v2');
      if (cachedKey) {
        this.apiKey = cachedKey;
        return this.apiKey;
      }

      // Get key from AWS Secrets Manager
      const secrets = await this.secretsManager.getSecret('encore/youtube-api');
      const apiKey = secrets?.apiKey || process.env.YOUTUBE_API_KEY;

      if (!apiKey) {
        logger.error('YouTube API key not configured', { service: 'music-service' });
        return null;
      }

      this.apiKey = apiKey;

      // Cache the key (no expiration for API keys)
      await redisHelpers.set('youtube:api_key_v2', apiKey);

      return apiKey;
    } catch (error) {
      logger.error('Failed to get YouTube API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
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
        if (error instanceof YouTubeError && !error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        logger.warn(`YouTube API retry attempt ${attempt}/${maxRetries}`, {
          delay: Math.round(delay),
          error: error instanceof Error ? error.message : 'Unknown error',
          service: 'music-service'
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  public async searchVideos(
    query: string,
    options: {
      maxResults?: number;
      order?: 'relevance' | 'date' | 'rating' | 'title' | 'videoCount' | 'viewCount';
      regionCode?: string;
      relevanceLanguage?: string;
    } = {}
  ): Promise<any[]> {
    const {
      maxResults = 25,
      order = 'relevance',
      regionCode = 'US',
      relevanceLanguage = 'en'
    } = options;

    return this.withRetry(async () => {
      const cacheKey = `youtube:search:${query}:${maxResults}:${order}:${regionCode}`;

      // Check cache
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get<YouTubeSearchResponse>('/search', {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: Math.min(maxResults, 50),
          order,
          regionCode,
          relevanceLanguage,
          videoCategoryId: '10', // Music category
        },
      });

      const videos = response.data.items.map(item => ({
        id: `youtube:video:${item.id.videoId}`,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
        source: 'youtube',
        videoId: item.id.videoId,
        tags: item.snippet.tags || [],
      }));

      // Cache results for 15 minutes
      await redisHelpers.set(cacheKey, videos, 900);

      return videos;
    });
  }

  public async getVideoDetails(videoId: string): Promise<any> {
    return this.withRetry(async () => {
      const cacheKey = `youtube:video:${videoId}`;

      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get<YouTubeVideoDetailsResponse>('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
        },
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new YouTubeError('Video not found', 404);
      }

      const video = response.data.items[0];

      const videoDetails = {
        id: `youtube:video:${video.id}`,
        title: video.snippet.title,
        description: video.snippet.description,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        publishedAt: video.snippet.publishedAt,
        duration: this.parseDuration(video.contentDetails.duration),
        viewCount: parseInt(video.statistics.viewCount),
        likeCount: video.statistics.likeCount ? parseInt(video.statistics.likeCount) : undefined,
        thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
        source: 'youtube',
        videoId: video.id,
        tags: video.snippet.tags || [],
        statistics: {
          viewCount: video.statistics.viewCount,
          likeCount: video.statistics.likeCount,
          commentCount: video.statistics.commentCount,
        }
      };

      // Cache for 30 minutes
      await redisHelpers.set(cacheKey, videoDetails, 1800);

      return videoDetails;
    });
  }

  public async getTrendingMusic(regionCode: string = 'US', maxResults: number = 25): Promise<any[]> {
    return this.withRetry(async () => {
      const cacheKey = `youtube:trending:${regionCode}:${maxResults}`;

      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get<YouTubeSearchResponse>('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          regionCode,
          maxResults: Math.min(maxResults, 50),
          videoCategoryId: '10', // Music category
        },
      });

      const videos = response.data.items.map(video => ({
        id: `youtube:video:${video.id}`,
        title: video.snippet.title,
        description: video.snippet.description,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails?.duration ? this.parseDuration(video.contentDetails.duration) : 0,
        viewCount: video.statistics?.viewCount ? parseInt(video.statistics.viewCount) : 0,
        likeCount: video.statistics?.likeCount ? parseInt(video.statistics.likeCount) : undefined,
        thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
        source: 'youtube',
        videoId: video.id,
        tags: video.snippet.tags || [],
      }));

      // Cache for 10 minutes
      await redisHelpers.set(cacheKey, videos, 600);

      return videos;
    });
  }

  public async getChannelVideos(channelId: string, maxResults: number = 25): Promise<any[]> {
    return this.withRetry(async () => {
      const cacheKey = `youtube:channel:${channelId}:${maxResults}`;

      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      const response = await this.client.get('/search', {
        params: {
          part: 'snippet',
          channelId,
          type: 'video',
          order: 'date',
          maxResults: Math.min(maxResults, 50),
        },
      });

      const videos = response.data.items.map((item: any) => ({
        id: `youtube:video:${item.id.videoId}`,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
        source: 'youtube',
        videoId: item.id.videoId,
        tags: item.snippet.tags || [],
      }));

      // Cache for 20 minutes
      await redisHelpers.set(cacheKey, videos, 1200);

      return videos;
    });
  }

  /**
   * Buscar canciones en YouTube con filtrado de contenido inapropiado
   * Este es el método principal para la rocola digital
   */
  public async searchSongs(query: string, options: {
    maxResults?: number;
    regionCode?: string;
  } = {}): Promise<{
    songs: Array<{
      id: string;
      song_id: string;
      title: string;
      artist: string;
      thumbnailUrl: string;
      duration: number;
    }>;
    total: number;
  }> {
    const { maxResults = 25, regionCode = 'US' } = options;

    return this.withRetry(async () => {
      const cacheKey = `youtube:songs:${query}:${maxResults}:${regionCode}`;

      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      this.metrics.cacheMisses++;

      // Buscar videos en YouTube
      const videos = await this.searchVideos(query, {
        maxResults: Math.min(maxResults * 2, 50), // Buscar más para filtrar
        regionCode,
        order: 'relevance'
      });

      // Filtrar y procesar videos para obtener detalles completos
      const songPromises = videos
        .filter(video => this.isAppropriateContent(video))
        .slice(0, maxResults)
        .map(async (video) => {
          try {
            // Obtener detalles completos del video
            const videoId = video.videoId || video.id.split(':').pop();
            const details = await this.getVideoDetails(videoId);

            return {
              id: video.id,
              song_id: videoId,
              title: details.title,
              artist: details.artist,
              thumbnailUrl: details.thumbnailUrl,
              duration: details.duration
            };
          } catch (error) {
            logger.warn('Failed to get video details for song search', {
              videoId: video.videoId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Fallback con datos básicos
            return {
              id: video.id,
              song_id: video.videoId || video.id.split(':').pop() || '',
              title: video.title,
              artist: video.artist || 'Unknown Artist',
              thumbnailUrl: video.thumbnailUrl,
              duration: 0
            };
          }
        });

      const songs = await Promise.all(songPromises);

      const result = {
        songs: songs.filter(song => song.duration > 30 && song.duration < 600), // 30s - 10min
        total: songs.length
      };

      // Cache for 10 minutes
      await redisHelpers.set(cacheKey, result, 600);

      return result;
    });
  }

  /**
   * Filtrar contenido inapropiado basado en título, descripción y tags
   */
  private isAppropriateContent(video: any): boolean {
    const content = `${video.title} ${video.description || ''} ${video.tags?.join(' ') || ''}`.toLowerCase();

    // Lista de palabras clave para contenido inapropiado
    const inappropriateKeywords = [
      'nsfw', 'porn', 'sex', 'nude', 'naked', 'adult', 'xxx', 'hentai',
      'violence', 'gore', 'blood', 'kill', 'death', 'murder',
      'drugs', 'cocaine', 'heroin', 'meth', 'weed', 'marijuana',
      'hate', 'racist', 'nazi', 'kkk', 'supremacist',
      'explicit', 'fuck', 'shit', 'damn', 'bitch', 'asshole'
    ];

    // Verificar si contiene palabras inapropiadas
    const hasInappropriateContent = inappropriateKeywords.some(keyword =>
      content.includes(keyword)
    );

    // Verificar si es contenido musical (tiene términos relacionados con música)
    const musicKeywords = [
      'music', 'song', 'track', 'album', 'artist', 'band', 'singer',
      'official', 'video', 'audio', 'lyrics', 'remix', 'cover',
      'rock', 'pop', 'jazz', 'hip hop', 'rap', 'electronic', 'dance'
    ];

    const isMusicalContent = musicKeywords.some(keyword =>
      content.includes(keyword)
    );

    // Verificar si el canal parece ser musical
    const channelName = video.channelTitle?.toLowerCase() || '';
    const isMusicChannel = channelName.includes('music') ||
                          channelName.includes('records') ||
                          channelName.includes('official') ||
                          channelName.includes('vevo');

    return !hasInappropriateContent && (isMusicalContent || isMusicChannel);
  }

  // Método para invalidar caché específico
  public async invalidateCache(pattern: string): Promise<void> {
    try {
      // Usar Redis SCAN para encontrar keys que coincidan con el patrón
      const keys: string[] = [];
      // Aquí iría la lógica para escanear keys con el patrón
      // Por simplicidad, invalidamos algunas keys comunes
      const commonKeys = [
        `youtube:${pattern}`,
        `youtube:search:${pattern}`,
        `youtube:video:${pattern}`,
        `youtube:trending:${pattern}`,
        `youtube:channel:${pattern}`
      ];

      for (const key of commonKeys) {
        const exists = await redisHelpers.exists(key);
        if (exists) {
          await redisHelpers.del(key);
          keys.push(key);
        }
      }

      if (keys.length > 0) {
        logger.info(`Invalidated ${keys.length} YouTube cache entries`, {
          pattern,
          keys,
          service: 'music-service'
        });
      }
    } catch (error) {
      logger.error('Error invalidating YouTube cache', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'music-service'
      });
    }
  }

  // Parse ISO 8601 duration to seconds
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]?.replace('H', '') || '0');
    const minutes = parseInt(match[2]?.replace('M', '') || '0');
    const seconds = parseInt(match[3]?.replace('S', '') || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  // Método para obtener métricas
  public getMetrics() {
    return {
      ...this.metrics,
      circuitBreakerState: this.circuitBreaker.getState(),
      remainingRequests: {
        search: this.rateLimiter.getRemainingRequests('search'),
        videoDetails: this.rateLimiter.getRemainingRequests('videoDetails'),
        trending: this.rateLimiter.getRemainingRequests('trending'),
        general: this.rateLimiter.getRemainingRequests('general')
      },
      cacheHitRate: this.metrics.requests > 0 ?
        (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0
    };
  }

  // Método para resetear métricas
  public resetMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      quotaExceeded: 0,
      rateLimits: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0
    };
  }

  // Cleanup method
  public destroy() {
    this.rateLimiter.destroy();
  }
}

// Exportar instancia singleton
export const enhancedYouTubeService = EnhancedYouTubeService.getInstance();

// Funciones de utilidad para mantener compatibilidad
export const searchYouTubeVideos = (query: string, options?: any) =>
  enhancedYouTubeService.searchVideos(query, options);

export const searchYouTubeSongs = (query: string, options?: any) =>
  enhancedYouTubeService.searchSongs(query, options);

export const getYouTubeVideoDetails = (videoId: string) =>
  enhancedYouTubeService.getVideoDetails(videoId);

export const getYouTubeTrending = (regionCode?: string, maxResults?: number) =>
  enhancedYouTubeService.getTrendingMusic(regionCode, maxResults);

export const getYouTubeChannelVideos = (channelId: string, maxResults?: number) =>
  enhancedYouTubeService.getChannelVideos(channelId, maxResults);

export default enhancedYouTubeService;