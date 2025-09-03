import { SpotifyService } from './spotifyService';
import { YouTubeService } from './youtubeService';
import { CacheService, CacheKeys, CacheTags } from './cacheService';
import { Song } from '../models/Song';
import { Queue } from '../models/Queue';
import logger from '../../../shared/utils/logger';

interface SearchOptions {
  limit?: number;
  offset?: number;
  sources?: ('spotify' | 'youtube')[];
}

interface SongData {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  preview_url?: string;
  thumbnail_url?: string;
  external_url: string;
  source: 'spotify' | 'youtube';
  release_date?: string;
  audio_features?: {
    energy: number;
    danceability: number;
    valence: number;
    tempo: number;
  };
}

export class MusicService {
  /**
   * Search for songs across multiple music services
   */
  public static async searchSongs(
    query: string,
    barId: string,
    options: SearchOptions = {}
  ): Promise<SongData[]> {
    const { limit = 50, offset = 0, sources = ['spotify', 'youtube'] } = options;
    const cacheKey = CacheKeys.search(barId, query, limit, offset, sources);

    try {
      // Use enhanced cache service with getOrSet pattern
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await this.performSearch(query, sources, limit, offset);
        },
        {
          ttl: 300, // 5 minutes
          tags: [CacheTags.search(), CacheTags.bar(barId)]
        }
      );
    } catch (error) {
      logger.error('Music search error:', { query, barId, error });
      throw error;
    }
  }

  /**
   * Perform the actual search across services
   */
  private static async performSearch(
    query: string,
    sources: string[],
    limit: number,
    offset: number
  ): Promise<SongData[]> {
    try {

      const searchPromises: Promise<SongData[]>[] = [];
      const resultsPerSource = Math.ceil(limit / sources.length);

      // Search Spotify if enabled
      if (sources.includes('spotify')) {
        searchPromises.push(
          SpotifyService.searchTracks(query, { 
            limit: resultsPerSource, 
            offset: Math.floor(offset / sources.length) 
          }).catch(error => {
            console.error('Spotify search failed:', error);
            return [];
          })
        );
      }

      // Search YouTube if enabled
      if (sources.includes('youtube')) {
        searchPromises.push(
          YouTubeService.searchVideos(query, { 
            maxResults: resultsPerSource 
          }).catch(error => {
            console.error('YouTube search failed:', error);
            return [];
          })
        );
      }

      const results = await Promise.all(searchPromises);
      const allSongs = results.flat();

      if (allSongs.length === 0) {
        throw new Error('All music services are currently unavailable');
      }

      // Remove duplicates based on title and artist similarity
      const uniqueSongs = this.deduplicateSongs(allSongs);
      
      // Sort by relevance (could be improved with better scoring)
      const sortedSongs = uniqueSongs
        .slice(offset, offset + limit)
        .sort((a, b) => {
          // Prefer songs with preview URLs
          if (a.preview_url && !b.preview_url) return -1;
          if (!a.preview_url && b.preview_url) return 1;
          
          // Prefer Spotify over YouTube for better metadata
          if (a.source === 'spotify' && b.source === 'youtube') return -1;
          if (a.source === 'youtube' && b.source === 'spotify') return 1;
          
          return 0;
        });

      return sortedSongs;
    } catch (error) {
      logger.error('Search execution error:', { query, sources, error });
      if (results.some(r => r.length > 0)) {
        // Return partial results if at least one service worked
        const partialResults = results.flat();
        return this.deduplicateSongs(partialResults).slice(offset, offset + limit);
      }
      throw new Error('All music services are currently unavailable');
    }
  }

  /**
   * Get detailed information about a specific song
   */
  public static async getSongDetails(songId: string, barId: string): Promise<SongData> {
    const cacheKey = CacheKeys.song(songId, barId);

    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          let songDetails: SongData;

          if (songId.startsWith('spotify:')) {
            const trackId = songId.split(':')[2];
            songDetails = await SpotifyService.getTrackDetails(trackId);
          } else if (songId.startsWith('youtube:')) {
            const videoId = songId.split(':')[2];
            songDetails = await YouTubeService.getVideoDetails(videoId);
          } else {
            throw Object.assign(new Error('Unsupported song source'), { statusCode: 400 });
          }

          return songDetails;
        },
        {
          ttl: 3600, // 1 hour
          tags: [CacheTags.song(songId), CacheTags.bar(barId)]
        }
      );
    } catch (error) {
      logger.error('Get song details error:', { songId, barId, error });
      if (error.statusCode) {
        throw error;
      }
      throw Object.assign(new Error('Song not found'), { statusCode: 404 });
    }
  }

  /**
   * Get popular songs for a specific bar
   */
  public static async getPopularSongs(
    barId: string,
    options: { limit?: number; timeframe?: 'day' | 'week' | 'month' | 'all' } = {}
  ): Promise<SongData[]> {
    const { limit = 20, timeframe = 'week' } = options;
    const cacheKey = CacheKeys.popular(barId, limit, timeframe);

    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          // Get popular songs from queue history
          const popularSongIds = await Queue.getPopularSongs(barId, { limit, timeframe });
          
          if (popularSongIds.length === 0) {
            // Fallback to trending songs if no popular songs in this bar
            return this.getTrendingSongs({ limit });
          }

          // Get details for each popular song with parallel processing
          const songDetailsPromises = popularSongIds.map(async (songData: any) => {
            try {
              const details = await this.getSongDetails(songData.song_id, barId);
              return {
                ...details,
                play_count: songData.play_count,
                last_played: songData.last_played,
              };
            } catch (error) {
              logger.warn(`Failed to get details for song ${songData.song_id}:`, error);
              return null;
            }
          });

          const songDetails = (await Promise.all(songDetailsPromises))
            .filter(song => song !== null);

          return songDetails;
        },
        {
          ttl: 1800, // 30 minutes
          tags: [CacheTags.popular(), CacheTags.bar(barId), CacheTags.queue(barId)]
        }
      );
    } catch (error) {
      logger.error('Get popular songs error:', { barId, options, error });
      throw new Error('Failed to get popular songs');
    }
  }

  /**
   * Get recently played songs for a specific bar
   */
  public static async getRecentSongs(
    barId: string,
    options: { limit?: number } = {}
  ): Promise<SongData[]> {
    const { limit = 20 } = options;
    const cacheKey = CacheKeys.recent(barId, limit);

    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          // Get recent songs from queue history
          const recentSongIds = await Queue.getRecentSongs(barId, { limit });
          
          if (recentSongIds.length === 0) {
            return [];
          }

          // Get details for each recent song with parallel processing
          const songDetailsPromises = recentSongIds.map(async (songData: any) => {
            try {
              const details = await this.getSongDetails(songData.song_id, barId);
              return {
                ...details,
                played_at: songData.played_at,
              };
            } catch (error) {
              logger.warn(`Failed to get details for song ${songData.song_id}:`, error);
              return null;
            }
          });

          const songDetails = (await Promise.all(songDetailsPromises))
            .filter(song => song !== null);

          return songDetails;
        },
        {
          ttl: 300, // 5 minutes
          tags: [CacheTags.bar(barId), CacheTags.queue(barId)]
        }
      );
    } catch (error) {
      logger.error('Get recent songs error:', { barId, options, error });
      throw new Error('Failed to get recent songs');
    }
  }

  /**
   * Get trending songs from external services
   */
  public static async getTrendingSongs(
    options: { limit?: number; source?: 'spotify' | 'youtube' } = {}
  ): Promise<SongData[]> {
    const { limit = 20, source } = options;
    const cacheKey = CacheKeys.trending(limit, source || 'all');

    try {
      return await CacheService.getOrSet(
        cacheKey,
        async () => {
          let trendingSongs: SongData[] = [];

          if (!source || source === 'youtube') {
            try {
              const youtubeTrending = await YouTubeService.getTrendingVideos({ 
                maxResults: source === 'youtube' ? limit : Math.ceil(limit / 2) 
              });
              trendingSongs = trendingSongs.concat(youtubeTrending);
            } catch (error) {
              logger.warn('Failed to get YouTube trending:', error);
            }
          }

          if (!source || source === 'spotify') {
            try {
              // Spotify doesn't have a direct trending endpoint, so use featured playlists
              const spotifyFeatured = await SpotifyService.getFeaturedPlaylists({ 
                limit: source === 'spotify' ? limit : Math.ceil(limit / 2) 
              });
              // This would need additional logic to get tracks from playlists
              // For now, we'll skip this or implement playlist track fetching
            } catch (error) {
              logger.warn('Failed to get Spotify featured:', error);
            }
          }

          // Remove duplicates and limit results
          const uniqueSongs = this.deduplicateSongs(trendingSongs).slice(0, limit);
          return uniqueSongs;
        },
        {
          ttl: 3600, // 1 hour
          tags: [CacheTags.trending()]
        }
      );
    } catch (error) {
      logger.error('Get trending songs error:', { options, error });
      throw new Error('Failed to get trending songs');
    }
  }

  /**
   * Create a new song record in the database
   */
  public static async createSong(songData: Partial<SongData>): Promise<SongData> {
    try {
      const song = await Song.create(songData);
      
      // Invalidate related caches using tags
      await CacheService.invalidateByTags([
        CacheTags.search(),
        CacheTags.trending()
      ]);
      
      return song;
    } catch (error) {
      logger.error('Create song error:', { songData, error });
      throw new Error('Failed to create song');
    }
  }

  /**
   * Update an existing song record
   */
  public static async updateSong(songId: string, updates: Partial<SongData>): Promise<SongData> {
    try {
      const song = await Song.update(songId, updates);
      if (!song) {
        throw Object.assign(new Error('Song not found'), { statusCode: 404 });
      }
      
      // Invalidate related caches using tags
      await CacheService.invalidateByTags([
        CacheTags.song(songId),
        CacheTags.search()
      ]);
      
      return song;
    } catch (error) {
      logger.error('Update song error:', { songId, updates, error });
      throw error;
    }
  }

  /**
   * Delete a song record
   */
  public static async deleteSong(songId: string): Promise<void> {
    try {
      const deleted = await Song.delete(songId);
      if (!deleted) {
        throw Object.assign(new Error('Song not found'), { statusCode: 404 });
      }
      
      // Invalidate related caches using tags
      await CacheService.invalidateByTags([
        CacheTags.song(songId),
        CacheTags.search(),
        CacheTags.popular(),
        CacheTags.trending()
      ]);
      
    } catch (error) {
      logger.error('Delete song error:', { songId, error });
      throw error;
    }
  }

  /**
   * Mark a song as unavailable
   */
  public static async markSongUnavailable(songId: string, reason?: string): Promise<void> {
    try {
      await Song.markUnavailable(songId, reason);
      
      // Invalidate related caches using tags
      await CacheService.invalidateByTags([
        CacheTags.song(songId),
        CacheTags.search()
      ]);
      
    } catch (error) {
      logger.error('Mark song unavailable error:', { songId, error });
      throw new Error('Failed to mark song as unavailable');
    }
  }

  /**
   * Mark a song as available
   */
  public static async markSongAvailable(songId: string): Promise<void> {
    try {
      await Song.markAvailable(songId);
      
      // Invalidate related caches using tags
      await CacheService.invalidateByTags([
        CacheTags.song(songId),
        CacheTags.search()
      ]);
      
    } catch (error) {
      logger.error('Mark song available error:', { songId, error });
      throw new Error('Failed to mark song as available');
    }
  }

  /**
   * Import a song from external service to database
   */
  public static async importSong(songId: string, barId: string): Promise<SongData> {
    try {
      // Get song details from external service
      const songDetails = await this.getSongDetails(songId, barId);
      
      // Check if song already exists in database
      const existingSong = await Song.findById(songId);
      if (existingSong) {
        return existingSong;
      }

      // Create new song record
      const importedSong = await this.createSong({
        ...songDetails,
        imported_at: new Date().toISOString(),
        import_source: songDetails.source,
      });

      return importedSong;
    } catch (error) {
      console.error('Import song error:', error);
      throw new Error('Failed to import song');
    }
  }

  /**
   * Remove duplicate songs based on title and artist similarity
   */
  private static deduplicateSongs(songs: SongData[]): SongData[] {
    const seen = new Set<string>();
    const unique: SongData[] = [];

    for (const song of songs) {
      // Create a normalized key for comparison
      const normalizedTitle = song.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedArtist = song.artist.toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = `${normalizedTitle}:${normalizedArtist}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(song);
      }
    }

    return unique;
  }

  /**
   * Calculate similarity between two strings (for deduplication)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export default MusicService;