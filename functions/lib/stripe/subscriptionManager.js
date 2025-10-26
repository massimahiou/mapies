"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = void 0;
const stripe_1 = require("stripe");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const userOperations_1 = require("../firestore/userOperations");
const subscriptionOperations_1 = require("../firestore/subscriptionOperations");
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
class SubscriptionManager {
    /**
     * Get customer email from Stripe
     */
    static async getCustomerEmail(customerId) {
        try {
            const customer = await this.stripe.customers.retrieve(customerId);
            return customer.email || undefined;
        }
        catch (error) {
            this.logger.warn(`Failed to get customer email for ${customerId}:`, error);
            return undefined;
        }
    }
    /**
     * Get limits for a subscription plan
     */
    static getLimitsForPlan(plan) {
        const limits = {
            freemium: {
                maxMaps: 1,
                maxMarkersPerMap: 50,
                maxTotalMarkers: 50,
                customIcons: false,
                advancedAnalytics: false,
                prioritySupport: false,
                geocoding: false,
                bulkImport: true,
                smartGrouping: false,
                watermark: true,
                customizationLevel: 'basic'
            },
            starter: {
                maxMaps: 3,
                maxMarkersPerMap: 500,
                maxTotalMarkers: 500,
                customIcons: true,
                advancedAnalytics: false,
                prioritySupport: false,
                geocoding: true,
                bulkImport: true,
                smartGrouping: false,
                watermark: true,
                customizationLevel: 'premium'
            },
            professional: {
                maxMaps: 5,
                maxMarkersPerMap: 1500,
                maxTotalMarkers: 1500,
                customIcons: true,
                advancedAnalytics: true,
                prioritySupport: true,
                geocoding: true,
                bulkImport: true,
                smartGrouping: true,
                watermark: true,
                customizationLevel: 'premium'
            },
            enterprise: {
                maxMaps: 10,
                maxMarkersPerMap: 3000,
                maxTotalMarkers: 3000,
                customIcons: true,
                advancedAnalytics: true,
                prioritySupport: true,
                geocoding: true,
                bulkImport: true,
                smartGrouping: true,
                watermark: true,
                customizationLevel: 'premium'
            }
        };
        return limits[plan];
    }
    /**
     * Determine subscription tier based on price ID
     */
    static getSubscriptionTier(priceId) {
        const config = {
            starter: functions.config().stripe.price_id_starter,
            professional: functions.config().stripe.price_id_professional,
            enterprise: functions.config().stripe.price_id_enterprise,
            freemium: functions.config().stripe.price_id_freemium,
            // Legacy support
            premium: functions.config().stripe.price_id_premium,
            pro: functions.config().stripe.price_id_pro
        };
        console.log('Price ID mapping:', { priceId, config });
        if (priceId === config.enterprise)
            return 'enterprise';
        if (priceId === config.professional)
            return 'professional';
        if (priceId === config.starter)
            return 'starter';
        if (priceId === config.freemium)
            return 'freemium';
        if (priceId === config.pro)
            return 'professional'; // Legacy mapping
        if (priceId === config.premium)
            return 'starter'; // Legacy mapping
        // Default to freemium if price ID doesn't match
        console.log('Price ID not found, defaulting to freemium:', priceId);
        return 'freemium';
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
            // Update user subscription data - preserve existing structure and update nested subscription object
            const userRef = admin.firestore().collection('users').doc(userId);
            // Update the nested subscription object and limits based on the plan
            const limits = this.getLimitsForPlan(subscriptionTier);
            await userRef.update({
                'subscription.plan': subscriptionTier,
                'subscription.status': subscription.status,
                'subscription.subscriptionId': subscription.id,
                'subscription.subscriptionStartDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_start * 1000),
                'subscription.subscriptionEndDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
                'subscription.nextBillingDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                'limits.maxMaps': limits.maxMaps,
                'limits.maxMarkersPerMap': limits.maxMarkersPerMap,
                'limits.maxTotalMarkers': limits.maxTotalMarkers,
                'limits.customIcons': limits.customIcons,
                'limits.advancedAnalytics': limits.advancedAnalytics,
                'limits.prioritySupport': limits.prioritySupport,
                'limits.geocoding': limits.geocoding,
                'limits.bulkImport': limits.bulkImport,
                'limits.smartGrouping': limits.smartGrouping,
                'limits.watermark': limits.watermark,
                'limits.customizationLevel': limits.customizationLevel,
                'stripeCustomerId': customerId,
                'email': await this.getCustomerEmail(customerId),
                'updatedAt': admin.firestore.FieldValue.serverTimestamp()
            });
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
            // Update user subscription data and limits
            const limits = this.getLimitsForPlan(subscriptionTier);
            const userRef = admin.firestore().collection('users').doc(userId);
            await userRef.update({
                'subscription.plan': subscriptionTier,
                'subscription.status': subscription.status,
                'subscription.subscriptionEndDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
                'subscription.canceledAt': subscription.canceled_at ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000) : admin.firestore.FieldValue.delete(),
                'subscription.nextBillingDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                'limits.maxMaps': limits.maxMaps,
                'limits.maxMarkersPerMap': limits.maxMarkersPerMap,
                'limits.maxTotalMarkers': limits.maxTotalMarkers,
                'limits.customIcons': limits.customIcons,
                'limits.advancedAnalytics': limits.advancedAnalytics,
                'limits.prioritySupport': limits.prioritySupport,
                'limits.geocoding': limits.geocoding,
                'limits.bulkImport': limits.bulkImport,
                'limits.smartGrouping': limits.smartGrouping,
                'limits.watermark': limits.watermark,
                'limits.customizationLevel': limits.customizationLevel,
                'updatedAt': admin.firestore.FieldValue.serverTimestamp()
            });
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
            // Update user subscription data and reset limits to freemium
            const freemiumLimits = this.getLimitsForPlan('freemium');
            const userRef = admin.firestore().collection('users').doc(userId);
            await userRef.update({
                'subscription.plan': 'freemium',
                'subscription.status': 'canceled',
                'subscription.subscriptionId': admin.firestore.FieldValue.delete(),
                'subscription.subscriptionEndDate': admin.firestore.FieldValue.delete(),
                'subscription.cancelAtPeriodEnd': false,
                'subscription.canceledAt': admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000),
                'subscription.nextBillingDate': admin.firestore.FieldValue.delete(),
                'limits.maxMaps': freemiumLimits.maxMaps,
                'limits.maxMarkersPerMap': freemiumLimits.maxMarkersPerMap,
                'limits.maxTotalMarkers': freemiumLimits.maxTotalMarkers,
                'limits.customIcons': freemiumLimits.customIcons,
                'limits.advancedAnalytics': freemiumLimits.advancedAnalytics,
                'limits.prioritySupport': freemiumLimits.prioritySupport,
                'limits.geocoding': freemiumLimits.geocoding,
                'limits.bulkImport': freemiumLimits.bulkImport,
                'limits.smartGrouping': freemiumLimits.smartGrouping,
                'limits.watermark': freemiumLimits.watermark,
                'limits.customizationLevel': freemiumLimits.customizationLevel,
                'updatedAt': admin.firestore.FieldValue.serverTimestamp()
            });
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
            // Update last payment date and next billing date using direct Firestore update
            const userRef = admin.firestore().collection('users').doc(userId);
            const updateData = {
                'subscription.lastPaymentDate': admin.firestore.Timestamp.fromMillis(invoice.created * 1000),
                'updatedAt': admin.firestore.FieldValue.serverTimestamp()
            };
            // If this is a subscription invoice, update next billing date
            if (invoice.subscription) {
                const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
                updateData['subscription.nextBillingDate'] = admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000);
            }
            await userRef.update(updateData);
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
    /**
     * Handle invoice upcoming event
     */
    static async handleInvoiceUpcoming(invoice) {
        try {
            this.logger.logStripeEvent('invoice.upcoming', invoice.id);
            const customerId = invoice.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Log upcoming invoice for monitoring
            this.logger.info(`Upcoming invoice for user ${userId}`, {
                invoiceId: invoice.id,
                amount: invoice.amount_due,
                dueDate: invoice.due_date
            });
        }
        catch (error) {
            this.logger.error('Error handling invoice upcoming:', error);
            throw error;
        }
    }
    /**
     * Handle invoice created event
     */
    static async handleInvoiceCreated(invoice) {
        try {
            this.logger.logStripeEvent('invoice.created', invoice.id);
            const customerId = invoice.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Log invoice creation for monitoring
            this.logger.info(`Invoice created for user ${userId}`, {
                invoiceId: invoice.id,
                amount: invoice.amount_due,
                subscription: invoice.subscription
            });
        }
        catch (error) {
            this.logger.error('Error handling invoice created:', error);
            throw error;
        }
    }
    /**
     * Handle invoice finalized event
     */
    static async handleInvoiceFinalized(invoice) {
        try {
            this.logger.logStripeEvent('invoice.finalized', invoice.id);
            const customerId = invoice.customer;
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Log invoice finalization for monitoring
            this.logger.info(`Invoice finalized for user ${userId}`, {
                invoiceId: invoice.id,
                amount: invoice.amount_due,
                dueDate: invoice.due_date
            });
        }
        catch (error) {
            this.logger.error('Error handling invoice finalized:', error);
            throw error;
        }
    }
    /**
     * Handle payment intent failed event
     */
    static async handlePaymentIntentFailed(paymentIntent) {
        try {
            this.logger.logStripeEvent('payment_intent.payment_failed', paymentIntent.id);
            const customerId = paymentIntent.customer;
            if (!customerId) {
                this.logger.warn(`No customer ID in payment intent ${paymentIntent.id}`);
                return;
            }
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Log payment intent failure for monitoring
            this.logger.warn(`Payment intent failed for user ${userId}`, {
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                lastPaymentError: paymentIntent.last_payment_error
            });
        }
        catch (error) {
            this.logger.error('Error handling payment intent failed:', error);
            throw error;
        }
    }
    /**
     * Handle payment intent succeeded event
     */
    static async handlePaymentIntentSucceeded(paymentIntent) {
        try {
            this.logger.logStripeEvent('payment_intent.succeeded', paymentIntent.id);
            const customerId = paymentIntent.customer;
            if (!customerId) {
                this.logger.warn(`No customer ID in payment intent ${paymentIntent.id}`);
                return;
            }
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customerId);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customerId}`);
                return;
            }
            // Log payment intent success for monitoring
            this.logger.info(`Payment intent succeeded for user ${userId}`, {
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount
            });
        }
        catch (error) {
            this.logger.error('Error handling payment intent succeeded:', error);
            throw error;
        }
    }
    /**
     * Handle checkout session completed event
     */
    static async handleCheckoutSessionCompleted(session) {
        var _a;
        try {
            this.logger.logStripeEvent('checkout.session.completed', session.id);
            const customerId = session.customer;
            const userId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                this.logger.warn(`No user ID in checkout session metadata ${session.id}`);
                return;
            }
            // If this checkout created a subscription, wait a moment for it to be created
            if (session.subscription) {
                // Wait for subscription to be fully created
                await new Promise(resolve => setTimeout(resolve, 2000));
                try {
                    const subscription = await this.stripe.subscriptions.retrieve(session.subscription);
                    await this.handleSubscriptionCreated(subscription);
                    this.logger.info(`Subscription created from checkout for user ${userId}`, {
                        sessionId: session.id,
                        subscriptionId: session.subscription,
                        customerId: customerId
                    });
                }
                catch (subError) {
                    this.logger.error('Error processing subscription from checkout:', subError);
                }
            }
            else {
                // Log checkout completion for monitoring
                this.logger.info(`Checkout session completed for user ${userId}`, {
                    sessionId: session.id,
                    customerId: customerId,
                    subscriptionId: session.subscription
                });
            }
        }
        catch (error) {
            this.logger.error('Error handling checkout session completed:', error);
            throw error;
        }
    }
}
exports.SubscriptionManager = SubscriptionManager;
SubscriptionManager.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || functions.config().stripe.secret_key, {
    apiVersion: '2023-10-16',
});
SubscriptionManager.logger = logger_1.Logger.getInstance();
//# sourceMappingURL=subscriptionManager.js.map