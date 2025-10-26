import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { Logger } from './utils/logger';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const logger = Logger.getInstance();

/**
 * Cancel user's subscription (set to cancel at period end)
 */
export const cancelSubscription = functions.https.onCall(async (data, context) => {
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
    const stripeCustomerId = userData?.stripeCustomerId;

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
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || functions.config().stripe.secret_key, {
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
    const currentPlan = userData?.subscription?.plan || 'freemium';
    
    // Update Firestore with cancellation info
    await userRef.update({
      'subscription.plan': currentPlan, // Keep current plan until period ends
      'subscription.status': 'active', // Still active until period ends
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

  } catch (error) {
    logger.error('Error canceling subscription', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Internal server error');
  }
});

