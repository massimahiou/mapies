/**
 * Utility functions for consistent feature access checking
 * This ensures we always read from the user's actual Firestore limits
 */

import { UserDocument } from '../firebase/users'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

export interface UserLimits {
  maxMarkersPerMap: number
  maxTotalMarkers: number
  maxMaps: number
  watermark: boolean
  bulkImport: boolean
  geocoding: boolean
  smartGrouping: boolean
  customizationLevel: 'basic' | 'premium'
  maxStorageMB: number
}

/**
 * Get user's actual limits from Firestore, with fallback to plan defaults
 */
export const getUserLimits = (userDocument: UserDocument | null, plan: string = 'freemium'): UserLimits => {
  const planLimits = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.freemium
  
  // If user has limits in Firestore, use those (they override plan defaults)
  if (userDocument?.limits) {
    return {
      maxMarkersPerMap: userDocument.limits.maxMarkersPerMap ?? planLimits.maxMarkersPerMap,
      maxTotalMarkers: userDocument.limits.maxTotalMarkers ?? planLimits.maxTotalMarkers,
      maxMaps: userDocument.limits.maxMaps ?? planLimits.maxMaps,
      watermark: userDocument.limits.watermark ?? planLimits.watermark,
      bulkImport: userDocument.limits.bulkImport ?? planLimits.bulkImport,
      geocoding: userDocument.limits.geocoding ?? planLimits.geocoding,
      smartGrouping: userDocument.limits.smartGrouping ?? planLimits.smartGrouping,
      customizationLevel: userDocument.limits.customizationLevel ?? planLimits.customizationLevel,
      maxStorageMB: userDocument.limits.maxStorageMB ?? planLimits.maxStorageMB
    }
  }
  
  // Fallback to plan defaults
  return {
    maxMarkersPerMap: planLimits.maxMarkersPerMap,
    maxTotalMarkers: planLimits.maxTotalMarkers,
    maxMaps: planLimits.maxMaps,
    watermark: planLimits.watermark,
    bulkImport: planLimits.bulkImport,
    geocoding: planLimits.geocoding,
    smartGrouping: planLimits.smartGrouping,
    customizationLevel: planLimits.customizationLevel,
    maxStorageMB: planLimits.maxStorageMB
  }
}

/**
 * Check if user can perform a specific action
 */
export const canUserPerformAction = (
  userDocument: UserDocument | null,
  action: 'addMarker' | 'createMap' | 'useGeocoding' | 'useBulkImport' | 'useSmartGrouping',
  currentCount?: number
): boolean => {
  const limits = getUserLimits(userDocument, userDocument?.subscription?.plan)
  
  switch (action) {
    case 'addMarker':
      return currentCount !== undefined ? currentCount < limits.maxMarkersPerMap : true
    
    case 'createMap':
      return currentCount !== undefined ? currentCount < limits.maxMaps : true
    
    case 'useGeocoding':
      return limits.geocoding
    
    case 'useBulkImport':
      return limits.bulkImport
    
    case 'useSmartGrouping':
      return limits.smartGrouping
    
    default:
      return false
  }
}

/**
 * Get feature access status for UI components
 */
export const getFeatureAccess = (userDocument: UserDocument | null) => {
  const limits = getUserLimits(userDocument, userDocument?.subscription?.plan)
  
  return {
    hasGeocoding: limits.geocoding,
    hasBulkImport: limits.bulkImport,
    hasSmartGrouping: limits.smartGrouping,
    showWatermark: limits.watermark,
    customizationLevel: limits.customizationLevel,
    maxMarkersPerMap: limits.maxMarkersPerMap,
    maxMaps: limits.maxMaps,
    maxTotalMarkers: limits.maxTotalMarkers,
    maxStorageMB: limits.maxStorageMB
  }
}

/**
 * Check if user is on enterprise plan
 */
export const isEnterprisePlan = (userDocument: UserDocument | null): boolean => {
  const plan = userDocument?.subscription?.plan || 'freemium'
  return plan === 'enterprise'
}

/**
 * Debug function to log user's actual limits vs plan defaults
 */
export const debugUserLimits = (userDocument: UserDocument | null) => {
  const plan = userDocument?.subscription?.plan || 'freemium'
  const planLimits = SUBSCRIPTION_PLANS[plan]
  const userLimits = getUserLimits(userDocument, plan)
  
  console.log('🔍 User Limits Debug:', {
    plan,
    userDocumentLimits: userDocument?.limits,
    planDefaults: planLimits,
    finalLimits: userLimits,
    differences: {
      geocoding: userDocument?.limits?.geocoding !== planLimits.geocoding,
      bulkImport: userDocument?.limits?.bulkImport !== planLimits.bulkImport,
      smartGrouping: userDocument?.limits?.smartGrouping !== planLimits.smartGrouping
    }
  })
}

