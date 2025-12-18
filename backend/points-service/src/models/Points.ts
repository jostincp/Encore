import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { query, transaction } from '../../../shared/database';
import { getRedisClient } from '../../../shared/utils/redis';
import logger from '../../../shared/utils/logger';

// Interfaces
export interface PointsData {
  id: string;
  user_id: string;
  bar_id: string;
  current_balance: number;
  total_earned: number;
  total_spent: number;
  last_activity: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PointsTransaction {
  id: string;
  user_id: string;
  bar_id: string;
  type: 'earn' | 'spend' | 'bonus' | 'penalty' | 'refund';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  reference_type?: string;
  metadata?: any;
  created_at: Date;
}

export interface CreatePointsTransactionData {
  user_id: string;
  bar_id: string;
  type: 'earn' | 'spend' | 'bonus' | 'penalty' | 'refund';
  amount: number;
  description: string;
  reference_id?: string;
  reference_type?: string;
  metadata?: any;
}

export interface PointsFilters {
  user_id?: string;
  type?: 'earn' | 'spend' | 'bonus' | 'penalty' | 'refund';
  date_from?: Date;
  date_to?: Date;
  reference_type?: string;
}

export interface PaginatedPointsResult {
  transactions: PointsTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PointsStats {
  total_users: number;
  total_points_earned: number;
  total_points_spent: number;
  total_points_in_circulation: number;
  average_balance: number;
  top_earners: Array<{ user_id: string; username: string; total_earned: number }>;
  top_spenders: Array<{ user_id: string; username: string; total_spent: number }>;
  transaction_volume_by_type: Array<{ type: string; count: number; total_amount: number }>;
  daily_activity: Array<{ date: string; transactions: number; points_earned: number; points_spent: number }>;
}

export class PointsModel {
  // Get or create user points record
  static async getOrCreateUserPoints(userId: string, barId: string): Promise<PointsData> {
    try {
      const cacheKey = `points:user:${userId}:bar:${barId}`;
      
      // Try to get from cache first
      const cached = await getRedisClient().get(cacheKey);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Check if record exists
      let result = await query(
        'SELECT * FROM user_points WHERE user_id = $1 AND bar_id = $2',
        [userId, barId]
      );

      let pointsData: PointsData;

      if (result.rows.length === 0) {
        // Create new points record
        const id = uuidv4();
        // Ensure we handle potential race conditions with ON CONFLICT if the table has unique constraint on (user_id, bar_id)
        // Assuming there is a unique constraint on (user_id, bar_id)
        const insertResult = await query(
          `INSERT INTO user_points (id, user_id, bar_id, current_balance, total_earned, total_spent, last_activity, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
           ON CONFLICT (user_id, bar_id) DO UPDATE SET updated_at = NOW()
           RETURNING *`,
          [id, userId, barId, 0, 0, 0]
        );
        pointsData = insertResult.rows[0];
      } else {
        pointsData = result.rows[0];
      }

      // Cache the result
      await getRedisClient().setex(cacheKey, 300, JSON.stringify(pointsData));

      return pointsData;
    } catch (error) {
      logger.error('Error getting/creating user points:', error);
      throw error;
    }
  }

  // Add points transaction
  static async addTransaction(transactionData: CreatePointsTransactionData): Promise<PointsTransaction> {
    return await transaction(async (client) => {

      // Get current points balance
      const currentPoints = await this.getOrCreateUserPoints(transactionData.user_id, transactionData.bar_id);
      const balanceBefore = currentPoints.current_balance;
      
      // Calculate new balance
      let balanceAfter: number;
      if (transactionData.type === 'earn' || transactionData.type === 'refund' || transactionData.type === 'bonus') {
        balanceAfter = balanceBefore + Math.abs(transactionData.amount);
      } else if (transactionData.type === 'spend' || transactionData.type === 'penalty') {
        balanceAfter = balanceBefore - Math.abs(transactionData.amount);
        
        if (balanceAfter < 0) {
          throw new Error('Insufficient points balance');
        }
      } else {
        throw new Error('Invalid transaction type');
      }

      // Create transaction record
      const transactionId = uuidv4();
      const transactionResult = await client.query(
        `INSERT INTO points_transactions (id, user_id, bar_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         RETURNING *`,
        [
          transactionId,
          transactionData.user_id,
          transactionData.bar_id,
          transactionData.type,
          Math.abs(transactionData.amount),
          balanceBefore,
          balanceAfter,
          transactionData.description,
          transactionData.reference_id || null,
          transactionData.reference_type || null,
          transactionData.metadata ? JSON.stringify(transactionData.metadata) : null
        ]
      );

      // Update user points balance
      const updateFields = ['current_balance = $3', 'last_activity = NOW()', 'updated_at = NOW()'];
      const updateValues = [transactionData.user_id, transactionData.bar_id, balanceAfter];
      
      if (transactionData.type === 'earn' || transactionData.type === 'bonus') {
        updateFields.push('total_earned = total_earned + $4');
        updateValues.push(Math.abs(transactionData.amount));
      } else if (transactionData.type === 'spend') {
        updateFields.push('total_spent = total_spent + $4');
        updateValues.push(Math.abs(transactionData.amount));
      }

      await client.query(
        `UPDATE user_points SET ${updateFields.join(', ')} WHERE user_id = $1 AND bar_id = $2`,
        updateValues
      );

      // Clear cache
      await this.clearUserPointsCache(transactionData.user_id, transactionData.bar_id);

      const transactionRecord = transactionResult.rows[0];
      
      logger.info(`Points transaction created: ${transactionRecord.type} ${transactionRecord.amount} points for user ${transactionData.user_id} in bar ${transactionData.bar_id}`);
      
      return transactionRecord;
    });
  }

  // Get user points balance
  static async getUserBalance(userId: string, barId: string): Promise<number> {
    try {
      const pointsData = await this.getOrCreateUserPoints(userId, barId);
      return pointsData.current_balance;
    } catch (error) {
      logger.error('Error getting user balance:', error);
      throw error;
    }
  }

  // Get user points transactions with pagination
  static async getUserTransactions(
    userId: string,
    barId: string,
    filters?: PointsFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedPointsResult> {
    try {
      const offset = (page - 1) * limit;
      
      let whereConditions = ['user_id = $1', 'bar_id = $2'];
      let queryParams: any[] = [userId, barId];
      let paramIndex = 3;

      if (filters?.type) {
        whereConditions.push(`type = $${paramIndex}`);
        queryParams.push(filters.type);
        paramIndex++;
      }

      if (filters?.date_from) {
        whereConditions.push(`created_at >= $${paramIndex}`);
        queryParams.push(filters.date_from);
        paramIndex++;
      }

      if (filters?.date_to) {
        whereConditions.push(`created_at <= $${paramIndex}`);
        queryParams.push(filters.date_to);
        paramIndex++;
      }

      if (filters?.reference_type) {
        whereConditions.push(`reference_type = $${paramIndex}`);
        queryParams.push(filters.reference_type);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM points_transactions WHERE ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].count);

      // Get transactions
      const transactionsResult = await query(
        `SELECT * FROM points_transactions 
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      return {
        transactions: transactionsResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error getting user transactions:', error);
      throw error;
    }
  }

  // Get bar points statistics
  static async getBarPointsStats(
    barId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<PointsStats> {
    try {
      const cacheKey = `points:stats:bar:${barId}:${dateFrom?.toISOString() || 'all'}:${dateTo?.toISOString() || 'all'}`;
      
      const cached = await getRedisClient().get(cacheKey);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }

      let dateFilter = '';
      let dateParams: any[] = [];
      
      if (dateFrom || dateTo) {
        const conditions = [];
        if (dateFrom) {
          conditions.push('pt.created_at >= $2');
          dateParams.push(dateFrom);
        }
        if (dateTo) {
          conditions.push(`pt.created_at <= $${dateParams.length + 2}`);
          dateParams.push(dateTo);
        }
        dateFilter = ` AND ${conditions.join(' AND ')}`;
      }

      // Get basic stats
      const basicStatsResult = await query(
        `SELECT 
           COUNT(DISTINCT up.user_id) as total_users,
           COALESCE(SUM(up.total_earned), 0) as total_points_earned,
           COALESCE(SUM(up.total_spent), 0) as total_points_spent,
           COALESCE(SUM(up.current_balance), 0) as total_points_in_circulation,
           COALESCE(AVG(up.current_balance), 0) as average_balance
         FROM user_points up
         WHERE up.bar_id = $1`,
        [barId]
      );

      // Get top earners
      const topEarnersResult = await query(
        `SELECT up.user_id, u.username, up.total_earned
         FROM user_points up
         JOIN users u ON up.user_id = u.id
         WHERE up.bar_id = $1
         ORDER BY up.total_earned DESC
         LIMIT 10`,
        [barId]
      );

      // Get top spenders
      const topSpendersResult = await query(
        `SELECT up.user_id, u.username, up.total_spent
         FROM user_points up
         JOIN users u ON up.user_id = u.id
         WHERE up.bar_id = $1
         ORDER BY up.total_spent DESC
         LIMIT 10`,
        [barId]
      );

      // Get transaction volume by type
      const transactionVolumeResult = await query(
        `SELECT pt.type, COUNT(*) as count, COALESCE(SUM(pt.amount), 0) as total_amount
         FROM points_transactions pt
         WHERE pt.bar_id = $1 ${dateFilter}
         GROUP BY pt.type
         ORDER BY total_amount DESC`,
        [barId].concat(dateParams)
      );

      // Get daily activity
      const dailyActivityResult = await query(
        `SELECT 
           DATE(pt.created_at) as date,
           COUNT(*) as transactions,
           COALESCE(SUM(CASE WHEN pt.type IN ('earn', 'bonus', 'refund') THEN pt.amount ELSE 0 END), 0) as points_earned,
           COALESCE(SUM(CASE WHEN pt.type IN ('spend', 'penalty') THEN pt.amount ELSE 0 END), 0) as points_spent
         FROM points_transactions pt
         WHERE pt.bar_id = $1 ${dateFilter}
         GROUP BY DATE(pt.created_at)
         ORDER BY date DESC
         LIMIT 30`,
        [barId].concat(dateParams)
      );

      const stats: PointsStats = {
        total_users: parseInt(basicStatsResult.rows[0].total_users),
        total_points_earned: parseInt(basicStatsResult.rows[0].total_points_earned),
        total_points_spent: parseInt(basicStatsResult.rows[0].total_points_spent),
        total_points_in_circulation: parseInt(basicStatsResult.rows[0].total_points_in_circulation),
        average_balance: parseFloat(basicStatsResult.rows[0].average_balance),
        top_earners: topEarnersResult.rows,
        top_spenders: topSpendersResult.rows,
        transaction_volume_by_type: transactionVolumeResult.rows,
        daily_activity: dailyActivityResult.rows
      };

      // Cache for 10 minutes
      await getRedisClient().setex(cacheKey, 600, JSON.stringify(stats));

      return stats;
    } catch (error) {
      logger.error('Error getting bar points stats:', error);
      throw error;
    }
  }

  // Transfer points between users
  static async transferPoints(
    fromUserId: string,
    toUserId: string,
    barId: string,
    amount: number,
    description: string,
    adminId: string
  ): Promise<{ fromTransaction: PointsTransaction; toTransaction: PointsTransaction }> {
    return await transaction(async (client) => {

      // Deduct points from sender
      const fromTransaction = await this.addTransaction({
        user_id: fromUserId,
        bar_id: barId,
        type: 'spend',
        amount: amount,
        description: `Transfer to user: ${description}`,
        reference_type: 'transfer',
        metadata: { to_user_id: toUserId, admin_id: adminId }
      });

      // Add points to receiver
      const toTransaction = await this.addTransaction({
        user_id: toUserId,
        bar_id: barId,
        type: 'earn',
        amount: amount,
        description: `Transfer from user: ${description}`,
        reference_type: 'transfer',
        metadata: { from_user_id: fromUserId, admin_id: adminId }
      });

      logger.info(`Points transferred: ${amount} from ${fromUserId} to ${toUserId} in bar ${barId} by admin ${adminId}`);

      return { fromTransaction, toTransaction };
    });
  }

  // Clear user points cache
  static async clearUserPointsCache(userId: string, barId: string): Promise<void> {
    try {
      const cacheKey = `points:user:${userId}:bar:${barId}`;
      await getRedisClient().del(cacheKey);
    } catch (error) {
      logger.error('Error clearing user points cache:', error);
    }
  }

  // Clear bar stats cache
  static async clearBarStatsCache(barId: string): Promise<void> {
    try {
      const pattern = `points:stats:bar:${barId}:*`;
      const keys = await getRedisClient().keys(pattern);
      if (keys && keys.length > 0) {
        for (const key of keys) {
          await getRedisClient().del(key);
        }
      }
    } catch (error) {
      logger.error('Error clearing bar stats cache:', error);
    }
  }

  // Get leaderboard for a bar
  static async getLeaderboard(
    barId: string,
    type: 'earned' | 'spent' | 'balance' = 'earned',
    limit: number = 10
  ): Promise<Array<{ user_id: string; username: string; value: number; rank: number }>> {
    try {
      const cacheKey = `points:leaderboard:bar:${barId}:${type}:${limit}`;
      
      const cached = await getRedisClient().get(cacheKey);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }

      let orderField: string;
      switch (type) {
        case 'earned':
          orderField = 'up.total_earned';
          break;
        case 'spent':
          orderField = 'up.total_spent';
          break;
        case 'balance':
          orderField = 'up.current_balance';
          break;
        default:
          orderField = 'up.total_earned';
      }

      const result = await query(
        `SELECT 
           up.user_id,
           u.username,
           ${orderField} as value,
           ROW_NUMBER() OVER (ORDER BY ${orderField} DESC) as rank
         FROM user_points up
         JOIN users u ON up.user_id = u.id
         WHERE up.bar_id = $1 AND ${orderField} > 0
         ORDER BY ${orderField} DESC
         LIMIT $2`,
        [barId, limit]
      );

      const leaderboard = result.rows.map((row: any) => ({
        user_id: row.user_id,
        username: row.username,
        value: parseInt(row.value),
        rank: parseInt(row.rank)
      }));

      // Cache for 5 minutes
      await getRedisClient().setex(cacheKey, 300, JSON.stringify(leaderboard));

      return leaderboard;
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      throw error;
    }
  }
}