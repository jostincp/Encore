import { Request, Response } from 'express';
import { PointsModel, CreatePointsTransactionData, PointsFilters } from '../models/Points';
import { logger } from '../../../shared/utils/logger';
import { validateRequest } from '../../../shared/middleware/validation';
import { AuthenticatedRequest } from '../../../shared/types/auth';

export class PointsController {
  // Get user points balance
  static async getUserBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = req.user!.id;

      const balance = await PointsModel.getUserBalance(userId, barId);

      res.json({
        success: true,
        data: {
          user_id: userId,
          bar_id: barId,
          balance
        }
      });
    } catch (error) {
      logger.error('Error getting user balance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user balance'
      });
    }
  }

  // Get user points transactions
  static async getUserTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = req.user!.id;
      
      const {
        type,
        date_from,
        date_to,
        reference_type,
        page = 1,
        limit = 20
      } = req.query;

      const filters: PointsFilters = {};
      
      if (type) filters.type = type as string;
      if (date_from) filters.date_from = new Date(date_from as string);
      if (date_to) filters.date_to = new Date(date_to as string);
      if (reference_type) filters.reference_type = reference_type as string;

      const result = await PointsModel.getUserTransactions(
        userId,
        barId,
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error getting user transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user transactions'
      });
    }
  }

  // Add points transaction (admin only)
  static async addTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user_id, bar_id, type, amount, description, reference_id, reference_type, metadata } = req.body;
      const adminId = req.user!.id;

      // Verify admin has permission for this bar
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        // Check if user is bar owner
        const { BarModel } = await import('../../../shared/models/Bar');
        const bar = await BarModel.findById(bar_id);
        
        if (!bar || bar.owner_id !== adminId) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }
      }

      const transactionData: CreatePointsTransactionData = {
        user_id,
        bar_id,
        type,
        amount: Math.abs(amount),
        description,
        reference_id,
        reference_type,
        metadata: {
          ...metadata,
          admin_id: adminId,
          admin_action: true
        }
      };

      const transaction = await PointsModel.addTransaction(transactionData);

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Points transaction added successfully'
      });
    } catch (error) {
      logger.error('Error adding points transaction:', error);
      
      if (error instanceof Error && error.message === 'Insufficient points balance') {
        return res.status(400).json({
          success: false,
          message: 'Insufficient points balance'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to add points transaction'
      });
    }
  }

  // Transfer points between users (admin only)
  static async transferPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { from_user_id, to_user_id, bar_id, amount, description } = req.body;
      const adminId = req.user!.id;

      // Verify admin has permission for this bar
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        const { BarModel } = await import('../../../shared/models/Bar');
        const bar = await BarModel.findById(bar_id);
        
        if (!bar || bar.owner_id !== adminId) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }
      }

      // Validate users exist
      const { UserModel } = await import('../../../shared/models/User');
      const [fromUser, toUser] = await Promise.all([
        UserModel.findById(from_user_id),
        UserModel.findById(to_user_id)
      ]);

      if (!fromUser || !toUser) {
        return res.status(404).json({
          success: false,
          message: 'One or both users not found'
        });
      }

      const result = await PointsModel.transferPoints(
        from_user_id,
        to_user_id,
        bar_id,
        Math.abs(amount),
        description,
        adminId
      );

      res.json({
        success: true,
        data: result,
        message: 'Points transferred successfully'
      });
    } catch (error) {
      logger.error('Error transferring points:', error);
      
      if (error instanceof Error && error.message === 'Insufficient points balance') {
        return res.status(400).json({
          success: false,
          message: 'Insufficient points balance'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to transfer points'
      });
    }
  }

  // Get bar points statistics (admin/bar owner only)
  static async getBarPointsStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { date_from, date_to } = req.query;
      const userId = req.user!.id;

      // Verify admin has permission for this bar
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        const { BarModel } = await import('../../../shared/models/Bar');
        const bar = await BarModel.findById(barId);
        
        if (!bar || bar.owner_id !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }
      }

      const dateFrom = date_from ? new Date(date_from as string) : undefined;
      const dateTo = date_to ? new Date(date_to as string) : undefined;

      const stats = await PointsModel.getBarPointsStats(barId, dateFrom, dateTo);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting bar points stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get bar points statistics'
      });
    }
  }

  // Get leaderboard for a bar
  static async getLeaderboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { type = 'earned', limit = 10 } = req.query;

      // Validate type
      if (!['earned', 'spent', 'balance'].includes(type as string)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid leaderboard type. Must be: earned, spent, or balance'
        });
      }

      const leaderboard = await PointsModel.getLeaderboard(
        barId,
        type as 'earned' | 'spent' | 'balance',
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: {
          type,
          leaderboard
        }
      });
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get leaderboard'
      });
    }
  }

  // Get all transactions for a bar (admin/bar owner only)
  static async getBarTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = req.user!.id;
      
      // Verify admin has permission for this bar
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        const { BarModel } = await import('../../../shared/models/Bar');
        const bar = await BarModel.findById(barId);
        
        if (!bar || bar.owner_id !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }
      }

      const {
        user_id,
        type,
        date_from,
        date_to,
        reference_type,
        page = 1,
        limit = 20
      } = req.query;

      const filters: PointsFilters = { bar_id: barId };
      
      if (user_id) filters.user_id = user_id as string;
      if (type) filters.type = type as string;
      if (date_from) filters.date_from = new Date(date_from as string);
      if (date_to) filters.date_to = new Date(date_to as string);
      if (reference_type) filters.reference_type = reference_type as string;

      // Get transactions for the bar
      const result = await PointsModel.getUserTransactions(
        '', // Empty user_id to get all users
        barId,
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error getting bar transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get bar transactions'
      });
    }
  }

  // Bulk add points to multiple users (admin only)
  static async bulkAddPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bar_id, users, amount, description, reference_type } = req.body;
      const adminId = req.user!.id;

      // Verify admin has permission for this bar
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        const { BarModel } = await import('../../../shared/models/Bar');
        const bar = await BarModel.findById(bar_id);
        
        if (!bar || bar.owner_id !== adminId) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }
      }

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Users array is required and cannot be empty'
        });
      }

      const transactions = [];
      const errors = [];

      // Process each user
      for (const userId of users) {
        try {
          const transactionData: CreatePointsTransactionData = {
            user_id: userId,
            bar_id,
            type: 'bonus',
            amount: Math.abs(amount),
            description: `Bulk bonus: ${description}`,
            reference_type: reference_type || 'bulk_bonus',
            metadata: {
              admin_id: adminId,
              bulk_operation: true
            }
          };

          const transaction = await PointsModel.addTransaction(transactionData);
          transactions.push(transaction);
        } catch (error) {
          errors.push({
            user_id: userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        data: {
          successful_transactions: transactions.length,
          failed_transactions: errors.length,
          transactions,
          errors
        },
        message: `Bulk points operation completed. ${transactions.length} successful, ${errors.length} failed.`
      });
    } catch (error) {
      logger.error('Error in bulk add points:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process bulk points operation'
      });
    }
  }

  // Get user points summary across all bars
  static async getUserPointsSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Get user points for all bars
      const result = await PointsModel.pool.query(
        `SELECT 
           up.bar_id,
           b.name as bar_name,
           up.current_balance,
           up.total_earned,
           up.total_spent,
           up.last_activity
         FROM user_points up
         JOIN bars b ON up.bar_id = b.id
         WHERE up.user_id = $1
         ORDER BY up.last_activity DESC`,
        [userId]
      );

      const summary = {
        total_bars: result.rows.length,
        total_balance: result.rows.reduce((sum, row) => sum + row.current_balance, 0),
        total_earned: result.rows.reduce((sum, row) => sum + row.total_earned, 0),
        total_spent: result.rows.reduce((sum, row) => sum + row.total_spent, 0),
        bars: result.rows
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting user points summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user points summary'
      });
    }
  }
}