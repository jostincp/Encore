/**
 * Subscription Service - Manejo de suscripciones recurrentes
 * Gestiona suscripciones premium, renovaciones automáticas y beneficios
 */

import Stripe from 'stripe';
import logger from '../../../shared/utils/logger';
import { getPool } from '../../../shared/database';
import stripeService from './stripeService';

interface SubscriptionData {
  userId: string;
  planId: string;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  pointsBonus: number;
  features: string[];
  stripePriceId: string;
}

class SubscriptionService {
  private plans: SubscriptionPlan[] = [
    {
      id: 'premium_monthly',
      name: 'Premium Mensual',
      description: 'Acceso premium con beneficios exclusivos',
      price: 9.99,
      currency: 'usd',
      interval: 'month',
      pointsBonus: 100,
      features: ['Sin anuncios', 'Puntos extra', 'Soporte prioritario'],
      stripePriceId: 'price_premium_monthly'
    },
    {
      id: 'premium_yearly',
      name: 'Premium Anual',
      description: 'Acceso premium con descuento anual',
      price: 99.99,
      currency: 'usd',
      interval: 'year',
      pointsBonus: 1200,
      features: ['Sin anuncios', 'Puntos extra', 'Soporte prioritario', 'Descuento 17%'],
      stripePriceId: 'price_premium_yearly'
    }
  ];

  /**
   * Crear una suscripción
   */
  async createSubscription(data: SubscriptionData): Promise<Stripe.Subscription> {
    try {
      logger.info('Creating subscription', {
        service: 'subscription-service',
        userId: data.userId,
        planId: data.planId
      });

      const plan = this.plans.find(p => p.id === data.planId);
      if (!plan) {
        throw new Error(`Plan ${data.planId} not found`);
      }

      // Crear suscripción en Stripe
      const subscription = await this.createStripeSubscription(data, plan);

      // Guardar en base de datos
      await this.saveSubscription(data.userId, subscription, plan);

      // Otorgar puntos de bonificación
      await this.grantBonusPoints(data.userId, plan.pointsBonus);

      logger.info('Subscription created successfully', {
        service: 'subscription-service',
        subscriptionId: subscription.id,
        userId: data.userId,
        planId: data.planId
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create subscription', {
        service: 'subscription-service',
        userId: data.userId,
        planId: data.planId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Cancelar una suscripción
   */
  async cancelSubscription(subscriptionId: string, userId: string): Promise<Stripe.Subscription> {
    try {
      logger.info('Canceling subscription', {
        service: 'subscription-service',
        subscriptionId,
        userId
      });

      // Verificar que el usuario es el propietario
      await this.verifySubscriptionOwnership(subscriptionId, userId);

      // Cancelar en Stripe
      const subscription = await this.cancelStripeSubscription(subscriptionId);

      // Actualizar en base de datos
      await this.updateSubscriptionStatus(subscriptionId, 'canceled');

      logger.info('Subscription canceled successfully', {
        service: 'subscription-service',
        subscriptionId,
        userId
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', {
        service: 'subscription-service',
        subscriptionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Obtener suscripciones del usuario
   */
  async getUserSubscriptions(userId: string): Promise<any[]> {
    const pool = getPool();

    try {
      const result = await pool.query(`
        SELECT s.*, p.name as plan_name, p.description as plan_description,
               p.price as plan_price, p.points_bonus
        FROM subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get user subscriptions', {
        service: 'subscription-service',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Obtener planes disponibles
   */
  getAvailablePlans(): SubscriptionPlan[] {
    return this.plans;
  }

  /**
   * Procesar renovación de suscripción
   */
  async processSubscriptionRenewal(subscriptionId: string): Promise<void> {
    try {
      logger.info('Processing subscription renewal', {
        service: 'subscription-service',
        subscriptionId
      });

      const pool = getPool();

      // Obtener detalles de la suscripción
      const result = await pool.query(`
        SELECT s.*, p.points_bonus
        FROM subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.stripe_subscription_id = $1
      `, [subscriptionId]);

      if (result.rows.length === 0) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const subscription = result.rows[0];

      // Otorgar puntos de renovación
      await this.grantBonusPoints(subscription.user_id, subscription.points_bonus);

      // Actualizar fecha de renovación
      await pool.query(`
        UPDATE subscriptions
        SET current_period_end = CURRENT_TIMESTAMP + INTERVAL '1 month',
            updated_at = NOW()
        WHERE stripe_subscription_id = $1
      `, [subscriptionId]);

      logger.info('Subscription renewal processed', {
        service: 'subscription-service',
        subscriptionId,
        userId: subscription.user_id,
        pointsGranted: subscription.points_bonus
      });

    } catch (error) {
      logger.error('Failed to process subscription renewal', {
        service: 'subscription-service',
        subscriptionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Verificar propiedad de suscripción
   */
  private async verifySubscriptionOwnership(subscriptionId: string, userId: string): Promise<void> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT user_id FROM subscriptions
      WHERE stripe_subscription_id = $1
    `, [subscriptionId]);

    if (result.rows.length === 0) {
      throw new Error('Subscription not found');
    }

    if (result.rows[0].user_id !== userId) {
      throw new Error('Unauthorized access to subscription');
    }
  }

  /**
   * Crear suscripción en Stripe
   */
  private async createStripeSubscription(data: SubscriptionData, plan: SubscriptionPlan): Promise<Stripe.Subscription> {
    // This would integrate with Stripe's subscription API
    // For now, return a mock object
    return {
      id: `sub_${Date.now()}`,
      customer: 'cus_mock',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      items: {
        data: [{
          price: {
            id: plan.stripePriceId,
            currency: plan.currency,
            unit_amount: Math.round(plan.price * 100)
          }
        }]
      }
    } as any;
  }

  /**
   * Cancelar suscripción en Stripe
   */
  private async cancelStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    // This would integrate with Stripe's cancel subscription API
    return {
      id: subscriptionId,
      status: 'canceled'
    } as any;
  }

  /**
   * Guardar suscripción en base de datos
   */
  private async saveSubscription(userId: string, subscription: Stripe.Subscription, plan: SubscriptionPlan): Promise<void> {
    const pool = getPool();

    await pool.query(`
      INSERT INTO subscriptions (
        user_id, stripe_subscription_id, plan_id, status,
        current_period_start, current_period_end, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `, [
      userId,
      subscription.id,
      plan.id,
      subscription.status,
      new Date((subscription as any).current_period_start * 1000),
      new Date((subscription as any).current_period_end * 1000)
    ]);
  }

  /**
   * Actualizar estado de suscripción
   */
  private async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void> {
    const pool = getPool();

    await pool.query(`
      UPDATE subscriptions
      SET status = $1, updated_at = NOW()
      WHERE stripe_subscription_id = $2
    `, [status, subscriptionId]);
  }

  /**
   * Otorgar puntos de bonificación
   */
  private async grantBonusPoints(userId: string, points: number): Promise<void> {
    const pool = getPool();

    await pool.query(`
      UPDATE users
      SET points_balance = points_balance + $1,
          updated_at = NOW()
      WHERE id = $2
    `, [points, userId]);

    // Registrar transacción
    await pool.query(`
      INSERT INTO points_transactions (user_id, amount, type, description)
      VALUES ($1, $2, 'bonus', 'Subscription bonus points')
    `, [userId, points]);
  }
}

export const subscriptionService = new SubscriptionService();
export default subscriptionService;