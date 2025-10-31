import { MapSettings } from './markerUtils'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

// Define Marker interface locally since it's not exported from markerUtils
interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible?: boolean
}

export interface MapValidationResult {
  isValid: boolean
  reason?: string
  premiumFeaturesUsed: string[]
}

export interface PremiumFeatureCheck {
  feature: string
  isUsed: boolean
  description: string
}

/**
 * Automatically fixes map settings to be compliant with the user's plan
 * This prevents maps from being disabled due to invalid settings
 */
export function fixMapSettingsForPlan(
  mapSettings: MapSettings,
  ownerPlan: keyof typeof SUBSCRIPTION_PLANS
): MapSettings {
  const planLimits = SUBSCRIPTION_PLANS[ownerPlan] || SUBSCRIPTION_PLANS.freemium
  
  const fixedSettings = { ...mapSettings }
  
  // Fix premium customization issues
  if (planLimits.customizationLevel !== 'premium') {
    // Reset to default shape if non-default shape is used
    if (fixedSettings.markerShape !== 'circle') {
      fixedSettings.markerShape = 'circle'
    }
    
    // Reset search bar colors to defaults if custom colors are used
    if (fixedSettings.searchBarBackgroundColor !== '#ffffff') {
      fixedSettings.searchBarBackgroundColor = '#ffffff'
    }
    if (fixedSettings.searchBarTextColor !== '#000000') {
      fixedSettings.searchBarTextColor = '#000000'
    }
    if (fixedSettings.searchBarHoverColor !== '#f3f4f6') {
      fixedSettings.searchBarHoverColor = '#f3f4f6'
    }
  }
  
  // Fix smart grouping issues
  if (!planLimits.smartGrouping && fixedSettings.nameRules && fixedSettings.nameRules.length > 0) {
    fixedSettings.nameRules = []
  }
  
  return fixedSettings
}

/**
 * Validates if a map respects the owner's current subscription plan
 * Checks for premium features that shouldn't be available on lower plans
 */
export function validateMapAgainstPlan(
  markers: Marker[],
  mapSettings: MapSettings,
  ownerPlan: keyof typeof SUBSCRIPTION_PLANS,
  folderIcons?: Record<string, string>
): MapValidationResult {
  const planLimits = SUBSCRIPTION_PLANS[ownerPlan] || SUBSCRIPTION_PLANS.freemium
  const premiumFeaturesUsed: string[] = []

  console.log('🔍 Map Validation Debug:', {
    ownerPlan,
    planLimits,
    markersCount: markers.length,
    mapSettings: {
      markerShape: mapSettings.markerShape,
      markerColor: mapSettings.markerColor,
      searchBarBackgroundColor: mapSettings.searchBarBackgroundColor,
      searchBarTextColor: mapSettings.searchBarTextColor,
      searchBarHoverColor: mapSettings.searchBarHoverColor,
      nameRules: mapSettings.nameRules?.length || 0
    }
  })

  // Check marker count limit
  if (markers.length > planLimits.maxMarkersPerMap) {
    return {
      isValid: false,
      reason: 'Map exceeds marker limit',
      premiumFeaturesUsed: [`marker_limit_exceeded`]
    }
  }

  // Check for geocoded markers (premium feature)
  const geocodedMarkers = markers.filter(marker => {
    // If marker has no explicit coordinates but has an address, it was likely geocoded
    // This is a heuristic - in practice, we'd need to track this during marker creation
    return marker.address && marker.address.trim() !== '' && 
           (!marker.lat || !marker.lng || marker.lat === 0 || marker.lng === 0)
  })

  if (geocodedMarkers.length > 0 && !planLimits.geocoding) {
    premiumFeaturesUsed.push('geocoding')
  }

  // Check for name rules usage (premium feature)
  if (mapSettings.nameRules && mapSettings.nameRules.length > 0 && !planLimits.smartGrouping) {
    premiumFeaturesUsed.push('name_rules')
  }

  // Check for premium customization
  // Premium customization includes advanced styling (search bar colors, non-default shapes)
  // Basic customization (border, border width, basic colors) is available to all plans
  // For basic plans: allow 'pin' and 'circle' shapes, disallow 'square' and 'diamond'
  const allowedShapes = planLimits.customizationLevel === 'premium' 
    ? ['pin', 'circle', 'square', 'diamond'] // Premium: all shapes allowed
    : ['pin', 'circle'] // Basic: only pin and circle allowed
  const hasPremiumCustomization = 
    !allowedShapes.includes(mapSettings.markerShape) || // Non-allowed shapes
    mapSettings.searchBarBackgroundColor !== '#ffffff' || // Custom search bar colors
    mapSettings.searchBarTextColor !== '#000000' || // Custom text colors
    mapSettings.searchBarHoverColor !== '#f3f4f6' // Custom hover colors

  console.log('🔍 Premium Customization Check:', {
    hasPremiumCustomization,
    allowedShapes,
    checks: {
      markerShapeNotAllowed: !allowedShapes.includes(mapSettings.markerShape),
      searchBarBackgroundNotWhite: mapSettings.searchBarBackgroundColor !== '#ffffff',
      searchBarTextNotBlack: mapSettings.searchBarTextColor !== '#000000',
      searchBarHoverNotGray: mapSettings.searchBarHoverColor !== '#f3f4f6'
    },
    values: {
      markerShape: mapSettings.markerShape,
      searchBarBackgroundColor: mapSettings.searchBarBackgroundColor,
      searchBarTextColor: mapSettings.searchBarTextColor,
      searchBarHoverColor: mapSettings.searchBarHoverColor
    },
    customizationLevel: planLimits.customizationLevel
  })

  if (hasPremiumCustomization && planLimits.customizationLevel !== 'premium') {
    console.log('❌ Premium customization detected for basic plan')
    premiumFeaturesUsed.push('premium_customization')
  }

  // Check for bulk import indicators
  // If there are many markers with similar patterns, it might indicate bulk import
  const bulkImportIndicators = checkBulkImportIndicators(markers)
  if (bulkImportIndicators && !planLimits.bulkImport) {
    premiumFeaturesUsed.push('bulk_import')
  }

  // Check for smart grouping usage
  const smartGroupingUsed = checkSmartGroupingUsage(mapSettings)
  if (smartGroupingUsed && !planLimits.smartGrouping) {
    premiumFeaturesUsed.push('smart_grouping')
  }

  // Check for custom logos usage (premium customization feature)
  const hasCustomLogos = checkCustomLogosUsage(markers, folderIcons)
  if (hasCustomLogos && planLimits.customizationLevel !== 'premium') {
    premiumFeaturesUsed.push('custom_logos')
  }

  // If any premium features are used without proper plan, map is invalid
  if (premiumFeaturesUsed.length > 0) {
    console.log('❌ Map validation failed - premium features used:', premiumFeaturesUsed)
    return {
      isValid: false,
      reason: 'Map uses premium features not available in current plan',
      premiumFeaturesUsed
    }
  }

  console.log('✅ Map validation passed - no premium features detected')
  return {
    isValid: true,
    premiumFeaturesUsed: []
  }
}

/**
 * Checks if markers indicate bulk import usage
 */
function checkBulkImportIndicators(markers: Marker[]): boolean {
  if (markers.length < 10) return false // Not enough markers to indicate bulk import

  // Check for patterns that suggest bulk import:
  // 1. Many markers with similar naming patterns
  // 2. Markers added in quick succession (similar timestamps)
  // 3. Markers with systematic address patterns

  const names = markers.map(m => m.name.toLowerCase())
  const addresses = markers.map(m => m.address.toLowerCase())

  // Check for systematic naming patterns
  const namePatterns = new Set()
  names.forEach(name => {
    // Extract potential patterns (e.g., "store_1", "store_2", "location_a", "location_b")
    const pattern = name.replace(/\d+/g, '#').replace(/[a-z]/g, 'X')
    namePatterns.add(pattern)
  })

  // If we have many similar patterns, it might be bulk import
  if (namePatterns.size < names.length * 0.3) {
    return true
  }

  // Check for systematic address patterns
  const addressPatterns = new Set()
  addresses.forEach(address => {
    // Extract street patterns
    const streetPattern = address.replace(/\d+/g, '#').replace(/[a-z]/g, 'X')
    addressPatterns.add(streetPattern)
  })

  // If many addresses follow similar patterns, it might be bulk import
  if (addressPatterns.size < addresses.length * 0.4) {
    return true
  }

  return false
}

/**
 * Checks if custom logos are being used
 */
function checkCustomLogosUsage(markers: Marker[], folderIcons?: Record<string, string>): boolean {
  if (!folderIcons || Object.keys(folderIcons).length === 0) {
    return false
  }

  // Check if any markers are using custom logos
  const markersWithLogos = markers.filter(marker => {
    const markerRenamedName = marker.name // We'd need to apply name rules here if available
    return folderIcons[markerRenamedName] || folderIcons[marker.name]
  })

  return markersWithLogos.length > 0
}

/**
 * Checks if smart grouping features are being used
 * Note: Basic clustering is available to all plans, only advanced smart grouping is premium
 * Only checks settings, not markers, because we can't undo smart grouping once applied to markers
 */
function checkSmartGroupingUsage(mapSettings: MapSettings): boolean {
  // Check if name rules are applied (premium feature)
  // This is the only check we do - if nameRules is empty, smart grouping is not being used
  // We don't check markers themselves because:
  // 1. Markers can be renamed manually without smart grouping
  // 2. Once smart grouping is removed from settings, the map should be compliant
  if (mapSettings.nameRules && mapSettings.nameRules.length > 0) {
    return true
  }

  // Basic clustering is available to all plans - don't flag it as premium
  // Only advanced smart grouping features (name rules) should be flagged
  
  return false
}

/**
 * Gets a user-friendly description of premium features used
 */
export function getPremiumFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    'geocoding': 'Geocoded markers (address-to-coordinates conversion)',
    'name_rules': 'Custom name rules and smart grouping',
    'premium_customization': 'Advanced customization options (search bar colors, non-default shapes)',
    'bulk_import': 'Bulk marker import',
    'smart_grouping': 'Advanced smart grouping (name rules and categorization)',
    'custom_logos': 'Custom logos for markers',
    'marker_limit_exceeded': 'Exceeds marker limit for current plan'
  }

  return descriptions[feature] || feature
}

/**
 * Checks if a specific marker was geocoded
 * This would need to be tracked during marker creation
 */
export function isMarkerGeocoded(marker: Marker): boolean {
  // This is a heuristic - in practice, we'd need to track this during marker creation
  // For now, we'll assume markers with addresses but no coordinates were geocoded
  return !!(marker.address && marker.address.trim() !== '' && 
           (!marker.lat || !marker.lng || marker.lat === 0 || marker.lng === 0))
}

/**
 * User-friendly descriptions of premium features
 */
export const PREMIUM_FEATURE_DESCRIPTIONS: Record<string, PremiumFeatureCheck> = {
  'marker_limit_exceeded': {
    feature: 'marker_limit_exceeded',
    isUsed: false,
    description: 'Your map has too many markers for the freemium plan. Upgrade to add more markers.'
  },
  'geocoding': {
    feature: 'geocoding',
    isUsed: false,
    description: 'Auto-geocoding requires a paid plan. You can still add markers manually.'
  },
  'name_rules': {
    feature: 'name_rules',
    isUsed: false,
    description: 'Smart grouping rules require a paid plan. Your markers will use basic grouping.'
  },
  'premium_customization': {
    feature: 'premium_customization',
    isUsed: false,
    description: 'Advanced customization (custom shapes, search bar colors) requires a paid plan. Your map will use basic styling.'
  },
  'bulk_import': {
    feature: 'bulk_import',
    isUsed: false,
    description: 'Bulk import feature requires a paid plan. You can still add markers one by one.'
  },
  'smart_grouping': {
    feature: 'smart_grouping',
    isUsed: false,
    description: 'Smart grouping feature requires a paid plan. Your markers will use basic grouping.'
  },
  'custom_logos': {
    feature: 'custom_logos',
    isUsed: false,
    description: 'Custom logos require premium customization. Your map will use default icons.'
  }
}

/**
 * Gets all premium features that should be checked for a given plan
 */
export function getRequiredPremiumFeatures(plan: keyof typeof SUBSCRIPTION_PLANS): string[] {
  const planLimits = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.freemium
  const requiredFeatures: string[] = []

  if (!planLimits.geocoding) requiredFeatures.push('geocoding')
  if (!planLimits.smartGrouping) requiredFeatures.push('name_rules', 'smart_grouping')
  if (planLimits.customizationLevel !== 'premium') requiredFeatures.push('premium_customization')
  if (!planLimits.bulkImport) requiredFeatures.push('bulk_import')

  return requiredFeatures
}
