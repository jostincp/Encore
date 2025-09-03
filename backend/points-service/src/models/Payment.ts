import { Pool } from 'pg';
import { getPool } from '../../../shared/database';
import { getRedisClient } from '../../../shared/utils/redis';
import logger from '../../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
});

// Interfaces
export interface PaymentData {
  id: string;
  user_id: string;
  bar_id: string;
  stripe_payment_intent_id: string;
  amount: number; // Amount in cents
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  payment_method?: string;
  points_purchased: number;
  description: string;
  metadata?: any;
  stripe_client_secret?: string;
  failure_reason?: string;
  refund_amount?: number;
  refunded_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentData {
  user_id: string;
  bar_id: string;
  amount: number; // Amount in cents
  currency: string;
  points_purchased: number;
  description: string;
  metadata?: any;
}

export interface PaymentFilters {
  user_id?: string;
  bar_id?: string;
  status?: string;
  date_from?: Date;
  date_to?: Date;
  amount_min?: number;
  amount_max?: number;
}

export interface PaginatedPaymentResult {
  payments: PaymentData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaymentStats {
  total_payments: number;
  total_amount: number;
  total_points_sold: number;
  average_payment_amount: number;
  success_rate: number;
  payment_volume_by_status: Array<{
    status: string;
    count: number;
    total_amount: number;
  }>;
  daily_revenue: Array<{
    date: string;
    payments: number;
    amount: number;
    points_sold: number;
  }>;
  top_customers: Array<{
    user_id: string;
    username: string;
    total_spent: number;
    total_points_purchased: number;
  }>;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

export class PaymentModel {
  // Create payment intent with Stripe
  static async createPaymentIntent(paymentData: CreatePaymentData): Promise<PaymentData> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Create Stripe Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: paymentData.amount,
        currency: paymentData.currency,
        metadata: {
          user_id: paymentData.user_id,
          bar_id: paymentData.bar_id,
          points_purchased: paymentData.points_purchased.toString(),
          description: paymentData.description,
          ...paymentData.metadata
        },
        description: paymentData.description
      });

      // Create payment record in database
      const paymentId = uuidv4();
      const result = await client.query(
        `INSERT INTO payments (id, user_id, bar_id, stripe_payment_intent_id, amount, currency, status, points_purchased, description, metadata, stripe_client_secret, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING *`,
        [
          paymentId,
          paymentData.user_id,
          paymentData.bar_id,
          paymentIntent.id,
          paymentData.amount,
          paymentData.currency,
          'pending',
          paymentData.points_purchased,
          paymentData.description,
          paymentData.metadata ? JSON.stringify(paymentData.metadata) : null,
          paymentIntent.client_secret
        ]
      );

      await client.query('COMMIT');

      const payment = result.rows[0];
      
      logger.info(`Payment intent created: ${payment.id} for user ${paymentData.user_id} - Amount: ${paymentData.amount} ${paymentData.currency}`);
      
      return payment;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating payment intent:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get payment by ID
  static async findById(paymentId: string): Promise<PaymentData | null> {
    try {
      const cacheKey = `payment:${paymentId}`;
      
      // Try cache first
      const redisClient = getRedisClient();
      const cached = await redisClient.get(cacheKey);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const result = await getPool().query(
        'SELECT * FROM payments WHERE id = $1',
        [paymentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const payment = result.rows[0];
      
      // Cache for 5 minutes
      await redisClient.setex(cacheKey, 300, JSON.stringify(payment));
      
      return payment;
    } catch (error) {
      logger.error('Error finding payment by ID:', error);
      throw error;
    }
  }

  // Get payment by Stripe Payment Intent ID
  static async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<PaymentData | null> {
    try {
      const result = await getPool().query(
        'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
        [stripePaymentIntentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error finding payment by Stripe Payment Intent ID:', error);
      throw error;
    }
  }

  // Update payment status
  static async updatePaymentStatus(
    paymentId: string,
    status: PaymentData['status'],
    paymentMethod?: string,
    failureReason?: string
  ): Promise<PaymentData> {
    try {
      const result = await getPool().query(
        `UPDATE payments 
         SET status = $2, payment_method = $3, failure_reason = $4, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [paymentId, status, paymentMethod || null, failureReason || null]
      );

      if (result.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const payment = result.rows[0];
      
      // Clear cache
      await this.clearPaymentCache(paymentId);
      
      logger.info(`Payment status updated: ${paymentId} -> ${status}`);
      
      return payment;
    } catch (error) {
      logger.error('Error updating payment status:', error);
      throw error;
    }
  }

  // Process successful payment (add points to user)
  static async processSuccessfulPayment(paymentId: string): Promise<void> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Get payment details
      const payment = await this.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'pending' && payment.status !== 'processing') {
        logger.warn(`Payment ${paymentId} already processed with status: ${payment.status}`);
        return;
      }

      // Update payment status to succeeded
      await this.updatePaymentStatus(paymentId, 'succeeded');

      // Add points to user (this will be handled by the points service)
      // We'll emit an event or make an API call to the points service
      const { PointsModel } = await import('./Points');
      
      await PointsModel.addTransaction({
        user_id: payment.user_id,
        bar_id: payment.bar_id,
        type: 'earn',
        amount: payment.points_purchased,
        description: `Points purchased via payment ${payment.id}`,
        reference_id: payment.id,
        reference_type: 'payment',
        metadata: {
          payment_amount: payment.amount,
          currency: payment.currency,
          stripe_payment_intent_id: payment.stripe_payment_intent_id
        }
      });

      await client.query('COMMIT');
      
      logger.info(`Payment processed successfully: ${paymentId} - ${payment.points_purchased} points added to user ${payment.user_id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing successful payment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Process failed payment
  static async processFailedPayment(paymentId: string, failureReason: string): Promise<void> {
    try {
      await this.updatePaymentStatus(paymentId, 'failed', undefined, failureReason);
      
      logger.info(`Payment failed: ${paymentId} - Reason: ${failureReason}`);
    } catch (error) {
      logger.error('Error processing failed payment:', error);
      throw error;
    }
  }

  // Refund payment
  static async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<PaymentData> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Get payment details
      const payment = await this.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'succeeded') {
        throw new Error('Can only refund succeeded payments');
      }

      // Create refund in Stripe
      const refundAmount = amount || payment.amount;
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: refundAmount,
        reason: 'requested_by_customer',
        metadata: {
          reason: reason || 'Refund requested'
        }
      });

      // Update payment record
      const result = await getPool().query(
        `UPDATE payments 
         SET status = $2, refund_amount = $3, refunded_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [paymentId, 'refunded', refundAmount]
      );

      // Deduct points from user if they were added
      const { PointsModel } = await import('./Points');
      
      await PointsModel.addTransaction({
        user_id: payment.user_id,
        bar_id: payment.bar_id,
        type: 'penalty',
        amount: payment.points_purchased,
        description: `Points deducted due to payment refund ${payment.id}`,
        reference_id: payment.id,
        reference_type: 'refund',
        metadata: {
          original_payment_id: payment.id,
          refund_amount: refundAmount,
          stripe_refund_id: refund.id,
          reason: reason
        }
      });

      await client.query('COMMIT');

      const updatedPayment = result.rows[0];
      
      // Clear cache
      await this.clearPaymentCache(paymentId);
      
      logger.info(`Payment refunded: ${paymentId} - Amount: ${refundAmount}`);
      
      return updatedPayment;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error refunding payment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get payments with filters and pagination
  static async getPayments(
    filters: PaymentFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedPaymentResult> {
    try {
      const offset = (page - 1) * limit;
      
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // Add filters
      if (filters.user_id) {
        whereConditions.push(`user_id = $${paramIndex}`);
        queryParams.push(filters.user_id);
        paramIndex++;
      }

      if (filters.bar_id) {
        whereConditions.push(`bar_id = $${paramIndex}`);
        queryParams.push(filters.bar_id);
        paramIndex++;
      }

      if (filters.status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(filters.status);
        paramIndex++;
      }

      if (filters.date_from) {
        whereConditions.push(`created_at >= $${paramIndex}`);
        queryParams.push(filters.date_from);
        paramIndex++;
      }

      if (filters.date_to) {
        whereConditions.push(`created_at <= $${paramIndex}`);
        queryParams.push(filters.date_to);
        paramIndex++;
      }

      if (filters.amount_min) {
        whereConditions.push(`amount >= $${paramIndex}`);
        queryParams.push(filters.amount_min);
        paramIndex++;
      }

      if (filters.amount_max) {
        whereConditions.push(`amount <= $${paramIndex}`);
        queryParams.push(filters.amount_max);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await getPool().query(
        `SELECT COUNT(*) FROM payments ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].count);

      // Get payments
      const paymentsResult = await getPool().query(
        `SELECT p.*, u.username 
         FROM payments p
         LEFT JOIN users u ON p.user_id = u.id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      return {
        payments: paymentsResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error getting payments:', error);
      throw error;
    }
  }

  // Get payment statistics
  static async getPaymentStats(barId?: string, dateFrom?: Date, dateTo?: Date): Promise<PaymentStats> {
    try {
      const cacheKey = `payment:stats:${barId || 'all'}:${dateFrom?.toISOString() || 'all'}:${dateTo?.toISOString() || 'all'}`;
      
      // Try cache first
      const cached = await getRedisClient().get(cacheKey);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }

      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      if (barId) {
        whereConditions.push(`p.bar_id = $${paramIndex}`);
        queryParams.push(barId);
        paramIndex++;
      }

      if (dateFrom) {
        whereConditions.push(`p.created_at >= $${paramIndex}`);
        queryParams.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        whereConditions.push(`p.created_at <= $${paramIndex}`);
        queryParams.push(dateTo);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get basic stats
      const basicStatsResult = await getPool().query(
        `SELECT 
           COUNT(*) as total_payments,
           COALESCE(SUM(amount), 0) as total_amount,
           COALESCE(SUM(points_purchased), 0) as total_points_sold,
           COALESCE(AVG(amount), 0) as average_payment_amount,
           COALESCE(COUNT(CASE WHEN status = 'succeeded' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as success_rate
         FROM payments p
         ${whereClause}`,
        queryParams
      );

      // Get payment volume by status
      const statusVolumeResult = await getPool().query(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
         FROM payments p
         ${whereClause}
         GROUP BY status
         ORDER BY total_amount DESC`,
        queryParams
      );

      // Get daily revenue
      const dailyRevenueResult = await getPool().query(
        `SELECT 
           DATE(p.created_at) as date,
           COUNT(*) as payments,
           COALESCE(SUM(p.amount), 0) as amount,
           COALESCE(SUM(p.points_purchased), 0) as points_sold
         FROM payments p
         ${whereClause}
         GROUP BY DATE(p.created_at)
         ORDER BY date DESC
         LIMIT 30`,
        queryParams
      );

      // Get top customers
      const topCustomersResult = await getPool().query(
        `SELECT 
           p.user_id,
           u.username,
           COALESCE(SUM(p.amount), 0) as total_spent,
           COALESCE(SUM(p.points_purchased), 0) as total_points_purchased
         FROM payments p
         LEFT JOIN users u ON p.user_id = u.id
         ${whereClause} AND p.status = 'succeeded'
         GROUP BY p.user_id, u.username
         ORDER BY total_spent DESC
         LIMIT 10`,
        queryParams
      );

      const stats: PaymentStats = {
        total_payments: parseInt(basicStatsResult.rows[0].total_payments),
        total_amount: parseInt(basicStatsResult.rows[0].total_amount),
        total_points_sold: parseInt(basicStatsResult.rows[0].total_points_sold),
        average_payment_amount: parseFloat(basicStatsResult.rows[0].average_payment_amount),
        success_rate: parseFloat(basicStatsResult.rows[0].success_rate),
        payment_volume_by_status: statusVolumeResult.rows,
        daily_revenue: dailyRevenueResult.rows,
        top_customers: topCustomersResult.rows
      };

      // Cache for 10 minutes
      await getRedisClient().setex(cacheKey, 600, JSON.stringify(stats));

      return stats;
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      throw error;
    }
  }

  // Handle Stripe webhook events
  static async handleStripeWebhook(event: StripeWebhookEvent): Promise<void> {
    try {
      logger.info(`Processing Stripe webhook: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        
        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object);
          break;
        
        case 'charge.dispute.created':
          await this.handleChargeDispute(event.data.object);
          break;
        
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      throw error;
    }
  }

  // Handle successful payment intent
  private static async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    try {
      const payment = await this.findByStripePaymentIntentId(paymentIntent.id);
      if (payment) {
        await this.processSuccessfulPayment(payment.id);
      }
    } catch (error) {
      logger.error('Error handling payment intent succeeded:', error);
      throw error;
    }
  }

  // Handle failed payment intent
  private static async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    try {
      const payment = await this.findByStripePaymentIntentId(paymentIntent.id);
      if (payment) {
        const failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
        await this.processFailedPayment(payment.id, failureReason);
      }
    } catch (error) {
      logger.error('Error handling payment intent failed:', error);
      throw error;
    }
  }

  // Handle canceled payment intent
  private static async handlePaymentIntentCanceled(paymentIntent: any): Promise<void> {
    try {
      const payment = await this.findByStripePaymentIntentId(paymentIntent.id);
      if (payment) {
        await this.updatePaymentStatus(payment.id, 'canceled');
      }
    } catch (error) {
      logger.error('Error handling payment intent canceled:', error);
      throw error;
    }
  }

  // Handle charge dispute
  private static async handleChargeDispute(dispute: any): Promise<void> {
    try {
      logger.warn(`Charge dispute created: ${dispute.id} - Amount: ${dispute.amount}`);
      // Additional dispute handling logic can be added here
    } catch (error) {
      logger.error('Error handling charge dispute:', error);
      throw error;
    }
  }

  // Clear payment cache
  static async clearPaymentCache(paymentId: string): Promise<void> {
    try {
      const cacheKey = `payment:${paymentId}`;
      await getRedisClient().del(cacheKey);
    } catch (error) {
      logger.error('Error clearing payment cache:', error);
    }
  }

  // Clear payment stats cache
  static async clearPaymentStatsCache(barId?: string): Promise<void> {
    try {
      const pattern = barId ? `payment:stats:${barId}:*` : 'payment:stats:*';
      const keys = await getRedisClient().keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await getRedisClient().del(key);
        }
      }
    } catch (error) {
      logger.error('Error clearing payment stats cache:', error);
    }
  }
}