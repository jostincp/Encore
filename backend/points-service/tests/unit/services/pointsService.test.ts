import { PointsService } from '../../../src/services/pointsService';
import { PointsModel } from '../../../src/models/Points';
import { TransactionModel } from '../../../src/models/Transaction';
import { AppError } from '../../../../shared/utils/errors';
import {
  mockDbQuery,
  mockDbError,
  mockUser,
  mockTransaction,
  mockRedisGet,
  mockRedisSet,
  expectError
} from '../../setup';

// Mock dependencies
jest.mock('../../../src/models/Points');
jest.mock('../../../src/models/Transaction');
jest.mock('../../../../shared/utils/errors');
jest.mock('../../../src/config/redis');

describe('PointsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserBalance', () => {
    const userId = 'user-123';
    const barId = 'bar-456';

    it('should get user balance successfully', async () => {
      const mockBalance = {
        user_id: userId,
        bar_id: barId,
        balance: 150,
        total_earned: 500,
        total_spent: 350,
        last_transaction_at: new Date()
      };

      (PointsModel.getUserBalance as jest.Mock).mockResolvedValue(mockBalance);

      const result = await PointsService.getUserBalance(userId, barId);

      expect(PointsModel.getUserBalance).toHaveBeenCalledWith(userId, barId);
      expect(result).toEqual(mockBalance);
    });

    it('should return zero balance if user has no points', async () => {
      (PointsModel.getUserBalance as jest.Mock).mockResolvedValue(null);

      const result = await PointsService.getUserBalance(userId, barId);

      expect(result).toEqual({
        user_id: userId,
        bar_id: barId,
        balance: 0,
        total_earned: 0,
        total_spent: 0,
        last_transaction_at: null
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      (PointsModel.getUserBalance as jest.Mock).mockRejectedValue(dbError);

      await expect(PointsService.getUserBalance(userId, barId)).rejects.toThrow(dbError);
    });
  });

  describe('addPoints', () => {
    const userId = 'user-123';
    const barId = 'bar-456';
    const points = 50;
    const reason = 'Purchase reward';
    const adminId = 'admin-789';

    it('should add points successfully', async () => {
      const mockTransaction = {
        id: 'txn-123',
        user_id: userId,
        bar_id: barId,
        points: points,
        type: 'earned',
        reason: reason,
        created_by: adminId,
        created_at: new Date()
      };

      const updatedBalance = {
        user_id: userId,
        bar_id: barId,
        balance: 200,
        total_earned: 550,
        total_spent: 350
      };

      (TransactionModel.create as jest.Mock).mockResolvedValue(mockTransaction);
      (PointsModel.updateBalance as jest.Mock).mockResolvedValue(updatedBalance);

      const result = await PointsService.addPoints(userId, barId, points, reason, adminId);

      expect(TransactionModel.create).toHaveBeenCalledWith({
        user_id: userId,
        bar_id: barId,
        points: points,
        type: 'earned',
        reason: reason,
        created_by: adminId
      });
      expect(PointsModel.updateBalance).toHaveBeenCalledWith(userId, barId, points, 'add');
      expect(result).toEqual({
        transaction: mockTransaction,
        balance: updatedBalance
      });
    });

    it('should throw error for negative points', async () => {
      await expect(
        PointsService.addPoints(userId, barId, -10, reason, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Points must be a positive number',
          statusCode: 400
        })
      );
    });

    it('should throw error for zero points', async () => {
      await expect(
        PointsService.addPoints(userId, barId, 0, reason, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Points must be a positive number',
          statusCode: 400
        })
      );
    });

    it('should handle transaction creation failure', async () => {
      const dbError = new Error('Transaction creation failed');
      (TransactionModel.create as jest.Mock).mockRejectedValue(dbError);

      await expect(
        PointsService.addPoints(userId, barId, points, reason, adminId)
      ).rejects.toThrow(dbError);
    });
  });

  describe('spendPoints', () => {
    const userId = 'user-123';
    const barId = 'bar-456';
    const points = 30;
    const reason = 'Drink purchase';
    const adminId = 'admin-789';

    it('should spend points successfully', async () => {
      const currentBalance = {
        user_id: userId,
        bar_id: barId,
        balance: 100,
        total_earned: 500,
        total_spent: 400
      };

      const mockTransaction = {
        id: 'txn-456',
        user_id: userId,
        bar_id: barId,
        points: points,
        type: 'spent',
        reason: reason,
        created_by: adminId,
        created_at: new Date()
      };

      const updatedBalance = {
        user_id: userId,
        bar_id: barId,
        balance: 70,
        total_earned: 500,
        total_spent: 430
      };

      (PointsModel.getUserBalance as jest.Mock).mockResolvedValue(currentBalance);
      (TransactionModel.create as jest.Mock).mockResolvedValue(mockTransaction);
      (PointsModel.updateBalance as jest.Mock).mockResolvedValue(updatedBalance);

      const result = await PointsService.spendPoints(userId, barId, points, reason, adminId);

      expect(PointsModel.getUserBalance).toHaveBeenCalledWith(userId, barId);
      expect(TransactionModel.create).toHaveBeenCalledWith({
        user_id: userId,
        bar_id: barId,
        points: points,
        type: 'spent',
        reason: reason,
        created_by: adminId
      });
      expect(PointsModel.updateBalance).toHaveBeenCalledWith(userId, barId, points, 'subtract');
      expect(result).toEqual({
        transaction: mockTransaction,
        balance: updatedBalance
      });
    });

    it('should throw error for insufficient balance', async () => {
      const currentBalance = {
        user_id: userId,
        bar_id: barId,
        balance: 20, // Less than points to spend
        total_earned: 100,
        total_spent: 80
      };

      (PointsModel.getUserBalance as jest.Mock).mockResolvedValue(currentBalance);

      await expect(
        PointsService.spendPoints(userId, barId, points, reason, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Insufficient points balance',
          statusCode: 400
        })
      );
    });

    it('should throw error for user with no points record', async () => {
      (PointsModel.getUserBalance as jest.Mock).mockResolvedValue(null);

      await expect(
        PointsService.spendPoints(userId, barId, points, reason, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Insufficient points balance',
          statusCode: 400
        })
      );
    });

    it('should throw error for negative points', async () => {
      await expect(
        PointsService.spendPoints(userId, barId, -10, reason, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Points must be a positive number',
          statusCode: 400
        })
      );
    });
  });

  describe('transferPoints', () => {
    const fromUserId = 'user-123';
    const toUserId = 'user-456';
    const barId = 'bar-789';
    const points = 25;
    const reason = 'Gift transfer';
    const adminId = 'admin-999';

    it('should transfer points successfully', async () => {
      const fromBalance = {
        user_id: fromUserId,
        bar_id: barId,
        balance: 100,
        total_earned: 200,
        total_spent: 100
      };

      const mockFromTransaction = {
        id: 'txn-from',
        user_id: fromUserId,
        bar_id: barId,
        points: points,
        type: 'spent',
        reason: `Transfer to user ${toUserId}: ${reason}`,
        created_by: adminId
      };

      const mockToTransaction = {
        id: 'txn-to',
        user_id: toUserId,
        bar_id: barId,
        points: points,
        type: 'earned',
        reason: `Transfer from user ${fromUserId}: ${reason}`,
        created_by: adminId
      };

      const updatedFromBalance = { ...fromBalance, balance: 75, total_spent: 125 };
      const updatedToBalance = {
        user_id: toUserId,
        bar_id: barId,
        balance: 25,
        total_earned: 25,
        total_spent: 0
      };

      (PointsModel.getUserBalance as jest.Mock)
        .mockResolvedValueOnce(fromBalance) // First call for sender
        .mockResolvedValueOnce(null); // Second call for receiver (new user)

      (TransactionModel.create as jest.Mock)
        .mockResolvedValueOnce(mockFromTransaction)
        .mockResolvedValueOnce(mockToTransaction);

      (PointsModel.updateBalance as jest.Mock)
        .mockResolvedValueOnce(updatedFromBalance)
        .mockResolvedValueOnce(updatedToBalance);

      const result = await PointsService.transferPoints(fromUserId, toUserId, barId, points, reason, adminId);

      expect(PointsModel.getUserBalance).toHaveBeenCalledWith(fromUserId, barId);
      expect(TransactionModel.create).toHaveBeenCalledTimes(2);
      expect(PointsModel.updateBalance).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        fromTransaction: mockFromTransaction,
        toTransaction: mockToTransaction,
        fromBalance: updatedFromBalance,
        toBalance: updatedToBalance
      });
    });

    it('should throw error for insufficient balance', async () => {
      const fromBalance = {
        user_id: fromUserId,
        bar_id: barId,
        balance: 10, // Less than points to transfer
        total_earned: 50,
        total_spent: 40
      };

      (PointsModel.getUserBalance as jest.Mock).mockResolvedValue(fromBalance);

      await expect(
        PointsService.transferPoints(fromUserId, toUserId, barId, points, reason, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Insufficient points balance for transfer',
          statusCode: 400
        })
      );
    });

    it('should throw error for self-transfer', async () => {
      await expect(
        PointsService.transferPoints(fromUserId, fromUserId, barId, points, reason, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Cannot transfer points to yourself',
          statusCode: 400
        })
      );
    });
  });

  describe('getUserTransactions', () => {
    const userId = 'user-123';
    const barId = 'bar-456';

    it('should get user transactions successfully', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          user_id: userId,
          bar_id: barId,
          points: 50,
          type: 'earned',
          reason: 'Purchase reward',
          created_at: new Date()
        },
        {
          id: 'txn-2',
          user_id: userId,
          bar_id: barId,
          points: 25,
          type: 'spent',
          reason: 'Drink purchase',
          created_at: new Date()
        }
      ];

      (TransactionModel.getUserTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const result = await PointsService.getUserTransactions(userId, barId);

      expect(TransactionModel.getUserTransactions).toHaveBeenCalledWith(userId, barId, {
        limit: 50,
        offset: 0
      });
      expect(result).toEqual(mockTransactions);
    });

    it('should get user transactions with custom pagination', async () => {
      const options = { limit: 10, offset: 20 };
      const mockTransactions = [];

      (TransactionModel.getUserTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const result = await PointsService.getUserTransactions(userId, barId, options);

      expect(TransactionModel.getUserTransactions).toHaveBeenCalledWith(userId, barId, options);
      expect(result).toEqual(mockTransactions);
    });
  });

  describe('getBarStats', () => {
    const barId = 'bar-456';

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

      (PointsModel.getBarStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await PointsService.getBarStats(barId);

      expect(PointsModel.getBarStats).toHaveBeenCalledWith(barId);
      expect(result).toEqual(mockStats);
    });

    it('should handle bars with no activity', async () => {
      const emptyStats = {
        total_points_issued: 0,
        total_points_redeemed: 0,
        active_users: 0,
        total_transactions: 0,
        average_points_per_user: 0,
        top_earners: []
      };

      (PointsModel.getBarStats as jest.Mock).mockResolvedValue(emptyStats);

      const result = await PointsService.getBarStats(barId);

      expect(result).toEqual(emptyStats);
    });
  });

  describe('getLeaderboard', () => {
    const barId = 'bar-456';

    it('should get leaderboard by earned points', async () => {
      const mockLeaderboard = [
        { user_id: 'user-1', username: 'user1', total_earned: 500, rank: 1 },
        { user_id: 'user-2', username: 'user2', total_earned: 450, rank: 2 },
        { user_id: 'user-3', username: 'user3', total_earned: 400, rank: 3 }
      ];

      (PointsModel.getLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);

      const result = await PointsService.getLeaderboard(barId, 'earned');

      expect(PointsModel.getLeaderboard).toHaveBeenCalledWith(barId, 'earned', 10);
      expect(result).toEqual(mockLeaderboard);
    });

    it('should get leaderboard by spent points', async () => {
      const mockLeaderboard = [
        { user_id: 'user-1', username: 'user1', total_spent: 300, rank: 1 },
        { user_id: 'user-2', username: 'user2', total_spent: 250, rank: 2 }
      ];

      (PointsModel.getLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);

      const result = await PointsService.getLeaderboard(barId, 'spent', 5);

      expect(PointsModel.getLeaderboard).toHaveBeenCalledWith(barId, 'spent', 5);
      expect(result).toEqual(mockLeaderboard);
    });

    it('should get leaderboard by current balance', async () => {
      const mockLeaderboard = [
        { user_id: 'user-1', username: 'user1', balance: 200, rank: 1 },
        { user_id: 'user-2', username: 'user2', balance: 150, rank: 2 }
      ];

      (PointsModel.getLeaderboard as jest.Mock).mockResolvedValue(mockLeaderboard);

      const result = await PointsService.getLeaderboard(barId, 'balance');

      expect(PointsModel.getLeaderboard).toHaveBeenCalledWith(barId, 'balance', 10);
      expect(result).toEqual(mockLeaderboard);
    });
  });

  describe('bulkAddPoints', () => {
    const barId = 'bar-456';
    const adminId = 'admin-789';
    const bulkData = [
      { user_id: 'user-1', points: 50, reason: 'Bulk reward 1' },
      { user_id: 'user-2', points: 75, reason: 'Bulk reward 2' },
      { user_id: 'user-3', points: 25, reason: 'Bulk reward 3' }
    ];

    it('should add points to multiple users successfully', async () => {
      const mockResults = bulkData.map((data, index) => ({
        transaction: {
          id: `txn-${index + 1}`,
          user_id: data.user_id,
          bar_id: barId,
          points: data.points,
          type: 'earned',
          reason: data.reason,
          created_by: adminId
        },
        balance: {
          user_id: data.user_id,
          bar_id: barId,
          balance: data.points,
          total_earned: data.points,
          total_spent: 0
        }
      }));

      // Mock successful operations for all users
      (TransactionModel.create as jest.Mock)
        .mockResolvedValueOnce(mockResults[0].transaction)
        .mockResolvedValueOnce(mockResults[1].transaction)
        .mockResolvedValueOnce(mockResults[2].transaction);

      (PointsModel.updateBalance as jest.Mock)
        .mockResolvedValueOnce(mockResults[0].balance)
        .mockResolvedValueOnce(mockResults[1].balance)
        .mockResolvedValueOnce(mockResults[2].balance);

      const result = await PointsService.bulkAddPoints(barId, bulkData, adminId);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.summary).toEqual({
        total: 3,
        successful: 3,
        failed: 0,
        total_points_added: 150
      });
    });

    it('should handle partial failures gracefully', async () => {
      const mockSuccessTransaction = {
        id: 'txn-1',
        user_id: 'user-1',
        bar_id: barId,
        points: 50,
        type: 'earned',
        reason: 'Bulk reward 1',
        created_by: adminId
      };

      const mockSuccessBalance = {
        user_id: 'user-1',
        bar_id: barId,
        balance: 50,
        total_earned: 50,
        total_spent: 0
      };

      // Mock first user success, second user failure, third user success
      (TransactionModel.create as jest.Mock)
        .mockResolvedValueOnce(mockSuccessTransaction)
        .mockRejectedValueOnce(new Error('Transaction failed'))
        .mockResolvedValueOnce({
          id: 'txn-3',
          user_id: 'user-3',
          bar_id: barId,
          points: 25,
          type: 'earned',
          reason: 'Bulk reward 3',
          created_by: adminId
        });

      (PointsModel.updateBalance as jest.Mock)
        .mockResolvedValueOnce(mockSuccessBalance)
        .mockResolvedValueOnce({
          user_id: 'user-3',
          bar_id: barId,
          balance: 25,
          total_earned: 25,
          total_spent: 0
        });

      const result = await PointsService.bulkAddPoints(barId, bulkData, adminId);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({
        user_id: 'user-2',
        error: 'Transaction failed'
      });
      expect(result.summary).toEqual({
        total: 3,
        successful: 2,
        failed: 1,
        total_points_added: 75
      });
    });

    it('should validate bulk data before processing', async () => {
      const invalidBulkData = [
        { user_id: 'user-1', points: -10, reason: 'Invalid points' }, // Negative points
        { user_id: '', points: 50, reason: 'Missing user ID' }, // Empty user ID
        { user_id: 'user-3', points: 25 } // Missing reason
      ];

      await expect(
        PointsService.bulkAddPoints(barId, invalidBulkData, adminId)
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Invalid bulk data'),
          statusCode: 400
        })
      );
    });

    it('should handle empty bulk data', async () => {
      const result = await PointsService.bulkAddPoints(barId, [], adminId);

      expect(result).toEqual({
        successful: [],
        failed: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          total_points_added: 0
        }
      });
    });
  });

  describe('getUserPointsSummary', () => {
    const userId = 'user-123';

    it('should get user points summary across all bars', async () => {
      const mockSummary = {
        user_id: userId,
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

      (PointsModel.getUserPointsSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await PointsService.getUserPointsSummary(userId);

      expect(PointsModel.getUserPointsSummary).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockSummary);
    });

    it('should handle user with no points', async () => {
      const emptySummary = {
        user_id: userId,
        total_balance: 0,
        total_earned: 0,
        total_spent: 0,
        bars: []
      };

      (PointsModel.getUserPointsSummary as jest.Mock).mockResolvedValue(emptySummary);

      const result = await PointsService.getUserPointsSummary(userId);

      expect(result).toEqual(emptySummary);
    });
  });
});