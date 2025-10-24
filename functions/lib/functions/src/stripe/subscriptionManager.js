"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = void 0;
const stripe_1 = require("stripe");
const admin = require("firebase-admin");
const userOperations_1 = require("../firestore/userOperations");
const subscriptionOperations_1 = require("../firestore/subscriptionOperations");
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
class SubscriptionManager {
    /**
     * Determine subscription tier based on price ID
     */
    static getSubscriptionTier(priceId) {
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
    static async handleSubscriptionCreated(subscription) {
        try {
            this.logger.logStripeEvent('subscription.created', subscription.id);
            const customerId = subscription.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Get the first price item to determine tier
            const priceItem = subscription.items.data[0];
            const subscriptionTier = this.getSubscriptionTier(priceItem.price.id);
            // Update user subscription data
            const userSubscriptionData = {
                subscriptionStatus: subscription.status,
                subscriptionId: subscription.id,
                subscriptionTier,
                subscriptionStartDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_start * 1000),
                subscriptionEndDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                nextBillingDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
            };
            await userOperations_1.UserOperations.updateUserSubscription(userId, userSubscriptionData);
            // Create subscription document
            const subscriptionDoc = {
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
            await subscriptionOperations_1.SubscriptionOperations.createSubscription(subscriptionDoc);
            this.logger.info(`Subscription created successfully for user ${userId}`, {
                subscriptionId: subscription.id,
                tier: subscriptionTier
            });
        }
        catch (error) {
            this.logger.error('Error handling subscription created:', error);
            throw error;
        }
    }
    /**
     * Handle subscription updated event
     */
    static async handleSubscriptionUpdated(subscription) {
        try {
            this.logger.logStripeEvent('subscription.updated', subscription.id);
            const customerId = subscription.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Get the first price item to determine tier
            const priceItem = subscription.items.data[0];
            const subscriptionTier = this.getSubscriptionTier(priceItem.price.id);
            // Update user subscription data
            const userSubscriptionData = {
                subscriptionStatus: subscription.status,
                subscriptionTier,
                subscriptionEndDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                canceledAt: subscription.canceled_at ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000) : undefined,
                nextBillingDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
            };
            await userOperations_1.UserOperations.updateUserSubscription(userId, userSubscriptionData);
            // Update subscription document
            const subscriptionUpdateData = {
                status: subscription.status,
                currentPeriodStart: admin.firestore.Timestamp.fromMillis(subscription.current_period_start * 1000),
                currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                canceledAt: subscription.canceled_at ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000) : undefined,
                endedAt: subscription.ended_at ? admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000) : undefined,
                metadata: subscription.metadata
            };
            await subscriptionOperations_1.SubscriptionOperations.updateSubscription(subscription.id, subscriptionUpdateData);
            this.logger.info(`Subscription updated successfully for user ${userId}`, {
                subscriptionId: subscription.id,
                status: subscription.status
            });
        }
        catch (error) {
            this.logger.error('Error handling subscription updated:', error);
            throw error;
        }
    }
    /**
     * Handle subscription deleted event
     */
    static async handleSubscriptionDeleted(subscription) {
        try {
            this.logger.logStripeEvent('subscription.deleted', subscription.id);
            const customerId = subscription.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Update user subscription data
            const userSubscriptionData = {
                subscriptionStatus: 'canceled',
                subscriptionTier: 'free',
                subscriptionId: undefined,
                subscriptionEndDate: undefined,
                cancelAtPeriodEnd: false,
                canceledAt: admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000),
                nextBillingDate: undefined
            };
            await userOperations_1.UserOperations.updateUserSubscription(userId, userSubscriptionData);
            // End subscription document
            await subscriptionOperations_1.SubscriptionOperations.endSubscription(subscription.id);
            this.logger.info(`Subscription deleted successfully for user ${userId}`, {
                subscriptionId: subscription.id
            });
        }
        catch (error) {
            this.logger.error('Error handling subscription deleted:', error);
            throw error;
        }
    }
    /**
     * Handle invoice payment succeeded
     */
    static async handleInvoicePaymentSucceeded(invoice) {
        try {
            this.logger.logStripeEvent('invoice.payment_succeeded', invoice.id);
            const customerId = invoice.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Update last payment date
            await userOperations_1.UserOperations.updateLastPaymentDate(userId);
            // If this is a subscription invoice, update next billing date
            if (invoice.subscription) {
                const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
                const userSubscriptionData = {
                    nextBillingDate: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
                };
                await userOperations_1.UserOperations.updateUserSubscription(userId, userSubscriptionData);
            }
            this.logger.info(`Payment succeeded for user ${userId}`, {
                invoiceId: invoice.id,
                amount: invoice.amount_paid
            });
        }
        catch (error) {
            this.logger.error('Error handling invoice payment succeeded:', error);
            throw error;
        }
    }
    /**
     * Handle invoice payment failed
     */
    static async handleInvoicePaymentFailed(invoice) {
        try {
            this.logger.logStripeEvent('invoice.payment_failed', invoice.id);
            const customerId = invoice.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Update user subscription status to past_due
            const userSubscriptionData = {
                subscriptionStatus: 'past_due'
            };
            await userOperations_1.UserOperations.updateUserSubscription(userId, userSubscriptionData);
            this.logger.warn(`Payment failed for user ${userId}`, {
                invoiceId: invoice.id,
                amount: invoice.amount_due
            });
        }
        catch (error) {
            this.logger.error('Error handling invoice payment failed:', error);
            throw error;
        }
    }
}
exports.SubscriptionManager = SubscriptionManager;
SubscriptionManager.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});
SubscriptionManager.logger = logger_1.Logger.getInstance();
//# sourceMappingURL=subscriptionManager.js.map