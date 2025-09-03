import { SpotifyService } from './spotifyService';
import { MusicService } from './musicService';
import { redisHelpers } from '../config/redis';
import { User } from '../models/User';
import { Queue } from '../models/Queue';
import { Song } from '../models/Song';

interface UserPreferences {
  genres: string[];
  artists: string[];
  audio_features: {
    energy: number;
    danceability: number;
    valence: number;
    tempo: number;
  };
  listening_history: {
    song_id: string;
    played_at: string;
    rating?: number;
  }[];
}

interface RecommendationOptions {
  limit?: number;
  seed_genres?: string[];
  seed_artists?: string[];
  seed_tracks?: string[];
  target_audio_features?: {
    energy?: number;
    danceability?: number;
    valence?: number;
    tempo?: number;
  };
}

interface RecommendationResult {
  song_id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  preview_url?: string;
  thumbnail_url?: string;
  external_url: string;
  source: 'spotify' | 'youtube';
  confidence_score: number;
  recommendation_reason: string;
  audio_features?: {
    energy: number;
    danceability: number;
    valence: number;
    tempo: number;
  };
}

export class RecommendationService {
  /**
   * Get personalized recommendations for a user
   */
  public static async getPersonalizedRecommendations(
    userId: string,
    barId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const { limit = 20 } = options;
    const cacheKey = `recommendations:personalized:${userId}:${barId}:${limit}`;

    try {
      // Check cache first
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get user preferences
      const userPreferences = await this.getUserPreferences(userId);
      
      // Get bar context (popular songs, recent plays)
      const barContext = await this.getBarContext(barId);

      // Generate recommendations from multiple sources
      const recommendations: RecommendationResult[] = [];

      // 1. Spotify-based recommendations (60% of results)
      const spotifyLimit = Math.ceil(limit * 0.6);
      try {
        const spotifyRecs = await this.getSpotifyRecommendations(
          userPreferences,
          barContext,
          { limit: spotifyLimit }
        );
        recommendations.push(...spotifyRecs);
      } catch (error) {
        console.error('Spotify recommendations failed:', error);
      }

      // 2. Collaborative filtering recommendations (25% of results)
      const collaborativeLimit = Math.ceil(limit * 0.25);
      try {
        const collaborativeRecs = await this.getCollaborativeRecommendations(
          userId,
          barId,
          { limit: collaborativeLimit }
        );
        recommendations.push(...collaborativeRecs);
      } catch (error) {
        console.error('Collaborative recommendations failed:', error);
      }

      // 3. Content-based recommendations (15% of results)
      const contentLimit = Math.ceil(limit * 0.15);
      try {
        const contentRecs = await this.getContentBasedRecommendations(
          userPreferences,
          { limit: contentLimit }
        );
        recommendations.push(...contentRecs);
      } catch (error) {
        console.error('Content-based recommendations failed:', error);
      }

      // Remove duplicates and sort by confidence score
      const uniqueRecommendations = this.deduplicateRecommendations(recommendations)
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, limit);

      // Cache for 30 minutes
      await redisHelpers.set(cacheKey, uniqueRecommendations, 1800);

      return uniqueRecommendations;
    } catch (error) {
      console.error('Get personalized recommendations error:', error);
      throw new Error('Failed to get personalized recommendations');
    }
  }

  /**
   * Get popular recommendations based on bar activity
   */
  public static async getPopularRecommendations(
    barId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const { limit = 20 } = options;
    const cacheKey = `recommendations:popular:${barId}:${limit}`;

    try {
      // Check cache first
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get popular songs in this bar
      const popularSongs = await MusicService.getPopularSongs(barId, { limit: limit * 2 });
      
      if (popularSongs.length === 0) {
        // Fallback to trending songs
        const trendingSongs = await MusicService.getTrendingSongs({ limit });
        const recommendations = trendingSongs.map(song => ({
          ...song,
          song_id: song.id,
          confidence_score: 0.7,
          recommendation_reason: 'Trending globally'
        }));
        
        await redisHelpers.set(cacheKey, recommendations, 1800);
        return recommendations;
      }

      // Get similar songs to popular ones
      const recommendations: RecommendationResult[] = [];
      const seedTracks = popularSongs.slice(0, 5).map(song => song.id);

      try {
        // Use Spotify to find similar tracks
        const spotifyRecs = await SpotifyService.getRecommendations({
          seed_tracks: seedTracks.filter(id => id.startsWith('spotify:')).map(id => id.split(':')[2]),
          limit: limit
        });

        const formattedRecs = spotifyRecs.map(track => ({
          song_id: `spotify:track:${track.id}`,
          title: track.name,
          artist: track.artists[0]?.name || 'Unknown Artist',
          album: track.album?.name,
          duration: Math.floor(track.duration_ms / 1000),
          preview_url: track.preview_url,
          thumbnail_url: track.album?.images?.[0]?.url,
          external_url: track.external_urls?.spotify || '',
          source: 'spotify' as const,
          confidence_score: 0.8,
          recommendation_reason: 'Similar to popular songs in this bar',
          audio_features: track.audio_features
        }));

        recommendations.push(...formattedRecs);
      } catch (error) {
        console.error('Failed to get Spotify recommendations:', error);
      }

      // If we don't have enough recommendations, add some popular songs
      if (recommendations.length < limit) {
        const additionalSongs = popularSongs
          .slice(0, limit - recommendations.length)
          .map(song => ({
            ...song,
            song_id: song.id,
            confidence_score: 0.6,
            recommendation_reason: 'Popular in this bar'
          }));
        
        recommendations.push(...additionalSongs);
      }

      const uniqueRecommendations = this.deduplicateRecommendations(recommendations)
        .slice(0, limit);

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, uniqueRecommendations, 3600);

      return uniqueRecommendations;
    } catch (error) {
      console.error('Get popular recommendations error:', error);
      throw new Error('Failed to get popular recommendations');
    }
  }

  /**
   * Get recommendations based on current queue context
   */
  public static async getQueueBasedRecommendations(
    barId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const { limit = 10 } = options;
    const cacheKey = `recommendations:queue:${barId}:${limit}`;

    try {
      // Check cache first
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get current queue
      const currentQueue = await Queue.getQueue(barId);
      
      if (currentQueue.length === 0) {
        return [];
      }

      // Analyze queue for patterns
      const queueAnalysis = await this.analyzeQueue(currentQueue);
      
      // Get recommendations based on queue analysis
      const recommendations = await this.getSpotifyRecommendations(
        {
          genres: queueAnalysis.dominant_genres,
          artists: queueAnalysis.frequent_artists,
          audio_features: queueAnalysis.average_audio_features,
          listening_history: []
        },
        { recent_songs: currentQueue },
        { limit }
      );

      // Cache for 10 minutes (shorter cache for queue-based)
      await redisHelpers.set(cacheKey, recommendations, 600);

      return recommendations;
    } catch (error) {
      console.error('Get queue-based recommendations error:', error);
      throw new Error('Failed to get queue-based recommendations');
    }
  }

  /**
   * Get user preferences from listening history and explicit preferences
   */
  private static async getUserPreferences(userId: string): Promise<UserPreferences> {
    const cacheKey = `user_preferences:${userId}`;
    
    try {
      // Check cache first
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get listening history
      const listeningHistory = await Queue.getUserListeningHistory(userId, { limit: 100 });
      
      // Analyze listening patterns
      const genreCount = new Map<string, number>();
      const artistCount = new Map<string, number>();
      const audioFeatures = {
        energy: 0,
        danceability: 0,
        valence: 0,
        tempo: 0,
        count: 0
      };

      for (const entry of listeningHistory) {
        try {
          const songDetails = await MusicService.getSongDetails(entry.song_id, entry.bar_id);
          
          // Count genres (would need to be extracted from song metadata)
          // This is simplified - in reality you'd need genre classification
          
          // Count artists
          const artist = songDetails.artist;
          artistCount.set(artist, (artistCount.get(artist) || 0) + 1);
          
          // Aggregate audio features
          if (songDetails.audio_features) {
            audioFeatures.energy += songDetails.audio_features.energy;
            audioFeatures.danceability += songDetails.audio_features.danceability;
            audioFeatures.valence += songDetails.audio_features.valence;
            audioFeatures.tempo += songDetails.audio_features.tempo;
            audioFeatures.count++;
          }
        } catch (error) {
          console.error(`Failed to analyze song ${entry.song_id}:`, error);
        }
      }

      // Calculate averages
      const avgAudioFeatures = audioFeatures.count > 0 ? {
        energy: audioFeatures.energy / audioFeatures.count,
        danceability: audioFeatures.danceability / audioFeatures.count,
        valence: audioFeatures.valence / audioFeatures.count,
        tempo: audioFeatures.tempo / audioFeatures.count
      } : {
        energy: 0.5,
        danceability: 0.5,
        valence: 0.5,
        tempo: 120
      };

      const preferences: UserPreferences = {
        genres: Array.from(genreCount.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([genre]) => genre),
        artists: Array.from(artistCount.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([artist]) => artist),
        audio_features: avgAudioFeatures,
        listening_history: listeningHistory.map(entry => ({
          song_id: entry.song_id,
          played_at: entry.played_at,
          rating: entry.rating
        }))
      };

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, preferences, 3600);

      return preferences;
    } catch (error) {
      console.error('Get user preferences error:', error);
      // Return default preferences
      return {
        genres: [],
        artists: [],
        audio_features: {
          energy: 0.5,
          danceability: 0.5,
          valence: 0.5,
          tempo: 120
        },
        listening_history: []
      };
    }
  }

  /**
   * Get bar context for recommendations
   */
  private static async getBarContext(barId: string): Promise<any> {
    try {
      const [popularSongs, recentSongs] = await Promise.all([
        MusicService.getPopularSongs(barId, { limit: 10 }),
        MusicService.getRecentSongs(barId, { limit: 20 })
      ]);

      return {
        popular_songs: popularSongs,
        recent_songs: recentSongs
      };
    } catch (error) {
      console.error('Get bar context error:', error);
      return {
        popular_songs: [],
        recent_songs: []
      };
    }
  }

  /**
   * Get Spotify-based recommendations
   */
  private static async getSpotifyRecommendations(
    userPreferences: UserPreferences,
    barContext: any,
    options: RecommendationOptions
  ): Promise<RecommendationResult[]> {
    try {
      const seedTracks = userPreferences.listening_history
        .slice(0, 2)
        .map(entry => entry.song_id)
        .filter(id => id.startsWith('spotify:'))
        .map(id => id.split(':')[2]);

      const seedArtists = userPreferences.artists
        .slice(0, 2)
        .map(artist => artist.replace(/\s+/g, '').toLowerCase());

      const seedGenres = userPreferences.genres.slice(0, 1);

      const spotifyRecs = await SpotifyService.getRecommendations({
        seed_tracks: seedTracks,
        seed_artists: seedArtists,
        seed_genres: seedGenres,
        target_energy: userPreferences.audio_features.energy,
        target_danceability: userPreferences.audio_features.danceability,
        target_valence: userPreferences.audio_features.valence,
        target_tempo: userPreferences.audio_features.tempo,
        limit: options.limit || 10
      });

      return spotifyRecs.map(track => ({
        song_id: `spotify:track:${track.id}`,
        title: track.name,
        artist: track.artists[0]?.name || 'Unknown Artist',
        album: track.album?.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        thumbnail_url: track.album?.images?.[0]?.url,
        external_url: track.external_urls?.spotify || '',
        source: 'spotify' as const,
        confidence_score: 0.9,
        recommendation_reason: 'Based on your listening preferences',
        audio_features: track.audio_features
      }));
    } catch (error) {
      console.error('Spotify recommendations error:', error);
      return [];
    }
  }

  /**
   * Get collaborative filtering recommendations
   */
  private static async getCollaborativeRecommendations(
    userId: string,
    barId: string,
    options: RecommendationOptions
  ): Promise<RecommendationResult[]> {
    try {
      // Find users with similar listening patterns
      const similarUsers = await this.findSimilarUsers(userId, barId);
      
      if (similarUsers.length === 0) {
        return [];
      }

      // Get songs liked by similar users but not by current user
      const userHistory = await Queue.getUserListeningHistory(userId, { limit: 200 });
      const userSongIds = new Set(userHistory.map(entry => entry.song_id));

      const recommendations: RecommendationResult[] = [];
      
      for (const similarUser of similarUsers.slice(0, 5)) {
        const similarUserHistory = await Queue.getUserListeningHistory(similarUser.user_id, { limit: 50 });
        
        for (const entry of similarUserHistory) {
          if (!userSongIds.has(entry.song_id) && recommendations.length < (options.limit || 10)) {
            try {
              const songDetails = await MusicService.getSongDetails(entry.song_id, barId);
              recommendations.push({
                ...songDetails,
                song_id: songDetails.id,
                confidence_score: 0.7 * similarUser.similarity_score,
                recommendation_reason: `Users with similar taste also liked this`
              });
            } catch (error) {
              console.error(`Failed to get song details for ${entry.song_id}:`, error);
            }
          }
        }
      }

      return recommendations;
    } catch (error) {
      console.error('Collaborative recommendations error:', error);
      return [];
    }
  }

  /**
   * Get content-based recommendations
   */
  private static async getContentBasedRecommendations(
    userPreferences: UserPreferences,
    options: RecommendationOptions
  ): Promise<RecommendationResult[]> {
    try {
      // This is a simplified content-based approach
      // In a real system, you'd use more sophisticated content analysis
      
      const recommendations: RecommendationResult[] = [];
      
      // Search for songs by preferred artists
      for (const artist of userPreferences.artists.slice(0, 3)) {
        try {
          const artistSongs = await MusicService.searchSongs(
            artist,
            'content-based',
            { limit: 3, sources: ['spotify'] }
          );
          
          const filteredSongs = artistSongs
            .filter(song => !userPreferences.listening_history.some(h => h.song_id === song.id))
            .map(song => ({
              ...song,
              song_id: song.id,
              confidence_score: 0.6,
              recommendation_reason: `More songs by ${artist}`
            }));
          
          recommendations.push(...filteredSongs);
        } catch (error) {
          console.error(`Failed to get songs for artist ${artist}:`, error);
        }
      }

      return recommendations.slice(0, options.limit || 10);
    } catch (error) {
      console.error('Content-based recommendations error:', error);
      return [];
    }
  }

  /**
   * Find users with similar listening patterns
   */
  private static async findSimilarUsers(
    userId: string,
    barId: string
  ): Promise<Array<{ user_id: string; similarity_score: number }>> {
    try {
      // This is a simplified similarity calculation
      // In production, you'd use more sophisticated algorithms like cosine similarity
      
      const userHistory = await Queue.getUserListeningHistory(userId, { limit: 100 });
      const userSongIds = new Set(userHistory.map(entry => entry.song_id));
      
      // Get other users who have played in this bar
      const otherUsers = await Queue.getBarUsers(barId, { limit: 50 });
      
      const similarities: Array<{ user_id: string; similarity_score: number }> = [];
      
      for (const otherUser of otherUsers) {
        if (otherUser.user_id === userId) continue;
        
        const otherUserHistory = await Queue.getUserListeningHistory(otherUser.user_id, { limit: 100 });
        const otherUserSongIds = new Set(otherUserHistory.map(entry => entry.song_id));
        
        // Calculate Jaccard similarity
        const intersection = new Set([...userSongIds].filter(id => otherUserSongIds.has(id)));
        const union = new Set([...userSongIds, ...otherUserSongIds]);
        
        const similarity = intersection.size / union.size;
        
        if (similarity > 0.1) { // Minimum similarity threshold
          similarities.push({
            user_id: otherUser.user_id,
            similarity_score: similarity
          });
        }
      }
      
      return similarities.sort((a, b) => b.similarity_score - a.similarity_score);
    } catch (error) {
      console.error('Find similar users error:', error);
      return [];
    }
  }

  /**
   * Analyze queue for recommendation patterns
   */
  private static async analyzeQueue(queue: any[]): Promise<any> {
    const genreCount = new Map<string, number>();
    const artistCount = new Map<string, number>();
    const audioFeatures = {
      energy: 0,
      danceability: 0,
      valence: 0,
      tempo: 0,
      count: 0
    };

    for (const entry of queue) {
      try {
        const songDetails = await MusicService.getSongDetails(entry.song_id, entry.bar_id);
        
        // Count artists
        const artist = songDetails.artist;
        artistCount.set(artist, (artistCount.get(artist) || 0) + 1);
        
        // Aggregate audio features
        if (songDetails.audio_features) {
          audioFeatures.energy += songDetails.audio_features.energy;
          audioFeatures.danceability += songDetails.audio_features.danceability;
          audioFeatures.valence += songDetails.audio_features.valence;
          audioFeatures.tempo += songDetails.audio_features.tempo;
          audioFeatures.count++;
        }
      } catch (error) {
        console.error(`Failed to analyze queue song ${entry.song_id}:`, error);
      }
    }

    return {
      dominant_genres: Array.from(genreCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([genre]) => genre),
      frequent_artists: Array.from(artistCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([artist]) => artist),
      average_audio_features: audioFeatures.count > 0 ? {
        energy: audioFeatures.energy / audioFeatures.count,
        danceability: audioFeatures.danceability / audioFeatures.count,
        valence: audioFeatures.valence / audioFeatures.count,
        tempo: audioFeatures.tempo / audioFeatures.count
      } : {
        energy: 0.5,
        danceability: 0.5,
        valence: 0.5,
        tempo: 120
      }
    };
  }

  /**
   * Remove duplicate recommendations
   */
  private static deduplicateRecommendations(recommendations: RecommendationResult[]): RecommendationResult[] {
    const seen = new Set<string>();
    const unique: RecommendationResult[] = [];

    for (const rec of recommendations) {
      const key = `${rec.title.toLowerCase()}:${rec.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      }
    }

    return unique;
  }
}

export default RecommendationService;