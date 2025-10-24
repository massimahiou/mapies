"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionOperations = void 0;
const admin = require("firebase-admin");
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
class SubscriptionOperations {
    /**
     * Create subscription document
     */
    static async createSubscription(subscriptionData) {
        try {
            const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionData.stripeSubscriptionId);
            await subscriptionRef.set(Object.assign(Object.assign({}, subscriptionData), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            this.logger.logSubscriptionUpdate(subscriptionData.stripeSubscriptionId, 'subscription_created', subscriptionData);
        }
        catch (error) {
            this.logger.error(`Error creating subscription ${subscriptionData.stripeSubscriptionId}:`, error);
            throw error;
        }
    }
    /**
     * Update subscription document
     */
    static async updateSubscription(subscriptionId, updateData) {
        try {
            const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
            await subscriptionRef.update(Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_updated', updateData);
        }
        catch (error) {
            this.logger.error(`Error updating subscription ${subscriptionId}:`, error);
            throw error;
        }
    }
    /**
     * Get subscription by Stripe subscription ID
     */
    static async getSubscriptionByStripeId(stripeSubscriptionId) {
        try {
            const subscriptionDoc = await this.db
                .collection('subscriptions')
                .doc(stripeSubscriptionId)
                .get();
            if (!subscriptionDoc.exists) {
                return null;
            }
            return subscriptionDoc.data();
        }
        catch (error) {
            this.logger.error(`Error getting subscription ${stripeSubscriptionId}:`, error);
            throw error;
        }
    }
    /**
     * Cancel subscription
     */
    static async cancelSubscription(subscriptionId) {
        try {
            const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
            await subscriptionRef.update({
                status: 'canceled',
                cancelAtPeriodEnd: true,
                canceledAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_canceled');
        }
        catch (error) {
            this.logger.error(`Error canceling subscription ${subscriptionId}:`, error);
            throw error;
        }
    }
    /**
     * End subscription immediately
     */
    static async endSubscription(subscriptionId) {
        try {
            const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
            await subscriptionRef.update({
                status: 'canceled',
                endedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_ended');
        }
        catch (error) {
            this.logger.error(`Error ending subscription ${subscriptionId}:`, error);
            throw error;
        }
    }
    /**
     * Reactivate subscription
     */
    static async reactivateSubscription(subscriptionId) {
        try {
            const subscriptionRef = this.db.collection('subscriptions').doc(subscriptionId);
            await subscriptionRef.update({
                status: 'active',
                cancelAtPeriodEnd: false,
                canceledAt: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            this.logger.logSubscriptionUpdate(subscriptionId, 'subscription_reactivated');
        }
        catch (error) {
            this.logger.error(`Error reactivating subscription ${subscriptionId}:`, error);
            throw error;
        }
    }
    /**
     * Update subscription period
     */
    static async updateSubscriptionPeriod(subscriptionId, currentPeriodStart, currentPeriodEnd) {
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
        }
        catch (error) {
            this.logger.error(`Error updating subscription period for ${subscriptionId}:`, error);
            throw error;
        }
    }
    /**
     * Get subscriptions by user ID
     */
    static async getSubscriptionsByUserId(userId) {
        try {
            const subscriptionsSnapshot = await this.db
                .collection('subscriptions')
                .where('userId', '==', userId)
                .get();
            return subscriptionsSnapshot.docs.map(doc => doc.data());
        }
        catch (error) {
            this.logger.error(`Error getting subscriptions for user ${userId}:`, error);
            throw error;
        }
    }
}
exports.SubscriptionOperations = SubscriptionOperations;
SubscriptionOperations.db = admin.firestore();
SubscriptionOperations.logger = logger_1.Logger.getInstance();
//# sourceMappingURL=subscriptionOperations.js.map