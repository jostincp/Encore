import { google } from 'googleapis';
import { redisHelpers } from '../config/redis';
import { youtubeConfig } from '../config';
import logger from '@shared/utils/logger';

// YouTube API response interfaces
interface YouTubeVideo {
  id: {
    kind: string;
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      default?: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      high?: { url: string; width: number; height: number };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

// Clean video interface for our API
export interface CleanVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration?: string;
  viewCount?: number;
}

export class YouTubeService {
  private static instance: YouTubeService;
  private youtube: any;

  private constructor() {
    // Initialize YouTube API client with Google APIs
    this.youtube = google.youtube({
      version: 'v3',
      auth: youtubeConfig.apiKey
    });
  }

  public static getInstance(): YouTubeService {
    if (!YouTubeService.instance) {
      YouTubeService.instance = new YouTubeService();
    }
    return YouTubeService.instance;
  }

  /**
   * Search videos on YouTube with caching
   * @param query Search query string
   * @returns Array of cleaned video objects
   */
  async searchVideos(query: string): Promise<CleanVideo[]> {
    try {
      // 1. Normalize Query
      const normalizedQuery = this.normalizeQuery(query);
      
      // 2. Check Redis Cache First
      const cacheKey = `music:search:yt:${normalizedQuery}`;
      const cachedResults = await redisHelpers.get(cacheKey);
      
      if (cachedResults) {
        logger.info(`⚡ Cache HIT for YouTube search: "${normalizedQuery}"`);
        return cachedResults;
      }

      // 3. Cache Miss - Call YouTube API
      logger.info(`🌐 Cache MISS - Calling YouTube API for: "${normalizedQuery}"`);
      
      const response = await this.youtube.search.list({
        part: 'snippet',
        type: 'video',
        videoCategoryId: youtubeConfig.videoCategoryId, // Music category
        maxResults: youtubeConfig.maxResults,
        regionCode: youtubeConfig.regionCode,
        q: normalizedQuery
      });

      const youtubeResponse: YouTubeSearchResponse = response.data;
      
      // 4. Process and Clean Results
      const cleanedVideos = this.cleanYouTubeResponse(youtubeResponse);
      
      // 5. Save to Cache with TTL (48 hours)
      await redisHelpers.set(cacheKey, cleanedVideos, youtubeConfig.searchCacheTTL);
      logger.info(`💾 Cached YouTube search results for: "${normalizedQuery}" (${cleanedVideos.length} videos)`);

      return cleanedVideos;

    } catch (error) {
      logger.error('❌ Error searching YouTube videos:', error);
      
      // Handle specific YouTube API errors
      if (this.isQuotaExceededError(error)) {
        throw new Error('YouTube API quota exceeded. Please try again later.');
      }
      
      if (this.isInvalidApiKeyError(error)) {
        throw new Error('Invalid YouTube API key configuration.');
      }
      
      throw new Error('Failed to search YouTube videos');
    }
  }

  /**
   * Normalize search query
   * @param query Raw search query
   * @returns Normalized query
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Clean YouTube API response to our format
   * @param response Raw YouTube API response
   * @returns Array of cleaned video objects
   */
  private cleanYouTubeResponse(response: YouTubeSearchResponse): CleanVideo[] {
    if (!response.items || response.items.length === 0) {
      return [];
    }

    return response.items
      .filter(item => item.id && item.id.videoId && item.snippet)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle || 'Unknown Channel',
        thumbnail: this.getBestThumbnail(item.snippet.thumbnails)
      }));
  }

  /**
   * Get the best available thumbnail
   * @param thumbnails YouTube thumbnails object
   * @returns Best thumbnail URL
   */
  private getBestThumbnail(thumbnails: any): string {
    return thumbnails?.high?.url || 
           thumbnails?.medium?.url || 
           thumbnails?.default?.url || 
           '';
  }

  /**
   * Check if error is quota exceeded
   * @param error Error object
   * @returns True if quota exceeded
   */
  private isQuotaExceededError(error: any): boolean {
    return error?.code === 429 || 
           error?.errors?.[0]?.reason === 'quotaExceeded' ||
           error?.message?.includes('quota');
  }

  /**
   * Check if error is invalid API key
   * @param error Error object
   * @returns True if invalid API key
   */
  private isInvalidApiKeyError(error: any): boolean {
    return error?.code === 403 || 
           error?.errors?.[0]?.reason === 'keyInvalid' ||
           error?.message?.includes('API key');
  }
}

// Export singleton instance
export const youtubeService = new YouTubeService();
export default youtubeService;
