import { useState, useEffect, useCallback } from 'react'
import { validateMapAgainstPlan, fixMapSettingsForPlan, PREMIUM_FEATURE_DESCRIPTIONS } from '../utils/mapValidation'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

// Define Marker and MapSettings interfaces locally since types module doesn't exist
interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
}

interface MapSettings {
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

interface ValidationResult {
  isValid: boolean
  reason?: string
  premiumFeaturesUsed: string[]
  userFriendlyMessages: string[]
  needsUpgrade: boolean
  recommendedPlan?: string
}

interface UseMapValidationProps {
  markers: Marker[]
  mapSettings: MapSettings
  userPlan: keyof typeof SUBSCRIPTION_PLANS
  folderIcons?: Record<string, string>
  autoFix?: boolean // Whether to automatically fix invalid settings
}

export const useMapValidation = ({
  markers,
  mapSettings,
  userPlan,
  folderIcons = {},
  autoFix = false
}: UseMapValidationProps): ValidationResult => {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    premiumFeaturesUsed: [],
    userFriendlyMessages: [],
    needsUpgrade: false
  })

  const validateMap = useCallback(() => {
    // If autoFix is enabled, fix settings first
    const settingsToValidate = autoFix 
      ? fixMapSettingsForPlan(mapSettings, userPlan)
      : mapSettings

    const validation = validateMapAgainstPlan(markers, settingsToValidate, userPlan, folderIcons)
    
    // Generate user-friendly messages
    const userFriendlyMessages = validation.premiumFeaturesUsed.map(feature => 
      PREMIUM_FEATURE_DESCRIPTIONS[feature]?.description || `${feature} requires upgrade`
    )

    // Determine if upgrade is needed
    const needsUpgrade = validation.premiumFeaturesUsed.length > 0

    // Recommend appropriate plan
    let recommendedPlan: string | undefined
    if (needsUpgrade) {
      if (validation.premiumFeaturesUsed.includes('marker_limit_exceeded')) {
        recommendedPlan = 'starter' // For marker limits
      } else if (validation.premiumFeaturesUsed.includes('premium_customization')) {
        recommendedPlan = 'starter' // For customization
      } else {
        recommendedPlan = 'professional' // For advanced features
      }
    }

    setValidationResult({
      isValid: validation.isValid,
      reason: validation.reason,
      premiumFeaturesUsed: validation.premiumFeaturesUsed,
      userFriendlyMessages,
      needsUpgrade,
      recommendedPlan
    })

    return validation
  }, [markers, mapSettings, userPlan, folderIcons, autoFix])

  // Re-validate when dependencies change
  useEffect(() => {
    validateMap()
  }, [validateMap])

  return validationResult
}

/**
 * Hook for real-time validation with automatic fixing
 */
export const useMapValidationWithAutoFix = (props: Omit<UseMapValidationProps, 'autoFix'>) => {
  return useMapValidation({ ...props, autoFix: true })
}

/**
 * Hook for validation warnings without auto-fixing
 */
export const useMapValidationWarnings = (props: Omit<UseMapValidationProps, 'autoFix'>) => {
  return useMapValidation({ ...props, autoFix: false })
}
