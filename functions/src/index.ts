import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { StripeWebhookEvent, WebhookProcessingResult } from './types';
import { ValidationUtils } from './utils/validation';
import { Logger } from './utils/logger';
import { SubscriptionManager } from './stripe/subscriptionManager';
import { CustomerManager } from './stripe/customerManager';
import { createCheckoutSession, createCustomerPortalSession } from './checkout';

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
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      logger.error('Missing Stripe signature');
      res.status(400).send('Missing Stripe signature');
      return;
    }

    // Get webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
      res.status(500).send('Server configuration error');
      return;
    }

    // Verify webhook signature
    const payload = JSON.stringify(req.body);
    const isValidSignature = ValidationUtils.verifyStripeSignature(payload, signature, webhookSecret);
    
    if (!isValidSignature) {
      logger.error('Invalid Stripe signature');
      res.status(400).send('Invalid signature');
      return;
    }

    // Parse the event
    const event: StripeWebhookEvent = req.body;
    
    // Validate event structure
    if (!ValidationUtils.validateStripeEvent(event)) {
      logger.error('Invalid Stripe event structure');
      res.status(400).send('Invalid event structure');
      return;
    }

    logger.logStripeEvent(event.type, event.id, event.data.object);

    // Process the event
    const result = await processStripeEvent(event, startTime);
    
    // Log the result
    logger.logWebhookResult(result);

    // Send response
    if (result.success) {
      res.status(200).send('Webhook processed successfully');
    } else {
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
async function processStripeEvent(event: StripeWebhookEvent, startTime: number): Promise<WebhookProcessingResult> {
  const eventId = event.id;
  const eventType = event.type;
  const stripeObject = event.data.object;

  try {
    // Check if event was already processed (idempotency)
    const processedEventsRef = admin.firestore().collection('processedWebhookEvents').doc(eventId);
    const processedEvent = await processedEventsRef.get();
    
    if (processedEvent.exists) {
      logger.info(`Event ${eventId} already processed, skipping`);
      return {
        success: true,
        eventId,
        eventType,
        processingTime: Date.now() - startTime
      };
    }

    // Process the event based on type
    await processEventByType(eventType, stripeObject);

    // Mark event as processed
    await processedEventsRef.set({
      eventId,
      eventType,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingTime: Date.now() - startTime
    });

    return {
      success: true,
      eventId,
      eventType,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error(`Error processing event ${eventId}:`, error);
    
    return {
      success: false,
      eventId,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Process events by type
 */
async function processEventByType(eventType: string, stripeObject: any): Promise<void> {
  switch (eventType) {
    // Customer events
    case 'customer.created':
      await CustomerManager.handleCustomerCreated(stripeObject);
      break;
    
    case 'customer.updated':
      await CustomerManager.handleCustomerUpdated(stripeObject);
      break;
    
    case 'customer.deleted':
      await CustomerManager.handleCustomerDeleted(stripeObject);
      break;

    // Subscription events
    case 'customer.subscription.created':
      await SubscriptionManager.handleSubscriptionCreated(stripeObject);
      break;
    
    case 'customer.subscription.updated':
      await SubscriptionManager.handleSubscriptionUpdated(stripeObject);
      break;
    
    case 'customer.subscription.deleted':
      await SubscriptionManager.handleSubscriptionDeleted(stripeObject);
      break;

    // Invoice events
    case 'invoice.payment_succeeded':
      await SubscriptionManager.handleInvoicePaymentSucceeded(stripeObject);
      break;
    
    case 'invoice.payment_failed':
      await SubscriptionManager.handleInvoicePaymentFailed(stripeObject);
      break;

    // Payment Intent events
    case 'payment_intent.payment_failed':
      logger.warn('Payment intent failed', {
        paymentIntentId: stripeObject.id,
        customerId: stripeObject.customer,
        amount: stripeObject.amount
      });
      break;

    // Product and Price events (for future use)
    case 'price.created':
    case 'price.updated':
      logger.info(`Price event: ${eventType}`, {
        priceId: stripeObject.id,
        productId: stripeObject.product
      });
      break;

    // Default case for unhandled events
    default:
      logger.info(`Unhandled event type: ${eventType}`, {
        eventId: stripeObject.id,
        objectType: stripeObject.object
      });
      break;
  }
}

/**
 * Health check endpoint
 */
export const webhookStatus = functions.https.onRequest(async (req, res) => {
  try {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.status(200).json(status);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Export checkout functions
export { createCheckoutSession, createCustomerPortalSession };
