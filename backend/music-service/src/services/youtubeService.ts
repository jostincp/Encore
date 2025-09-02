import axios from 'axios';
import { config } from '../../../shared/config';
import { logger } from '../../../shared/utils/logger';
import { cacheService } from '../../../shared/utils/cache';
import { ExternalServiceError } from '../../../shared/utils/errors';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  thumbnail_url: string;
  url: string;
  view_count?: number;
  published_at?: string;
  description?: string;
}

export interface YouTubeVideoDetails {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail_url: string;
  url: string;
  view_count: number;
  like_count?: number;
  published_at: string;
  description: string;
  tags?: string[];
  category_id?: string;
}

export class YouTubeService {
  private static readonly BASE_URL = 'https://www.googleapis.com/youtube/v3';
  private static readonly API_KEY = config.youtube.apiKey;
  private static readonly CACHE_TTL = 3600; // 1 hour
  
  static async searchSongs(
    query: string,
    maxResults: number = 25
  ): Promise<YouTubeSearchResult[]> {
    try {
      if (!this.API_KEY) {
        throw new ExternalServiceError('YouTube API key not configured');
      }
      
      const cacheKey = `youtube:search:${query}:${maxResults}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('YouTube search results retrieved from cache', { query });
        return JSON.parse(cached);
      }
      
      const searchUrl = `${this.BASE_URL}/search`;
      const searchParams = {
        part: 'snippet',
        q: query,
        type: 'video',
        videoCategoryId: '10', // Music category
        maxResults: maxResults,
        key: this.API_KEY,
        order: 'relevance',
        safeSearch: 'moderate'
      };
      
      logger.debug('Searching YouTube', { query, maxResults });
      const searchResponse = await axios.get(searchUrl, { params: searchParams });
      
      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        logger.info('No YouTube results found', { query });
        return [];
      }
      
      // Get video IDs for duration lookup
      const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId).join(',');
      
      // Get video details including duration
      const detailsUrl = `${this.BASE_URL}/videos`;
      const detailsParams = {
        part: 'contentDetails,statistics,snippet',
        id: videoIds,
        key: this.API_KEY
      };
      
      const detailsResponse = await axios.get(detailsUrl, { params: detailsParams });
      
      const results: YouTubeSearchResult[] = searchResponse.data.items.map((item: any) => {
        const details = detailsResponse.data.items.find((d: any) => d.id === item.id.videoId);
        const duration = details ? this.parseDuration(details.contentDetails.duration) : 0;
        
        // Extract artist from title (common patterns)
        const title = item.snippet.title;
        const { cleanTitle, artist } = this.extractArtistFromTitle(title);
        
        return {
          id: item.id.videoId,
          title: cleanTitle,
          artist: artist,
          duration: duration,
          thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          view_count: details ? parseInt(details.statistics.viewCount || '0') : undefined,
          published_at: item.snippet.publishedAt,
          description: item.snippet.description
        };
      });
      
      // Filter out very short or very long videos (likely not music)
      const filteredResults = results.filter(result => 
        result.duration >= 30 && result.duration <= 600 // 30 seconds to 10 minutes
      );
      
      // Cache results
      await cacheService.set(cacheKey, JSON.stringify(filteredResults), this.CACHE_TTL);
      
      logger.info(`YouTube search completed`, { 
        query, 
        totalResults: results.length, 
        filteredResults: filteredResults.length 
      });
      
      return filteredResults;
    } catch (error) {
      logger.error('YouTube search error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new ExternalServiceError('YouTube API quota exceeded or invalid API key');
        }
        if (error.response?.status === 400) {
          throw new ExternalServiceError('Invalid YouTube search parameters');
        }
      }
      
      throw new ExternalServiceError('YouTube search failed');
    }
  }
  
  static async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null> {
    try {
      if (!this.API_KEY) {
        throw new ExternalServiceError('YouTube API key not configured');
      }
      
      const cacheKey = `youtube:video:${videoId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('YouTube video details retrieved from cache', { videoId });
        return JSON.parse(cached);
      }
      
      const url = `${this.BASE_URL}/videos`;
      const params = {
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: this.API_KEY
      };
      
      logger.debug('Getting YouTube video details', { videoId });
      const response = await axios.get(url, { params });
      
      if (!response.data.items || response.data.items.length === 0) {
        logger.warn('YouTube video not found', { videoId });
        return null;
      }
      
      const item = response.data.items[0];
      const duration = this.parseDuration(item.contentDetails.duration);
      const { cleanTitle, artist } = this.extractArtistFromTitle(item.snippet.title);
      
      const videoDetails: YouTubeVideoDetails = {
        id: item.id,
        title: cleanTitle,
        artist: artist,
        duration: duration,
        thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        view_count: parseInt(item.statistics.viewCount || '0'),
        like_count: parseInt(item.statistics.likeCount || '0'),
        published_at: item.snippet.publishedAt,
        description: item.snippet.description,
        tags: item.snippet.tags,
        category_id: item.snippet.categoryId
      };
      
      // Cache video details
      await cacheService.set(cacheKey, JSON.stringify(videoDetails), this.CACHE_TTL);
      
      logger.info('YouTube video details retrieved', { videoId, title: cleanTitle });
      return videoDetails;
    } catch (error) {
      logger.error('YouTube video details error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new ExternalServiceError('YouTube API quota exceeded or invalid API key');
        }
        if (error.response?.status === 404) {
          return null;
        }
      }
      
      throw new ExternalServiceError('Failed to get YouTube video details');
    }
  }
  
  static async validateVideoId(videoId: string): Promise<boolean> {
    try {
      const details = await this.getVideoDetails(videoId);
      return details !== null;
    } catch (error) {
      logger.error('YouTube video validation error:', error);
      return false;
    }
  }
  
  static async getPlaylistVideos(playlistId: string, maxResults: number = 50): Promise<YouTubeSearchResult[]> {
    try {
      if (!this.API_KEY) {
        throw new ExternalServiceError('YouTube API key not configured');
      }
      
      const cacheKey = `youtube:playlist:${playlistId}:${maxResults}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('YouTube playlist retrieved from cache', { playlistId });
        return JSON.parse(cached);
      }
      
      const url = `${this.BASE_URL}/playlistItems`;
      const params = {
        part: 'snippet',
        playlistId: playlistId,
        maxResults: maxResults,
        key: this.API_KEY
      };
      
      logger.debug('Getting YouTube playlist videos', { playlistId, maxResults });
      const response = await axios.get(url, { params });
      
      if (!response.data.items || response.data.items.length === 0) {
        logger.info('No videos found in YouTube playlist', { playlistId });
        return [];
      }
      
      // Get video IDs for duration lookup
      const videoIds = response.data.items
        .map((item: any) => item.snippet.resourceId.videoId)
        .join(',');
      
      // Get video details including duration
      const detailsUrl = `${this.BASE_URL}/videos`;
      const detailsParams = {
        part: 'contentDetails,statistics',
        id: videoIds,
        key: this.API_KEY
      };
      
      const detailsResponse = await axios.get(detailsUrl, { params: detailsParams });
      
      const results: YouTubeSearchResult[] = response.data.items.map((item: any) => {
        const videoId = item.snippet.resourceId.videoId;
        const details = detailsResponse.data.items.find((d: any) => d.id === videoId);
        const duration = details ? this.parseDuration(details.contentDetails.duration) : 0;
        
        const title = item.snippet.title;
        const { cleanTitle, artist } = this.extractArtistFromTitle(title);
        
        return {
          id: videoId,
          title: cleanTitle,
          artist: artist,
          duration: duration,
          thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          view_count: details ? parseInt(details.statistics.viewCount || '0') : undefined,
          published_at: item.snippet.publishedAt,
          description: item.snippet.description
        };
      });
      
      // Filter out invalid videos
      const filteredResults = results.filter(result => 
        result.duration >= 30 && result.duration <= 600
      );
      
      // Cache results
      await cacheService.set(cacheKey, JSON.stringify(filteredResults), this.CACHE_TTL);
      
      logger.info(`YouTube playlist videos retrieved`, { 
        playlistId, 
        totalResults: results.length, 
        filteredResults: filteredResults.length 
      });
      
      return filteredResults;
    } catch (error) {
      logger.error('YouTube playlist error:', error);
      throw new ExternalServiceError('Failed to get YouTube playlist videos');
    }
  }
  
  // Helper method to parse YouTube duration format (PT4M13S -> 253 seconds)
  private static parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1]?.replace('H', '') || '0');
    const minutes = parseInt(match[2]?.replace('M', '') || '0');
    const seconds = parseInt(match[3]?.replace('S', '') || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // Helper method to extract artist from video title
  private static extractArtistFromTitle(title: string): { cleanTitle: string; artist: string } {
    // Common patterns: "Artist - Title", "Artist: Title", "Title by Artist", "Title - Artist"
    const patterns = [
      /^(.+?)\s*-\s*(.+)$/, // Artist - Title
      /^(.+?)\s*:\s*(.+)$/, // Artist: Title
      /^(.+?)\s+by\s+(.+)$/i, // Title by Artist
      /^(.+?)\s*\|\s*(.+)$/, // Artist | Title
      /^(.+?)\s*–\s*(.+)$/, // Artist – Title (em dash)
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const [, part1, part2] = match;
        
        // Heuristic: if part1 looks like an artist name (shorter, no common title words)
        const titleWords = ['official', 'video', 'music', 'lyrics', 'audio', 'live', 'remix', 'cover'];
        const part1Lower = part1.toLowerCase();
        const hasVideoWords = titleWords.some(word => part1Lower.includes(word));
        
        if (!hasVideoWords && part1.length < part2.length) {
          return {
            cleanTitle: part2.trim(),
            artist: part1.trim()
          };
        } else {
          return {
            cleanTitle: part1.trim(),
            artist: part2.trim()
          };
        }
      }
    }
    
    // If no pattern matches, try to extract artist from common formats
    const artistMatch = title.match(/\(([^)]+)\)$/) || title.match(/\[([^\]]+)\]$/);
    if (artistMatch) {
      return {
        cleanTitle: title.replace(artistMatch[0], '').trim(),
        artist: artistMatch[1].trim()
      };
    }
    
    // Default: use channel name as artist (would need to be passed from search results)
    return {
      cleanTitle: title.trim(),
      artist: 'Unknown Artist'
    };
  }
  
  static async getTrendingMusic(regionCode: string = 'US', maxResults: number = 50): Promise<YouTubeSearchResult[]> {
    try {
      if (!this.API_KEY) {
        throw new ExternalServiceError('YouTube API key not configured');
      }
      
      const cacheKey = `youtube:trending:${regionCode}:${maxResults}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('YouTube trending music retrieved from cache', { regionCode });
        return JSON.parse(cached);
      }
      
      const url = `${this.BASE_URL}/videos`;
      const params = {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        videoCategoryId: '10', // Music category
        regionCode: regionCode,
        maxResults: maxResults,
        key: this.API_KEY
      };
      
      logger.debug('Getting YouTube trending music', { regionCode, maxResults });
      const response = await axios.get(url, { params });
      
      if (!response.data.items || response.data.items.length === 0) {
        logger.info('No trending music found on YouTube', { regionCode });
        return [];
      }
      
      const results: YouTubeSearchResult[] = response.data.items.map((item: any) => {
        const duration = this.parseDuration(item.contentDetails.duration);
        const { cleanTitle, artist } = this.extractArtistFromTitle(item.snippet.title);
        
        return {
          id: item.id,
          title: cleanTitle,
          artist: artist,
          duration: duration,
          thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          view_count: parseInt(item.statistics.viewCount || '0'),
          published_at: item.snippet.publishedAt,
          description: item.snippet.description
        };
      });
      
      // Filter music videos
      const filteredResults = results.filter(result => 
        result.duration >= 30 && result.duration <= 600
      );
      
      // Cache results for shorter time (trending changes frequently)
      await cacheService.set(cacheKey, JSON.stringify(filteredResults), 1800); // 30 minutes
      
      logger.info(`YouTube trending music retrieved`, { 
        regionCode, 
        totalResults: results.length, 
        filteredResults: filteredResults.length 
      });
      
      return filteredResults;
    } catch (error) {
      logger.error('YouTube trending music error:', error);
      throw new ExternalServiceError('Failed to get YouTube trending music');
    }
  }
}