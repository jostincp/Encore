/**
 * Stripe Service - Complete PCI DSS Compliant Payment Processing
 * Handles all Stripe operations with security, logging, and error handling
 */

import Stripe from 'stripe';
import crypto from 'crypto';
import logger from '../../../shared/utils/logger';
import { getSecretsManager } from '../../../shared/utils/secrets';
import { getPool } from '../../../shared/database';
import { getRedisClient } from '../../../shared/utils/redis';

interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  apiVersion: string;
}

interface PaymentIntentData {
  amount: number;
  currency: string;
  userId: string;
  barId?: string;
  pointsAmount: number;
  description?: string;
  metadata?: Record<string, any>;
}

interface RefundData {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

class StripeService {
  private stripe!: Stripe;
  private config!: StripeConfig;
  private redis: any;

  constructor() {
    this.redis = getRedisClient();
    this.initializeStripe();
  }

  /**
   * Initialize Stripe with secrets from AWS Secrets Manager
   */
  private async initializeStripe(): Promise<void> {
    try {
      const secretsManager = getSecretsManager();

      // Get Stripe secrets from AWS Secrets Manager in production
      if (process.env.NODE_ENV === 'production') {
        const stripeSecrets = await secretsManager.getSecret('encore/stripe-api');

        this.config = {
          secretKey: stripeSecrets.secretKey,
          webhookSecret: stripeSecrets.webhookSecret,
          publishableKey: stripeSecrets.publishableKey,
          apiVersion: '2025-08-27.basil'
        };
      } else {
        // Use environment variables in development
        this.config = {
          secretKey: process.env.STRIPE_SECRET_KEY!,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
          apiVersion: '2025-08-27.basil'
        };
      }

      this.stripe = new Stripe(this.config.secretKey, {
        apiVersion: this.config.apiVersion as any,
        timeout: 20000, // 20 second timeout
        maxNetworkRetries: 3
      });

      logger.info('Stripe service initialized successfully', {
        service: 'stripe-service',
        environment: process.env.NODE_ENV
      });
    } catch (error) {
      logger.error('Failed to initialize Stripe service', {
        service: 'stripe-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a PCI DSS compliant payment intent
   */
  async createPaymentIntent(data: PaymentIntentData): Promise<Stripe.PaymentIntent> {
    const startTime = Date.now();

    try {
      logger.info('Creating payment intent', {
        service: 'stripe-service',
        userId: data.userId,
        amount: data.amount,
        pointsAmount: data.pointsAmount
      });

      // Validate input data
      this.validatePaymentData(data);

      // Create or get Stripe customer
      const customer = await this.getOrCreateCustomer(data.userId);

      // Create payment intent with enhanced security
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency,
        customer: customer.id,
        payment_method_types: ['card'],
        setup_future_usage: 'off_session', // Allow saving payment methods
        description: data.description || `Purchase of ${data.pointsAmount} points`,
        metadata: {
          user_id: data.userId,
          bar_id: data.barId || '',
          points_amount: data.pointsAmount.toString(),
          service: 'encore-points',
          created_at: new Date().toISOString(),
          ...data.metadata
        },
        // Enhanced security features
        automatic_payment_methods: {
          enabled: false // Disable automatic payment methods for better control
        },
        // PCI DSS compliance
        application_fee_amount: undefined, // No application fees for now
        transfer_data: undefined, // Direct charges to platform
        on_behalf_of: undefined
      });

      const duration = Date.now() - startTime;

      logger.info('Payment intent created successfully', {
        service: 'stripe-service',
        paymentIntentId: paymentIntent.id,
        clientSecret: this.maskClientSecret(paymentIntent.client_secret!),
        duration: `${duration}ms`,
        userId: data.userId
      });

      // Cache payment intent for faster retrieval
      await this.cachePaymentIntent(paymentIntent.id, paymentIntent, 3600); // 1 hour

      return paymentIntent;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Failed to create payment intent', {
        service: 'stripe-service',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId,
        amount: data.amount,
        duration: `${duration}ms`
      });

      throw this.handleStripeError(error);
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string): Promise<Stripe.PaymentIntent> {
    try {
      logger.info('Confirming payment intent', {
        service: 'stripe-service',
        paymentIntentId,
        paymentMethodId
      });

      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
        return_url: `${process.env.FRONTEND_URL}/payment/success`
      });

      logger.info('Payment intent confirmed', {
        service: 'stripe-service',
        paymentIntentId,
        status: paymentIntent.status
      });

      // Update cache
      await this.cachePaymentIntent(paymentIntentId, paymentIntent, 3600);

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to confirm payment intent', {
        service: 'stripe-service',
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.handleStripeError(error);
    }
  }

  /**
   * Create a refund with enhanced validation
   */
  async createRefund(data: RefundData): Promise<Stripe.Refund> {
    try {
      logger.info('Creating refund', {
        service: 'stripe-service',
        paymentIntentId: data.paymentIntentId,
        amount: data.amount,
        reason: data.reason
      });

      // Get payment intent to validate refund
      const paymentIntent = await this.stripe.paymentIntents.retrieve(data.paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Cannot refund payment with status: ${paymentIntent.status}`);
      }

      // Calculate refund amount
      const refundAmount = data.amount || paymentIntent.amount;

      if (refundAmount > paymentIntent.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      const refund = await this.stripe.refunds.create({
        payment_intent: data.paymentIntentId,
        amount: refundAmount,
        reason: this.mapRefundReason(data.reason),
        metadata: {
          service: 'encore-points',
          refunded_at: new Date().toISOString(),
          original_amount: paymentIntent.amount.toString(),
          ...data.metadata
        }
      });

      logger.info('Refund created successfully', {
        service: 'stripe-service',
        refundId: refund.id,
        paymentIntentId: data.paymentIntentId,
        amount: refundAmount
      });

      return refund;
    } catch (error) {
      logger.error('Failed to create refund', {
        service: 'stripe-service',
        paymentIntentId: data.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.handleStripeError(error);
    }
  }

  /**
   * Handle Stripe webhooks with comprehensive event processing
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    try {
      // Verify webhook signature for security
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.webhookSecret
      );

      logger.info('Processing Stripe webhook', {
        service: 'stripe-service',
        eventId: event.id,
        eventType: event.type,
        created: event.created
      });

      // Process different event types
      await this.processWebhookEvent(event);

      // Log successful webhook processing
      logger.info('Webhook processed successfully', {
        service: 'stripe-service',
        eventId: event.id,
        eventType: event.type
      });

    } catch (error) {
      logger.error('Webhook processing failed', {
        service: 'stripe-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process individual webhook events
   */
  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    const eventData = event.data.object as any;

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(eventData);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(eventData);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentIntentCanceled(eventData);
        break;

      case 'charge.dispute.created':
        await this.handleChargeDisputeCreated(eventData);
        break;

      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(eventData);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(eventData);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(eventData);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(eventData);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(eventData);
        break;

      default:
        logger.info('Unhandled webhook event type', {
          service: 'stripe-service',
          eventType: event.type,
          eventId: event.id
        });
    }

    // Store webhook event for audit purposes
    await this.storeWebhookEvent(event);
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const pool = getPool();

    try {
      // Update payment status in database
      await pool.query(`
        UPDATE payments
        SET status = 'succeeded',
            stripe_payment_intent_id = $1,
            updated_at = NOW()
        WHERE stripe_payment_intent_id = $1
      `, [paymentIntent.id]);

      // Award points to user
      const pointsAmount = parseInt(paymentIntent.metadata.points_amount);
      const userId = paymentIntent.metadata.user_id;

      if (pointsAmount && userId) {
        await pool.query(`
          UPDATE users
          SET points_balance = points_balance + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [pointsAmount, userId]);

        // Log points transaction
        await pool.query(`
          INSERT INTO points_transactions (user_id, amount, type, description, metadata)
          VALUES ($1, $2, 'earned', 'Points purchased', $3)
        `, [userId, pointsAmount, JSON.stringify({
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        })]);
      }

      logger.info('Payment processed successfully', {
        service: 'stripe-service',
        paymentIntentId: paymentIntent.id,
        userId,
        pointsAmount
      });

    } catch (error) {
      logger.error('Failed to process successful payment', {
        service: 'stripe-service',
        paymentIntentId: paymentIntent.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const pool = getPool();

    try {
      await pool.query(`
        UPDATE payments
        SET status = 'failed',
            updated_at = NOW()
        WHERE stripe_payment_intent_id = $1
      `, [paymentIntent.id]);

      logger.warn('Payment failed', {
        service: 'stripe-service',
        paymentIntentId: paymentIntent.id,
        userId: paymentIntent.metadata.user_id,
        lastError: paymentIntent.last_payment_error?.message
      });

    } catch (error) {
      logger.error('Failed to process failed payment', {
        service: 'stripe-service',
        paymentIntentId: paymentIntent.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle canceled payment
   */
  private async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const pool = getPool();

    try {
      await pool.query(`
        UPDATE payments
        SET status = 'canceled',
            updated_at = NOW()
        WHERE stripe_payment_intent_id = $1
      `, [paymentIntent.id]);

      logger.info('Payment canceled', {
        service: 'stripe-service',
        paymentIntentId: paymentIntent.id,
        userId: paymentIntent.metadata.user_id
      });

    } catch (error) {
      logger.error('Failed to process canceled payment', {
        service: 'stripe-service',
        paymentIntentId: paymentIntent.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle charge disputes
   */
  private async handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    logger.warn('Charge dispute created', {
      service: 'stripe-service',
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status
    });

    // TODO: Implement dispute handling logic
    // - Notify bar owner
    // - Update payment status
    // - Log dispute details
  }

  /**
   * Handle subscription events
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription created', {
      service: 'stripe-service',
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription updated', {
      service: 'stripe-service',
      subscriptionId: subscription.id,
      status: subscription.status
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription deleted', {
      service: 'stripe-service',
      subscriptionId: subscription.id
    });
  }

  /**
   * Handle invoice events
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Invoice payment succeeded', {
      service: 'stripe-service',
      invoiceId: invoice.id,
      subscriptionId: (invoice as any).subscription,
      amount: invoice.amount_paid
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.warn('Invoice payment failed', {
      service: 'stripe-service',
      invoiceId: invoice.id,
      subscriptionId: (invoice as any).subscription,
      amount: invoice.amount_due
    });
  }

  /**
   * Get or create Stripe customer
   */
  private async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
    const pool = getPool();

    // Check if user already has a Stripe customer ID
    const result = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    let customer: Stripe.Customer;

    if (result.rows[0]?.stripe_customer_id) {
      // Retrieve existing customer
      customer = await this.stripe.customers.retrieve(result.rows[0].stripe_customer_id) as Stripe.Customer;
    } else {
      // Get user details for customer creation
      const userResult = await pool.query(
        'SELECT email, name FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];

      // Create new customer
      customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          user_id: userId,
          service: 'encore-platform'
        }
      });

      // Store customer ID in database
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
        [customer.id, userId]
      );
    }

    return customer;
  }

  /**
   * Validate payment data
   */
  private validatePaymentData(data: PaymentIntentData): void {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!data.currency || !['usd', 'eur', 'gbp'].includes(data.currency.toLowerCase())) {
      throw new Error('Invalid currency');
    }

    if (!data.userId) {
      throw new Error('User ID is required');
    }

    if (!data.pointsAmount || data.pointsAmount <= 0) {
      throw new Error('Invalid points amount');
    }
  }

  /**
   * Map refund reason to Stripe format
   */
  private mapRefundReason(reason?: string): Stripe.RefundCreateParams.Reason {
    switch (reason?.toLowerCase()) {
      case 'duplicate':
        return 'duplicate';
      case 'fraudulent':
        return 'fraudulent';
      case 'requested_by_customer':
        return 'requested_by_customer';
      default:
        return 'requested_by_customer';
    }
  }

  /**
   * Handle Stripe errors with proper logging
   */
  private handleStripeError(error: any): Error {
    if (error.type) {
      switch (error.type) {
        case 'StripeCardError':
          return new Error(`Card error: ${error.message}`);
        case 'StripeRateLimitError':
          return new Error('Rate limit exceeded. Please try again later.');
        case 'StripeInvalidRequestError':
          return new Error(`Invalid request: ${error.message}`);
        case 'StripeAPIError':
          return new Error('Stripe API error. Please try again.');
        case 'StripeConnectionError':
          return new Error('Connection error. Please try again.');
        case 'StripeAuthenticationError':
          return new Error('Authentication error with payment processor.');
        default:
          return new Error(`Payment error: ${error.message}`);
      }
    }

    return error;
  }

  /**
   * Mask sensitive data in logs
   */
  private maskClientSecret(clientSecret: string): string {
    if (!clientSecret) return '';
    const parts = clientSecret.split('_secret_');
    return `${parts[0]}_secret_****${clientSecret.slice(-4)}`;
  }

  /**
   * Cache payment intent for performance
   */
  private async cachePaymentIntent(paymentIntentId: string, data: any, ttl: number): Promise<void> {
    try {
      await this.redis.setex(`payment_intent:${paymentIntentId}`, ttl, JSON.stringify(data));
    } catch (error) {
      logger.warn('Failed to cache payment intent', {
        service: 'stripe-service',
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Store webhook event for audit purposes
   */
  private async storeWebhookEvent(event: Stripe.Event): Promise<void> {
    const pool = getPool();

    try {
      await pool.query(`
        INSERT INTO webhook_events (event_id, event_type, event_data, processed_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (event_id) DO NOTHING
      `, [event.id, event.type, JSON.stringify(event)]);
    } catch (error) {
      logger.warn('Failed to store webhook event', {
        service: 'stripe-service',
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get Stripe configuration (for debugging)
   */
  getConfig(): { publishableKey: string } {
    return {
      publishableKey: this.config.publishableKey
    };
  }
}

// Export singleton instance
export const stripeService = new StripeService();
export default stripeService;