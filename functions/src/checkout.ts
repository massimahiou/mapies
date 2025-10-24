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

export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  try {
    console.log('createCheckoutSession called with data:', data);
    
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { 
      priceId, 
      userId, 
      userEmail, 
      successUrl, 
      cancelUrl, 
      trialPeriodDays, 
      couponId 
    } = data;

    console.log('Processing checkout for:', { priceId, userId, userEmail });

    if (!priceId || !userId || !userEmail) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    // Get or create Stripe customer
    let customerId: string;
    
    try {
      console.log('Looking up customer by email:', userEmail);
      // Try to find existing customer by email
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log('Found existing customer:', customerId);
      } else {
        console.log('Creating new customer for:', userEmail);
        // Create new customer
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId: userId
          }
        });
        customerId = customer.id;
        console.log('Created new customer:', customerId);
      }
    } catch (error) {
      console.error('Error managing Stripe customer:', error);
      throw new functions.https.HttpsError('internal', 'Failed to manage customer');
    }

    console.log('Creating checkout session with price ID:', priceId);
    
    // Create checkout session
    const sessionConfig: any = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: successUrl || `${process.env.VITE_APP_URL || 'https://mapies.web.app'}/dashboard?subscription=success`,
      cancel_url: cancelUrl || `${process.env.VITE_APP_URL || 'https://mapies.web.app'}/dashboard?subscription=cancelled`,
      metadata: {
        userId: userId,
        userEmail: userEmail
      },
      subscription_data: {
        metadata: {
          userId: userId,
          userEmail: userEmail
        }
      },
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic'
        }
      }
    };

    // Add trial period if specified
    if (trialPeriodDays && trialPeriodDays > 0) {
      sessionConfig.subscription_data.trial_period_days = trialPeriodDays;
      console.log('Added trial period:', trialPeriodDays, 'days');
    }

    // Add coupon if specified
    if (couponId) {
      sessionConfig.discounts = [{
        coupon: couponId
      }];
      console.log('Added coupon:', couponId);
    }

    console.log('Session config:', JSON.stringify(sessionConfig, null, 2));

    const session = await stripe.checkout.sessions.create(sessionConfig);
    console.log('Checkout session created successfully:', session.id);

    return {
      sessionId: session.id,
      url: session.url
    };

  } catch (error) {
    console.error('Error creating checkout session:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create checkout session');
  }
});

export const createCustomerPortalSession = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId, returnUrl } = data;

    if (!customerId) {
      throw new functions.https.HttpsError('invalid-argument', 'Customer ID is required');
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.VITE_APP_URL || 'https://mapies.web.app'}/dashboard`,
    });

    return {
      url: session.url
    };

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create customer portal session');
  }
});
