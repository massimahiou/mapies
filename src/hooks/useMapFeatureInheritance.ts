import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFeatureAccess } from './useFeatureAccess'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'
import { MapDocument } from '../firebase/maps'
import { isAdmin } from '../utils/admin'

export interface MapFeatureInheritance {
  // Inherited features from map owner
  inheritedFeatures: {
    hasGeocoding: boolean
    hasSmartGrouping: boolean
    hasBulkImport: boolean
    showWatermark: boolean
    customizationLevel: 'basic' | 'premium'
    maxMarkersPerMap: number
    maxTotalMarkers: number
    maxMaps: number
    maxStorageMB: number
  }
  
  // Map owner's plan info
  mapOwnerPlan: string
  mapOwnerPlanName: string
  
  // Current user's plan info
  currentUserPlan: string
  currentUserPlanName: string
  
  // Whether user is working on their own map
  isOwnedMap: boolean
  
  // User's role in this shared map (if shared)
  userRole?: 'viewer' | 'editor' | 'admin'
  
  // Permissions based on role
  permissions: {
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canAddMarkers: boolean
    canModifySettings: boolean
  }
  
  // Header message for UI
  headerMessage: string
  headerType: 'info' | 'warning' | 'success'
}

/**
 * Hook that provides map-level feature inheritance
 * Users inherit the features of the map they're working on, not their own subscription
 */
export const useMapFeatureInheritance = (currentMap?: MapDocument | null): MapFeatureInheritance => {
  const { user } = useAuth()
  const currentUserFeatures = useFeatureAccess()
  const [mapOwnerPlan, setMapOwnerPlan] = useState<string>('freemium')
  const [mapOwnerPlanLoaded, setMapOwnerPlanLoaded] = useState(false)
  const [userRole, setUserRole] = useState<'viewer' | 'editor' | 'admin' | undefined>(undefined)
  
  // Load map owner's subscription plan and user role
  useEffect(() => {
    const loadMapOwnerPlan = async () => {
      if (!currentMap || !currentMap.userId) {
        setMapOwnerPlanLoaded(true)
        return
      }
      
      try {
        const { getUserDocument } = await import('../firebase/users')
        const ownerDoc = await getUserDocument(currentMap.userId)
        const ownerPlan = ownerDoc?.subscription?.plan || 'freemium'
        setMapOwnerPlan(ownerPlan)
        
        // Determine user's role in this shared map
        if (user && currentMap.sharing?.sharedWith) {
          const sharedUser = currentMap.sharing.sharedWith.find(
            (sharedUser: any) => sharedUser.email === user.email
          )
          setUserRole(sharedUser?.role)
        } else {
          setUserRole(undefined)
        }
        
        setMapOwnerPlanLoaded(true)
      } catch (error) {
        console.error('Error loading map owner plan:', error)
        setMapOwnerPlan('freemium')
        setUserRole(undefined)
        setMapOwnerPlanLoaded(true)
      }
    }
    
    loadMapOwnerPlan()
  }, [currentMap, user])
  
  return useMemo(() => {
    // Don't return inheritance data until map owner plan is loaded
    if (!mapOwnerPlanLoaded) {
      return {
        inheritedFeatures: {
          hasGeocoding: currentUserFeatures.hasGeocoding,
          hasSmartGrouping: currentUserFeatures.hasSmartGrouping,
          hasBulkImport: currentUserFeatures.hasBulkImport,
          showWatermark: currentUserFeatures.showWatermark,
          customizationLevel: currentUserFeatures.customizationLevel,
          maxMarkersPerMap: currentUserFeatures.planLimits.maxMarkersPerMap,
          maxTotalMarkers: currentUserFeatures.planLimits.maxTotalMarkers,
          maxMaps: currentUserFeatures.planLimits.maxMaps,
          maxStorageMB: currentUserFeatures.planLimits.maxStorageMB,
        },
        mapOwnerPlan: currentUserFeatures.currentPlan,
        mapOwnerPlanName: SUBSCRIPTION_PLANS[currentUserFeatures.currentPlan]?.name || 'Unknown',
        currentUserPlan: currentUserFeatures.currentPlan,
        currentUserPlanName: SUBSCRIPTION_PLANS[currentUserFeatures.currentPlan]?.name || 'Unknown',
        isOwnedMap: true,
        userRole: undefined,
        permissions: {
          canEdit: true,
          canDelete: true,
          canShare: true,
          canAddMarkers: true,
          canModifySettings: true
        },
        headerMessage: '',
        headerType: 'info' as const,
      }
    }
    // If no map or user, return current user's features
    if (!currentMap || !user) {
      return {
        inheritedFeatures: {
          hasGeocoding: currentUserFeatures.hasGeocoding,
          hasSmartGrouping: currentUserFeatures.hasSmartGrouping,
          hasBulkImport: currentUserFeatures.hasBulkImport,
          showWatermark: currentUserFeatures.showWatermark,
          customizationLevel: currentUserFeatures.customizationLevel,
          maxMarkersPerMap: currentUserFeatures.planLimits.maxMarkersPerMap,
          maxTotalMarkers: currentUserFeatures.planLimits.maxTotalMarkers,
          maxMaps: currentUserFeatures.planLimits.maxMaps,
          maxStorageMB: currentUserFeatures.planLimits.maxStorageMB,
        },
        mapOwnerPlan: currentUserFeatures.currentPlan,
        mapOwnerPlanName: SUBSCRIPTION_PLANS[currentUserFeatures.currentPlan]?.name || 'Unknown',
        currentUserPlan: currentUserFeatures.currentPlan,
        currentUserPlanName: SUBSCRIPTION_PLANS[currentUserFeatures.currentPlan]?.name || 'Unknown',
        isOwnedMap: true,
        userRole: undefined,
        permissions: {
          canEdit: true,
          canDelete: true,
          canShare: true,
          canAddMarkers: true,
          canModifySettings: true
        },
        headerMessage: '',
        headerType: 'info' as const,
      }
    }
    
    // Determine if this is the user's own map or if user is admin
    const userIsAdmin = isAdmin(user.email)
    const isOwnedMap = currentMap.userId === user.uid || userIsAdmin
    
    // Get map owner's plan from loaded data
    const mapOwnerPlanLimits = SUBSCRIPTION_PLANS[mapOwnerPlan] || SUBSCRIPTION_PLANS.freemium
    
    // Determine permissions based on role
    // Admin always has full permissions
    const permissions = userIsAdmin ? {
      canEdit: true,
      canDelete: true,
      canShare: true,
      canAddMarkers: true,
      canModifySettings: true
    } : {
      canEdit: isOwnedMap || userRole === 'editor' || userRole === 'admin',
      canDelete: isOwnedMap || userRole === 'admin',
      canShare: isOwnedMap || userRole === 'admin',
      canAddMarkers: isOwnedMap || userRole === 'editor' || userRole === 'admin',
      canModifySettings: isOwnedMap || userRole === 'admin'
    }
    
    // Inherit features from map owner
    const inheritedFeatures = {
      hasGeocoding: mapOwnerPlanLimits.geocoding,
      hasSmartGrouping: mapOwnerPlanLimits.smartGrouping,
      hasBulkImport: mapOwnerPlanLimits.bulkImport,
      showWatermark: mapOwnerPlanLimits.watermark,
      customizationLevel: mapOwnerPlanLimits.customizationLevel,
      maxMarkersPerMap: mapOwnerPlanLimits.maxMarkersPerMap,
      maxTotalMarkers: mapOwnerPlanLimits.maxTotalMarkers,
      maxMaps: mapOwnerPlanLimits.maxMaps,
      maxStorageMB: mapOwnerPlanLimits.maxStorageMB,
    }
    
    // Generate header message
    let headerMessage = ''
    let headerType: 'info' | 'warning' | 'success' = 'info'
    
    if (!isOwnedMap) {
      const mapOwnerPlanName = mapOwnerPlanLimits.name
      const roleText = userRole ? ` as ${userRole}` : ''
      
      if (mapOwnerPlan === currentUserFeatures.currentPlan) {
        headerMessage = `You are working on a ${mapOwnerPlanName} map${roleText}. You have access to ${mapOwnerPlanName} features for this map only.`
        headerType = 'info'
      } else if (mapOwnerPlanLimits.maxMarkersPerMap > currentUserFeatures.planLimits.maxMarkersPerMap) {
        headerMessage = `You are working on a ${mapOwnerPlanName} map${roleText}. You have access to ${mapOwnerPlanName} features for this map only.`
        headerType = 'success'
      } else {
        headerMessage = `You are working on a ${mapOwnerPlanName} map${roleText}. You have access to ${mapOwnerPlanName} features for this map only.`
        headerType = 'warning'
      }
    }
    
    return {
      inheritedFeatures,
      mapOwnerPlan,
      mapOwnerPlanName: mapOwnerPlanLimits.name,
      currentUserPlan: currentUserFeatures.currentPlan,
      currentUserPlanName: SUBSCRIPTION_PLANS[currentUserFeatures.currentPlan]?.name || 'Unknown',
      isOwnedMap,
      userRole,
      permissions,
      headerMessage,
      headerType,
    }
  }, [currentMap, user, currentUserFeatures, mapOwnerPlan, mapOwnerPlanLoaded, userRole])
}
