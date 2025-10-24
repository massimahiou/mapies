import * as functions from 'firebase-functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

export const listPrices = functions.https.onCall(async (data, context) => {
  try {
    console.log('Listing Stripe prices...');
    
    const prices = await stripe.prices.list({
      active: true,
      limit: 100
    });

    console.log('Found prices:', prices.data.length);
    
    const priceList = prices.data.map(price => ({
      id: price.id,
      nickname: price.nickname,
      unit_amount: price.unit_amount,
      currency: price.currency,
      recurring: price.recurring,
      product: price.product
    }));

    return {
      prices: priceList,
      count: prices.data.length
    };

  } catch (error) {
    console.error('Error listing prices:', error);
    throw new functions.https.HttpsError('internal', 'Failed to list prices');
  }
});
