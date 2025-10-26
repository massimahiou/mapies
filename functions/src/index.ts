import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { WebhookProcessingResult } from './types';
import { Logger } from './utils/logger';
import { SubscriptionManager } from './stripe/subscriptionManager';
import { CustomerManager } from './stripe/customerManager';
import { createCheckoutSession, createCustomerPortalSession, testCustomerPortal } from './checkout';
import { fixUserLimits } from './fixUserLimits';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const logger = Logger.getInstance();

export const handleMapiesStripeWebhooks = functions.https.onRequest(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Get Stripe signature from headers
    const signature = req.get('stripe-signature');
    if (!signature) {
      logger.error('Missing Stripe signature');
      res.status(400).send('Missing Stripe signature');
      return;
    }

    // Hardcoded webhook secret
    const webhookSecret = 'whsec_xEZyejEe4qCRqQV7xCCWBAPdQItEQkBf';
    console.log('Using hardcoded webhook secret');
    console.log('Webhook secret length:', webhookSecret.length);

    // Get raw body - try different approaches
    let rawBody: string | Buffer;
    
    // Try to get raw body from Firebase Functions
    if (req.rawBody) {
      rawBody = req.rawBody;
      console.log('Using req.rawBody');
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
      console.log('Using Buffer body');
    } else {
      // Fallback to JSON stringify
      rawBody = JSON.stringify(req.body);
      console.log('Using JSON.stringify fallback');
    }

    console.log('Raw body length:', rawBody.length);
    console.log('Raw body type:', typeof rawBody);
    console.log('Raw body first 100 chars:', rawBody.toString().substring(0, 100));
    console.log('Received signature:', signature);
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));

    // Initialize Stripe with secret key
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || functions.config().stripe.secret_key, {
      apiVersion: '2023-10-16',
    });

    // Use Stripe's official signature verification
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      console.log('✅ Signature verification successful');
    } catch (err) {
      console.error('❌ Signature verification failed:', err);
      logger.error('Invalid Stripe signature', err);
      res.status(400).send('Invalid signature');
      return;
    }
    
    // Validate event structure
    if (!event.id || !event.type || !event.data) {
      logger.error('Invalid Stripe event structure');
      res.status(400).send('Invalid event structure');
      return;
    }

    logger.logStripeEvent(event.type, event.id, event.data.object);
    console.log(`🎯 Processing ${event.type} event for ${event.id}`);

    // Process the event
    const result = await processStripeEvent(event, startTime);
    
    // Log the result
    logger.logWebhookResult(result);
    console.log(`✅ Event processing result:`, result);

    // Send response
    if (result.success) {
      console.log(`🎉 Successfully processed ${event.type} event`);
      res.status(200).send('Webhook processed successfully');
    } else {
      console.log(`❌ Failed to process ${event.type} event:`, result.error);
      res.status(500).send('Webhook processing failed');
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Webhook processing error:', error);
    
    const errorResult: WebhookProcessingResult = {
      success: false,
      eventId: req.body?.id || 'unknown',
      eventType: req.body?.type || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    };
    
    logger.logWebhookResult(errorResult);
    res.status(500).send('Internal server error');
  }
});

/**
 * Process individual Stripe events
 */
async function processStripeEvent(event: Stripe.Event, startTime: number): Promise<WebhookProcessingResult> {
  const eventId = event.id;
  const eventType = event.type;
  const stripeObject = event.data.object;

  try {
    logger.info(`Processing ${eventType} event`, { eventId, objectId: (stripeObject as any).id });

    // Process event based on type
    await processEventByType(eventType, stripeObject);

    const processingTime = Date.now() - startTime;
    logger.info(`Successfully processed ${eventType} event`, { 
      eventId, 
      processingTime 
    });

    return {
      success: true,
      eventId,
      eventType,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`Failed to process ${eventType} event`, { 
      eventId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime 
    });

    return {
      success: false,
      eventId,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    };
  }
}

/**
 * Process events by type
 */
async function processEventByType(eventType: string, stripeObject: any): Promise<void> {
  switch (eventType) {
    case 'customer.created':
      await CustomerManager.handleCustomerCreated(stripeObject);
      break;
    case 'customer.deleted':
      await CustomerManager.handleCustomerDeleted(stripeObject);
      break;
    case 'customer.subscription.created':
      await SubscriptionManager.handleSubscriptionCreated(stripeObject);
      break;
    case 'customer.subscription.updated':
      await SubscriptionManager.handleSubscriptionUpdated(stripeObject);
      break;
    case 'customer.subscription.deleted':
      await SubscriptionManager.handleSubscriptionDeleted(stripeObject);
      break;
    case 'invoice.upcoming':
      await SubscriptionManager.handleInvoiceUpcoming(stripeObject);
      break;
    case 'invoice.created':
      await SubscriptionManager.handleInvoiceCreated(stripeObject);
      break;
    case 'invoice.finalized':
      await SubscriptionManager.handleInvoiceFinalized(stripeObject);
      break;
    case 'payment_intent.succeeded':
      await SubscriptionManager.handlePaymentIntentSucceeded(stripeObject);
      break;
    case 'checkout.session.completed':
      await SubscriptionManager.handleCheckoutSessionCompleted(stripeObject);
      break;
    case 'checkout.session.expired':
      logger.info('Checkout session expired', {
        sessionId: stripeObject.id,
        customerId: stripeObject.customer
      });
      break;
    case 'invoice.payment_succeeded':
      await SubscriptionManager.handleInvoicePaymentSucceeded(stripeObject);
      break;
    case 'invoice.payment_failed':
      await SubscriptionManager.handleInvoicePaymentFailed(stripeObject);
      break;
    case 'payment_intent.payment_failed':
      await SubscriptionManager.handlePaymentIntentFailed(stripeObject);
      break;
    case 'billing_portal.session.created':
      logger.info('Customer portal session created', {
        sessionId: stripeObject.id,
        customerId: stripeObject.customer
      });
      break;
    case 'coupon.created':
    case 'coupon.updated':
    case 'coupon.deleted':
      logger.info(`Coupon event: ${eventType}`, {
        couponId: stripeObject.id,
        name: stripeObject.name
      });
      break;
    case 'product.created':
    case 'product.updated':
      logger.info(`Product event: ${eventType}`, {
        productId: stripeObject.id,
        name: stripeObject.name
      });
      break;
    case 'tax_rate.created':
    case 'tax_rate.updated':
      logger.info(`Tax rate event: ${eventType}`, {
        taxRateId: stripeObject.id,
        displayName: stripeObject.display_name
      });
      break;
    default:
    logger.info(`Unhandled event type: ${eventType}`, {
      eventId: stripeObject.id || 'unknown'
    });
  }
}

/**
 * Webhook status endpoint for debugging
 */
export const webhookStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  return {
    status: 'active',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
});

/**
 * Leave shared map function
 */
export const leaveSharedMap = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { mapId } = data;
  const userId = context.auth.uid;

  if (!mapId) {
    throw new functions.https.HttpsError('invalid-argument', 'Map ID is required');
  }

  try {
    logger.info('User leaving shared map', { userId, mapId });

    // Get the map document
    const mapRef = admin.firestore().collection('users').doc(userId).collection('maps').doc(mapId);
    const mapDoc = await mapRef.get();

    if (!mapDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Map not found');
    }

    const mapData = mapDoc.data();
    if (!mapData) {
      throw new functions.https.HttpsError('not-found', 'Map data not found');
    }

    // Check if user is the owner
    if (mapData.userId === userId) {
      throw new functions.https.HttpsError('permission-denied', 'Map owner cannot leave their own map');
    }

    // Remove user from sharedWith array
    const sharedWith = mapData.sharing?.sharedWith || [];
    const updatedSharedWith = sharedWith.filter((user: any) => user.email !== context.auth?.token.email);

    await mapRef.update({
      'sharing.sharedWith': updatedSharedWith,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info('Successfully left shared map', { userId, mapId });

    return { success: true, message: 'Successfully left the shared map' };

  } catch (error) {
    logger.error('Error in leaveSharedMap function', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Internal server error');
  }
});

// Export checkout functions
export { createCheckoutSession, createCustomerPortalSession, testCustomerPortal };

// Export temporary fix function
export { fixUserLimits };
export { listPrices } from './listPrices';