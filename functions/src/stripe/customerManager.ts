import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { StripeCustomer } from '../types';
import { UserOperations } from '../firestore/userOperations';
import { Logger } from '../utils/logger';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export class CustomerManager {
  private static stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
  });
  private static logger = Logger.getInstance();

  /**
   * Handle customer created event
   */
  static async handleCustomerCreated(customer: StripeCustomer): Promise<void> {
    try {
      this.logger.logStripeEvent('customer.created', customer.id);

      // Extract user ID from metadata if available
      const userId = customer.metadata.userId;
      
      if (!userId) {
        this.logger.warn(`No userId found in customer metadata for ${customer.id}`);
        return;
      }

      // Create user with Stripe customer data
      const userSubscriptionData = {
        stripeCustomerId: customer.id,
        subscriptionStatus: 'free' as const,
        subscriptionTier: 'freemium' as const
      };

      await UserOperations.createUserWithSubscription(
        userId,
        customer.id,
        customer.email || '',
        userSubscriptionData
      );

      this.logger.info(`Customer created successfully for user ${userId}`, {
        customerId: customer.id,
        email: customer.email
      });

    } catch (error) {
      this.logger.error('Error handling customer created:', error);
      throw error;
    }
  }

  /**
   * Handle customer updated event
   */
  static async handleCustomerUpdated(customer: StripeCustomer): Promise<void> {
    try {
      this.logger.logStripeEvent('customer.updated', customer.id);

      const userId = await UserOperations.getUserByStripeCustomerId(customer.id);

      if (!userId) {
        this.logger.warn(`No user found for customer ${customer.id}`);
        return;
      }

      // Update user email if it changed
      if (customer.email) {
        await UserOperations.updateUserSubscription(userId, {
          email: customer.email
        });
      }

      this.logger.info(`Customer updated successfully for user ${userId}`, {
        customerId: customer.id,
        email: customer.email
      });

    } catch (error) {
      this.logger.error('Error handling customer updated:', error);
      throw error;
    }
  }

  /**
   * Handle customer deleted event
   */
  static async handleCustomerDeleted(customer: StripeCustomer): Promise<void> {
    try {
      this.logger.logStripeEvent('customer.deleted', customer.id);

      const userId = await UserOperations.getUserByStripeCustomerId(customer.id);

      if (!userId) {
        this.logger.warn(`No user found for customer ${customer.id}`);
        return;
      }

      // Cancel all subscriptions for this customer
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customer.id,
        status: 'active'
      });

      for (const subscription of subscriptions.data) {
        await this.stripe.subscriptions.cancel(subscription.id);
      }

      // Update user to free tier
      const userSubscriptionData = {
        subscriptionStatus: 'canceled' as const,
        subscriptionTier: 'freemium' as const,
        subscriptionId: undefined,
        subscriptionEndDate: undefined,
        cancelAtPeriodEnd: false,
        canceledAt: admin.firestore.FieldValue.serverTimestamp(),
        nextBillingDate: undefined
      };

      await UserOperations.updateUserSubscription(userId, userSubscriptionData);

      this.logger.info(`Customer deleted successfully for user ${userId}`, {
        customerId: customer.id
      });

    } catch (error) {
      this.logger.error('Error handling customer deleted:', error);
      throw error;
    }
  }

  /**
   * Create Stripe customer for user
   */
  static async createStripeCustomer(
    userId: string,
    email: string,
    name?: string
  ): Promise<StripeCustomer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId
        }
      });

      this.logger.info(`Stripe customer created for user ${userId}`, {
        customerId: customer.id,
        email: customer.email
      });

      return {
        id: customer.id,
        object: customer.object,
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
        created: customer.created
      } as StripeCustomer;
    } catch (error) {
      this.logger.error(`Error creating Stripe customer for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get Stripe customer by ID
   */
  static async getStripeCustomer(customerId: string): Promise<StripeCustomer | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        return null;
      }

      return customer as StripeCustomer;
    } catch (error) {
      this.logger.error(`Error getting Stripe customer ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Update Stripe customer
   */
  static async updateStripeCustomer(
    customerId: string,
    updateData: {
      email?: string;
      name?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<StripeCustomer> {
    try {
      const customer = await this.stripe.customers.update(customerId, updateData);

      this.logger.info(`Stripe customer updated ${customerId}`, updateData);

      return customer as StripeCustomer;
    } catch (error) {
      this.logger.error(`Error updating Stripe customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Delete Stripe customer
   */
  static async deleteStripeCustomer(customerId: string): Promise<void> {
    try {
      await this.stripe.customers.del(customerId);

      this.logger.info(`Stripe customer deleted ${customerId}`);
    } catch (error) {
      this.logger.error(`Error deleting Stripe customer ${customerId}:`, error);
      throw error;
    }
  }
}
