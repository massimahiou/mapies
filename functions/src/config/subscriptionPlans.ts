export interface SubscriptionPlan {
  // Numeric limits (clear and intuitive)
  limits: {
    maxMarkersPerMap: number
    maxTotalMarkers: number
    maxMaps: number
    maxStorageMB: number
  }
  
  // Feature flags (true = enabled, false = disabled)
  features: {
    watermark: boolean           // true = shows watermark, false = no watermark
    bulkImport: boolean          // true = can import CSV, false = cannot
    geocoding: boolean           // true = can geocode addresses, false = cannot
    smartGrouping: boolean       // true = can use name rules, false = cannot
    customIcons: boolean         // true = can upload custom icons, false = cannot
    advancedAnalytics: boolean   // true = has analytics, false = does not
    prioritySupport: boolean     // true = has priority support, false = does not
  }
  
  // Customization level
  customizationLevel: 'basic' | 'premium'
  
  // Pricing & metadata
  price: number
  name: string
  description: string
  popular?: boolean
  stripePriceId?: string
  trialDays?: number
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  freemium: {
    limits: {
      maxMarkersPerMap: 50,
      maxTotalMarkers: 50,
      maxMaps: 1,
      maxStorageMB: 10
    },
    features: {
      watermark: true,           // Shows watermark
      bulkImport: false,         // Cannot import CSV
      geocoding: false,          // Cannot geocode addresses
      smartGrouping: false,      // Cannot use name rules
      customIcons: false,        // Cannot upload custom icons
      advancedAnalytics: false,  // No analytics
      prioritySupport: false     // No priority support
    },
    customizationLevel: 'basic',
    price: 0,
    name: 'Freemium',
    description: 'Perfect for getting started',
    stripePriceId: 'price_1SLn4xQ5zKkScSt2aMRLmPCq'
  },
  starter: {
    limits: {
      maxMarkersPerMap: 500,
      maxTotalMarkers: 500,
      maxMaps: 3,
      maxStorageMB: 100
    },
    features: {
      watermark: false,          // No watermark
      bulkImport: true,          // Can import CSV
      geocoding: true,           // Can geocode addresses
      smartGrouping: false,      // Cannot use name rules
      customIcons: true,         // Can upload custom icons
      advancedAnalytics: false,  // No analytics
      prioritySupport: false     // No priority support
    },
    customizationLevel: 'premium',
    price: 14,
    name: 'Starter',
    description: 'Great for small businesses',
    stripePriceId: 'price_1SLn1lQ5zKkScSt26QWJ1kfz',
    trialDays: 14
  },
  professional: {
    limits: {
      maxMarkersPerMap: 1500,
      maxTotalMarkers: 1500,
      maxMaps: 5,
      maxStorageMB: 500
    },
    features: {
      watermark: false,          // No watermark
      bulkImport: true,          // Can import CSV
      geocoding: true,           // Can geocode addresses
      smartGrouping: true,       // Can use name rules
      customIcons: true,         // Can upload custom icons
      advancedAnalytics: true,   // Has analytics
      prioritySupport: true      // Has priority support
    },
    customizationLevel: 'premium',
    price: 36,
    name: 'Professional',
    description: 'Most popular choice',
    popular: true,
    stripePriceId: 'price_1SLn1mQ5zKkScSt2ptUM9Lr0',
    trialDays: 14
  },
  enterprise: {
    limits: {
      maxMarkersPerMap: 3000,
      maxTotalMarkers: 3000,
      maxMaps: 10,
      maxStorageMB: 2000
    },
    features: {
      watermark: false,          // No watermark
      bulkImport: true,          // Can import CSV
      geocoding: true,           // Can geocode addresses
      smartGrouping: true,       // Can use name rules
      customIcons: true,         // Can upload custom icons
      advancedAnalytics: true,   // Has analytics
      prioritySupport: true      // Has priority support
    },
    customizationLevel: 'premium',
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
  switch (action) {
    case 'limits':
      return true // Always allowed, but UI will show different options
    
    case 'features':
      return true // Always allowed, but UI will show different options
    
    case 'customizationLevel':
      return true // Always allowed, but UI will show different options
    
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
    if (plan.features[feature as keyof typeof plan.features]) {
      return planOrder[i]
    }
  }
  
  return 'enterprise' // Fallback to highest plan
}



