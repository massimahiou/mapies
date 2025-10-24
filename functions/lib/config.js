"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.config = void 0;
// Environment configuration for Firebase Functions
exports.config = {
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        priceIds: {
            premium: process.env.STRIPE_PRICE_ID_PREMIUM || '',
            pro: process.env.STRIPE_PRICE_ID_PRO || ''
        }
    },
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || 'mapies'
    }
};
// Validate required environment variables
function validateConfig() {
    const requiredVars = [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_ID_PREMIUM',
        'STRIPE_PRICE_ID_PRO'
    ];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}
exports.validateConfig = validateConfig;
//# sourceMappingURL=config.js.map