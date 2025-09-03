import { MusicService } from '../../../src/services/musicService';
import { SpotifyService } from '../../../src/services/spotifyService';
import { YouTubeService } from '../../../src/services/youtubeService';
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
jest.mock('../../../src/services/youtubeService');
jest.mock('../../../src/models/Queue');
jest.mock('../../../src/models/Song');
jest.mock('../../../../shared/utils/errors');
jest.mock('../../../src/config/redis');

describe('MusicService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchSongs', () => {
    const query = 'test song';
    const barId = 'bar-123';

    it('should search songs from multiple sources successfully', async () => {
      const spotifyResults = [
        {
          id: 'spotify-1',
          title: 'Test Song 1',
          artist: 'Test Artist 1',
          duration: 180,
          preview_url: 'https://spotify.com/preview1',
          external_url: 'https://spotify.com/track1',
          source: 'spotify'
        }
      ];

      const youtubeResults = [
        {
          id: 'youtube-1',
          title: 'Test Song 2',
          artist: 'Test Artist 2',
          duration: 200,
          thumbnail_url: 'https://youtube.com/thumb1',
          external_url: 'https://youtube.com/watch1',
          source: 'youtube'
        }
      ];

      (SpotifyService.searchTracks as jest.Mock).mockResolvedValue(spotifyResults);
      (YouTubeService.searchVideos as jest.Mock).mockResolvedValue(youtubeResults);

      const result = await MusicService.searchSongs(query, barId);

      expect(SpotifyService.searchTracks).toHaveBeenCalledWith(query, { limit: 25 });
      expect(YouTubeService.searchVideos).toHaveBeenCalledWith(query, { maxResults: 25 });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(spotifyResults[0]);
      expect(result[1]).toEqual(youtubeResults[0]);
    });

    it('should handle Spotify service failure gracefully', async () => {
      const youtubeResults = [
        {
          id: 'youtube-1',
          title: 'Test Song',
          artist: 'Test Artist',
          duration: 200,
          source: 'youtube'
        }
      ];

      (SpotifyService.searchTracks as jest.Mock).mockRejectedValue(new Error('Spotify API error'));
      (YouTubeService.searchVideos as jest.Mock).mockResolvedValue(youtubeResults);

      const result = await MusicService.searchSongs(query, barId);

      expect(result).toEqual(youtubeResults);
    });

    it('should handle YouTube service failure gracefully', async () => {
      const spotifyResults = [
        {
          id: 'spotify-1',
          title: 'Test Song',
          artist: 'Test Artist',
          duration: 180,
          source: 'spotify'
        }
      ];

      (SpotifyService.searchTracks as jest.Mock).mockResolvedValue(spotifyResults);
      (YouTubeService.searchVideos as jest.Mock).mockRejectedValue(new Error('YouTube API error'));

      const result = await MusicService.searchSongs(query, barId);

      expect(result).toEqual(spotifyResults);
    });

    it('should throw error when both services fail', async () => {
      (SpotifyService.searchTracks as jest.Mock).mockRejectedValue(new Error('Spotify API error'));
      (YouTubeService.searchVideos as jest.Mock).mockRejectedValue(new Error('YouTube API error'));

      await expect(MusicService.searchSongs(query, barId)).rejects.toThrow(
        expect.objectContaining({
          message: 'All music services are currently unavailable',
          statusCode: 503
        })
      );
    });

    it('should return cached results when available', async () => {
      const cachedResults = [
        {
          id: 'cached-1',
          title: 'Cached Song',
          artist: 'Cached Artist',
          duration: 150,
          source: 'spotify'
        }
      ];

      mockRedisGet(`search:${barId}:${query}`, cachedResults);

      const result = await MusicService.searchSongs(query, barId);

      expect(result).toEqual(cachedResults);
      expect(SpotifyService.searchTracks).not.toHaveBeenCalled();
      expect(YouTubeService.searchVideos).not.toHaveBeenCalled();
    });

    it('should cache search results', async () => {
      const spotifyResults = [
        {
          id: 'spotify-1',
          title: 'Test Song',
          artist: 'Test Artist',
          duration: 180,
          source: 'spotify'
        }
      ];

      (SpotifyService.searchTracks as jest.Mock).mockResolvedValue(spotifyResults);
      (YouTubeService.searchVideos as jest.Mock).mockResolvedValue([]);

      await MusicService.searchSongs(query, barId);

      expect(mockRedisSet).toHaveBeenCalledWith(
        `search:${barId}:${query}`,
        expect.any(String),
        'EX',
        300 // 5 minutes cache
      );
    });
  });

  describe('getSongDetails', () => {
    const songId = 'spotify:track:123';
    const barId = 'bar-123';

    it('should get Spotify song details successfully', async () => {
      const mockSongDetails = {
        id: songId,
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 180,
        preview_url: 'https://spotify.com/preview',
        external_url: 'https://spotify.com/track',
        source: 'spotify',
        genres: ['pop', 'rock'],
        release_date: '2023-01-01'
      };

      (SpotifyService.getTrackDetails as jest.Mock).mockResolvedValue(mockSongDetails);

      const result = await MusicService.getSongDetails(songId, barId);

      expect(SpotifyService.getTrackDetails).toHaveBeenCalledWith(songId.split(':')[2]);
      expect(result).toEqual(mockSongDetails);
    });

    it('should get YouTube song details successfully', async () => {
      const youtubeSongId = 'youtube:video:abc123';
      const mockSongDetails = {
        id: youtubeSongId,
        title: 'Test YouTube Song',
        artist: 'Test YouTube Artist',
        duration: 200,
        thumbnail_url: 'https://youtube.com/thumb',
        external_url: 'https://youtube.com/watch',
        source: 'youtube'
      };

      (YouTubeService.getVideoDetails as jest.Mock).mockResolvedValue(mockSongDetails);

      const result = await MusicService.getSongDetails(youtubeSongId, barId);

      expect(YouTubeService.getVideoDetails).toHaveBeenCalledWith(youtubeSongId.split(':')[2]);
      expect(result).toEqual(mockSongDetails);
    });

    it('should throw error for unsupported source', async () => {
      const unsupportedSongId = 'soundcloud:track:123';

      await expect(MusicService.getSongDetails(unsupportedSongId, barId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unsupported music source: soundcloud',
          statusCode: 400
        })
      );
    });

    it('should handle service errors', async () => {
      (SpotifyService.getTrackDetails as jest.Mock).mockRejectedValue(
        new Error('Track not found')
      );

      await expect(MusicService.getSongDetails(songId, barId)).rejects.toThrow('Track not found');
    });

    it('should return cached song details when available', async () => {
      const cachedDetails = {
        id: songId,
        title: 'Cached Song',
        artist: 'Cached Artist',
        duration: 180,
        source: 'spotify'
      };

      mockRedisGet(`song:${songId}`, cachedDetails);

      const result = await MusicService.getSongDetails(songId, barId);

      expect(result).toEqual(cachedDetails);
      expect(SpotifyService.getTrackDetails).not.toHaveBeenCalled();
    });
  });

  describe('addToQueue', () => {
    const barId = 'bar-123';
    const userId = 'user-456';
    const songData = {
      id: 'spotify:track:123',
      title: 'Test Song',
      artist: 'Test Artist',
      duration: 180,
      source: 'spotify'
    };

    it('should add song to queue successfully', async () => {
      const mockQueueEntry = {
        id: 'queue-123',
        bar_id: barId,
        user_id: userId,
        song_id: songData.id,
        song_title: songData.title,
        song_artist: songData.artist,
        song_duration: songData.duration,
        source: songData.source,
        position: 1,
        status: 'pending',
        created_at: new Date()
      };

      (QueueModel.addToQueue as jest.Mock).mockResolvedValue(mockQueueEntry);
      (SongModel.createOrUpdate as jest.Mock).mockResolvedValue(songData);

      const result = await MusicService.addToQueue(barId, userId, songData);

      expect(SongModel.createOrUpdate).toHaveBeenCalledWith(songData);
      expect(QueueModel.addToQueue).toHaveBeenCalledWith({
        bar_id: barId,
        user_id: userId,
        song_id: songData.id,
        song_title: songData.title,
        song_artist: songData.artist,
        song_duration: songData.duration,
        source: songData.source
      });
      expect(result).toEqual(mockQueueEntry);
    });

    it('should handle duplicate song in queue', async () => {
      (QueueModel.addToQueue as jest.Mock).mockRejectedValue(
        new Error('Song already in queue')
      );

      await expect(MusicService.addToQueue(barId, userId, songData)).rejects.toThrow(
        'Song already in queue'
      );
    });

    it('should handle database errors', async () => {
      (SongModel.createOrUpdate as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(MusicService.addToQueue(barId, userId, songData)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getQueue', () => {
    const barId = 'bar-123';

    it('should get queue successfully', async () => {
      const mockQueue = [
        {
          id: 'queue-1',
          bar_id: barId,
          user_id: 'user-1',
          song_id: 'spotify:track:123',
          song_title: 'Song 1',
          song_artist: 'Artist 1',
          song_duration: 180,
          source: 'spotify',
          position: 1,
          status: 'pending',
          created_at: new Date()
        },
        {
          id: 'queue-2',
          bar_id: barId,
          user_id: 'user-2',
          song_id: 'youtube:video:abc',
          song_title: 'Song 2',
          song_artist: 'Artist 2',
          song_duration: 200,
          source: 'youtube',
          position: 2,
          status: 'pending',
          created_at: new Date()
        }
      ];

      (QueueModel.getQueue as jest.Mock).mockResolvedValue(mockQueue);

      const result = await MusicService.getQueue(barId);

      expect(QueueModel.getQueue).toHaveBeenCalledWith(barId, { limit: 50, status: 'pending' });
      expect(result).toEqual(mockQueue);
    });

    it('should get queue with custom options', async () => {
      const options = { limit: 10, status: 'all' };
      const mockQueue = [];

      (QueueModel.getQueue as jest.Mock).mockResolvedValue(mockQueue);

      const result = await MusicService.getQueue(barId, options);

      expect(QueueModel.getQueue).toHaveBeenCalledWith(barId, options);
      expect(result).toEqual(mockQueue);
    });

    it('should return cached queue when available', async () => {
      const cachedQueue = [
        {
          id: 'queue-cached',
          bar_id: barId,
          song_title: 'Cached Song',
          position: 1
        }
      ];

      mockRedisGet(`queue:${barId}`, cachedQueue);

      const result = await MusicService.getQueue(barId);

      expect(result).toEqual(cachedQueue);
      expect(QueueModel.getQueue).not.toHaveBeenCalled();
    });
  });

  describe('removeFromQueue', () => {
    const queueId = 'queue-123';
    const userId = 'user-456';
    const barId = 'bar-123';

    it('should remove song from queue successfully', async () => {
      const mockQueueEntry = {
        id: queueId,
        bar_id: barId,
        user_id: userId,
        song_title: 'Test Song',
        status: 'pending'
      };

      (QueueModel.findById as jest.Mock).mockResolvedValue(mockQueueEntry);
      (QueueModel.removeFromQueue as jest.Mock).mockResolvedValue(true);

      const result = await MusicService.removeFromQueue(queueId, userId, barId);

      expect(QueueModel.findById).toHaveBeenCalledWith(queueId);
      expect(QueueModel.removeFromQueue).toHaveBeenCalledWith(queueId);
      expect(result).toBe(true);
    });

    it('should throw error if queue entry not found', async () => {
      (QueueModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(MusicService.removeFromQueue(queueId, userId, barId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Queue entry not found',
          statusCode: 404
        })
      );
    });

    it('should throw error if user tries to remove another user\'s song', async () => {
      const mockQueueEntry = {
        id: queueId,
        bar_id: barId,
        user_id: 'different-user',
        song_title: 'Test Song',
        status: 'pending'
      };

      (QueueModel.findById as jest.Mock).mockResolvedValue(mockQueueEntry);

      await expect(MusicService.removeFromQueue(queueId, userId, barId)).rejects.toThrow(
        expect.objectContaining({
          message: 'You can only remove your own songs from the queue',
          statusCode: 403
        })
      );
    });

    it('should throw error if song is already playing', async () => {
      const mockQueueEntry = {
        id: queueId,
        bar_id: barId,
        user_id: userId,
        song_title: 'Test Song',
        status: 'playing'
      };

      (QueueModel.findById as jest.Mock).mockResolvedValue(mockQueueEntry);

      await expect(MusicService.removeFromQueue(queueId, userId, barId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Cannot remove currently playing song',
          statusCode: 400
        })
      );
    });
  });

  describe('updateQueueStatus', () => {
    const queueId = 'queue-123';
    const status = 'playing';
    const barId = 'bar-123';

    it('should update queue status successfully', async () => {
      const mockUpdatedEntry = {
        id: queueId,
        bar_id: barId,
        status: status,
        updated_at: new Date()
      };

      (QueueModel.updateStatus as jest.Mock).mockResolvedValue(mockUpdatedEntry);

      const result = await MusicService.updateQueueStatus(queueId, status, barId);

      expect(QueueModel.updateStatus).toHaveBeenCalledWith(queueId, status);
      expect(result).toEqual(mockUpdatedEntry);
    });

    it('should handle invalid status', async () => {
      const invalidStatus = 'invalid-status';

      await expect(MusicService.updateQueueStatus(queueId, invalidStatus, barId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Invalid queue status',
          statusCode: 400
        })
      );
    });

    it('should handle database errors', async () => {
      (QueueModel.updateStatus as jest.Mock).mockRejectedValue(
        new Error('Database update failed')
      );

      await expect(MusicService.updateQueueStatus(queueId, status, barId)).rejects.toThrow(
        'Database update failed'
      );
    });
  });

  describe('getCurrentSong', () => {
    const barId = 'bar-123';

    it('should get currently playing song successfully', async () => {
      const mockCurrentSong = {
        id: 'queue-123',
        bar_id: barId,
        song_id: 'spotify:track:123',
        song_title: 'Current Song',
        song_artist: 'Current Artist',
        song_duration: 180,
        source: 'spotify',
        status: 'playing',
        started_at: new Date()
      };

      (QueueModel.getCurrentSong as jest.Mock).mockResolvedValue(mockCurrentSong);

      const result = await MusicService.getCurrentSong(barId);

      expect(QueueModel.getCurrentSong).toHaveBeenCalledWith(barId);
      expect(result).toEqual(mockCurrentSong);
    });

    it('should return null when no song is playing', async () => {
      (QueueModel.getCurrentSong as jest.Mock).mockResolvedValue(null);

      const result = await MusicService.getCurrentSong(barId);

      expect(result).toBeNull();
    });

    it('should return cached current song when available', async () => {
      const cachedSong = {
        id: 'queue-cached',
        bar_id: barId,
        song_title: 'Cached Current Song',
        status: 'playing'
      };

      mockRedisGet(`current_song:${barId}`, cachedSong);

      const result = await MusicService.getCurrentSong(barId);

      expect(result).toEqual(cachedSong);
      expect(QueueModel.getCurrentSong).not.toHaveBeenCalled();
    });
  });

  describe('getPopularSongs', () => {
    const barId = 'bar-123';

    it('should get popular songs successfully', async () => {
      const mockPopularSongs = [
        {
          song_id: 'spotify:track:123',
          song_title: 'Popular Song 1',
          song_artist: 'Popular Artist 1',
          play_count: 50,
          source: 'spotify'
        },
        {
          song_id: 'youtube:video:abc',
          song_title: 'Popular Song 2',
          song_artist: 'Popular Artist 2',
          play_count: 45,
          source: 'youtube'
        }
      ];

      (QueueModel.getPopularSongs as jest.Mock).mockResolvedValue(mockPopularSongs);

      const result = await MusicService.getPopularSongs(barId);

      expect(QueueModel.getPopularSongs).toHaveBeenCalledWith(barId, { limit: 20, timeframe: '7d' });
      expect(result).toEqual(mockPopularSongs);
    });

    it('should get popular songs with custom options', async () => {
      const options = { limit: 10, timeframe: '30d' };
      const mockPopularSongs = [];

      (QueueModel.getPopularSongs as jest.Mock).mockResolvedValue(mockPopularSongs);

      const result = await MusicService.getPopularSongs(barId, options);

      expect(QueueModel.getPopularSongs).toHaveBeenCalledWith(barId, options);
      expect(result).toEqual(mockPopularSongs);
    });

    it('should return cached popular songs when available', async () => {
      const cachedSongs = [
        {
          song_id: 'cached-song',
          song_title: 'Cached Popular Song',
          play_count: 100
        }
      ];

      mockRedisGet(`popular:${barId}:20:7d`, cachedSongs);

      const result = await MusicService.getPopularSongs(barId);

      expect(result).toEqual(cachedSongs);
      expect(QueueModel.getPopularSongs).not.toHaveBeenCalled();
    });
  });

  describe('getUserHistory', () => {
    const userId = 'user-123';
    const barId = 'bar-456';

    it('should get user history successfully', async () => {
      const mockHistory = [
        {
          id: 'queue-1',
          song_id: 'spotify:track:123',
          song_title: 'History Song 1',
          song_artist: 'History Artist 1',
          played_at: new Date(),
          source: 'spotify'
        },
        {
          id: 'queue-2',
          song_id: 'youtube:video:abc',
          song_title: 'History Song 2',
          song_artist: 'History Artist 2',
          played_at: new Date(),
          source: 'youtube'
        }
      ];

      (QueueModel.getUserHistory as jest.Mock).mockResolvedValue(mockHistory);

      const result = await MusicService.getUserHistory(userId, barId);

      expect(QueueModel.getUserHistory).toHaveBeenCalledWith(userId, barId, { limit: 50 });
      expect(result).toEqual(mockHistory);
    });

    it('should get user history with custom limit', async () => {
      const options = { limit: 10 };
      const mockHistory = [];

      (QueueModel.getUserHistory as jest.Mock).mockResolvedValue(mockHistory);

      const result = await MusicService.getUserHistory(userId, barId, options);

      expect(QueueModel.getUserHistory).toHaveBeenCalledWith(userId, barId, options);
      expect(result).toEqual(mockHistory);
    });
  });

  describe('clearCache', () => {
    const barId = 'bar-123';

    it('should clear all cache for a bar', async () => {
      await MusicService.clearCache(barId);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `queue:${barId}`,
        `current_song:${barId}`,
        `popular:${barId}:*`
      );
    });

    it('should handle cache clearing errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw error
      await expect(MusicService.clearCache(barId)).resolves.not.toThrow();
    });
  });
});