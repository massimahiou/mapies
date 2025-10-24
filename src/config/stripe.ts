// Stripe configuration
export const STRIPE_CONFIG = {
  // This should match your Stripe publishable key
  // You can get this from your Stripe dashboard
  PUBLISHABLE_KEY: 'pk_live_51SK8ygQ5zKkScSt2KVBDjW6xSG7F9PA5ZNyEDNnxvbsKwKjAKBrse5Gbny075AxL0kOjJOOayD9ug9Jh8961y2nF00WJc5ASHz',
  
  // Price IDs for each subscription plan
  PRICE_IDS: {
    freemium: 'price_1SLn4xQ5zKkScSt2aMRLmPCq',
    starter: 'price_1SLn1lQ5zKkScSt26QWJ1kfz',
    professional: 'price_1SLn1mQ5zKkScSt2ptUM9Lr0',
    enterprise: 'price_1SLn1mQ5zKkScSt2qKv1dRDs',
  },
  
  // Legacy support
  PREMIUM_PRICE_ID: 'price_1SK8VZBahmrTOdT2vMeKI2qQ'
}

// Helper function to get price ID for a plan
export const getPriceIdForPlan = (planId: string): string | null => {
  return STRIPE_CONFIG.PRICE_IDS[planId as keyof typeof STRIPE_CONFIG.PRICE_IDS] || null
}

// Helper function to get plan ID from price ID
export const getPlanIdFromPriceId = (priceId: string): string | null => {
  const entries = Object.entries(STRIPE_CONFIG.PRICE_IDS)
  const found = entries.find(([, id]) => id === priceId)
  return found ? found[0] : null
}








