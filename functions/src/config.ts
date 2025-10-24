// Environment configuration for Firebase Functions
export const config = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceIds: {
      starter: process.env.STRIPE_PRICE_ID_STARTER || '',
      professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL || '',
      enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
      // Legacy support
      premium: process.env.STRIPE_PRICE_ID_PREMIUM || '',
      pro: process.env.STRIPE_PRICE_ID_PRO || ''
    }
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'mapies'
  }
};

// Validate required environment variables
export function validateConfig(): void {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID_STARTER',
    'STRIPE_PRICE_ID_PROFESSIONAL',
    'STRIPE_PRICE_ID_ENTERPRISE'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}








