import axios, { AxiosInstance } from 'axios';
import { redisHelpers } from '../config/redis';

interface YouTubeVideo {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
}

interface YouTubeVideoDetails {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
  };
}

interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeVideoDetailsResponse {
  items: YouTubeVideoDetails[];
}

export class YouTubeService {
  private static instance: YouTubeService;
  private client: AxiosInstance;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      timeout: 10000,
      params: {
        key: this.apiKey,
      },
    });
  }

  public static getInstance(): YouTubeService {
    if (!YouTubeService.instance) {
      YouTubeService.instance = new YouTubeService();
    }
    return YouTubeService.instance;
  }

  private static parseDuration(duration: string): number {
    // Parse ISO 8601 duration format (PT4M13S) to seconds
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  private static extractArtistFromTitle(title: string, channelTitle: string): string {
    // Try to extract artist from title patterns like "Artist - Song" or "Song by Artist"
    const patterns = [
      /^(.+?)\s*[-–—]\s*(.+)$/, // Artist - Song
      /^(.+?)\s*by\s+(.+)$/i,   // Song by Artist
      /^(.+?)\s*\|\s*(.+)$/,    // Artist | Song
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        // Assume first part is artist if it's shorter or contains common artist indicators
        const part1 = match[1].trim();
        const part2 = match[2].trim();
        
        if (part1.length < part2.length || /official|video|lyrics|audio/i.test(part2)) {
          return part1;
        } else {
          return part2;
        }
      }
    }

    // Fallback to channel title, but clean it up
    return channelTitle
      .replace(/official|channel|music|records|entertainment/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Unknown Artist';
  }

  public static async searchVideos(
    query: string,
    options: { maxResults?: number; pageToken?: string } = {}
  ): Promise<any[]> {
    const instance = YouTubeService.getInstance();
    const { maxResults = 25, pageToken } = options;

    if (!instance.apiKey) {
      console.error('YouTube API key not configured');
      throw new Error('YouTube API key not configured');
    }

    try {
      const cacheKey = `youtube:search:${query}:${maxResults}:${pageToken || 'first'}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const params: any = {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        videoCategoryId: '10', // Music category
        order: 'relevance',
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await instance.client.get<YouTubeSearchResponse>('/search', {
        params,
      });

      const videos = response.data.items.map(video => ({
        id: `youtube:video:${video.id.videoId}`,
        title: video.snippet.title,
        artist: YouTubeService.extractArtistFromTitle(
          video.snippet.title,
          video.snippet.channelTitle
        ),
        channel: video.snippet.channelTitle,
        duration: 0, // Will be filled by getVideoDetails if needed
        thumbnail_url: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
        external_url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
        source: 'youtube',
        published_at: video.snippet.publishedAt,
        description: video.snippet.description,
      }));

      // Cache results for 5 minutes
      await redisHelpers.set(cacheKey, videos, 300);

      return videos;
    } catch (error) {
      console.error('YouTube search error:', error);
      throw new Error('Failed to search YouTube videos');
    }
  }

  public static async getVideoDetails(videoId: string): Promise<any> {
    const instance = YouTubeService.getInstance();

    if (!instance.apiKey) {
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