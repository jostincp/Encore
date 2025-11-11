import { google } from 'googleapis';
import { redisHelpers } from '../config/redis';
import { youtubeConfig } from '../config';
import logger from '../../../shared/utils/logger';

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

  private normalizeQuery(query: string): string {
    // Normalize query string for caching
    return query.trim().toLowerCase();
  }

  private cleanYouTubeResponse(response: YouTubeSearchResponse): CleanVideo[] {
    // Clean and process YouTube API response
    return response.items.map((item) => {
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
      };
    });
  }

  private isQuotaExceededError(error: any): boolean {
    // Check if error is due to quota exceeded
    return error.code === 403 && error.errors[0].reason === 'quotaExceeded';
  }

  private isInvalidApiKeyError(error: any): boolean {
    // Check if error is due to invalid API key
    return error.code === 401 && error.errors[0].reason === 'invalidApiKey';
  }

  public static async getVideoDetails(videoId: string): Promise<any> {
    const instance = YouTubeService.getInstance();

      console.error('YouTube API key not configured');
      throw new Error('YouTube API key not configured');
    }

    try {
      const cacheKey = `youtube:video:${videoId}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await instance.client.get<YouTubeVideoDetailsResponse>('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
        },
      });

      if (!response.data.items.length) {
        throw new Error('Video not found');
      }

      const video = response.data.items[0];
      const duration = YouTubeService.parseDuration(video.contentDetails.duration);

      const videoDetails = {
        id: `youtube:video:${video.id}`,
        title: video.snippet.title,
        artist: YouTubeService.extractArtistFromTitle(
          video.snippet.title,
          video.snippet.channelTitle
        ),
        channel: video.snippet.channelTitle,
        duration,
        thumbnail_url: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
        external_url: `https://www.youtube.com/watch?v=${video.id}`,
        source: 'youtube',
        published_at: video.snippet.publishedAt,
        description: video.snippet.description,
        view_count: parseInt(video.statistics.viewCount, 10),
        like_count: parseInt(video.statistics.likeCount, 10),
      };

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, videoDetails, 3600);

      return videoDetails;
    } catch (error) {
      console.error('YouTube video details error:', error);
      throw new Error('Failed to get YouTube video details');
    }
  }

  public static async getTrendingVideos(
    options: { maxResults?: number; regionCode?: string } = {}
  ): Promise<any[]> {
    const instance = YouTubeService.getInstance();
    const { maxResults = 25, regionCode = 'US' } = options;

    if (!instance.apiKey) {
      console.error('YouTube API key not configured');
      throw new Error('YouTube API key not configured');
    }

    try {
      const cacheKey = `youtube:trending:${maxResults}:${regionCode}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await instance.client.get('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          videoCategoryId: '10', // Music category
          regionCode,
          maxResults,
        },
      });

      const videos = response.data.items.map((video: any) => {
        const duration = YouTubeService.parseDuration(video.contentDetails.duration);
        
        return {
          id: `youtube:video:${video.id}`,
          title: video.snippet.title,
          artist: YouTubeService.extractArtistFromTitle(
            video.snippet.title,
            video.snippet.channelTitle
          ),
          channel: video.snippet.channelTitle,
          duration,
          thumbnail_url: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
          external_url: `https://www.youtube.com/watch?v=${video.id}`,
          source: 'youtube',
          published_at: video.snippet.publishedAt,
          view_count: parseInt(video.statistics.viewCount, 10),
          like_count: parseInt(video.statistics.likeCount, 10),
        };
      });

      // Cache for 30 minutes
      await redisHelpers.set(cacheKey, videos, 1800);

      return videos;
    } catch (error) {
      console.error('YouTube trending videos error:', error);
      throw new Error('Failed to get YouTube trending videos');
    }
  }

  public static async getPlaylistVideos(
    playlistId: string,
    options: { maxResults?: number; pageToken?: string } = {}
  ): Promise<any[]> {
    const instance = YouTubeService.getInstance();
    const { maxResults = 25, pageToken } = options;

    if (!instance.apiKey) {
      console.error('YouTube API key not configured');
      throw new Error('YouTube API key not configured');
    }

    try {
      const cacheKey = `youtube:playlist:${playlistId}:${maxResults}:${pageToken || 'first'}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const params: any = {
        part: 'snippet',
        playlistId,
        maxResults,
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await instance.client.get('/playlistItems', {
        params,
      });

      const videos = response.data.items
        .filter((item: any) => item.snippet.resourceId.kind === 'youtube#video')
        .map((item: any) => ({
          id: `youtube:video:${item.snippet.resourceId.videoId}`,
          title: item.snippet.title,
          artist: YouTubeService.extractArtistFromTitle(
            item.snippet.title,
            item.snippet.channelTitle
          ),
          channel: item.snippet.channelTitle,
          duration: 0, // Would need separate API call to get duration
          thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
          external_url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
          source: 'youtube',
          published_at: item.snippet.publishedAt,
          description: item.snippet.description,
        }));

      // Cache for 15 minutes
      await redisHelpers.set(cacheKey, videos, 900);

      return videos;
    } catch (error) {
      console.error('YouTube playlist videos error:', error);
      throw new Error('Failed to get YouTube playlist videos');
    }
  }
}

export default YouTubeService