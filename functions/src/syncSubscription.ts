import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

/**
 * Helper function to get subscription tier from price ID
 */
function getSubscriptionTier(priceId: string): 'freemium' | 'starter' | 'professional' | 'enterprise' {
  const config = {
    starter: functions.config().stripe.price_id_starter,
    professional: functions.config().stripe.price_id_professional,
    enterprise: functions.config().stripe.price_id_enterprise,
    freemium: functions.config().stripe.price_id_freemium,
  };

  if (priceId === config.enterprise) return 'enterprise';
  if (priceId === config.professional) return 'professional';
  if (priceId === config.starter) return 'starter';
  if (priceId === config.freemium) return 'freemium';
  
  return 'freemium';
}

/**
 * Get limits for a subscription plan
 */
function getLimitsForPlan(plan: 'freemium' | 'starter' | 'professional' | 'enterprise') {
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
 * Sync user subscription from Stripe
 */
export const syncUserSubscription = functions.https.onCall(async (data, context) => {
  try {
    console.log('syncUserSubscription called with data:', data);
    
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    console.log('Syncing subscription for user:', userId);

    // Get user document
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;

    if (!stripeCustomerId) {
      throw new functions.https.HttpsError('invalid-argument', 'No Stripe customer ID found');
    }

    console.log('Fetching subscription for customer:', stripeCustomerId);

    // Get customer's subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 1,
      status: 'all'
    });

    if (subscriptions.data.length === 0) {
      console.log('No active subscription found, setting to freemium');
      
      // Set to freemium
      const freemiumLimits = getLimitsForPlan('freemium');
      await userRef.update({
        'subscription.plan': 'freemium',
        'subscription.status': 'free',
        'subscription.subscriptionStatus': 'free',
        'subscription.subscriptionTier': 'freemium',
        'limits': freemiumLimits,
        'updatedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, plan: 'freemium', message: 'Set to freemium' };
    }

    const subscription = subscriptions.data[0];
    console.log('Found subscription:', subscription.id, 'Status:', subscription.status);

    // Get the first price item to determine tier
    const priceItem = subscription.items.data[0];
    const subscriptionTier = getSubscriptionTier(priceItem.price.id);
    
    console.log('Determined tier:', subscriptionTier);
    console.log('Price ID:', priceItem.price.id);

    // Update user subscription data
    const limits = getLimitsForPlan(subscriptionTier);
    
    const updateData: any = {
      'subscription.plan': subscriptionTier,
      'subscription.subscriptionTier': subscriptionTier,
      'subscription.status': subscription.status,
      'subscription.subscriptionStatus': subscription.status === 'active' ? 'active' : 'free',
      'subscription.subscriptionId': subscription.id,
      'subscription.subscriptionStartDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_start * 1000),
      'subscription.subscriptionEndDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
      'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
      'subscription.nextBillingDate': admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
      'limits': limits,
      'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    };

    if (subscription.canceled_at) {
      updateData['subscription.canceledAt'] = admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000);
    }

    await userRef.update(updateData);

    console.log('Successfully synced subscription for user:', userId);

    return { 
      success: true, 
      plan: subscriptionTier,
      status: subscription.status,
      subscriptionId: subscription.id
    };

  } catch (error) {
    console.error('Error syncing user subscription:', error);
    throw new functions.https.HttpsError('internal', 'Failed to sync subscription');
  }
});

