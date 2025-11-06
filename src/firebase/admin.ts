import { 
  collection, 
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc
} from 'firebase/firestore'
import { db } from './config'
import { UserDocument } from './users'
import { MapDocument } from './maps'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

export interface AdminStats {
  users: {
    total: number
    byPlan: Record<string, number>
    byDate: Array<{ date: string; count: number }>
  }
  maps: {
    total: number
    byDate: Array<{ date: string; count: number }>
  }
}

/**
 * Get all users (admin only)
 */
export const getAllUsers = async (): Promise<UserDocument[]> => {
  try {
    const usersRef = collection(db, 'users')
    let snapshot
    
    // Try to order by createdAt, but fall back to no ordering if index doesn't exist
    try {
      const usersQuery = query(usersRef, orderBy('createdAt', 'asc'))
      snapshot = await getDocs(usersQuery)
    } catch (orderError: any) {
      // If ordering fails (likely missing index), fetch without ordering
      if (orderError.code === 'failed-precondition') {
        console.warn('createdAt index not found, fetching users without ordering')
        snapshot = await getDocs(usersRef)
        // Sort manually
        const users: UserDocument[] = []
        snapshot.forEach((doc) => {
          const data = doc.data() as UserDocument
          users.push({
            ...data,
            uid: doc.id
          })
        })
        // Sort by createdAt if available
        return users.sort((a, b) => {
          const aDate = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt as any)) : new Date(0)
          const bDate = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt as any)) : new Date(0)
          return aDate.getTime() - bDate.getTime()
        })
      } else {
        throw orderError
      }
    }
    
    const users: UserDocument[] = []
    snapshot.forEach((doc) => {
      const data = doc.data() as UserDocument
      users.push({
        ...data,
        uid: doc.id
      })
    })
    
    return users
  } catch (error) {
    console.error('Error fetching all users:', error)
    throw error
  }
}

/**
 * Get all maps (admin only)
 */
export const getAllMapsForAdmin = async (): Promise<MapDocument[]> => {
  try {
    const usersRef = collection(db, 'users')
    const usersSnapshot = await getDocs(usersRef)
    
    const allMaps: MapDocument[] = []
    
    for (const userDoc of usersSnapshot.docs) {
      const mapsRef = collection(db, 'users', userDoc.id, 'maps')
      const mapsSnapshot = await getDocs(mapsRef)
      
      mapsSnapshot.forEach((mapDoc) => {
        const mapData = mapDoc.data() as MapDocument
        allMaps.push({
          ...mapData,
          id: mapDoc.id,
          userId: userDoc.id
        })
      })
    }
    
    return allMaps
  } catch (error) {
    console.error('Error fetching all maps:', error)
    throw error
  }
}

/**
 * Get admin statistics
 */
export const getAdminStats = async (): Promise<AdminStats> => {
  try {
    const users = await getAllUsers()
    const maps = await getAllMapsForAdmin()
    
    // Process user statistics
    const byPlan: Record<string, number> = {}
    const usersByDate: Record<string, number> = {}
    
    users.forEach(user => {
      const plan = user.subscription?.plan || 'freemium'
      byPlan[plan] = (byPlan[plan] || 0) + 1
      
      if (user.createdAt) {
        // Handle Firestore Timestamp or Date
        let createdAtDate: Date
        if (user.createdAt instanceof Date) {
          createdAtDate = user.createdAt
        } else if (user.createdAt && typeof user.createdAt === 'object' && 'toDate' in user.createdAt) {
          // Firestore Timestamp
          createdAtDate = (user.createdAt as any).toDate()
        } else if (typeof user.createdAt === 'string' || typeof user.createdAt === 'number') {
          createdAtDate = new Date(user.createdAt)
        } else {
          return // Skip if can't parse
        }
        const date = createdAtDate.toISOString().split('T')[0]
        usersByDate[date] = (usersByDate[date] || 0) + 1
      }
    })
    
    // Process map statistics
    const mapsByDate: Record<string, number> = {}
    maps.forEach(map => {
      if (map.createdAt) {
        // Handle Firestore Timestamp or Date
        let createdAtDate: Date
        if (map.createdAt instanceof Date) {
          createdAtDate = map.createdAt
        } else if (map.createdAt && typeof map.createdAt === 'object' && 'toDate' in map.createdAt) {
          // Firestore Timestamp
          createdAtDate = (map.createdAt as any).toDate()
        } else if (typeof map.createdAt === 'string' || typeof map.createdAt === 'number') {
          createdAtDate = new Date(map.createdAt)
        } else {
          return // Skip if can't parse
        }
        const date = createdAtDate.toISOString().split('T')[0]
        mapsByDate[date] = (mapsByDate[date] || 0) + 1
      }
    })
    
    // Convert to arrays and sort by date
    const usersByDateArray = Object.entries(usersByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    const mapsByDateArray = Object.entries(mapsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    // Calculate cumulative counts
    let cumulativeUsers = 0
    const usersCumulative = usersByDateArray.map(({ date, count }) => {
      cumulativeUsers += count
      return { date, count: cumulativeUsers }
    })
    
    let cumulativeMaps = 0
    const mapsCumulative = mapsByDateArray.map(({ date, count }) => {
      cumulativeMaps += count
      return { date, count: cumulativeMaps }
    })
    
    return {
      users: {
        total: users.length,
        byPlan,
        byDate: usersCumulative
      },
      maps: {
        total: maps.length,
        byDate: mapsCumulative
      }
    }
  } catch (error) {
    console.error('Error getting admin stats:', error)
    throw error
  }
}

/**
 * Update user subscription plan (admin only)
 * Updates ALL fields, features, and limitations according to the plan
 */
export const updateUserSubscription = async (
  userId: string,
  plan: 'freemium' | 'starter' | 'professional' | 'enterprise'
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId)
    const planLimits = SUBSCRIPTION_PLANS[plan]
    
    // Update subscription plan and status
    // Update all limits fields according to the plan
    // Note: updateDoc only updates specified fields, so usage counts (maps, markers, storage) are preserved
    await updateDoc(userRef, {
      // Subscription info
      'subscription.plan': plan,
      'subscription.status': 'active',
      
      // Plan limits - all max values
      'limits.maxMarkersPerMap': planLimits.maxMarkersPerMap,
      'limits.maxTotalMarkers': planLimits.maxTotalMarkers,
      'limits.maxMaps': planLimits.maxMaps,
      'limits.maxStorageMB': planLimits.maxStorageMB,
      
      // Plan features - all boolean flags
      'limits.watermark': planLimits.watermark,
      'limits.bulkImport': planLimits.bulkImport,
      'limits.geocoding': planLimits.geocoding,
      'limits.smartGrouping': planLimits.smartGrouping,
      'limits.customizationLevel': planLimits.customizationLevel
      
      // Note: Usage counts (limits.maps, limits.markers, limits.storage) are preserved
      // because updateDoc only updates the specified fields
    })
    
    console.log('✅ Updated user subscription:', {
      userId,
      plan,
      limits: {
        maxMarkersPerMap: planLimits.maxMarkersPerMap,
        maxTotalMarkers: planLimits.maxTotalMarkers,
        maxMaps: planLimits.maxMaps,
        maxStorageMB: planLimits.maxStorageMB,
        watermark: planLimits.watermark,
        bulkImport: planLimits.bulkImport,
        geocoding: planLimits.geocoding,
        smartGrouping: planLimits.smartGrouping,
        customizationLevel: planLimits.customizationLevel
      }
    })
  } catch (error) {
    console.error('Error updating user subscription:', error)
    throw error
  }
}

