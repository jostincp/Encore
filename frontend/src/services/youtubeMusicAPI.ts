// YouTube Music API Client for Encore Frontend
class YouTubeMusicAPI {
  private baseURL: string;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor(baseURL: string = 'http://localhost:3003') {
    this.baseURL = baseURL;
  }

  /**
   * Search YouTube videos with client-side caching
   */
  async searchVideos(query: string, options: {
    maxResults?: number;
    region?: string;
    useClientCache?: boolean;
  } = {}): Promise<any> {
    const { maxResults = 20, region = 'US', useClientCache = true } = options;

    // Validate input
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }

    if (query.trim().length === 0) {
      throw new Error('Query parameter cannot be empty');
    }

    if (query.length > 100) {
      throw new Error('Query parameter is too long (max 100 characters)');
    }

    // Client-side cache check
    const cacheKey = `search:${query}:${region}:${maxResults}`;
    
    if (useClientCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`⚡ Client Cache HIT for: ${query}`);
        return {
          ...cached.data,
          cached: true,
          cacheSource: 'client'
        };
      }
    }

    try {
      console.log(`🌐 Calling API for: ${query}`);
      
      const response = await fetch(`${this.baseURL}/api/music/youtube/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}&regionCode=${region}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful response
      if (data.success && useClientCache) {
        this.setCache(cacheKey, data, 5 * 60 * 1000); // 5 minutes client cache
      }

      return {
        ...data,
        cached: false,
        cacheSource: 'none'
      };

    } catch (error) {
      console.error('❌ YouTube search error:', error);
      throw error;
    }
  }

  /**
   * Get video details by ID
   */
  async getVideoDetails(videoId: string): Promise<any> {
    if (!videoId || typeof videoId !== 'string') {
      throw new Error('Video ID is required');
    }

    // Client-side cache check
    const cacheKey = `video:${videoId}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      console.log(`⚡ Client Cache HIT for video: ${videoId}`);
      return {
        ...cached.data,
        cached: true,
        cacheSource: 'client'
      };
    }

    try {
      console.log(`🌐 Calling API for video: ${videoId}`);
      
      const response = await fetch(`${this.baseURL}/api/music/youtube/video/${videoId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful response
      if (data.success) {
        this.setCache(cacheKey, data, 30 * 60 * 1000); // 30 minutes client cache
      }

      return {
        ...data,
        cached: false,
        cacheSource: 'none'
      };

    } catch (error) {
      console.error(`❌ Video details error for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Get trending music videos
   */
  async getTrendingMusic(region: string = 'US'): Promise<any> {
    // Client-side cache check
    const cacheKey = `trending:${region}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      console.log(`⚡ Client Cache HIT for trending: ${region}`);
      return {
        ...cached.data,
        cached: true,
        cacheSource: 'client'
      };
    }

    try {
      console.log(`🌐 Calling API for trending: ${region}`);
      
      const response = await fetch(`${this.baseURL}/api/music/youtube/trending?region=${region}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful response
      if (data.success) {
        this.setCache(cacheKey, data, 15 * 60 * 1000); // 15 minutes client cache
      }

      return {
        ...data,
        cached: false,
        cacheSource: 'none'
      };

    } catch (error) {
      console.error('❌ Trending music error:', error);
      throw error;
    }
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Health check error:', error);
      throw error;
    }
  }

  /**
   * Clear client-side cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      // Clear cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
    console.log(`🧹 Client cache cleared${pattern ? ` for pattern: ${pattern}` : ''}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // Private cache methods
  private getFromCache(key: string): { data: any; timestamp: number; ttl: number } | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
}

// Export singleton instance
export const youtubeMusicAPI = new YouTubeMusicAPI();

// Export types
export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration?: string;
  viewCount?: number;
}

export interface YouTubeSearchResponse {
  success: boolean;
  data: {
    query: string;
    results: number;
    videos: YouTubeVideo[];
    cached: boolean;
  };
  message: string;
  cached: boolean;
  cacheSource: 'client' | 'server' | 'none';
}

export default YouTubeMusicAPI;
