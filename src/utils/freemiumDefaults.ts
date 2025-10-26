import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

export interface FreemiumCompliantMapSettings {
  style: string
  markerShape: string
  markerColor: string
  markerSize: string
  markerBorder: string
  markerBorderWidth: number
  clusteringEnabled: boolean
  clusterRadius: number
  searchBarBackgroundColor: string
  searchBarTextColor: string
  searchBarHoverColor: string
  nameRules: any[]
}

/**
 * Returns freemium-compliant default map settings
 * These settings are guaranteed to work with any subscription plan
 */
export const getFreemiumCompliantDefaults = (): FreemiumCompliantMapSettings => {
  return {
    style: 'light',
    markerShape: 'circle', // Only circle is allowed for freemium
    markerColor: '#3B82F6', // Default blue color
    markerSize: 'medium',
    markerBorder: 'white',
    markerBorderWidth: 1, // Use 1px instead of 2px for better freemium experience
    // Clustering settings
    clusteringEnabled: true,
    clusterRadius: 50,
    // Search bar settings - use defaults that are freemium-compliant
    searchBarBackgroundColor: '#ffffff',
    searchBarTextColor: '#000000',
    searchBarHoverColor: '#f3f4f6',
    // Name rules settings - always empty for freemium
    nameRules: []
  }
}

/**
 * Ensures map settings are compliant with the user's plan
 * Automatically downgrades premium settings to freemium-compliant ones
 */
export const ensureFreemiumCompliance = (
  settings: Partial<FreemiumCompliantMapSettings>,
  userPlan: keyof typeof SUBSCRIPTION_PLANS = 'freemium'
): FreemiumCompliantMapSettings => {
  const defaults = getFreemiumCompliantDefaults()
  const planLimits = SUBSCRIPTION_PLANS[userPlan] || SUBSCRIPTION_PLANS.freemium
  
  const compliantSettings = { ...defaults, ...settings }
  
  // Force freemium compliance for basic plans
  if (planLimits.customizationLevel === 'basic') {
    // Only allow circle shape
    compliantSettings.markerShape = 'circle'
    
    // Force default search bar colors
    compliantSettings.searchBarBackgroundColor = '#ffffff'
    compliantSettings.searchBarTextColor = '#000000'
    compliantSettings.searchBarHoverColor = '#f3f4f6'
  }
  
  // Force smart grouping compliance
  if (!planLimits.smartGrouping) {
    compliantSettings.nameRules = []
  }
  
  return compliantSettings
}

/**
 * Checks if a setting change would violate freemium compliance
 */
export const isSettingFreemiumCompliant = (
  setting: string,
  value: any,
  userPlan: keyof typeof SUBSCRIPTION_PLANS = 'freemium'
): boolean => {
  const planLimits = SUBSCRIPTION_PLANS[userPlan] || SUBSCRIPTION_PLANS.freemium
  
  switch (setting) {
    case 'markerShape':
      // Only circle is allowed for basic plans
      return planLimits.customizationLevel === 'premium' || value === 'circle'
    
    case 'searchBarBackgroundColor':
    case 'searchBarTextColor':
    case 'searchBarHoverColor':
      // Only default colors are allowed for basic plans
      return planLimits.customizationLevel === 'premium' || 
             (setting === 'searchBarBackgroundColor' && value === '#ffffff') ||
             (setting === 'searchBarTextColor' && value === '#000000') ||
             (setting === 'searchBarHoverColor' && value === '#f3f4f6')
    
    case 'nameRules':
      // No name rules allowed for basic plans
      return planLimits.smartGrouping || (Array.isArray(value) && value.length === 0)
    
    default:
      // All other settings are freemium-compliant
      return true
  }
}
