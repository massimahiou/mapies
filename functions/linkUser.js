import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(readFileSync('./config/mapies-firebase-adminsdk-fbsvc-40548c12ec.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function linkUserToStripeCustomer() {
  try {
    const userId = 'Ql5olfgF8WZRG6j9fjpdpIhUMEv1';
    const stripeCustomerId = 'cus_TINrMnCqNxcxZK';
    
    console.log(`Linking user ${userId} to Stripe customer ${stripeCustomerId}`);
    
    // Update user document with Stripe customer ID
    await admin.firestore().collection('users').doc(userId).update({
      stripeCustomerId: stripeCustomerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Successfully linked user to Stripe customer');
    
    // Check the user document
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    console.log('User data:', {
      userId: userDoc.id,
      email: userData?.email,
      stripeCustomerId: userData?.stripeCustomerId,
      subscription: userData?.subscription
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

linkUserToStripeCustomer();
