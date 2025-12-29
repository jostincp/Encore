import logger from '@shared/utils/logger';
import { getRedisClient } from '@shared/utils/redis';
import { google } from 'googleapis';
import { cacheOptimizationService } from './cacheOptimizationService';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number;
  channelTitle: string;
  publishedAt: string;
  isPremium?: boolean;
}

export interface YouTubeVideoDetails {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  channelTitle: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  tags: string[];
  categoryId: string;
}

export class EnhancedYouTubeService {
  private youtube: any;
  private redis = getRedisClient();
  private readonly CACHE_TTL = 1800; // 30 minutes

  constructor() {
    this.initializeYouTube();
  }

  private async initializeYouTube(): Promise<void> {
    try {
      // Get API key from environment or vault
      const apiKey = process.env.YOUTUBE_API_KEY;

      if (!apiKey) {
        throw new Error('YouTube API key not configured');
      }

      this.youtube = google.youtube({
        version: 'v3',
        auth: apiKey
      });

      logger.info('Enhanced YouTube service initialized');
    } catch (error) {
      logger.error('Failed to initialize YouTube service:', error);
      throw error;
    }
  }

  /**
   * Buscar videos en YouTube con filtros y caché
   */
  async searchVideos(
    query: string,
    options: {
      maxResults?: number;
      order?: 'relevance' | 'date' | 'rating' | 'title' | 'videoCount' | 'viewCount';
      safeSearch?: 'moderate' | 'none' | 'strict';
      videoCategoryId?: string;
      barId?: string;
    } = {}
  ): Promise<YouTubeSearchResult[]> {
    const {
      maxResults = 20,
      order = 'relevance',
      safeSearch = 'moderate',
      videoCategoryId,
      barId
    } = options;

    // Crear clave de caché
    const cacheKey = `youtube:search:${query}:${maxResults}:${order}:${safeSearch}:${videoCategoryId || ''}:${barId || ''}`;

    try {
      // Verificar caché primero usando cache optimization service
      const cached = await cacheOptimizationService.get(query);
      if (cached) {
        logger.debug('Returning cached YouTube search results', {
          query,
          cacheHitRate: cacheOptimizationService.getStats().hitRate.toFixed(2) + '%'
        });
        return cached;
      }

      // Realizar búsqueda en YouTube
      const searchResponse = await this.youtube.search.list({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        order,
        safeSearch,
        videoCategoryId,
        relevanceLanguage: 'es' // Preferir resultados en español
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return [];
      }

      // Obtener detalles adicionales de los videos
      const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);
      const videoDetails = await this.getVideoDetails(videoIds);

      // Combinar resultados de búsqueda con detalles
      const results: YouTubeSearchResult[] = searchResponse.data.items.map((item: any) => {
        const details = videoDetails.find(v => v.videoId === item.id.videoId);

        return {
          videoId: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.default?.url ||
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.high?.url || '',
          duration: details?.duration || 0,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          isPremium: this.isPremiumContent(item.snippet.title, item.snippet.description)
        };
      });

      // Filtrar contenido inapropiado
      const filteredResults = results.filter(result =>
        !this.containsInappropriateContent(result.title, result.channelTitle)
      );

      // Cachear resultados usando cache optimization service
      // El servicio determinará automáticamente el TTL basado en popularidad
      await cacheOptimizationService.set(query, filteredResults);

      logger.info(`YouTube search completed: ${filteredResults.length} results for query "${query}"`, {
        cacheStats: cacheOptimizationService.getStats()
      });

      return filteredResults;

    } catch (error) {
      logger.error('Error searching YouTube:', error);

      // Si hay error de API, intentar devolver resultados en caché antiguos
      try {
        const cached = await cacheOptimizationService.get(query);
        if (cached) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('Returning stale cached results due to API error', {
            query,
            error: errorMessage
          });
          return cached;
        }
      } catch (cacheError) {
        logger.error('Cache fallback also failed:', cacheError);
      }

      throw error;
    }
  }

  /**
   * Obtener detalles completos de videos
   */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
    try {
      const response = await this.youtube.videos.list({
        part: 'snippet,contentDetails,statistics',
        id: videoIds.join(',')
      });

      if (!response.data.items) {
        return [];
      }

      return response.data.items.map((item: any) => ({
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.maxres?.url ||
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url || '',
        duration: this.parseDuration(item.contentDetails.duration),
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        viewCount: parseInt(item.statistics.viewCount || '0'),
        likeCount: parseInt(item.statistics.likeCount || '0'),
        publishedAt: item.snippet.publishedAt,
        tags: item.snippet.tags || [],
        categoryId: item.snippet.categoryId
      }));

    } catch (error) {
      logger.error('Error getting video details:', error);
      return [];
    }
  }

  /**
   * Verificar si un video está disponible
   */
  async isVideoAvailable(videoId: string): Promise<boolean> {
    try {
      const cacheKey = `youtube:available:${videoId}`;

      // Verificar caché
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }

      const response = await this.youtube.videos.list({
        part: 'status',
        id: videoId
      });

      const available = response.data.items &&
        response.data.items.length > 0 &&
        response.data.items[0].status.privacyStatus !== 'private' &&
        !response.data.items[0].status.embeddable === false;

      // Cachear por 1 hora
      await this.redis.setex(cacheKey, 3600, available ? 'true' : 'false');

      return available;

    } catch (error) {
      logger.error(`Error checking video availability for ${videoId}:`, error);
      return false;
    }
  }

  /**
   * Obtener sugerencias de búsqueda
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const cacheKey = `youtube:suggestions:${query}`;

      // Verificar caché
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      // YouTube no tiene API oficial para sugerencias, así que generamos algunas básicas
      const suggestions = await this.generateSuggestions(query);

      // Cachear por 1 hora
      await this.redis.setex(cacheKey, 3600, JSON.stringify(suggestions));

      return suggestions;

    } catch (error) {
      logger.error('Error getting search suggestions:', error);
      return [];
    }
  }

  /**
   * Generar sugerencias de búsqueda basadas en tendencias y query
   */
  private async generateSuggestions(query: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Sugerencias básicas basadas en el query
    if (query.length > 2) {
      suggestions.push(`${query} musica`);
      suggestions.push(`${query} cancion`);
      suggestions.push(`${query} lyrics`);
      suggestions.push(`${query} oficial`);
    }

    // Tendencias musicales comunes
    const trends = [
      'top 40',
      'reggaeton',
      'pop español',
      'rock en español',
      'salsa',
      'bachata',
      'cumbia',
      'vallenato'
    ];

    // Añadir tendencias relacionadas
    trends.forEach(trend => {
      if (trend.includes(query.toLowerCase()) || query.toLowerCase().includes(trend)) {
        suggestions.push(trend);
      }
    });

    return [...new Set(suggestions)].slice(0, 10);
  }

  /**
   * Parsear duración ISO 8601 a segundos
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

    if (!match) return 0;

    const hours = parseInt(match[1]?.replace('H', '') || '0');
    const minutes = parseInt(match[2]?.replace('M', '') || '0');
    const seconds = parseInt(match[3]?.replace('S', '') || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Determinar si el contenido es premium (basado en título y descripción)
   */
  private isPremiumContent(title: string, description: string): boolean {
    const premiumKeywords = [
      'remix',
      'remaster',
      'live',
      'acoustic',
      'orchestra',
      'symphony',
      'extended',
      'album version',
      'deluxe',
      'anniversary'
    ];

    const content = `${title} ${description}`.toLowerCase();

    return premiumKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Filtrar contenido inapropiado
   */
  private containsInappropriateContent(title: string, channelTitle: string): boolean {
    const inappropriateKeywords = [
      'explicit',
      'nsfw',
      'adult',
      'porn',
      'xxx',
      'sex',
      'nude',
      'violence',
      'drugs',
      'hate'
    ];

    const content = `${title} ${channelTitle}`.toLowerCase();

    return inappropriateKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Limpiar caché para un query específico
   */
  async clearSearchCache(query?: string): Promise<void> {
    try {
      if (query) {
        const keys = await this.redis.keys(`youtube:search:${query}*`);
        if (keys.length > 0) {
          for (const key of keys) {
            await this.redis.del(key);
          }
        }
      } else {
        // Limpiar todo el caché de búsquedas
        const keys = await this.redis.keys('youtube:search:*');
        if (keys.length > 0) {
          for (const key of keys) {
            await this.redis.del(key);
          }
        }
      }

      logger.info('YouTube search cache cleared', { query });
    } catch (error) {
      logger.error('Error clearing YouTube search cache:', error);
    }
  }

  /**
   * Obtener estadísticas de uso de la API
   */
  async getApiStats(): Promise<{
    cacheHits: number;
    cacheMisses: number;
    totalRequests: number;
    errorRate: number;
  }> {
    // TODO: Implementar métricas de uso
    return {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      errorRate: 0
    };
  }
}

export const enhancedYouTubeService = new EnhancedYouTubeService();