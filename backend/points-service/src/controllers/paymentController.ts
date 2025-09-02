import { Request, Response } from 'express';
import { PaymentModel, CreatePaymentData, PaymentFilters } from '../models/Payment';
import { logger } from '../../../shared/utils/logger';
import { AuthenticatedRequest } from '../../../shared/types/auth';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export class PaymentController {
  // Create payment intent for points purchase
  static async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bar_id, points_amount, payment_method_types = ['card'] } = req.body;
      const userId = req.user!.id;

      // Validate points amount
      if (!points_amount || points_amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid points amount'
        });
      }

      // Calculate price based on points (e.g., 1 point = $0.01)
      const pointsRate = parseFloat(process.env.POINTS_RATE || '0.01');
      const amount = Math.round(points_amount * pointsRate * 100); // Convert to cents

      // Validate minimum amount (Stripe minimum is $0.50)
      if (amount < 50) {
        return res.status(400).json({
          success: false,
          message: 'Minimum purchase amount is $0.50'
        });
      }

      const paymentData: CreatePaymentData = {
        user_id: userId,
        bar_id,
        amount: amount / 100, // Store in dollars
        currency: 'usd',
        points_amount,
        payment_method_types,
        metadata: {
          user_id: userId,
          bar_id,
          points_amount: points_amount.toString()
        }
      };

      const payment = await PaymentModel.createPaymentIntent(paymentData);

      res.status(201).json({
        success: true,
        data: {
          payment_id: payment.id,
          client_secret: payment.stripe_client_secret,
          amount: payment.amount,
          points_amount: payment.points_amount,
          status: payment.status
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

  // Get payment details
  static async getPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const userId = req.user!.id;

      const payment = await PaymentModel.findById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Check if user owns this payment or is admin
      if (payment.user_id !== userId && req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        // Check if user is bar owner
        const { BarModel } = await import('../../../shared/models/Bar');
        const bar = await BarModel.findById(payment.bar_id);
        
        if (!bar || bar.owner_id !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
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
      const userId = req.user!.id;
      const {
        bar_id,
        status,
        date_from,
        date_to,
        page = 1,
        limit = 20
      } = req.query;

      const filters: PaymentFilters = { user_id: userId };
      
      if (bar_id) filters.bar_id = bar_id as string;
      if (status) filters.status = status as string;
      if (date_from) filters.date_from = new Date(date_from as string);
      if (date_to) filters.date_to = new Date(date_to as string);

      const result = await PaymentModel.getPayments(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
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
        status,
        date_from,
        date_to,
        page = 1,
        limit = 20
      } = req.query;

      const filters: PaymentFilters = { bar_id: barId };
      
      if (user_id) filters.user_id = user_id as string;
      if (status) filters.status = status as string;
      if (date_from) filters.date_from = new Date(date_from as string);
      if (date_to) filters.date_to = new Date(date_to as string);

      const result = await PaymentModel.getPayments(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
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
      const { reason, amount } = req.body;
      const userId = req.user!.id;

      const payment = await PaymentModel.findById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Verify admin has permission for this bar
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        const { BarModel } = await import('../../../shared/models/Bar');
        const bar = await BarModel.findById(payment.bar_id);
        
        if (!bar || bar.owner_id !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }
      }

      if (payment.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Can only refund successful payments'
        });
      }

      const refundAmount = amount ? Math.min(amount, payment.amount) : payment.amount;
      
      const refundedPayment = await PaymentModel.refundPayment(
        paymentId,
        refundAmount,
        reason || 'Refund requested by admin'
      );

      res.json({
        success: true,
        data: refundedPayment,
        message: 'Payment refunded successfully'
      });
    } catch (error) {
      logger.error('Error refunding payment:', error);
      
      if (error instanceof Error && error.message.includes('already been refunded')) {
        return res.status(400).json({
          success: false,
          message: 'Payment has already been refunded'
        });
      }
      
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
      const sig = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

      if (!sig || !endpointSecret) {
        logger.error('Missing Stripe signature or webhook secret');
        return res.status(400).json({ error: 'Missing signature or secret' });
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        logger.error('Webhook signature verification failed:', err);
        return res.status(400).json({ error: 'Invalid signature' });
      }

      // Handle the event
      await PaymentModel.handleStripeWebhook({
        id: event.id,
        type: event.type,
        data: event.data,
        created: event.created
      });

      res.json({ received: true });
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  // Get payment methods for user
  static async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Get user's Stripe customer ID
      const { UserModel } = await import('../../../shared/models/User');
      const user = await UserModel.findById(userId);

      if (!user || !user.stripe_customer_id) {
        return res.json({
          success: true,
          data: {
            payment_methods: []
          }
        });
      }

      // Get payment methods from Stripe
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripe_customer_id,
        type: 'card'
      });

      res.json({
        success: true,
        data: {
          payment_methods: paymentMethods.data.map(pm => ({
            id: pm.id,
            type: pm.type,
            card: pm.card ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.exp_month,
              exp_year: pm.card.exp_year
            } : null
          }))
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
      const userId = req.user!.id;

      // Get user payment summary
      const result = await PaymentModel.pool.query(
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