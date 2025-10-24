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
  // Premium customization includes custom colors, shapes, and advanced styling
  const hasPremiumCustomization = 
    mapSettings.markerShape !== 'circle' || // Non-default shapes
    mapSettings.markerColor !== '#3B82F6' || // Non-default colors
    mapSettings.markerBorder !== 'none' || // Custom borders
    mapSettings.markerBorderWidth > 0 || // Custom border width
    mapSettings.searchBarBackgroundColor !== '#ffffff' || // Custom search bar colors
    mapSettings.searchBarTextColor !== '#000000' || // Custom text colors
    mapSettings.searchBarHoverColor !== '#f3f4f6' // Custom hover colors

  if (hasPremiumCustomization && planLimits.customizationLevel !== 'premium') {
    premiumFeaturesUsed.push('premium_customization')
  }

  // Check for bulk import indicators
  // If there are many markers with similar patterns, it might indicate bulk import
  const bulkImportIndicators = checkBulkImportIndicators(markers)
  if (bulkImportIndicators && !planLimits.bulkImport) {
    premiumFeaturesUsed.push('bulk_import')
  }

  // Check for smart grouping usage
  const smartGroupingUsed = checkSmartGroupingUsage(markers, mapSettings)
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
    return {
      isValid: false,
      reason: 'Map uses premium features not available in current plan',
      premiumFeaturesUsed
    }
  }

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
 */
function checkSmartGroupingUsage(markers: Marker[], mapSettings: MapSettings): boolean {
  // Check if name rules are applied
  if (mapSettings.nameRules && mapSettings.nameRules.length > 0) {
    return true
  }

  // Check for clustering usage (indicates smart grouping)
  if (mapSettings.clusteringEnabled) {
    return true
  }

  // Check for renamed markers (indicates smart grouping was used)
  const hasRenamedMarkers = markers.some(marker => {
    // This would need to be tracked during marker creation
    // For now, we'll check if markers have been processed by name rules
    return marker.name !== marker.address // Simple heuristic
  })

  return hasRenamedMarkers
}

/**
 * Gets a user-friendly description of premium features used
 */
export function getPremiumFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    'geocoding': 'Geocoded markers (address-to-coordinates conversion)',
    'name_rules': 'Custom name rules and smart grouping',
    'premium_customization': 'Premium customization options',
    'bulk_import': 'Bulk marker import',
    'smart_grouping': 'Smart grouping and clustering',
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
