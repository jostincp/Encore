import { RecommendationService } from '../../../src/services/recommendationService';
import { SpotifyService } from '../../../src/services/spotifyService';
import { QueueModel } from '../../../src/models/Queue';
import { SongModel } from '../../../src/models/Song';
import { AppError } from '../../../../shared/utils/errors';
import {
  mockDbQuery,
  mockDbError,
  mockRedisGet,
  mockRedisSet,
  expectError
} from '../../setup';

// Mock dependencies
jest.mock('../../../src/services/spotifyService');
jest.mock('../../../src/models/Queue');
jest.mock('../../../src/models/Song');
jest.mock('../../../../shared/utils/errors');
jest.mock('../../../src/config/redis');

describe('RecommendationService', () => {
  let recommendationService: RecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    recommendationService = new RecommendationService();
  });

  describe('getPersonalizedRecommendations', () => {
    const userId = 'user-123';
    const barId = 'bar-456';
    const filters = {
      limit: 10,
      genres: ['pop', 'rock'],
      minEnergy: 0.5,
      maxEnergy: 0.9
    };

    it('should get personalized recommendations successfully', async () => {
      const mockUserPreferences = {
        userId,
        topGenres: ['pop', 'rock', 'indie'],
        topArtists: ['Artist 1', 'Artist 2'],
        energyLevel: 0.7,
        danceability: 0.6,
        valence: 0.8
      };

      const mockDbRecommendations = [
        {
          id: 'spotify:track:123',
          title: 'DB Song 1',
          artist: 'DB Artist 1',
          duration: 180,
          source: 'spotify',
          score: 0.9
        }
      ];

      const mockSpotifyRecommendations = [
        {
          id: 'spotify:track:456',
          title: 'Spotify Song 1',
          artist: 'Spotify Artist 1',
          duration: 200,
          source: 'spotify',
          score: 0.8
        }
      ];

      jest.spyOn(recommendationService, 'getUserPreferences')
        .mockResolvedValue(mockUserPreferences);
      jest.spyOn(recommendationService, 'getDatabaseRecommendations')
        .mockResolvedValue(mockDbRecommendations);
      jest.spyOn(recommendationService, 'getSpotifyRecommendations')
        .mockResolvedValue(mockSpotifyRecommendations);
      jest.spyOn(recommendationService, 'scoreRecommendations')
        .mockImplementation((songs) => songs.map(song => ({ ...song, score: 0.85 })));
      jest.spyOn(recommendationService, 'deduplicateRecommendations')
        .mockImplementation((songs) => songs);

      const result = await recommendationService.getPersonalizedRecommendations(
        userId,
        barId,
        filters
      );

      expect(recommendationService.getUserPreferences).toHaveBeenCalledWith(userId, barId);
      expect(recommendationService.getDatabaseRecommendations)
        .toHaveBeenCalledWith(userId, barId, mockUserPreferences, filters);
      expect(recommendationService.getSpotifyRecommendations)
        .toHaveBeenCalledWith(mockUserPreferences, filters);
      expect(result).toHaveLength(2);
      expect(result[0].score).toBeDefined();
      expect(result[0].reason).toBeDefined();
    });

    it('should return cached recommendations when available', async () => {
      const cachedRecommendations = [
        {
          id: 'cached-1',
          title: 'Cached Song',
          artist: 'Cached Artist',
          score: 0.9,
          reason: 'Based on your listening history'
        }
      ];

      mockRedisGet(`recommendations:${userId}:${barId}`, cachedRecommendations);

      const result = await recommendationService.getPersonalizedRecommendations(
        userId,
        barId,
        filters
      );

      expect(result).toEqual(cachedRecommendations);
      expect(recommendationService.getUserPreferences).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(recommendationService, 'getUserPreferences')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        recommendationService.getPersonalizedRecommendations(userId, barId, filters)
      ).rejects.toThrow('Database error');
    });

    it('should cache recommendations after generation', async () => {
      const mockUserPreferences = {
        userId,
        topGenres: ['pop'],
        topArtists: ['Artist 1'],
        energyLevel: 0.7,
        danceability: 0.6,
        valence: 0.8
      };

      jest.spyOn(recommendationService, 'getUserPreferences')
        .mockResolvedValue(mockUserPreferences);
      jest.spyOn(recommendationService, 'getDatabaseRecommendations')
        .mockResolvedValue([]);
      jest.spyOn(recommendationService, 'getSpotifyRecommendations')
        .mockResolvedValue([]);
      jest.spyOn(recommendationService, 'scoreRecommendations')
        .mockReturnValue([]);
      jest.spyOn(recommendationService, 'deduplicateRecommendations')
        .mockReturnValue([]);

      await recommendationService.getPersonalizedRecommendations(userId, barId, filters);

      expect(mockRedisSet).toHaveBeenCalledWith(
        `recommendations:${userId}:${barId}`,
        expect.any(String),
        'EX',
        1800 // 30 minutes
      );
    });
  });

  describe('getPopularRecommendations', () => {
    const barId = 'bar-456';
    const filters = { limit: 20 };

    it('should get popular recommendations successfully', async () => {
      const mockPopularSongs = [
        {
          id: 'spotify:track:123',
          title: 'Popular Song 1',
          artist: 'Popular Artist 1',
          duration: 180,
          source: 'spotify',
          play_count: 50
        },
        {
          id: 'spotify:track:456',
          title: 'Popular Song 2',
          artist: 'Popular Artist 2',
          duration: 200,
          source: 'spotify',
          play_count: 45
        }
      ];

      const mockTrendingSongs = [
        {
          id: 'spotify:track:789',
          title: 'Trending Song 1',
          artist: 'Trending Artist 1',
          duration: 190,
          source: 'spotify'
        }
      ];

      jest.spyOn(recommendationService, 'getPopularSongsFromQueue')
        .mockResolvedValue(mockPopularSongs);
      jest.spyOn(recommendationService, 'getTrendingSongs')
        .mockResolvedValue(mockTrendingSongs);
      jest.spyOn(recommendationService, 'deduplicateRecommendations')
        .mockImplementation((songs) => songs);

      const result = await recommendationService.getPopularRecommendations(barId, filters);

      expect(recommendationService.getPopularSongsFromQueue)
        .toHaveBeenCalledWith(barId, { limit: 15 });
      expect(recommendationService.getTrendingSongs)
        .toHaveBeenCalledWith({ limit: 10 });
      expect(result).toHaveLength(3);
      expect(result[0].reason).toContain('popular');
    });

    it('should return cached popular recommendations when available', async () => {
      const cachedRecommendations = [
        {
          id: 'cached-popular-1',
          title: 'Cached Popular Song',
          artist: 'Cached Popular Artist',
          reason: 'Popular in this bar'
        }
      ];

      mockRedisGet(`popular_recommendations:${barId}`, cachedRecommendations);

      const result = await recommendationService.getPopularRecommendations(barId, filters);

      expect(result).toEqual(cachedRecommendations);
      expect(recommendationService.getPopularSongsFromQueue).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      jest.spyOn(recommendationService, 'getPopularSongsFromQueue')
        .mockResolvedValue([]);
      jest.spyOn(recommendationService, 'getTrendingSongs')
        .mockResolvedValue([]);
      jest.spyOn(recommendationService, 'deduplicateRecommendations')
        .mockReturnValue([]);

      const result = await recommendationService.getPopularRecommendations(barId, filters);

      expect(result).toEqual([]);
    });
  });

  describe('getSimilarSongs', () => {
    const songId = 'spotify:track:123';
    const barId = 'bar-456';
    const filters = { limit: 10 };

    it('should get similar songs successfully', async () => {
      const mockSimilarSongs = [
        {
          id: 'spotify:track:456',
          title: 'Similar Song 1',
          artist: 'Similar Artist 1',
          duration: 180,
          source: 'spotify'
        },
        {
          id: 'spotify:track:789',
          title: 'Similar Song 2',
          artist: 'Similar Artist 2',
          duration: 200,
          source: 'spotify'
        }
      ];

      const mockSpotifyRecommendations = [
        {
          id: 'spotify:track:abc',
          title: 'Spotify Similar Song',
          artist: 'Spotify Similar Artist',
          duration: 190,
          source: 'spotify'
        }
      ];

      jest.spyOn(recommendationService, 'findSimilarSongs')
        .mockResolvedValue(mockSimilarSongs);
      jest.spyOn(recommendationService, 'getSpotifyBasedRecommendations')
        .mockResolvedValue(mockSpotifyRecommendations);
      jest.spyOn(recommendationService, 'deduplicateRecommendations')
        .mockImplementation((songs) => songs);
      jest.spyOn(recommendationService, 'getSimilarityReason')
        .mockReturnValue('Similar to your selected song');

      const result = await recommendationService.getSimilarSongs(songId, barId, filters);

      expect(recommendationService.findSimilarSongs)
        .toHaveBeenCalledWith(songId, { limit: 7 });
      expect(recommendationService.getSpotifyBasedRecommendations)
        .toHaveBeenCalledWith(songId, { limit: 8 });
      expect(result).toHaveLength(3);
      expect(result[0].reason).toBe('Similar to your selected song');
    });

    it('should return cached similar songs when available', async () => {
      const cachedSimilarSongs = [
        {
          id: 'cached-similar-1',
          title: 'Cached Similar Song',
          artist: 'Cached Similar Artist',
          reason: 'Similar to your selected song'
        }
      ];

      mockRedisGet(`similar:${songId}:${barId}`, cachedSimilarSongs);

      const result = await recommendationService.getSimilarSongs(songId, barId, filters);

      expect(result).toEqual(cachedSimilarSongs);
      expect(recommendationService.findSimilarSongs).not.toHaveBeenCalled();
    });

    it('should handle invalid song ID', async () => {
      const invalidSongId = 'invalid-song-id';

      await expect(
        recommendationService.getSimilarSongs(invalidSongId, barId, filters)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Invalid song ID format',
          statusCode: 400
        })
      );
    });
  });

  describe('getUserPreferences', () => {
    const userId = 'user-123';
    const barId = 'bar-456';

    it('should get user preferences successfully', async () => {
      const mockQueueHistory = [
        {
          song_id: 'spotify:track:123',
          song_title: 'Song 1',
          song_artist: 'Artist 1',
          genres: ['pop', 'rock'],
          energy: 0.8,
          danceability: 0.7,
          valence: 0.9,
          played_at: new Date()
        },
        {
          song_id: 'spotify:track:456',
          song_title: 'Song 2',
          song_artist: 'Artist 2',
          genres: ['rock', 'indie'],
          energy: 0.6,
          danceability: 0.5,
          valence: 0.7,
          played_at: new Date()
        }
      ];

      (QueueModel.getUserHistory as jest.Mock).mockResolvedValue(mockQueueHistory);

      const result = await recommendationService.getUserPreferences(userId, barId);

      expect(QueueModel.getUserHistory).toHaveBeenCalledWith(
        userId,
        barId,
        { limit: 100, status: 'completed' }
      );
      expect(result.userId).toBe(userId);
      expect(result.topGenres).toContain('rock');
      expect(result.topArtists).toContain('Artist 1');
      expect(result.energyLevel).toBeGreaterThan(0);
      expect(result.danceability).toBeGreaterThan(0);
      expect(result.valence).toBeGreaterThan(0);
    });

    it('should return default preferences for new users', async () => {
      (QueueModel.getUserHistory as jest.Mock).mockResolvedValue([]);

      const result = await recommendationService.getUserPreferences(userId, barId);

      expect(result.userId).toBe(userId);
      expect(result.topGenres).toEqual(['pop', 'rock', 'indie']);
      expect(result.topArtists).toEqual([]);
      expect(result.energyLevel).toBe(0.5);
      expect(result.danceability).toBe(0.5);
      expect(result.valence).toBe(0.5);
    });

    it('should cache user preferences', async () => {
      const mockQueueHistory = [
        {
          song_id: 'spotify:track:123',
          song_title: 'Song 1',
          song_artist: 'Artist 1',
          genres: ['pop'],
          energy: 0.8,
          danceability: 0.7,
          valence: 0.9,
          played_at: new Date()
        }
      ];

      (QueueModel.getUserHistory as jest.Mock).mockResolvedValue(mockQueueHistory);

      await recommendationService.getUserPreferences(userId, barId);

      expect(mockRedisSet).toHaveBeenCalledWith(
        `user_preferences:${userId}:${barId}`,
        expect.any(String),
        'EX',
        3600 // 1 hour
      );
    });
  });

  describe('getDatabaseRecommendations', () => {
    const userId = 'user-123';
    const barId = 'bar-456';
    const userPreferences = {
      userId,
      topGenres: ['pop', 'rock'],
      topArtists: ['Artist 1', 'Artist 2'],
      energyLevel: 0.7,
      danceability: 0.6,
      valence: 0.8
    };
    const filters = { limit: 10 };

    it('should get database recommendations successfully', async () => {
      const mockRecommendations = [
        {
          id: 'spotify:track:123',
          title: 'DB Recommendation 1',
          artist: 'DB Artist 1',
          duration: 180,
          source: 'spotify',
          genres: ['pop'],
          energy: 0.8,
          danceability: 0.7,
          valence: 0.9
        },
        {
          id: 'spotify:track:456',
          title: 'DB Recommendation 2',
          artist: 'DB Artist 2',
          duration: 200,
          source: 'spotify',
          genres: ['rock'],
          energy: 0.6,
          danceability: 0.5,
          valence: 0.7
        }
      ];

      (SongModel.findSimilar as jest.Mock).mockResolvedValue(mockRecommendations);

      const result = await recommendationService.getDatabaseRecommendations(
        userId,
        barId,
        userPreferences,
        filters
      );

      expect(SongModel.findSimilar).toHaveBeenCalledWith({
        genres: userPreferences.topGenres,
        artists: userPreferences.topArtists,
        energyRange: [userPreferences.energyLevel - 0.2, userPreferences.energyLevel + 0.2],
        danceabilityRange: [userPreferences.danceability - 0.2, userPreferences.danceability + 0.2],
        valenceRange: [userPreferences.valence - 0.2, userPreferences.valence + 0.2],
        limit: filters.limit || 10,
        excludeUserId: userId
      });
      expect(result).toEqual(mockRecommendations);
    });

    it('should handle database errors', async () => {
      (SongModel.findSimilar as jest.Mock).mockRejectedValue(
        new Error('Database query failed')
      );

      await expect(
        recommendationService.getDatabaseRecommendations(
          userId,
          barId,
          userPreferences,
          filters
        )
      ).rejects.toThrow('Database query failed');
    });

    it('should return empty array when no similar songs found', async () => {
      (SongModel.findSimilar as jest.Mock).mockResolvedValue([]);

      const result = await recommendationService.getDatabaseRecommendations(
        userId,
        barId,
        userPreferences,
        filters
      );

      expect(result).toEqual([]);
    });
  });

  describe('getSpotifyRecommendations', () => {
    const userPreferences = {
      userId: 'user-123',
      topGenres: ['pop', 'rock'],
      topArtists: ['Artist 1', 'Artist 2'],
      energyLevel: 0.7,
      danceability: 0.6,
      valence: 0.8
    };
    const filters = { limit: 10 };

    it('should get Spotify recommendations successfully', async () => {
      const mockSpotifyRecommendations = [
        {
          id: 'spotify:track:123',
          title: 'Spotify Recommendation 1',
          artist: 'Spotify Artist 1',
          duration: 180,
          source: 'spotify',
          preview_url: 'https://spotify.com/preview1',
          external_url: 'https://spotify.com/track1'
        },
        {
          id: 'spotify:track:456',
          title: 'Spotify Recommendation 2',
          artist: 'Spotify Artist 2',
          duration: 200,
          source: 'spotify',
          preview_url: 'https://spotify.com/preview2',
          external_url: 'https://spotify.com/track2'
        }
      ];

      (SpotifyService.getRecommendations as jest.Mock).mockResolvedValue(
        mockSpotifyRecommendations
      );

      const result = await recommendationService.getSpotifyRecommendations(
        userPreferences,
        filters
      );

      expect(SpotifyService.getRecommendations).toHaveBeenCalledWith({
        seed_genres: userPreferences.topGenres.slice(0, 2),
        seed_artists: [],
        seed_tracks: [],
        limit: filters.limit || 20,
        target_energy: userPreferences.energyLevel,
        target_danceability: userPreferences.danceability,
        target_valence: userPreferences.valence,
        market: 'US'
      });
      expect(result).toEqual(mockSpotifyRecommendations);
    });

    it('should handle Spotify API errors gracefully', async () => {
      (SpotifyService.getRecommendations as jest.Mock).mockRejectedValue(
        new Error('Spotify API error')
      );

      const result = await recommendationService.getSpotifyRecommendations(
        userPreferences,
        filters
      );

      expect(result).toEqual([]);
    });

    it('should use default values when user preferences are minimal', async () => {
      const minimalPreferences = {
        userId: 'user-123',
        topGenres: [],
        topArtists: [],
        energyLevel: 0.5,
        danceability: 0.5,
        valence: 0.5
      };

      (SpotifyService.getRecommendations as jest.Mock).mockResolvedValue([]);

      await recommendationService.getSpotifyRecommendations(minimalPreferences, filters);

      expect(SpotifyService.getRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          seed_genres: ['pop', 'rock'], // Default genres
          target_energy: 0.5,
          target_danceability: 0.5,
          target_valence: 0.5
        })
      );
    });
  });

  describe('clearUserCache', () => {
    const userId = 'user-123';
    const barId = 'bar-456';

    it('should clear user cache successfully', async () => {
      await recommendationService.clearUserCache(userId, barId);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `recommendations:${userId}:${barId}`,
        `user_preferences:${userId}:${barId}`
      );
    });

    it('should handle cache clearing errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw error
      await expect(
        recommendationService.clearUserCache(userId, barId)
      ).resolves.not.toThrow();
    });
  });

  describe('scoreRecommendations', () => {
    const userPreferences = {
      userId: 'user-123',
      topGenres: ['pop', 'rock'],
      topArtists: ['Artist 1', 'Artist 2'],
      energyLevel: 0.7,
      danceability: 0.6,
      valence: 0.8
    };

    it('should score recommendations based on user preferences', () => {
      const recommendations = [
        {
          id: 'spotify:track:123',
          title: 'Test Song 1',
          artist: 'Artist 1',
          genres: ['pop'],
          energy: 0.8,
          danceability: 0.7,
          valence: 0.9
        },
        {
          id: 'spotify:track:456',
          title: 'Test Song 2',
          artist: 'Unknown Artist',
          genres: ['jazz'],
          energy: 0.3,
          danceability: 0.2,
          valence: 0.4
        }
      ];

      const result = recommendationService.scoreRecommendations(
        recommendations,
        userPreferences
      );

      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThan(result[1].score);
      expect(result[0].score).toBeGreaterThan(0.5); // High match
      expect(result[1].score).toBeLessThan(0.5); // Low match
    });

    it('should handle recommendations without audio features', () => {
      const recommendations = [
        {
          id: 'spotify:track:123',
          title: 'Test Song',
          artist: 'Test Artist'
        }
      ];

      const result = recommendationService.scoreRecommendations(
        recommendations,
        userPreferences
      );

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(0.5); // Default score
    });
  });

  describe('deduplicateRecommendations', () => {
    it('should remove duplicate recommendations', () => {
      const recommendations = [
        {
          id: 'spotify:track:123',
          title: 'Song 1',
          artist: 'Artist 1',
          score: 0.9
        },
        {
          id: 'spotify:track:456',
          title: 'Song 2',
          artist: 'Artist 2',
          score: 0.8
        },
        {
          id: 'spotify:track:123', // Duplicate
          title: 'Song 1',
          artist: 'Artist 1',
          score: 0.7
        }
      ];

      const result = recommendationService.deduplicateRecommendations(recommendations);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('spotify:track:123');
      expect(result[0].score).toBe(0.9); // Higher score kept
      expect(result[1].id).toBe('spotify:track:456');
    });

    it('should handle empty recommendations array', () => {
      const result = recommendationService.deduplicateRecommendations([]);
      expect(result).toEqual([]);
    });
  });

  describe('getRecommendationReason', () => {
    const userPreferences = {
      userId: 'user-123',
      topGenres: ['pop', 'rock'],
      topArtists: ['Artist 1'],
      energyLevel: 0.7,
      danceability: 0.6,
      valence: 0.8
    };

    it('should generate reason based on artist match', () => {
      const song = {
        id: 'spotify:track:123',
        title: 'Test Song',
        artist: 'Artist 1',
        genres: ['pop']
      };

      const reason = recommendationService.getRecommendationReason(song, userPreferences);

      expect(reason).toContain('Artist 1');
      expect(reason).toContain('favorite artist');
    });

    it('should generate reason based on genre match', () => {
      const song = {
        id: 'spotify:track:123',
        title: 'Test Song',
        artist: 'Unknown Artist',
        genres: ['rock']
      };

      const reason = recommendationService.getRecommendationReason(song, userPreferences);

      expect(reason).toContain('rock');
      expect(reason).toContain('genre');
    });

    it('should generate default reason when no specific match', () => {
      const song = {
        id: 'spotify:track:123',
        title: 'Test Song',
        artist: 'Unknown Artist',
        genres: ['jazz']
      };

      const reason = recommendationService.getRecommendationReason(song, userPreferences);

      expect(reason).toContain('listening preferences');
    });
  });

  describe('getSimilarityReason', () => {
    it('should generate similarity reason', () => {
      const reason = recommendationService.getSimilarityReason();

      expect(reason).toContain('Similar');
      expect(reason).toContain('selected song');
    });
  });
});