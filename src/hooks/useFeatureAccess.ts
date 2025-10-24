import { useAuth } from '../contexts/AuthContext'
import { SUBSCRIPTION_PLANS, getRecommendedUpgrade } from '../config/subscriptionPlans'
import { UsageTracker } from '../utils/usageTracker'
import { useState, useEffect } from 'react'

export interface FeatureAccess {
  // Plan info
  currentPlan: string
  planLimits: any
  
  // Usage checks
  canAddMarkers: (currentCount: number) => boolean
  canCreateMap: (currentCount: number) => boolean
  
  // Feature access
  hasGeocoding: boolean
  hasSmartGrouping: boolean
  hasBulkImport: boolean
  showWatermark: boolean
  
  // Customization
  customizationLevel: 'basic' | 'premium'
  
  // Usage stats
  usage: any
  
  // Upgrade helpers
  getRecommendedUpgrade: (feature: string) => string
  needsUpgrade: (action: 'addMarker' | 'createMap' | 'useFeature', feature?: string) => Promise<{ needsUpgrade: boolean; recommendedPlan?: string }>
}

// Hook for public maps that don't require authentication
export const usePublicFeatureAccess = (): FeatureAccess => {
  // For public maps, always use freemium settings
  const currentPlan = 'freemium'
  const planLimits = SUBSCRIPTION_PLANS.freemium

  const canAddMarkers = (currentCount: number): boolean => {
    return currentCount < planLimits.maxMarkersPerMap
  }

  const canCreateMap = (currentCount: number): boolean => {
    return currentCount < planLimits.maxMaps
  }

  const getRecommendedUpgradeForFeature = (feature: string): string => {
    return getRecommendedUpgrade(currentPlan, feature)
  }

  const checkUpgradeNeeds = async (
    _action: 'addMarker' | 'createMap' | 'useFeature',
    _feature?: string
  ): Promise<{ needsUpgrade: boolean; recommendedPlan?: string }> => {
    // For public maps, always suggest upgrade
    return { needsUpgrade: true, recommendedPlan: 'starter' }
  }

  return {
    currentPlan,
    planLimits,
    canAddMarkers,
    canCreateMap,
    hasGeocoding: planLimits.geocoding,
    hasSmartGrouping: planLimits.smartGrouping,
    hasBulkImport: planLimits.bulkImport,
    showWatermark: planLimits.watermark,
    customizationLevel: planLimits.customizationLevel,
    usage: null,
    getRecommendedUpgrade: getRecommendedUpgradeForFeature,
    needsUpgrade: checkUpgradeNeeds
  }
}

export const useFeatureAccess = (): FeatureAccess => {
  const { user, userDocument } = useAuth()
  const [usage, setUsage] = useState<any>(null)

  const currentPlan = userDocument?.subscription?.plan || 'freemium'
  const planLimits = SUBSCRIPTION_PLANS[currentPlan] || SUBSCRIPTION_PLANS.freemium

  useEffect(() => {
    const loadUsage = async () => {
      if (user) {
        try {
          const usageStats = await UsageTracker.getUsageStats(user.uid)
          setUsage(usageStats)
        } catch (error) {
          console.error('Error loading usage stats:', error)
        }
      }
    }

    loadUsage()
  }, [user, userDocument])

  const canAddMarkers = (currentCount: number): boolean => {
    return currentCount < (planLimits?.maxMarkersPerMap || 50)
  }

  const canCreateMap = (currentCount: number): boolean => {
    return currentCount < (planLimits?.maxMaps || 1)
  }

  const getRecommendedUpgradeForFeature = (feature: string): string => {
    return getRecommendedUpgrade(currentPlan, feature)
  }

  const checkUpgradeNeeds = async (
    action: 'addMarker' | 'createMap' | 'useFeature', 
    feature?: string
  ): Promise<{ needsUpgrade: boolean; recommendedPlan?: string }> => {
    if (!user) return { needsUpgrade: true, recommendedPlan: 'starter' }
    
    return await UsageTracker.needsUpgrade(user.uid, action, feature)
  }

  return {
    currentPlan,
    planLimits,
    canAddMarkers,
    canCreateMap,
    hasGeocoding: planLimits?.geocoding || false,
    hasSmartGrouping: planLimits?.smartGrouping || false,
    hasBulkImport: planLimits?.bulkImport || false,
    showWatermark: planLimits?.watermark || false,
    customizationLevel: planLimits?.customizationLevel || 'basic',
    usage,
    getRecommendedUpgrade: getRecommendedUpgradeForFeature,
    needsUpgrade: checkUpgradeNeeds
  }
}

// Helper hook for specific feature checks
export const useFeatureCheck = (feature: string) => {
  const { planLimits } = useFeatureAccess()
  return planLimits?.[feature] || false
}

// Helper hook for usage warnings
export const useUsageWarning = (type: 'markers' | 'maps', currentCount: number) => {
  const { planLimits, canAddMarkers, canCreateMap } = useFeatureAccess()
  
  const limit = type === 'markers' ? (planLimits?.maxMarkersPerMap || 50) : (planLimits?.maxMaps || 1)
  const canPerform = type === 'markers' ? canAddMarkers(currentCount) : canCreateMap(currentCount)
  const warningThreshold = limit * 0.8 // Show warning at 80% of limit
  
  return {
    showWarning: currentCount >= warningThreshold,
    showError: !canPerform,
    limit,
    currentCount,
    percentage: (currentCount / limit) * 100
  }
}
