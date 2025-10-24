import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

export interface UsageStats {
  maps: number
  markers: number
  storage: number
  mapsCount: number
  markersCount: number
}

export interface LimitationCheck {
  allowed: boolean
  currentUsage: number
  limit: number
  message?: string
}

export class UsageTracker {
  /**
   * Check if user can add more markers to a specific map
   */
  static async checkMarkerLimit(
    userId: string, 
    _mapId: string, 
    currentMarkers: number
  ): Promise<LimitationCheck> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) {
        return { allowed: false, currentUsage: 0, limit: 0, message: 'User not found' }
      }

      const userData = userDoc.data()
      const plan = userData.subscription?.plan || 'freemium'
      const planLimits = SUBSCRIPTION_PLANS[plan]

      const limit = planLimits.maxMarkersPerMap
      const allowed = currentMarkers < limit

      return {
        allowed,
        currentUsage: currentMarkers,
        limit,
        message: allowed ? undefined : `You've reached the marker limit for this map (${limit} markers)`
      }
    } catch (error) {
      console.error('Error checking marker limit:', error)
      return { allowed: false, currentUsage: 0, limit: 0, message: 'Error checking limits' }
    }
  }

  /**
   * Check if user can create more maps
   */
  static async checkMapLimit(userId: string, currentMaps: number): Promise<LimitationCheck> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) {
        return { allowed: false, currentUsage: 0, limit: 0, message: 'User not found' }
      }

      const userData = userDoc.data()
      const plan = userData.subscription?.plan || 'freemium'
      const planLimits = SUBSCRIPTION_PLANS[plan]

      const limit = planLimits.maxMaps
      const allowed = currentMaps < limit

      return {
        allowed,
        currentUsage: currentMaps,
        limit,
        message: allowed ? undefined : `You've reached the map limit (${limit} maps)`
      }
    } catch (error) {
      console.error('Error checking map limit:', error)
      return { allowed: false, currentUsage: 0, limit: 0, message: 'Error checking limits' }
    }
  }

  /**
   * Check if user has access to a specific feature
   */
  static async checkFeatureAccess(
    userId: string, 
    feature: 'watermark' | 'bulkImport' | 'geocoding' | 'smartGrouping'
  ): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) return false

      const userData = userDoc.data()
      const plan = userData.subscription?.plan || 'freemium'
      const planLimits = SUBSCRIPTION_PLANS[plan]

      return planLimits[feature]
    } catch (error) {
      console.error('Error checking feature access:', error)
      return false
    }
  }

  /**
   * Update usage statistics for a user
   */
  static async updateUsage(
    userId: string, 
    type: 'markers' | 'maps' | 'storage', 
    count: number
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        [`usage.${type}`]: count,
        [`usage.${type}Count`]: count,
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('Error updating usage:', error)
      throw error
    }
  }

  /**
   * Get current usage statistics for a user
   */
  static async getUsageStats(userId: string): Promise<UsageStats | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) return null

      const userData = userDoc.data()
      return userData.usage || {
        maps: 0,
        markers: 0,
        storage: 0,
        mapsCount: 0,
        markersCount: 0
      }
    } catch (error) {
      console.error('Error getting usage stats:', error)
      return null
    }
  }

  /**
   * Get user's current plan limits
   */
  static async getUserLimits(userId: string): Promise<any> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) return SUBSCRIPTION_PLANS.freemium

      const userData = userDoc.data()
      const plan = userData.subscription?.plan || 'freemium'
      return SUBSCRIPTION_PLANS[plan]
    } catch (error) {
      console.error('Error getting user limits:', error)
      return SUBSCRIPTION_PLANS.freemium
    }
  }

  /**
   * Check if user needs to upgrade for a specific action
   */
  static async needsUpgrade(
    userId: string, 
    action: 'addMarker' | 'createMap' | 'useFeature',
    feature?: string
  ): Promise<{ needsUpgrade: boolean; recommendedPlan?: string }> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) {
        return { needsUpgrade: true, recommendedPlan: 'starter' }
      }

      const userData = userDoc.data()
      const usage = userData.usage || { maps: 0, markers: 0 }

      switch (action) {
        case 'addMarker':
          const markerCheck = await this.checkMarkerLimit(userId, '', usage.markers)
          if (!markerCheck.allowed) {
            return { needsUpgrade: true, recommendedPlan: 'starter' }
          }
          break

        case 'createMap':
          const mapCheck = await this.checkMapLimit(userId, usage.maps)
          if (!mapCheck.allowed) {
            return { needsUpgrade: true, recommendedPlan: 'starter' }
          }
          break

        case 'useFeature':
          if (feature) {
            const hasAccess = await this.checkFeatureAccess(userId, feature as any)
            if (!hasAccess) {
              return { needsUpgrade: true, recommendedPlan: 'starter' }
            }
          }
          break
      }

      return { needsUpgrade: false }
    } catch (error) {
      console.error('Error checking upgrade needs:', error)
      return { needsUpgrade: true, recommendedPlan: 'starter' }
    }
  }
}
