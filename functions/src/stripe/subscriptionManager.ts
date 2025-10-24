import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { StripeSubscription, UserSubscriptionData, SubscriptionDocument } from '../types';
import { UserOperations } from '../firestore/userOperations';
import { SubscriptionOperations } from '../firestore/subscriptionOperations';
import { Logger } from '../utils/logger';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export class SubscriptionManager {
  private static stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
  });
  private static logger = Logger.getInstance();

  /**
   * Determine subscription tier based on price ID
   */
  private static getSubscriptionTier(priceId: string): 'premium' | 'pro' {
    const premiumPriceId = process.env.STRIPE_PRICE_ID_PREMIUM;
    const proPriceId = process.env.STRIPE_PRICE_ID_PRO;

    if (priceId === proPriceId) {
      return 'pro';
    }
    if (priceId === premiumPriceId) {
      return 'premium';
    }
    
    // Default to premium if price ID doesn't match
    return 'premium';
  }

  /**
   * Handle subscription created event
   */
  static async handleSubscriptionCreated(subscription: StripeSubscription): Promise<void> {
    try {
      this.logger.logStripeEvent('subscription.created', subscription.id);

      const customerId = subscription.customer;
      const userId = await UserOperations.getUserByStripeCustomerId(customerId);

      if (!userId) {
        this.logger.warn(`No user found for customer ${customerId}`);
        return;
      }

      // Get the first price item to determine tier
      const priceItem = subscription.items.data[0];
      const subscriptionTier = this.getSubscriptionTier(priceItem.price.id);

      // Update user subscription data
      const userSubscriptionData: Partial<UserSubscriptionData> = {
        subscriptionStatus: subscription.status as any,
        subscriptionId: subscription.id,
        subscriptionTier,
        subscriptionStartDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_start * 1000),
        subscriptionEndDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        nextBillingDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
      };

      await UserOperations.updateUserSubscription(userId, userSubscriptionData);

      // Create subscription document
      const subscriptionDoc: SubscriptionDocument = {
        userId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: admin.firestore.Timestamp.fromMillis(subscription.current_period_start * 1000),
        currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000) : undefined,
        endedAt: subscription.ended_at ? admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000) : undefined,
        metadata: subscription.metadata,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await SubscriptionOperations.createSubscription(subscriptionDoc);

      this.logger.info(`Subscription created successfully for user ${userId}`, {
        subscriptionId: subscription.id,
        tier: subscriptionTier
      });

    } catch (error) {
      this.logger.error('Error handling subscription created:', error);
      throw error;
    }
  }

  /**
   * Handle subscription updated event
   */
  static async handleSubscriptionUpdated(subscription: StripeSubscription): Promise<void> {
    try {
      this.logger.logStripeEvent('subscription.updated', subscription.id);

      const customerId = subscription.customer;
      const userId = await UserOperations.getUserByStripeCustomerId(customerId);

      if (!userId) {
        this.logger.warn(`No user found for customer ${customerId}`);
        return;
      }

      // Get the first price item to determine tier
      const priceItem = subscription.items.data[0];
      const subscriptionTier = this.getSubscriptionTier(priceItem.price.id);

      // Update user subscription data
      const userSubscriptionData: Partial<UserSubscriptionData> = {
        subscriptionStatus: subscription.status as any,
        subscriptionTier,
        subscriptionEndDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000) : undefined,
        nextBillingDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
      };

      await UserOperations.updateUserSubscription(userId, userSubscriptionData);

      // Update subscription document
      const subscriptionUpdateData: Partial<SubscriptionDocument> = {
        status: subscription.status,
        currentPeriodStart: admin.firestore.Timestamp.fromMillis(subscription.current_period_start * 1000),
        currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000) : undefined,
        endedAt: subscription.ended_at ? admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000) : undefined,
        metadata: subscription.metadata
      };

      await SubscriptionOperations.updateSubscription(subscription.id, subscriptionUpdateData);

      this.logger.info(`Subscription updated successfully for user ${userId}`, {
        subscriptionId: subscription.id,
        status: subscription.status
      });

    } catch (error) {
      this.logger.error('Error handling subscription updated:', error);
      throw error;
    }
  }

  /**
   * Handle subscription deleted event
   */
  static async handleSubscriptionDeleted(subscription: StripeSubscription): Promise<void> {
    try {
      this.logger.logStripeEvent('subscription.deleted', subscription.id);

      const customerId = subscription.customer;
      const userId = await UserOperations.getUserByStripeCustomerId(customerId);

      if (!userId) {
        this.logger.warn(`No user found for customer ${customerId}`);
        return;
      }

      // Update user subscription data
      const userSubscriptionData: Partial<UserSubscriptionData> = {
        subscriptionStatus: 'canceled',
        subscriptionTier: 'free',
        subscriptionId: undefined,
        subscriptionEndDate: undefined,
        cancelAtPeriodEnd: false,
        canceledAt: admin.firestore.Timestamp.fromMillis(subscription.ended_at! * 1000),
        nextBillingDate: undefined
      };

      await UserOperations.updateUserSubscription(userId, userSubscriptionData);

      // End subscription document
      await SubscriptionOperations.endSubscription(subscription.id);

      this.logger.info(`Subscription deleted successfully for user ${userId}`, {
        subscriptionId: subscription.id
      });

    } catch (error) {
      this.logger.error('Error handling subscription deleted:', error);
      throw error;
    }
  }

  /**
   * Handle invoice payment succeeded
   */
  static async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    try {
      this.logger.logStripeEvent('invoice.payment_succeeded', invoice.id);

      const customerId = invoice.customer;
      const userId = await UserOperations.getUserByStripeCustomerId(customerId);

      if (!userId) {
        this.logger.warn(`No user found for customer ${customerId}`);
        return;
      }

      // Update last payment date
      await UserOperations.updateLastPaymentDate(userId);

      // If this is a subscription invoice, update next billing date
      if (invoice.subscription) {
        const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
        const userSubscriptionData: Partial<UserSubscriptionData> = {
          nextBillingDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
        };
        await UserOperations.updateUserSubscription(userId, userSubscriptionData);
      }

      this.logger.info(`Payment succeeded for user ${userId}`, {
        invoiceId: invoice.id,
        amount: invoice.amount_paid
      });

    } catch (error) {
      this.logger.error('Error handling invoice payment succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle invoice payment failed
   */
  static async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    try {
      this.logger.logStripeEvent('invoice.payment_failed', invoice.id);

      const customerId = invoice.customer;
      const userId = await UserOperations.getUserByStripeCustomerId(customerId);

      if (!userId) {
        this.logger.warn(`No user found for customer ${customerId}`);
        return;
      }

      // Update user subscription status to past_due
      const userSubscriptionData: Partial<UserSubscriptionData> = {
        subscriptionStatus: 'past_due'
      };

      await UserOperations.updateUserSubscription(userId, userSubscriptionData);

      this.logger.warn(`Payment failed for user ${userId}`, {
        invoiceId: invoice.id,
        amount: invoice.amount_due
      });

    } catch (error) {
      this.logger.error('Error handling invoice payment failed:', error);
      throw error;
    }
  }
}
