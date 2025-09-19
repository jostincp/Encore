import request from 'supertest';
import express from 'express';
import { RecommendationService } from '../../../src/services/recommendationService';
import { authenticateToken } from '../../../src/middleware/auth';
import { handleValidationErrors } from '../../../src/middleware/validation';
import recommendationRoutes from '../../../src/routes/recommendations';
import {
  mockRequest,
  mockResponse,
  createTestUser,
  createTestBar,
  createTestSong
} from '../../setup';

// Mock dependencies
jest.mock('../../../src/services/recommendationService');
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/middleware/validation');

describe('Recommendation Routes Integration', () => {
  let app: express.Application;
  const mockUser = createTestUser();
  const mockBar = createTestBar();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock middleware
    (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    (handleValidationErrors as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      next();
    });
    
    // Mount routes
    app.use('/api/music/recommendations', recommendationRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/music/recommendations/personalized', () => {
    it('should get personalized recommendations successfully', async () => {
      const mockRecommendations = [
        {
          ...createTestSong({ id: 'spotify:track:123', title: 'Recommended Song 1' }),
          score: 0.95,
          reason: 'Based on your listening history'
        },
        {
          ...createTestSong({ id: 'spotify:track:456', title: 'Recommended Song 2' }),
          score: 0.87,
          reason: 'Similar to songs you liked'
        }
      ];

      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockResolvedValue(mockRecommendations);

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockRecommendations,
        meta: {
          total: 2,
          algorithm: 'hybrid',
          cached: false
        }
      });

      expect(RecommendationService.getPersonalizedRecommendations)
        .toHaveBeenCalledWith(mockUser.id, mockBar.id, { limit: 20 });
    });

    it('should handle custom limit parameter', async () => {
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id, limit: '10' })
        .expect(200);

      expect(RecommendationService.getPersonalizedRecommendations)
        .toHaveBeenCalledWith(mockUser.id, mockBar.id, { limit: 10 });
    });

    it('should handle missing barId parameter', async () => {
      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Bar ID is required'
      });
    });

    it('should handle service errors', async () => {
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockRejectedValue(new Error('Recommendation service unavailable'));

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle empty recommendations', async () => {
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockResolvedValue([]);

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        meta: {
          total: 0,
          algorithm: 'hybrid',
          cached: false
        },
        message: 'No personalized recommendations available. Try listening to more songs!'
      });
    });
  });

  describe('GET /api/music/recommendations/popular/:barId', () => {
    it('should get popular recommendations successfully', async () => {
      const mockPopularRecommendations = [
        {
          ...createTestSong({ id: 'spotify:track:789', title: 'Popular Song 1' }),
          playCount: 150,
          score: 0.92
        },
        {
          ...createTestSong({ id: 'spotify:track:101', title: 'Popular Song 2' }),
          playCount: 120,
          score: 0.88
        }
      ];

      (RecommendationService.getPopularRecommendations as jest.Mock)
        .mockResolvedValue(mockPopularRecommendations);

      const response = await request(app)
        .get(`/api/music/recommendations/popular/${mockBar.id}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPopularRecommendations,
        meta: {
          total: 2,
          timeframe: '7d',
          cached: false
        }
      });

      expect(RecommendationService.getPopularRecommendations)
        .toHaveBeenCalledWith(mockBar.id, { limit: 20, timeframe: '7d' });
    });

    it('should handle custom timeframe parameter', async () => {
      (RecommendationService.getPopularRecommendations as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get(`/api/music/recommendations/popular/${mockBar.id}`)
        .query({ timeframe: '30d', limit: '15' })
        .expect(200);

      expect(RecommendationService.getPopularRecommendations)
        .toHaveBeenCalledWith(mockBar.id, { limit: 15, timeframe: '30d' });
    });

    it('should handle invalid timeframe parameter', async () => {
      const response = await request(app)
        .get(`/api/music/recommendations/popular/${mockBar.id}`)
        .query({ timeframe: 'invalid' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid timeframe. Must be one of: 1d, 7d, 30d, all'
      });
    });
  });

  describe('GET /api/music/recommendations/similar/:songId', () => {
    it('should get similar songs successfully', async () => {
      const songId = 'spotify:track:123';
      const mockSimilarSongs = [
        {
          ...createTestSong({ id: 'spotify:track:456', title: 'Similar Song 1' }),
          similarity: 0.89,
          reason: 'Same artist'
        },
        {
          ...createTestSong({ id: 'spotify:track:789', title: 'Similar Song 2' }),
          similarity: 0.76,
          reason: 'Similar genre'
        }
      ];

      (RecommendationService.getSimilarSongs as jest.Mock)
        .mockResolvedValue(mockSimilarSongs);

      const response = await request(app)
        .get(`/api/music/recommendations/similar/${songId}`)
        .query({ barId: mockBar.id })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSimilarSongs,
        meta: {
          total: 2,
          baseSong: songId,
          algorithm: 'audio_features'
        }
      });

      expect(RecommendationService.getSimilarSongs)
        .toHaveBeenCalledWith(songId, mockBar.id, { limit: 10 });
    });

    it('should handle custom limit parameter', async () => {
      const songId = 'spotify:track:123';
      (RecommendationService.getSimilarSongs as jest.Mock)
        .mockResolvedValue([]);

      await request(app)
        .get(`/api/music/recommendations/similar/${songId}`)
        .query({ barId: mockBar.id, limit: '5' })
        .expect(200);

      expect(RecommendationService.getSimilarSongs)
        .toHaveBeenCalledWith(songId, mockBar.id, { limit: 5 });
    });

    it('should handle missing barId parameter', async () => {
      const songId = 'spotify:track:123';
      const response = await request(app)
        .get(`/api/music/recommendations/similar/${songId}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Bar ID is required'
      });
    });

    it('should handle invalid song ID', async () => {
      const invalidSongId = 'invalid:song:id';
      (RecommendationService.getSimilarSongs as jest.Mock)
        .mockRejectedValue(
          Object.assign(new Error('Invalid song ID'), { statusCode: 400 })
        );

      const response = await request(app)
        .get(`/api/music/recommendations/similar/${invalidSongId}`)
        .query({ barId: mockBar.id })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid song ID'
      });
    });

    it('should handle song not found', async () => {
      const songId = 'spotify:track:nonexistent';
      (RecommendationService.getSimilarSongs as jest.Mock)
        .mockRejectedValue(
          Object.assign(new Error('Song not found'), { statusCode: 404 })
        );

      const response = await request(app)
        .get(`/api/music/recommendations/similar/${songId}`)
        .query({ barId: mockBar.id })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Song not found'
      });
    });
  });

  describe('GET /api/music/recommendations/trending', () => {
    it('should get trending music successfully', async () => {
      const mockTrendingSongs = [
        {
          ...createTestSong({ id: 'spotify:track:trending1', title: 'Trending Song 1' }),
          trendScore: 0.95,
          growth: '+25%'
        },
        {
          ...createTestSong({ id: 'spotify:track:trending2', title: 'Trending Song 2' }),
          trendScore: 0.87,
          growth: '+18%'
        }
      ];

      // Mock the method that would be implemented
      (RecommendationService as any).getTrendingMusic = jest.fn()
        .mockResolvedValue(mockTrendingSongs);

      const response = await request(app)
        .get('/api/music/recommendations/trending')
        .query({ barId: mockBar.id })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockTrendingSongs,
        meta: {
          total: 2,
          timeframe: '24h',
          region: 'global'
        }
      });
    });

    it('should handle custom parameters', async () => {
      (RecommendationService as any).getTrendingMusic = jest.fn()
        .mockResolvedValue([]);

      await request(app)
        .get('/api/music/recommendations/trending')
        .query({ 
          barId: mockBar.id, 
          timeframe: '7d',
          region: 'local',
          limit: '15'
        })
        .expect(200);

      expect((RecommendationService as any).getTrendingMusic)
        .toHaveBeenCalledWith(mockBar.id, {
          limit: 15,
          timeframe: '7d',
          region: 'local'
        });
    });
  });

  describe('GET /api/music/recommendations/genres', () => {
    it('should get available genres successfully', async () => {
      const mockGenres = [
        { name: 'pop', count: 150, popularity: 0.85 },
        { name: 'rock', count: 120, popularity: 0.78 },
        { name: 'electronic', count: 95, popularity: 0.72 },
        { name: 'hip-hop', count: 88, popularity: 0.69 }
      ];

      // Mock the method that would be implemented
      (RecommendationService as any).getAvailableGenres = jest.fn()
        .mockResolvedValue(mockGenres);

      const response = await request(app)
        .get('/api/music/recommendations/genres')
        .query({ barId: mockBar.id })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockGenres,
        meta: {
          total: 4,
          source: 'spotify'
        }
      });
    });

    it('should handle missing barId parameter', async () => {
      const response = await request(app)
        .get('/api/music/recommendations/genres')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Bar ID is required'
      });
    });
  });

  describe('DELETE /api/music/recommendations/refresh', () => {
    it('should refresh user recommendations cache successfully', async () => {
      (RecommendationService.clearUserCache as jest.Mock)
        .mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/music/recommendations/refresh')
        .query({ barId: mockBar.id })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Recommendation cache cleared successfully'
      });

      expect(RecommendationService.clearUserCache)
        .toHaveBeenCalledWith(mockUser.id, mockBar.id);
    });

    it('should handle missing barId parameter', async () => {
      const response = await request(app)
        .delete('/api/music/recommendations/refresh')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Bar ID is required'
      });
    });

    it('should handle cache clearing errors', async () => {
      (RecommendationService.clearUserCache as jest.Mock)
        .mockRejectedValue(new Error('Cache clearing failed'));

      const response = await request(app)
        .delete('/api/music/recommendations/refresh')
        .query({ barId: mockBar.id })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all recommendation routes', async () => {
      // Mock auth middleware to simulate unauthenticated request
      (authenticateToken as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(401).json({ success: false, error: 'Authentication required' });
      });

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should handle invalid authentication tokens', async () => {
      (authenticateToken as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(401).json({ success: false, error: 'Invalid token' });
      });

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token'
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate limit parameter bounds', async () => {
      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id, limit: '101' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    });

    it('should validate barId format', async () => {
      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: 'invalid-uuid' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid bar ID format'
      });
    });

    it('should handle validation middleware errors', async () => {
      (handleValidationErrors as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: ['Invalid request parameters']
        });
      });

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: ['Invalid request parameters']
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting errors', async () => {
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockRejectedValue(
          Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 })
        );

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        error: 'Rate limit exceeded'
      });
    });

    it('should handle external API failures gracefully', async () => {
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockRejectedValue(
          Object.assign(new Error('Spotify API unavailable'), { statusCode: 503 })
        );

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'Spotify API unavailable'
      });
    });

    it('should handle database connection errors', async () => {
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockRejectedValue(
          Object.assign(new Error('Database connection failed'), { statusCode: 500 })
        );

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Database connection failed'
      });
    });

    it('should handle unexpected errors with generic message', async () => {
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should indicate when recommendations are served from cache', async () => {
      const mockCachedRecommendations = [
        {
          ...createTestSong({ id: 'spotify:track:cached1' }),
          score: 0.9,
          reason: 'Cached recommendation'
        }
      ];

      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockResolvedValue(mockCachedRecommendations);

      // Mock to simulate cached response
      const response = await request(app)
        .get('/api/music/recommendations/personalized')
        .query({ barId: mockBar.id })
        .expect(200);

      // In a real implementation, the service would set cached: true
      expect(response.body.meta).toHaveProperty('cached');
    });

    it('should handle concurrent requests gracefully', async () => {
      const mockRecommendations = [createTestSong()];
      (RecommendationService.getPersonalizedRecommendations as jest.Mock)
        .mockResolvedValue(mockRecommendations);

      // Simulate concurrent requests
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/music/recommendations/personalized')
          .query({ barId: mockBar.id })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});