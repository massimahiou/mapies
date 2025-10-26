"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserSubscription = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.checkUserSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = context.auth.uid;
    try {
        // Get user document
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        return {
            userId,
            subscription: (userData === null || userData === void 0 ? void 0 : userData.subscription) || null,
            stripeCustomerId: (userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId) || null,
            email: (userData === null || userData === void 0 ? void 0 : userData.email) || null
        };
    }
    catch (error) {
        console.error('Error checking user subscription:', error);
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});
//# sourceMappingURL=checkUserSubscription.js.map