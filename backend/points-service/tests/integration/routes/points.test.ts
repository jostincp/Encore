import request from 'supertest';
import express from 'express';
import { pointsRoutes } from '../../../src/routes/points';
import { PointsService } from '../../../src/services/pointsService';
import { authMiddleware } from '../../../../shared/middleware/auth';
import { validateRequest } from '../../../../shared/middleware/validation';
import {
  mockUser,
  mockAdmin,
  mockBarOwner,
  setupTestDb,
  cleanupTestDb,
  createTestUser,
  createTestBar
} from '../../setup';

// Mock dependencies
jest.mock('../../../src/services/pointsService');
jest.mock('../../../../shared/middleware/auth');
jest.mock('../../../../shared/middleware/validation');
jest.mock('../../../src/config/redis');

const app = express();
app.use(express.json());
app.use('/api/points', pointsRoutes);

describe('Points Routes Integration Tests', () => {
  let testUser: any;
  let testAdmin: any;
  let testBar: any;

  beforeAll(async () => {
    await setupTestDb();
    testUser = await createTestUser({ role: 'user' });
    testAdmin = await createTestUser({ role: 'admin' });
    testBar = await createTestBar();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth middleware to pass through with user context
    (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = testUser;
      next();
    });
    
    // Mock validation middleware to pass through
    (validateRequest as jest.Mock).mockImplementation((schema: any) => {
      return (req: any, res: any, next: any) => next();
    });
  });

  describe('GET /api/points/balance/:barId', () => {
    const barId = 'bar-123';

    it('should get user balance successfully', async () => {
      const mockBalance = {
        user_id: testUser.id,
        bar_id: barId,
        balance: 150,
        total_earned: 500,
        total_spent: 350,
        last_transaction_at: new Date()
      };

      (PointsService.getUserBalance as jest.Mock).mockResolvedValue(mockBalance);

      const response = await request(app)
        .get(`/api/points/balance/${barId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockBalance
      });
      expect(PointsService.getUserBalance).toHaveBeenCalledWith(testUser.id, barId);
    });

    it('should handle service errors', async () => {
      (PointsService.getUserBalance as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get(`/api/points/balance/${barId}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Database connection failed')
      });
    });

    it('should require authentication', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      });

      await request(app)
        .get(`/api/points/balance/${barId}`)
        .expect(401);
    });
  });

  describe('POST /api/points/add', () => {
    const requestBody = {
      userId: 'user-456',
      barId: 'bar-123',
      points: 50,
      reason: 'Purchase reward'
    };

    beforeEach(() => {
      // Mock admin authentication
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testAdmin;
        next();
      });
    });

    it('should add points successfully', async () => {
      const mockResult = {
        transaction: {
          id: 'txn-123',
          user_id: requestBody.userId,
          bar_id: requestBody.barId,
          points: requestBody.points,
          type: 'earned',
          reason: requestBody.reason,
          created_by: testAdmin.id,
          created_at: new Date()
        },
        balance: {
          user_id: requestBody.userId,
          bar_id: requestBody.barId,
          balance: 200,
          total_earned: 550,
          total_spent: 350
        }
      };

      (PointsService.addPoints as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/points/add')
        .send(requestBody)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
      expect(PointsService.addPoints).toHaveBeenCalledWith(
        requestBody.userId,
        requestBody.barId,
        requestBody.points,
        requestBody.reason,
        testAdmin.id
      );
    });

    it('should handle validation errors', async () => {
      (validateRequest as jest.Mock).mockImplementation((schema: any) => {
        return (req: any, res: any, next: any) => {
          res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: ['Points must be a positive number']
          });
        };
      });

      await request(app)
        .post('/api/points/add')
        .send({ ...requestBody, points: -10 })
        .expect(400);
    });

    it('should require admin privileges', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testUser; // Regular user, not admin
        next();
      });

      await request(app)
        .post('/api/points/add')
        .send(requestBody)
        .expect(403);
    });
  });

  describe('POST /api/points/spend', () => {
    const requestBody = {
      userId: 'user-456',
      barId: 'bar-123',
      points: 30,
      reason: 'Drink purchase'
    };

    beforeEach(() => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testAdmin;
        next();
      });
    });

    it('should spend points successfully', async () => {
      const mockResult = {
        transaction: {
          id: 'txn-456',
          user_id: requestBody.userId,
          bar_id: requestBody.barId,
          points: requestBody.points,
          type: 'spent',
          reason: requestBody.reason,
          created_by: testAdmin.id,
          created_at: new Date()
        },
        balance: {
          user_id: requestBody.userId,
          bar_id: requestBody.barId,
          balance: 70,
          total_earned: 500,
          total_spent: 430
        }
      };

      (PointsService.spendPoints as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/points/spend')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
      expect(PointsService.spendPoints).toHaveBeenCalledWith(
        requestBody.userId,
        requestBody.barId,
        requestBody.points,
        requestBody.reason,
        testAdmin.id
      );
    });

    it('should handle insufficient balance', async () => {
      (PointsService.spendPoints as jest.Mock).mockRejectedValue(
        new Error('Insufficient points balance')
      );

      const response = await request(app)
        .post('/api/points/spend')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Insufficient points balance')
      });
    });
  });

  describe('POST /api/points/transfer', () => {
    const requestBody = {
      fromUserId: 'user-123',
      toUserId: 'user-456',
      barId: 'bar-789',
      points: 25,
      reason: 'Gift transfer'
    };

    beforeEach(() => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testAdmin;
        next();
      });
    });

    it('should transfer points successfully', async () => {
      const mockResult = {
        fromTransaction: {
          id: 'txn-from',
          user_id: requestBody.fromUserId,
          bar_id: requestBody.barId,
          points: requestBody.points,
          type: 'spent',
          reason: `Transfer to user ${requestBody.toUserId}: ${requestBody.reason}`,
          created_by: testAdmin.id
        },
        toTransaction: {
          id: 'txn-to',
          user_id: requestBody.toUserId,
          bar_id: requestBody.barId,
          points: requestBody.points,
          type: 'earned',
          reason: `Transfer from user ${requestBody.fromUserId}: ${requestBody.reason}`,
          created_by: testAdmin.id
        },
        fromBalance: {
          user_id: requestBody.fromUserId,
          bar_id: requestBody.barId,
          balance: 75,
          total_earned: 200,
          total_spent: 125
        },
        toBalance: {
          user_id: requestBody.toUserId,
          bar_id: requestBody.barId,
          balance: 25,
          total_earned: 25,
          total_spent: 0
        }
      };

      (PointsService.transferPoints as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/points/transfer')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
      expect(PointsService.transferPoints).toHaveBeenCalledWith(
        requestBody.fromUserId,
        requestBody.toUserId,
        requestBody.barId,
        requestBody.points,
        requestBody.reason,
        testAdmin.id
      );
    });

    it('should handle self-transfer error', async () => {
      (PointsService.transferPoints as jest.Mock).mockRejectedValue(
        new Error('Cannot transfer points to yourself')
      );

      const response = await request(app)
        .post('/api/points/transfer')
        .send({ ...requestBody, toUserId: requestBody.fromUserId })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Cannot transfer points to yourself')
      });
    });
  });

  describe('GET /api/points/transactions/:barId', () => {
    const barId = 'bar-123';

    it('should get user transactions successfully', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          user_id: testUser.id,
          bar_id: barId,
          points: 50,
          type: 'earned',
          reason: 'Purchase reward',
          created_at: new Date()
        },
        {
          id: 'txn-2',
          user_id: testUser.id,
          bar_id: barId,
          points: 25,
          type: 'spent',
          reason: 'Drink purchase',
          created_at: new Date()
        }
      ];

      (PointsService.getUserTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get(`/api/points/transactions/${barId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockTransactions
      });
      expect(PointsService.getUserTransactions).toHaveBeenCalledWith(
        testUser.id,
        barId,
        { limit: 50, offset: 0 }
      );
    });

    it('should handle pagination parameters', async () => {
      const mockTransactions = [];
      (PointsService.getUserTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get(`/api/points/transactions/${barId}?limit=10&offset=20`)
        .expect(200);

      expect(PointsService.getUserTransactions).toHaveBeenCalledWith(
        testUser.id,
        barId,
        { limit: 10, offset: 20 }
      );
    });
  });

  describe('GET /api/points/stats/:barId', () => {
    const barId = 'bar-123';

    beforeEach(() => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testAdmin;
        next();
      });
    });

    it('should get bar statistics successfully', async () => {
      const mockStats = {
        total_points_issued: 5000,
        total_points_redeemed: 3000,
        active_users: 150,
        total_transactions: 500,
        average_points_per_user: 33.33,
        top_earners: [
          { user_id: 'user-1', username: 'user1', total_earned: 500 },
          { user_id: 'user-2', username: 'user2', total_earned: 450 }
        ]
      };

      (PointsService.getBarStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app)
        .get(`/api/points/stats/${barId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats
      });
      expect(PointsService.getBarStats).toHaveBeenCalledWith(barId);
    });

    it('should require admin privileges', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testUser; // Regular user
        next();
      });

      await request(app)
        .get(`/api/points/stats/${barId}`)
        .expect(403);
    });
  });

  describe('GET /api/points/leaderboard/:barId', () => {
    const barId = 'bar-123';

    it('should get leaderboard successfully', async () => {
      const mockLeaderboard = [
        { user_id: 'user-1', username: 'user1', total_earned: 500, rank: 1 },
        { user_id: 'user-2', username: 'user2', total_earned: 450, rank: 2 },
        { user_id: 'user-3', username: 'user3', total_earned: 400, rank: 3 }
      ];

      (PointsService.getLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get(`/api/points/leaderboard/${barId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockLeaderboard
      });
      expect(PointsService.getLeaderboard).toHaveBeenCalledWith(barId, 'earned', 10);
    });

    it('should handle different leaderboard types', async () => {
      const mockLeaderboard = [
        { user_id: 'user-1', username: 'user1', total_spent: 300, rank: 1 }
      ];

      (PointsService.getLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get(`/api/points/leaderboard/${barId}?type=spent&limit=5`)
        .expect(200);

      expect(PointsService.getLeaderboard).toHaveBeenCalledWith(barId, 'spent', 5);
    });
  });

  describe('POST /api/points/bulk-add', () => {
    const requestBody = {
      barId: 'bar-123',
      users: [
        { user_id: 'user-1', points: 50, reason: 'Bulk reward 1' },
        { user_id: 'user-2', points: 75, reason: 'Bulk reward 2' },
        { user_id: 'user-3', points: 25, reason: 'Bulk reward 3' }
      ]
    };

    beforeEach(() => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testAdmin;
        next();
      });
    });

    it('should add points to multiple users successfully', async () => {
      const mockResult = {
        successful: [
          {
            user_id: 'user-1',
            transaction: { id: 'txn-1', points: 50 },
            balance: { balance: 50 }
          },
          {
            user_id: 'user-2',
            transaction: { id: 'txn-2', points: 75 },
            balance: { balance: 75 }
          },
          {
            user_id: 'user-3',
            transaction: { id: 'txn-3', points: 25 },
            balance: { balance: 25 }
          }
        ],
        failed: [],
        summary: {
          total: 3,
          successful: 3,
          failed: 0,
          total_points_added: 150
        }
      };

      (PointsService.bulkAddPoints as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/points/bulk-add')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
      expect(PointsService.bulkAddPoints).toHaveBeenCalledWith(
        requestBody.barId,
        requestBody.users,
        testAdmin.id
      );
    });

    it('should handle partial failures', async () => {
      const mockResult = {
        successful: [
          {
            user_id: 'user-1',
            transaction: { id: 'txn-1', points: 50 },
            balance: { balance: 50 }
          }
        ],
        failed: [
          {
            user_id: 'user-2',
            error: 'User not found'
          }
        ],
        summary: {
          total: 2,
          successful: 1,
          failed: 1,
          total_points_added: 50
        }
      };

      (PointsService.bulkAddPoints as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/points/bulk-add')
        .send({
          barId: requestBody.barId,
          users: requestBody.users.slice(0, 2)
        })
        .expect(200);

      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.failed).toHaveLength(1);
    });

    it('should require admin privileges', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = testUser;
        next();
      });

      await request(app)
        .post('/api/points/bulk-add')
        .send(requestBody)
        .expect(403);
    });
  });

  describe('GET /api/points/summary', () => {
    it('should get user points summary successfully', async () => {
      const mockSummary = {
        user_id: testUser.id,
        total_balance: 350,
        total_earned: 1000,
        total_spent: 650,
        bars: [
          {
            bar_id: 'bar-1',
            bar_name: 'Bar One',
            balance: 150,
            total_earned: 400,
            total_spent: 250,
            last_transaction_at: new Date()
          },
          {
            bar_id: 'bar-2',
            bar_name: 'Bar Two',
            balance: 200,
            total_earned: 600,
            total_spent: 400,
            last_transaction_at: new Date()
          }
        ]
      };

      (PointsService.getUserPointsSummary as jest.Mock).mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/points/summary')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSummary
      });
      expect(PointsService.getUserPointsSummary).toHaveBeenCalledWith(testUser.id);
    });

    it('should handle user with no points', async () => {
      const emptySummary = {
        user_id: testUser.id,
        total_balance: 0,
        total_earned: 0,
        total_spent: 0,
        bars: []
      };

      (PointsService.getUserPointsSummary as jest.Mock).mockResolvedValue(emptySummary);

      const response = await request(app)
        .get('/api/points/summary')
        .expect(200);

      expect(response.body.data.total_balance).toBe(0);
      expect(response.body.data.bars).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      await request(app)
        .get('/api/points/non-existent')
        .expect(404);
    });

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/api/points/add')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      (validateRequest as jest.Mock).mockImplementation((schema: any) => {
        return (req: any, res: any, next: any) => {
          res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: ['userId is required', 'barId is required']
          });
        };
      });

      await request(app)
        .post('/api/points/add')
        .send({ points: 50 })
        .expect(400);
    });
  });
});