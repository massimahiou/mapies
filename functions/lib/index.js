"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryCsvJob = exports.processCsvUpload = exports.createCustomerPortalSession = exports.createCheckoutSession = exports.webhookStatus = exports.handleMapiesStripeWebhooks = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const validation_1 = require("./utils/validation");
const logger_1 = require("./utils/logger");
const subscriptionManager_1 = require("./stripe/subscriptionManager");
const customerManager_1 = require("./stripe/customerManager");
const checkout_1 = require("./checkout");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return checkout_1.createCheckoutSession; } });
Object.defineProperty(exports, "createCustomerPortalSession", { enumerable: true, get: function () { return checkout_1.createCustomerPortalSession; } });
const csvProcessor_1 = require("./csvProcessor");
Object.defineProperty(exports, "processCsvUpload", { enumerable: true, get: function () { return csvProcessor_1.processCsvUpload; } });
Object.defineProperty(exports, "retryCsvJob", { enumerable: true, get: function () { return csvProcessor_1.retryCsvJob; } });
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const logger = logger_1.Logger.getInstance();
exports.handleMapiesStripeWebhooks = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    const startTime = Date.now();
    try {
        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        // Get Stripe signature from headers
        const signature = req.headers['stripe-signature'];
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
        const isValidSignature = validation_1.ValidationUtils.verifyStripeSignature(payload, signature, webhookSecret);
        if (!isValidSignature) {
            logger.error('Invalid Stripe signature');
            res.status(400).send('Invalid signature');
            return;
        }
        // Parse the event
        const event = req.body;
        // Validate event structure
        if (!validation_1.ValidationUtils.validateStripeEvent(event)) {
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
        }
        else {
            res.status(500).send('Webhook processing failed');
        }
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error('Webhook processing error:', error);
        const errorResult = {
            success: false,
            eventId: ((_a = req.body) === null || _a === void 0 ? void 0 : _a.id) || 'unknown',
            eventType: ((_b = req.body) === null || _b === void 0 ? void 0 : _b.type) || 'unknown',
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
async function processStripeEvent(event, startTime) {
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
    }
    catch (error) {
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
async function processEventByType(eventType, stripeObject) {
    switch (eventType) {
        // Customer events
        case 'customer.created':
            await customerManager_1.CustomerManager.handleCustomerCreated(stripeObject);
            break;
        case 'customer.updated':
            await customerManager_1.CustomerManager.handleCustomerUpdated(stripeObject);
            break;
        case 'customer.deleted':
            await customerManager_1.CustomerManager.handleCustomerDeleted(stripeObject);
            break;
        // Subscription events
        case 'customer.subscription.created':
            await subscriptionManager_1.SubscriptionManager.handleSubscriptionCreated(stripeObject);
            break;
        case 'customer.subscription.updated':
            await subscriptionManager_1.SubscriptionManager.handleSubscriptionUpdated(stripeObject);
            break;
        case 'customer.subscription.deleted':
            await subscriptionManager_1.SubscriptionManager.handleSubscriptionDeleted(stripeObject);
            break;
        // Invoice events
        case 'invoice.payment_succeeded':
            await subscriptionManager_1.SubscriptionManager.handleInvoicePaymentSucceeded(stripeObject);
            break;
        case 'invoice.payment_failed':
            await subscriptionManager_1.SubscriptionManager.handleInvoicePaymentFailed(stripeObject);
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
exports.webhookStatus = functions.https.onRequest(async (req, res) => {
    try {
        const status = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        };
        res.status(200).json(status);
    }
    catch (error) {
        logger.error('Health check error:', error);
        res.status(500).json({ status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
//# sourceMappingURL=index.js.map