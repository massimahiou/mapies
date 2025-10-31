"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAllUsers = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Verify all existing users' emails
 * This function marks all existing users as having verified emails
 * Call this once to verify all existing users
 */
exports.verifyAllUsers = functions.https.onRequest(async (req, res) => {
    try {
        // Security: Only allow POST requests and check for a secret token
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        // Optional: Add a secret token check for security
        const secretToken = req.body.token || req.query.token;
        if (!secretToken || secretToken !== 'verify-all-users-secret-2024') {
            res.status(401).json({
                success: false,
                error: 'Unauthorized. Secret token required.'
            });
            return;
        }
        console.log('🔍 Starting to verify all existing users...');
        // Get all users from Firebase Auth
        let allUsers = [];
        let nextPageToken;
        do {
            const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
            allUsers = allUsers.concat(listUsersResult.users);
            nextPageToken = listUsersResult.pageToken;
            console.log(`📋 Found ${allUsers.length} users so far...`);
        } while (nextPageToken);
        console.log(`✅ Total users found: ${allUsers.length}`);
        let verifiedCount = 0;
        let alreadyVerifiedCount = 0;
        let errorCount = 0;
        const errors = [];
        // Update each user
        for (const userRecord of allUsers) {
            try {
                // Skip if already verified
                if (userRecord.emailVerified) {
                    alreadyVerifiedCount++;
                    continue;
                }
                // Update user to mark email as verified
                await admin.auth().updateUser(userRecord.uid, {
                    emailVerified: true
                });
                verifiedCount++;
                console.log(`✅ Verified: ${userRecord.email || userRecord.uid}`);
            }
            catch (error) {
                errorCount++;
                const errorMsg = `Failed to verify ${userRecord.email || userRecord.uid}: ${error.message}`;
                errors.push(errorMsg);
                console.error(`❌ ${errorMsg}`);
            }
        }
        const result = {
            success: true,
            message: 'Email verification process completed',
            totalUsers: allUsers.length,
            verified: verifiedCount,
            alreadyVerified: alreadyVerifiedCount,
            errors: errorCount,
            errorDetails: errors.slice(0, 10) // Only return first 10 errors
        };
        console.log('📊 Results:', result);
        res.status(200).json(result);
    }
    catch (error) {
        console.error('❌ Error in verifyAllUsers:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=verifyAllUsers.js.map