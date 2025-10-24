"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserOperations = void 0;
const admin = require("firebase-admin");
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
class UserOperations {
    /**
     * Update user subscription data
     */
    static async updateUserSubscription(userId, subscriptionData) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.update(Object.assign(Object.assign({}, subscriptionData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            this.logger.logUserUpdate(userId, 'subscription_updated', subscriptionData);
        }
        catch (error) {
            this.logger.error(`Error updating user subscription for ${userId}:`, error);
            throw error;
        }
    }
    /**
     * Get user by Stripe customer ID
     */
    static async getUserByStripeCustomerId(stripeCustomerId) {
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
        }
        catch (error) {
            this.logger.error(`Error getting user by Stripe customer ID ${stripeCustomerId}:`, error);
            throw error;
        }
    }
    /**
     * Create new user with subscription data
     */
    static async createUserWithSubscription(userId, stripeCustomerId, email, subscriptionData) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.set(Object.assign({ stripeCustomerId,
                email, subscriptionStatus: 'free', subscriptionTier: 'free', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, subscriptionData));
            this.logger.logUserUpdate(userId, 'user_created', { stripeCustomerId, email });
        }
        catch (error) {
            this.logger.error(`Error creating user ${userId}:`, error);
            throw error;
        }
    }
    /**
     * Get user subscription data
     */
    static async getUserSubscriptionData(userId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return null;
            }
            return userDoc.data();
        }
        catch (error) {
            this.logger.error(`Error getting user subscription data for ${userId}:`, error);
            throw error;
        }
    }
    /**
     * Update user's last payment date
     */
    static async updateLastPaymentDate(userId) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.update({
                lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            this.logger.logUserUpdate(userId, 'payment_date_updated');
        }
        catch (error) {
            this.logger.error(`Error updating last payment date for ${userId}:`, error);
            throw error;
        }
    }
    /**
     * Set user subscription as canceled
     */
    static async cancelUserSubscription(userId) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.update({
                subscriptionStatus: 'canceled',
                cancelAtPeriodEnd: true,
                canceledAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            this.logger.logUserUpdate(userId, 'subscription_canceled');
        }
        catch (error) {
            this.logger.error(`Error canceling subscription for ${userId}:`, error);
            throw error;
        }
    }
    /**
     * Reactivate user subscription
     */
    static async reactivateUserSubscription(userId) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.update({
                subscriptionStatus: 'active',
                cancelAtPeriodEnd: false,
                canceledAt: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            this.logger.logUserUpdate(userId, 'subscription_reactivated');
        }
        catch (error) {
            this.logger.error(`Error reactivating subscription for ${userId}:`, error);
            throw error;
        }
    }
}
exports.UserOperations = UserOperations;
UserOperations.db = admin.firestore();
UserOperations.logger = logger_1.Logger.getInstance();
//# sourceMappingURL=userOperations.js.map