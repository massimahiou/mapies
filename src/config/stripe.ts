// Stripe configuration
export const STRIPE_CONFIG = {
  // This should match your Stripe publishable key
  // You can get this from your Stripe dashboard
  PUBLISHABLE_KEY: 'pk_live_51LyknqBahmrTOdT23WcBoPPpLz9gc6ZFNra6rR98S32P547h6a71q0KMAV8cllMGhL4imTNxW7ADPNB66UiXxpp700xPagofqS',
  
  // Price IDs for each subscription plan
  PRICE_IDS: {
    starter: 'price_1SK8VZBahmrTOdT2vMeKI2qQ', // Using existing premium price ID for now
    professional: 'price_1SK8VZBahmrTOdT2vMeKI2qQ', // Using existing premium price ID for now
    enterprise: 'price_1SK8VZBahmrTOdT2vMeKI2qQ', // Using existing premium price ID for now
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








