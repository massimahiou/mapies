"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkStripeCustomer = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.linkStripeCustomer = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = context.auth.uid;
    const { stripeCustomerId } = data;
    if (!stripeCustomerId) {
        throw new functions.https.HttpsError('invalid-argument', 'Stripe customer ID is required');
    }
    try {
        // Update user document with Stripe customer ID
        await admin.firestore().collection('users').doc(userId).update({
            stripeCustomerId: stripeCustomerId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Linked user ${userId} to Stripe customer ${stripeCustomerId}`);
        return {
            success: true,
            message: 'Successfully linked user to Stripe customer',
            userId,
            stripeCustomerId
        };
    }
    catch (error) {
        console.error('Error linking Stripe customer:', error);
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});
//# sourceMappingURL=linkStripeCustomer.js.map