import * as admin from 'firebase-admin';
import { UserSubscriptionData } from '../types';
import { Logger } from '../utils/logger';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export class UserOperations {
  private static db = admin.firestore();
  private static logger = Logger.getInstance();

  /**
   * Update user subscription data
   */
  static async updateUserSubscription(
    userId: string,
    subscriptionData: Partial<UserSubscriptionData>
  ): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await userRef.update({
        ...subscriptionData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logUserUpdate(userId, 'subscription_updated', subscriptionData);
    } catch (error) {
      this.logger.error(`Error updating user subscription for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user by Stripe customer ID
   */
  static async getUserByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
    try {
      const usersSnapshot = await this.db
        .collection('users')
        .where('stripeCustomerId', '==', stripeCustomerId)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        return null;
      }

      return usersSnapshot.docs[0].id;
    } catch (error) {
      this.logger.error(`Error getting user by Stripe customer ID ${stripeCustomerId}:`, error);
      throw error;
    }
  }

  /**
   * Create new user with subscription data
   */
  static async createUserWithSubscription(
    userId: string,
    stripeCustomerId: string,
    email: string,
    subscriptionData: Partial<UserSubscriptionData>
  ): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await userRef.set({
        stripeCustomerId,
        email,
        subscriptionStatus: 'free',
        subscriptionTier: 'free',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...subscriptionData
      });

      this.logger.logUserUpdate(userId, 'user_created', { stripeCustomerId, email });
    } catch (error) {
      this.logger.error(`Error creating user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user subscription data
   */
  static async getUserSubscriptionData(userId: string): Promise<UserSubscriptionData | null> {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return null;
      }

      return userDoc.data() as UserSubscriptionData;
    } catch (error) {
      this.logger.error(`Error getting user subscription data for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user's last payment date
   */
  static async updateLastPaymentDate(userId: string): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await userRef.update({
        lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logUserUpdate(userId, 'payment_date_updated');
    } catch (error) {
      this.logger.error(`Error updating last payment date for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Set user subscription as canceled
   */
  static async cancelUserSubscription(userId: string): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await userRef.update({
        subscriptionStatus: 'canceled',
        cancelAtPeriodEnd: true,
        canceledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logUserUpdate(userId, 'subscription_canceled');
    } catch (error) {
      this.logger.error(`Error canceling subscription for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reactivate user subscription
   */
  static async reactivateUserSubscription(userId: string): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await userRef.update({
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: false,
        canceledAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.logger.logUserUpdate(userId, 'subscription_reactivated');
    } catch (error) {
      this.logger.error(`Error reactivating subscription for ${userId}:`, error);
      throw error;
    }
  }
}
