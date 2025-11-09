import { Request, Response } from 'express';
import { PaymentModel, PaymentFilters } from '../models/Payment';
import { AuthenticatedRequest } from '../../../shared/utils/jwt';
import logger from '../../../shared/utils/logger';
import { getPool } from '../../../shared/database';
import stripeService from '../services/stripeService';
import { UserRole } from '../../../shared/types/index';

export class PaymentController {
  // Create payment intent
  static async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bar_id, points_amount, payment_method_types = ['card'] } = req.body;
      const userId = req.user!.userId;

      // Validate points amount
      if (!points_amount || points_amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid points amount'
        });
        return;
      }

      // Calculate amount in cents (assuming 1 point = $0.01)
      const pointsRate = parseFloat(process.env.POINTS_RATE || '0.01');
      const amount = Math.round(points_amount * pointsRate * 100); // Convert to cents

      // Create payment intent with Stripe service
      const paymentIntent = await stripeService.createPaymentIntent({
        amount,
        currency: 'usd',
        userId,
        barId: bar_id || '',
        pointsAmount: points_amount,
        description: `Purchase of ${points_amount} points`
      });

      // Save payment record to database
      const payment = await PaymentModel.createPaymentIntent({
        user_id: userId,
        bar_id: bar_id || '',
        amount: amount / 100, // Store in dollars
        currency: 'USD',
        points_purchased: points_amount,
        description: `Purchase of ${points_amount} points`,
        metadata: {
          user_id: userId,
          bar_id: bar_id || '',
          points_amount: points_amount.toString()
        }
      });

      res.json({
        success: true,
        data: {
          client_secret: paymentIntent.client_secret,
          payment_id: payment.id,
          amount: amount / 100,
          points_amount
        }
      });
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent'
      });
    }
  }

  // Get single payment
  static async getPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const userId = req.user!.userId;
     
     const payment = await PaymentModel.findById(paymentId);
     if (!payment) {
       res.status(404).json({
         success: false,
         message: 'Payment not found'
       });
       return;
     }

     // Check if user has permission to view this payment
     if (payment.user_id !== userId && req.user!.role !== UserRole.ADMIN) {
       // Check if user owns the bar
       const result = await getPool().query(
         'SELECT owner_id FROM bars WHERE id = $1',
         [payment.bar_id]
       );
       const bar = result.rows[0];
         
         if (!bar || bar.owner_id !== userId) {
           res.status(403).json({
             success: false,
             message: 'Insufficient permissions'
           });
           return;
         }
       }

       res.json({
         success: true,
         data: payment
       });
    } catch (error) {
      logger.error('Error getting payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment'
      });
    }
  }

  // Get user payments
  static async getUserPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const {
        bar_id,
        status,
        limit = 20,
        page = 1,
        date_from,
        date_to
      } = req.query;

      const filters: any = { user_id: userId };
      
      if (bar_id) filters.bar_id = bar_id;
      if (status) filters.status = status;
      if (date_from) filters.date_from = new Date(date_from as string);
      if (date_to) filters.date_to = new Date(date_to as string);

      const result = await PaymentModel.getPayments(
        filters,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      const payments = result.payments;
      const total = result.total;

      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            total,
            limit: parseInt(limit as string),
            page: parseInt(page as string),
            totalPages: result.totalPages,
            has_more: parseInt(page as string) < result.totalPages
          }
        }
      });
    } catch (error) {
      logger.error('Error getting user payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user payments'
      });
    }
  }

  // Get bar payments (admin/bar owner only)
  static async getBarPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = req.user!.userId;

      // Verify admin has permission for this bar
      if (req.user!.role !== UserRole.ADMIN) {
        const result = await getPool().query(
          'SELECT owner_id FROM bars WHERE id = $1',
          [barId]
        );
        const bar = result.rows[0];
        
        if (!bar || bar.owner_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      const {
        status,
        limit = 20,
        page = 1,
        date_from,
        date_to
      } = req.query;

      const filters: any = { bar_id: barId };
      
      if (status) filters.status = status;
      if (date_from) filters.date_from = new Date(date_from as string);
      if (date_to) filters.date_to = new Date(date_to as string);

      const result = await PaymentModel.getPayments(
        filters,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      const payments = result.payments;
      const total = result.total;

      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            total,
            limit: parseInt(limit as string),
            page: parseInt(page as string),
            totalPages: result.totalPages,
            has_more: parseInt(page as string) < result.totalPages
          }
        }
      });
    } catch (error) {
      logger.error('Error getting bar payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get bar payments'
      });
    }
  }

  // Refund payment (admin/bar owner only)
  static async refundPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      const userId = req.user!.userId;

      // Get payment details
      const payment = await PaymentModel.findById(paymentId);
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      // Check if payment can be refunded
      if (payment.status !== 'succeeded') {
        res.status(400).json({
          success: false,
          message: 'Payment cannot be refunded'
        });
        return;
      }

      // Verify admin has permission for this payment
      if (req.user!.role !== UserRole.ADMIN) {
        const result = await getPool().query(
          'SELECT owner_id FROM bars WHERE id = $1',
          [payment.bar_id]
        );
        const bar = result.rows[0];
        
        if (!bar || bar.owner_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      // Create refund with Stripe service
      const refund = await stripeService.createRefund({
        paymentIntentId: payment.stripe_payment_intent_id,
        reason: reason || 'No reason provided',
        metadata: {
          refunded_by: userId,
          original_payment_id: payment.id
        }
      });

      // Update payment status
      const updatedPayment = await PaymentModel.refundPayment(paymentId, refund.amount / 100, reason);

      res.json({
        success: true,
        data: {
          payment: updatedPayment,
          refund: {
            id: refund.id,
            amount: refund.amount / 100,
            status: refund.status
          }
        }
      });
    } catch (error) {
      logger.error('Error refunding payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refund payment'
      });
    }
  }

  // Get payment statistics (admin/bar owner only)
  static async getPaymentStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { date_from, date_to } = req.query;
      const userId = req.user!.userId;

      // Verify admin has permission for this bar
      if (req.user!.role !== UserRole.ADMIN) {
        const result = await getPool().query(
          'SELECT owner_id FROM bars WHERE id = $1',
          [barId]
        );
        const bar = result.rows[0];
        
        if (!bar || bar.owner_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }
      }

      const dateFrom = date_from ? new Date(date_from as string) : undefined;
      const dateTo = date_to ? new Date(date_to as string) : undefined;

      const stats = await PaymentModel.getPaymentStats(barId, dateFrom, dateTo);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment statistics'
      });
    }
  }

  // Handle Stripe webhooks
  static async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Use Stripe service for webhook handling
      await stripeService.handleWebhook(req.body, req.headers['stripe-signature'] as string);

      res.json({ received: true });
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  // Get payment methods for user
  static async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Get user's Stripe customer ID from database
      const userResult = await getPool().query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];

      if (!user || !user.stripe_customer_id) {
        res.json({
          success: true,
          data: {
            payment_methods: []
          }
        });
        return;
      }

      // Get payment methods from Stripe service
      // Note: This would need to be implemented in the Stripe service
      // For now, return empty array as placeholder
      res.json({
        success: true,
        data: {
          payment_methods: []
        }
      });
    } catch (error) {
      logger.error('Error getting payment methods:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment methods'
      });
    }
  }

  // Get points packages/pricing
  static async getPointsPackages(req: Request, res: Response): Promise<void> {
    try {
      const pointsRate = parseFloat(process.env.POINTS_RATE || '0.01');
      
      // Define standard packages
      const packages = [
        { points: 100, price: 100 * pointsRate, bonus: 0 },
        { points: 500, price: 500 * pointsRate, bonus: 25 }, // 5% bonus
        { points: 1000, price: 1000 * pointsRate, bonus: 100 }, // 10% bonus
        { points: 2500, price: 2500 * pointsRate, bonus: 375 }, // 15% bonus
        { points: 5000, price: 5000 * pointsRate, bonus: 1000 }, // 20% bonus
        { points: 10000, price: 10000 * pointsRate, bonus: 2500 } // 25% bonus
      ];

      res.json({
        success: true,
        data: {
          packages: packages.map(pkg => ({
            points: pkg.points,
            total_points: pkg.points + pkg.bonus,
            price: pkg.price,
            bonus: pkg.bonus,
            savings: pkg.bonus * pointsRate
          })),
          rate: pointsRate,
          currency: 'USD'
        }
      });
    } catch (error) {
      logger.error('Error getting points packages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get points packages'
      });
    }
  }

  // Get user payment summary
  static async getUserPaymentSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Get user payment summary
      const result = await getPool().query(
        `SELECT 
           COUNT(*) as total_payments,
           COALESCE(SUM(amount), 0) as total_spent,
           COALESCE(SUM(points_amount), 0) as total_points_purchased,
           COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
           COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_payments,
           MAX(created_at) as last_payment_date
         FROM payments 
         WHERE user_id = $1`,
        [userId]
      );

      const summary = result.rows[0];
      
      // Convert string numbers to integers/floats
      summary.total_payments = parseInt(summary.total_payments);
      summary.total_spent = parseFloat(summary.total_spent);
      summary.total_points_purchased = parseInt(summary.total_points_purchased);
      summary.successful_payments = parseInt(summary.successful_payments);
      summary.failed_payments = parseInt(summary.failed_payments);
      summary.refunded_payments = parseInt(summary.refunded_payments);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting user payment summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user payment summary'
      });
    }
  }
}