import request from 'supertest';
import express from 'express';
import { MusicService } from '../../../src/services/musicService';
import { authenticateToken } from '../../../src/middleware/auth';
import { handleValidationErrors } from '../../../src/middleware/validation';
import musicRoutes from '../../../src/routes/songs';
import queueRoutes from '../../../src/routes/queue';
import {
  mockRequest,
  mockResponse,
  createTestUser,
  createTestBar,
  createTestSong,
  createTestQueueEntry
} from '../../setup';

// Mock dependencies
jest.mock('../../../src/services/musicService');
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/middleware/validation');

// Create mock references
const authMiddleware = authenticateToken as jest.Mock;
const validateRequest = handleValidationErrors as jest.Mock;

describe('Music Routes Integration', () => {
  let app: express.Application;
  const mockUser = createTestUser();
  const mockBar = createTestBar();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock middleware
    (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
    
    (handleValidationErrors as jest.Mock).mockImplementation((req, res, next) => {
      next();
    });
    
    // Mount routes
    app.use('/api/music/songs', musicRoutes);
    app.use('/api/music/queue', queueRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Song Routes', () => {
    describe('GET /api/music/songs/search', () => {
      it('should search songs successfully', async () => {
        const mockSearchResults = [
          createTestSong({ id: 'spotify:track:123', title: 'Test Song 1' }),
          createTestSong({ id: 'youtube:video:abc', title: 'Test Song 2', source: 'youtube' })
        ];

        (MusicService.searchSongs as jest.Mock).mockResolvedValue(mockSearchResults);

        const response = await request(app)
          .get('/api/music/songs/search')
          .query({ q: 'test song', barId: mockBar.id })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockSearchResults,
          pagination: {
            total: 2,
            page: 1,
            limit: 50,
            totalPages: 1
          }
        });

        expect(MusicService.searchSongs).toHaveBeenCalledWith(
          'test song',
          mockBar.id,
          { limit: 50, offset: 0 }
        );
      });

      it('should handle missing query parameter', async () => {
        const response = await request(app)
          .get('/api/music/songs/search')
          .query({ barId: mockBar.id })
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: 'Search query is required'
        });
      });

      it('should handle missing barId parameter', async () => {
        const response = await request(app)
          .get('/api/music/songs/search')
          .query({ q: 'test song' })
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: 'Bar ID is required'
        });
      });

      it('should handle service errors', async () => {
        (MusicService.searchSongs as jest.Mock).mockRejectedValue(
          new Error('Service unavailable')
        );

        const response = await request(app)
          .get('/api/music/songs/search')
          .query({ q: 'test song', barId: mockBar.id })
          .expect(500);

        expect(response.body).toEqual({
          success: false,
          error: 'Internal server error'
        });
      });

      it('should handle pagination parameters', async () => {
        const mockSearchResults = [createTestSong()];

        (MusicService.searchSongs as jest.Mock).mockResolvedValue(mockSearchResults);

        await request(app)
          .get('/api/music/songs/search')
          .query({ 
            q: 'test song', 
            barId: mockBar.id,
            page: '2',
            limit: '10'
          })
          .expect(200);

        expect(MusicService.searchSongs).toHaveBeenCalledWith(
          'test song',
          mockBar.id,
          { limit: 10, offset: 10 }
        );
      });
    });

    describe('GET /api/music/songs/:songId', () => {
      it('should get song details successfully', async () => {
        const mockSong = createTestSong({ id: 'spotify:track:123' });

        (MusicService.getSongDetails as jest.Mock).mockResolvedValue(mockSong);

        const response = await request(app)
          .get('/api/music/songs/spotify:track:123')
          .query({ barId: mockBar.id })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockSong
        });

        expect(MusicService.getSongDetails).toHaveBeenCalledWith(
          'spotify:track:123',
          mockBar.id
        );
      });

      it('should handle song not found', async () => {
        (MusicService.getSongDetails as jest.Mock).mockRejectedValue(
          Object.assign(new Error('Song not found'), { statusCode: 404 })
        );

        const response = await request(app)
          .get('/api/music/songs/spotify:track:nonexistent')
          .query({ barId: mockBar.id })
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          error: 'Song not found'
        });
      });

      it('should handle missing barId parameter', async () => {
        const response = await request(app)
          .get('/api/music/songs/spotify:track:123')
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: 'Bar ID is required'
        });
      });
    });

    describe('GET /api/music/songs/popular/:barId', () => {
      it('should get popular songs successfully', async () => {
        const mockPopularSongs = [
          createTestSong({ id: 'spotify:track:123', title: 'Popular Song 1' }),
          createTestSong({ id: 'spotify:track:456', title: 'Popular Song 2' })
        ];

        (MusicService.getPopularSongs as jest.Mock).mockResolvedValue(mockPopularSongs);

        const response = await request(app)
          .get(`/api/music/songs/popular/${mockBar.id}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockPopularSongs
        });

        expect(MusicService.getPopularSongs).toHaveBeenCalledWith(
          mockBar.id,
          { limit: 20, timeframe: '7d' }
        );
      });

      it('should handle custom options', async () => {
        (MusicService.getPopularSongs as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get(`/api/music/songs/popular/${mockBar.id}`)
          .query({ limit: '10', timeframe: '30d' })
          .expect(200);

        expect(MusicService.getPopularSongs).toHaveBeenCalledWith(
          mockBar.id,
          { limit: 10, timeframe: '30d' }
        );
      });
    });
  });

  describe('Queue Routes', () => {
    describe('GET /api/music/queue/:barId', () => {
      it('should get queue successfully', async () => {
        const mockQueue = [
          createTestQueueEntry({ id: 'queue-1', position: 1 }),
          createTestQueueEntry({ id: 'queue-2', position: 2 })
        ];

        (MusicService.getQueue as jest.Mock).mockResolvedValue(mockQueue);

        const response = await request(app)
          .get(`/api/music/queue/${mockBar.id}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockQueue,
          meta: {
            total: 2,
            currentSong: null
          }
        });

        expect(MusicService.getQueue).toHaveBeenCalledWith(
          mockBar.id,
          { limit: 50, status: 'pending' }
        );
      });

      it('should handle custom status filter', async () => {
        (MusicService.getQueue as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get(`/api/music/queue/${mockBar.id}`)
          .query({ status: 'all', limit: '10' })
          .expect(200);

        expect(MusicService.getQueue).toHaveBeenCalledWith(
          mockBar.id,
          { limit: 10, status: 'all' }
        );
      });
    });

    describe('POST /api/music/queue/:barId/add', () => {
      it('should add song to queue successfully', async () => {
        const songData = {
          id: 'spotify:track:123',
          title: 'Test Song',
          artist: 'Test Artist',
          duration: 180,
          source: 'spotify'
        };

        const mockQueueEntry = createTestQueueEntry({
          song_id: songData.id,
          song_title: songData.title,
          song_artist: songData.artist
        });

        (MusicService.addToQueue as jest.Mock).mockResolvedValue(mockQueueEntry);

        const response = await request(app)
          .post(`/api/music/queue/${mockBar.id}/add`)
          .send(songData)
          .expect(201);

        expect(response.body).toEqual({
          success: true,
          data: mockQueueEntry,
          message: 'Song added to queue successfully'
        });

        expect(MusicService.addToQueue).toHaveBeenCalledWith(
          mockBar.id,
          mockUser.id,
          songData
        );
      });

      it('should handle missing song data', async () => {
        const response = await request(app)
          .post(`/api/music/queue/${mockBar.id}/add`)
          .send({})
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: 'Song data is required'
        });
      });

      it('should handle duplicate song error', async () => {
        const songData = {
          id: 'spotify:track:123',
          title: 'Test Song',
          artist: 'Test Artist',
          duration: 180,
          source: 'spotify'
        };

        (MusicService.addToQueue as jest.Mock).mockRejectedValue(
          Object.assign(new Error('Song already in queue'), { statusCode: 409 })
        );

        const response = await request(app)
          .post(`/api/music/queue/${mockBar.id}/add`)
          .send(songData)
          .expect(409);

        expect(response.body).toEqual({
          success: false,
          error: 'Song already in queue'
        });
      });
    });

    describe('DELETE /api/music/queue/:barId/:queueId', () => {
      it('should remove song from queue successfully', async () => {
        (MusicService.removeFromQueue as jest.Mock).mockResolvedValue(true);

        const response = await request(app)
          .delete(`/api/music/queue/${mockBar.id}/queue-123`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Song removed from queue successfully'
        });

        expect(MusicService.removeFromQueue).toHaveBeenCalledWith(
          'queue-123',
          mockUser.id,
          mockBar.id
        );
      });

      it('should handle queue entry not found', async () => {
        (MusicService.removeFromQueue as jest.Mock).mockRejectedValue(
          Object.assign(new Error('Queue entry not found'), { statusCode: 404 })
        );

        const response = await request(app)
          .delete(`/api/music/queue/${mockBar.id}/nonexistent`)
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          error: 'Queue entry not found'
        });
      });

      it('should handle permission denied', async () => {
        (MusicService.removeFromQueue as jest.Mock).mockRejectedValue(
          Object.assign(new Error('You can only remove your own songs'), { statusCode: 403 })
        );

        const response = await request(app)
          .delete(`/api/music/queue/${mockBar.id}/queue-123`)
          .expect(403);

        expect(response.body).toEqual({
          success: false,
          error: 'You can only remove your own songs'
        });
      });
    });

    describe('PATCH /api/music/queue/:barId/:queueId/status', () => {
      it('should update queue status successfully', async () => {
        const mockUpdatedEntry = createTestQueueEntry({
          id: 'queue-123',
          status: 'playing'
        });

        (MusicService.updateQueueStatus as jest.Mock).mockResolvedValue(mockUpdatedEntry);

        const response = await request(app)
          .patch(`/api/music/queue/${mockBar.id}/queue-123/status`)
          .send({ status: 'playing' })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockUpdatedEntry,
          message: 'Queue status updated successfully'
        });

        expect(MusicService.updateQueueStatus).toHaveBeenCalledWith(
          'queue-123',
          'playing',
          mockBar.id
        );
      });

      it('should handle invalid status', async () => {
        const response = await request(app)
          .patch(`/api/music/queue/${mockBar.id}/queue-123/status`)
          .send({ status: 'invalid-status' })
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: 'Invalid status. Must be one of: pending, playing, completed, skipped'
        });
      });

      it('should handle missing status', async () => {
        const response = await request(app)
          .patch(`/api/music/queue/${mockBar.id}/queue-123/status`)
          .send({})
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: 'Status is required'
        });
      });
    });

    describe('GET /api/music/queue/:barId/current', () => {
      it('should get current song successfully', async () => {
        const mockCurrentSong = createTestQueueEntry({
          status: 'playing',
          started_at: new Date()
        });

        (MusicService.getCurrentSong as jest.Mock).mockResolvedValue(mockCurrentSong);

        const response = await request(app)
          .get(`/api/music/queue/${mockBar.id}/current`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockCurrentSong
        });

        expect(MusicService.getCurrentSong).toHaveBeenCalledWith(mockBar.id);
      });

      it('should handle no current song', async () => {
        (MusicService.getCurrentSong as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/music/queue/${mockBar.id}/current`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: null,
          message: 'No song currently playing'
        });
      });
    });

    describe('GET /api/music/queue/:barId/history', () => {
      it('should get user queue history successfully', async () => {
        const mockHistory = [
          createTestQueueEntry({ id: 'queue-1', status: 'completed' }),
          createTestQueueEntry({ id: 'queue-2', status: 'completed' })
        ];

        (MusicService.getUserHistory as jest.Mock).mockResolvedValue(mockHistory);

        const response = await request(app)
          .get(`/api/music/queue/${mockBar.id}/history`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockHistory,
          pagination: {
            total: 2,
            page: 1,
            limit: 50,
            totalPages: 1
          }
        });

        expect(MusicService.getUserHistory).toHaveBeenCalledWith(
          mockUser.id,
          mockBar.id,
          { limit: 50, offset: 0 }
        );
      });

      it('should handle pagination parameters', async () => {
        (MusicService.getUserHistory as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get(`/api/music/queue/${mockBar.id}/history`)
          .query({ page: '2', limit: '10' })
          .expect(200);

        expect(MusicService.getUserHistory).toHaveBeenCalledWith(
          mockUser.id,
          mockBar.id,
          { limit: 10, offset: 10 }
        );
      });
    });

    describe('DELETE /api/music/queue/:barId/cache', () => {
      it('should clear queue cache successfully', async () => {
        (MusicService.clearCache as jest.Mock).mockResolvedValue(undefined);

        const response = await request(app)
          .delete(`/api/music/queue/${mockBar.id}/cache`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Queue cache cleared successfully'
        });

        expect(MusicService.clearCache).toHaveBeenCalledWith(mockBar.id);
      });

      it('should handle cache clearing errors', async () => {
        (MusicService.clearCache as jest.Mock).mockRejectedValue(
          new Error('Cache clearing failed')
        );

        const response = await request(app)
          .delete(`/api/music/queue/${mockBar.id}/cache`)
          .expect(500);

        expect(response.body).toEqual({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });

  describe('Authentication Middleware', () => {
    it('should require authentication for protected routes', async () => {
      // Mock auth middleware to simulate unauthenticated request
      (authMiddleware as jest.Mock).mockImplementationOnce((req, res, next) => {
        res.status(401).json({ success: false, error: 'Authentication required' });
      });

      const response = await request(app)
        .get('/api/music/songs/search')
        .query({ q: 'test', barId: mockBar.id })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      (MusicService.searchSongs as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const response = await request(app)
        .get('/api/music/songs/search')
        .query({ q: 'test', barId: mockBar.id })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle validation errors', async () => {
      // Mock validation middleware to simulate validation error
      (validateRequest as jest.Mock).mockImplementationOnce((schema) => (req, res, next) => {
        res.status(400).json({ 
          success: false, 
          error: 'Validation failed',
          details: ['Invalid request format']
        });
      });

      const response = await request(app)
        .post(`/api/music/queue/${mockBar.id}/add`)
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: ['Invalid request format']
      });
    });
  });
});