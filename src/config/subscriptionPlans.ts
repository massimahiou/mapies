export interface SubscriptionPlan {
  // Marker limits
  maxMarkersPerMap: number
  maxTotalMarkers: number
  
  // Map limits
  maxMaps: number
  
  // Feature flags
  watermark: boolean
  bulkImport: boolean
  geocoding: boolean
  smartGrouping: boolean
  
  // Customization levels
  customizationLevel: 'basic' | 'premium'
  
  // Storage limits
  maxStorageMB: number
  
  // Pricing
  price: number
  name: string
  description: string
  popular?: boolean
  
  // Stripe integration
  stripePriceId?: string
  trialDays?: number
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  freemium: {
    maxMarkersPerMap: 50,
    maxTotalMarkers: 50,
    maxMaps: 1,
    watermark: true,
    bulkImport: false,
    geocoding: false,
    smartGrouping: false,
    customizationLevel: 'basic',
    maxStorageMB: 10,
    price: 0,
    name: 'Freemium',
    description: 'Perfect for getting started',
    stripePriceId: 'price_1SLn4xQ5zKkScSt2aMRLmPCq',
    trialDays: undefined
  },
  starter: {
    maxMarkersPerMap: 500,
    maxTotalMarkers: 500,
    maxMaps: 3,
    watermark: false,
    bulkImport: true,
    geocoding: true,
    smartGrouping: false,
    customizationLevel: 'premium',
    maxStorageMB: 100,
    price: 14,
    name: 'Starter',
    description: 'Great for small businesses',
    stripePriceId: 'price_1SLn1lQ5zKkScSt26QWJ1kfz',
    trialDays: 14
  },
  professional: {
    maxMarkersPerMap: 1500,
    maxTotalMarkers: 1500,
    maxMaps: 5,
    watermark: false,
    bulkImport: true,
    geocoding: true,
    smartGrouping: true,
    customizationLevel: 'premium',
    maxStorageMB: 500,
    price: 36,
    name: 'Professional',
    description: 'Most popular choice',
    popular: true,
    stripePriceId: 'price_1SLn1mQ5zKkScSt2ptUM9Lr0',
    trialDays: 14
  },
  enterprise: {
    maxMarkersPerMap: 3000,
    maxTotalMarkers: 3000,
    maxMaps: 10,
    watermark: false,
    bulkImport: true,
    geocoding: true,
    smartGrouping: true,
    customizationLevel: 'premium',
    maxStorageMB: 2000,
    price: 48,
    name: 'Enterprise',
    description: 'For large organizations',
    stripePriceId: 'price_1SLn1mQ5zKkScSt2qKv1dRDs',
    trialDays: 14
  }
}

// Helper function to get plan limits
export const getPlanLimits = (planId: string): SubscriptionPlan => {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.freemium
}

// Helper function to check if user can perform action
export const canPerformAction = (
  planId: string, 
  action: keyof SubscriptionPlan, 
  currentUsage?: number
): boolean => {
  const plan = getPlanLimits(planId)
  
  switch (action) {
    case 'maxMarkersPerMap':
    case 'maxTotalMarkers':
    case 'maxMaps':
      return currentUsage !== undefined ? currentUsage < plan[action] : true
    
    case 'watermark':
    case 'bulkImport':
    case 'geocoding':
    case 'smartGrouping':
      return plan[action] as boolean
    
    case 'customizationLevel':
      return true // Always allowed, but UI will show different options
    
    case 'maxStorageMB':
      return currentUsage !== undefined ? currentUsage < plan[action] : true
    
    default:
      return true
  }
}

// Helper function to get recommended upgrade plan
export const getRecommendedUpgrade = (currentPlan: string, feature: string): string => {
  const planOrder = ['freemium', 'starter', 'professional', 'enterprise']
  const currentIndex = planOrder.indexOf(currentPlan)
  
  // Find the first plan that supports the feature
  for (let i = currentIndex + 1; i < planOrder.length; i++) {
    const plan = SUBSCRIPTION_PLANS[planOrder[i]]
    if (plan[feature as keyof SubscriptionPlan]) {
      return planOrder[i]
    }
  }
  
  return 'enterprise' // Fallback to highest plan
}
