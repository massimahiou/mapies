import * as admin from 'firebase-admin';
import { SubscriptionDocument } from '../types';
import { Logger } from '../utils/logger';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export class SubscriptionOperations {
  private static db = admin.firestore();
  private static logger = Logger.getInstance();

  /**
   * Create subscription document
   */
  static async createSubscription(subscriptionData: SubscriptionDocument): Promise<void> {
    try {
      const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionData.stripeSubscriptionId);
      
      // Filter out undefined values to avoid Firestore errors
      const cleanData = Object.fromEntries(
        Object.entries(subscriptionData).filter(([_, value]) => value !== undefined)
      );
      
      await subscriptionRef.set({
        ...cleanData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logSubscriptionUpdate(
        subscriptionData.stripeSubscriptionId,
        'subscription_created',
        subscriptionData
      );
    } catch (error) {
      this.logger.error(`Error creating subscription ${subscriptionData.stripeSubscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription document
   */
  static async updateSubscription(
    subscriptionId: string,
    updateData: Partial<SubscriptionDocument>
  ): Promise<void> {
    try {
      const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
      
      // Filter out undefined values to avoid Firestore errors
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );
      
      await subscriptionRef.update({
        ...cleanData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_updated', updateData);
    } catch (error) {
      this.logger.error(`Error updating subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  static async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<SubscriptionDocument | null> {
    try {
      const subscriptionDoc = await this.db
        .collection('subscriptions')
        .doc(stripeSubscriptionId)
        .get();

      if (!subscriptionDoc.exists) {
        return null;
      }

      return subscriptionDoc.data() as SubscriptionDocument;
    } catch (error) {
      this.logger.error(`Error getting subscription ${stripeSubscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
      
      await subscriptionRef.update({
        status: 'canceled',
        cancelAtPeriodEnd: true,
        canceledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_canceled');
    } catch (error) {
      this.logger.error(`Error canceling subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * End subscription immediately
   */
  static async endSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
      
      await subscriptionRef.update({
        status: 'canceled',
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_ended');
    } catch (error) {
      this.logger.error(`Error ending subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Reactivate subscription
   */
  static async reactivateSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
      
      await subscriptionRef.update({
        status: 'active',
        cancelAtPeriodEnd: false,
        canceledAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_reactivated');
    } catch (error) {
      this.logger.error(`Error reactivating subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription period
   */
  static async updateSubscriptionPeriod(
    subscriptionId: string,
    currentPeriodStart: number,
    currentPeriodEnd: number
  ): Promise<void> {
    try {
      const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
      
      await subscriptionRef.update({
        currentPeriodStart: admin.firestore.Timestamp.fromMillis(currentPeriodStart * 1000),
        currentPeriodEnd: admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logSubscriptionUpdate(subscriptionId, 'period_updated', {
        currentPeriodStart,
        currentPeriodEnd
      });
    } catch (error) {
      this.logger.error(`Error updating subscription period for ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Get subscriptions by user ID
   */
  static async getSubscriptionsByUserId(userId: string): Promise<SubscriptionDocument[]> {
    try {
      const subscriptionsSnapshot = await this.db
        .collection('subscriptions')
        .where('userId', '==', userId)
        .get();

      return subscriptionsSnapshot.docs.map(doc => doc.data() as SubscriptionDocument);
    } catch (error) {
      this.logger.error(`Error getting subscriptions for user ${userId}:`, error);
      throw error;
    }
  }
}
