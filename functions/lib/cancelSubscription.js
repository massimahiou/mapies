"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSubscription = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
const logger_1 = require("./utils/logger");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const logger = logger_1.Logger.getInstance();
/**
 * Cancel user's subscription (set to cancel at period end)
 */
exports.cancelSubscription = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = context.auth.uid;
    try {
        logger.info('Canceling subscription for user', { userId });
        // Get user document
        const userRef = admin.firestore().collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User document not found');
        }
        const userData = userDoc.data();
        const stripeCustomerId = userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId;
        if (!stripeCustomerId) {
            // User doesn't have a Stripe customer, just update the plan
            await userRef.update({
                'subscription.plan': 'freemium',
                'subscription.status': 'cancelled',
                'subscription.cancelAtPeriodEnd': true,
                'updatedAt': admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info('No Stripe customer found, updated plan to freemium', { userId });
            return { success: true, message: 'Subscription cancelled' };
        }
        // Initialize Stripe
        const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || functions.config().stripe.secret_key, {
            apiVersion: '2023-10-16',
        });
        // Get active subscriptions for the customer
        const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
            limit: 1
        });
        if (subscriptions.data.length === 0) {
            // No active subscription, just update the plan
            await userRef.update({
                'subscription.plan': 'freemium',
                'subscription.status': 'cancelled',
                'subscription.cancelAtPeriodEnd': true,
                'updatedAt': admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info('No active subscription found, updated plan to freemium', { userId });
            return { success: true, message: 'Subscription cancelled' };
        }
        // Cancel subscription at period end
        const subscription = subscriptions.data[0];
        const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
            cancel_at_period_end: true
        });
        // Get subscription end date (current period end)
        const currentPeriodEnd = updatedSubscription.current_period_end;
        const periodEndDate = new Date(currentPeriodEnd * 1000);
        // Keep current plan but mark for cancellation at period end
        const currentPlan = ((_a = userData === null || userData === void 0 ? void 0 : userData.subscription) === null || _a === void 0 ? void 0 : _a.plan) || 'freemium';
        // Update Firestore with cancellation info
        await userRef.update({
            'subscription.plan': currentPlan,
            'subscription.status': 'active',
            'subscription.cancelAtPeriodEnd': true,
            'subscription.subscriptionEndDate': admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000),
            'subscription.nextBillingDate': admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000),
            'updatedAt': admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info('Subscription cancelled successfully', {
            userId,
            subscriptionId: subscription.id,
            periodEnd: periodEndDate.toISOString()
        });
        return {
            success: true,
            message: 'Subscription cancelled',
            periodEnd: periodEndDate.toISOString()
        };
    }
    catch (error) {
        logger.error('Error canceling subscription', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});
//# sourceMappingURL=cancelSubscription.js.map