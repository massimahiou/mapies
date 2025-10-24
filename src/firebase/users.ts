import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './config'
import { User } from 'firebase/auth'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

// User document interface
export interface UserDocument {
  uid: string
  email: string
  displayName?: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  profile?: {
    firstName?: string
    lastName?: string
    company?: string
    phone?: string
    avatar?: string
  }
  preferences?: {
    theme: 'light' | 'dark'
    language: string
    notifications: boolean
  }
  subscription?: {
    plan: 'freemium' | 'starter' | 'professional' | 'enterprise'
    status: 'active' | 'inactive' | 'cancelled'
    expiresAt?: Date
    stripeCustomerId?: string
  }
  limits?: {
    // Marker limits
    maxMarkersPerMap: number
    maxTotalMarkers: number
    
    // Map limits
    maxMaps: number
    
    // Feature flags
    watermark: boolean
    bulkImport: boolean
    geocoding: boolean
    smartGrouping: boolean
    
    // Customization levels
    customizationLevel: 'basic' | 'premium'
    
    // Storage limits
    maxStorageMB: number
    
    // Legacy fields for backward compatibility
    maps: number
    markers: number
    storage: number
  }
  usage?: {
    maps: number
    markers: number
    storage: number
    mapsCount: number
    markersCount: number
  }
}

// Create user document when account is created
export const createUserDocument = async (user: User, additionalData?: Partial<UserDocument>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', user.uid)
    const existingDoc = await getDoc(userRef)
    
    if (!existingDoc.exists()) {
      const plan = additionalData?.subscription?.plan || 'freemium'
      const planLimits = SUBSCRIPTION_PLANS[plan]
      
      const userDoc: UserDocument = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        emailVerified: user.emailVerified,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
        profile: {
          firstName: '',
          lastName: '',
          company: '',
          phone: '',
          avatar: ''
        },
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: true
        },
        subscription: {
          plan: plan as any,
          status: 'active',
          ...additionalData?.subscription
        },
        limits: {
          // Set limits based on plan
          maxMarkersPerMap: planLimits.maxMarkersPerMap,
          maxTotalMarkers: planLimits.maxTotalMarkers,
          maxMaps: planLimits.maxMaps,
          watermark: planLimits.watermark,
          bulkImport: planLimits.bulkImport,
          geocoding: planLimits.geocoding,
          smartGrouping: planLimits.smartGrouping,
          customizationLevel: planLimits.customizationLevel,
          maxStorageMB: planLimits.maxStorageMB,
          // Legacy fields
          maps: planLimits.maxMaps,
          markers: planLimits.maxMarkersPerMap,
          storage: planLimits.maxStorageMB
        },
        usage: {
          maps: 0,
          markers: 0,
          storage: 0,
          mapsCount: 0,
          markersCount: 0
        },
        ...additionalData
      }

      await setDoc(userRef, {
        ...userDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      })

      console.log('User document created successfully:', user.uid)
    }
  } catch (error) {
    console.error('Error creating user document:', error)
    throw error
  }
}

// Get user document
export const getUserDocument = async (uid: string): Promise<UserDocument | null> => {
  try {
    console.log('Attempting to get user document for UID:', uid)
    const userRef = doc(db, 'users', uid)
    console.log('User reference created:', userRef.path)
    
    const userSnap = await getDoc(userRef)
    console.log('Document snapshot received:', userSnap.exists())
    
    if (userSnap.exists()) {
      const data = userSnap.data() as UserDocument
      console.log('User document data:', data)
      return data
    } else {
      console.log('User document not found:', uid)
      return null
    }
  } catch (error) {
    console.error('Error getting user document:', error)
    console.error('Error code:', (error as any)?.code)
    console.error('Error message:', (error as any)?.message)
    throw error
  }
}

// Update user document
export const updateUserDocument = async (uid: string, updates: Partial<UserDocument>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
    console.log('User document updated successfully:', uid)
  } catch (error) {
    console.error('Error updating user document:', error)
    throw error
  }
}

// Update user profile
export const updateUserProfile = async (uid: string, profile: Partial<UserDocument['profile']>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
      'profile': profile,
      updatedAt: serverTimestamp()
    })
    console.log('User profile updated successfully:', uid)
  } catch (error) {
    console.error('Error updating user profile:', error)
    throw error
  }
}

// Update user preferences
export const updateUserPreferences = async (uid: string, preferences: Partial<UserDocument['preferences']>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
      'preferences': preferences,
      updatedAt: serverTimestamp()
    })
    console.log('User preferences updated successfully:', uid)
  } catch (error) {
    console.error('Error updating user preferences:', error)
    throw error
  }
}

// Update last login time
export const updateLastLogin = async (uid: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating last login:', error)
    // Don't throw error for last login update failures
  }
}

// Update subscription plan
export const updateSubscriptionPlan = async (uid: string, plan: 'freemium' | 'starter' | 'professional' | 'enterprise', stripeCustomerId?: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid)
    const planLimits = SUBSCRIPTION_PLANS[plan]
    
    // Build update object dynamically to avoid undefined values
    const updateData: any = {
      'subscription.plan': plan,
      'subscription.status': 'active',
      // Update limits based on new plan
      'limits.maxMarkersPerMap': planLimits.maxMarkersPerMap,
      'limits.maxTotalMarkers': planLimits.maxTotalMarkers,
      'limits.maxMaps': planLimits.maxMaps,
      'limits.watermark': planLimits.watermark,
      'limits.bulkImport': planLimits.bulkImport,
      'limits.geocoding': planLimits.geocoding,
      'limits.smartGrouping': planLimits.smartGrouping,
      'limits.customizationLevel': planLimits.customizationLevel,
      'limits.maxStorageMB': planLimits.maxStorageMB,
      // Legacy fields
      'limits.maps': planLimits.maxMaps,
      'limits.markers': planLimits.maxMarkersPerMap,
      'limits.storage': planLimits.maxStorageMB,
      updatedAt: serverTimestamp()
    }
    
    // Only add stripeCustomerId if provided
    if (stripeCustomerId !== undefined) {
      updateData['subscription.stripeCustomerId'] = stripeCustomerId
    }
    
    await updateDoc(userRef, updateData)
    console.log('Subscription plan updated successfully:', uid, plan)
  } catch (error) {
    console.error('Error updating subscription plan:', error)
    throw error
  }
}

// Delete user document
export const deleteUserDocument = async (uid: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid)
    await deleteDoc(userRef)
    console.log('User document deleted successfully:', uid)
  } catch (error) {
    console.error('Error deleting user document:', error)
    throw error
  }
}
