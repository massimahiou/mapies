import { useFeatureAccess } from './useFeatureAccess'
import { useAuth } from '../contexts/AuthContext'
import { isMapOwnedByUser } from '../firebase/maps'
import { useMapFeatureInheritance } from './useMapFeatureInheritance'

/**
 * Hook that provides feature access for shared maps
 * Uses map-level feature inheritance: users inherit the features of the map they're working on
 */
export const useSharedMapFeatureAccess = (currentMap?: any) => {
  const { user } = useAuth()
  const currentUserFeatures = useFeatureAccess()
  const mapInheritance = useMapFeatureInheritance(currentMap)
  
  // Determine if this is a shared map or owned map
  const isOwnedMap = currentMap && user ? isMapOwnedByUser(currentMap, user.uid) : true
  
  if (isOwnedMap) {
    // For owned maps, use the owner's feature access (current behavior)
    return {
      ...currentUserFeatures,
      mapInheritance: null // No inheritance for owned maps
    }
  }
  
  // For shared maps, inherit the map owner's features
  // This ensures shared users can use the map as it was designed
  
  // Create a function to check if user can add markers based on inherited limits
  const canAddMarkersWithInheritance = (currentCount: number): boolean => {
    // Check if user has permission to add markers
    if (!mapInheritance.permissions.canAddMarkers) {
      return false
    }
    // Check against inherited plan limits
    return currentCount < mapInheritance.inheritedFeatures.maxMarkersPerMap
  }
  
  return {
    ...currentUserFeatures,
    // Override with inherited features from map owner
    hasGeocoding: mapInheritance.inheritedFeatures.hasGeocoding,
    hasSmartGrouping: mapInheritance.inheritedFeatures.hasSmartGrouping,
    hasBulkImport: mapInheritance.inheritedFeatures.hasBulkImport,
    showWatermark: mapInheritance.inheritedFeatures.showWatermark,
    customizationLevel: mapInheritance.inheritedFeatures.customizationLevel,
    // Override plan limits for this map only
    planLimits: {
      ...currentUserFeatures.planLimits,
      maxMarkersPerMap: mapInheritance.inheritedFeatures.maxMarkersPerMap,
      maxTotalMarkers: mapInheritance.inheritedFeatures.maxTotalMarkers,
      maxMaps: mapInheritance.inheritedFeatures.maxMaps,
      maxStorageMB: mapInheritance.inheritedFeatures.maxStorageMB,
    },
    // Use permission-based function for editing capabilities
    canAddMarkers: canAddMarkersWithInheritance,
    canCreateMap: currentUserFeatures.canCreateMap, // Keep user's own limits for new maps
    currentPlan: currentUserFeatures.currentPlan, // User's own plan
    usage: currentUserFeatures.usage,
    getRecommendedUpgrade: currentUserFeatures.getRecommendedUpgrade,
    needsUpgrade: currentUserFeatures.needsUpgrade,
    // Add map inheritance info for UI
    mapInheritance
  }
}
