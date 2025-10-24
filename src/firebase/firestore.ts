import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './config'

// Collection names
const MARKERS_COLLECTION = 'markers'
const MAP_SETTINGS_COLLECTION = 'mapSettings'
const MARKER_GROUPS_COLLECTION = 'markerGroups'

// Legacy interfaces for backward compatibility
export interface FirestoreMarker {
  id?: string
  name: string
  address: string
  lat: number
  lng: number
  type: string
  visible: boolean
  userId: string
  mapId?: string
  createdAt: Date
  updatedAt: Date
}

// Map settings interface (now stored in map document)
export interface NameRule {
  id: string
  contains: string
  renameTo: string
}

// Group tracking interface
export interface MarkerGroup {
  id: string
  groupName: string
  markerIds: string[]
  userId: string
  mapId?: string
  iconUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface FirestoreMapSettings {
  id?: string
  userId: string
  mapId?: string
  style: string
  markerShape: string
  markerColor: string
  markerSize: string
  markerBorder: string
  markerBorderWidth: number
  // Clustering settings
  clusteringEnabled: boolean
  clusterRadius: number
  // Search bar settings
  searchBarBackgroundColor: string
  searchBarTextColor: string
  searchBarHoverColor: string
  // Name rules settings
  nameRules: NameRule[]
  updatedAt: Date
}

// Get user's markers
export const getUserMarkers = async (userId: string): Promise<FirestoreMarker[]> => {
  try {
    const q = query(
      collection(db, MARKERS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FirestoreMarker))
  } catch (error) {
    console.error('Error getting user markers:', error)
    throw error
  }
}

// Add a new marker
export const addMarker = async (marker: Omit<FirestoreMarker, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, MARKERS_COLLECTION), {
      ...marker,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding marker:', error)
    throw error
  }
}

// Update a marker
export const updateMarker = async (markerId: string, updates: Partial<FirestoreMarker>): Promise<void> => {
  try {
    const markerRef = doc(db, MARKERS_COLLECTION, markerId)
    await updateDoc(markerRef, {
      ...updates,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Error updating marker:', error)
    throw error
  }
}

// Delete a marker
export const deleteMarker = async (markerId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, MARKERS_COLLECTION, markerId))
  } catch (error) {
    console.error('Error deleting marker:', error)
    throw error
  }
}

// Get user's map settings
export const getUserMapSettings = async (userId: string): Promise<FirestoreMapSettings | null> => {
  try {
    const q = query(
      collection(db, MAP_SETTINGS_COLLECTION),
      where('userId', '==', userId)
    )
    const querySnapshot = await getDocs(q)
    
    if (querySnapshot.empty) {
      return null
    }
    
    const doc = querySnapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data()
    } as FirestoreMapSettings
  } catch (error) {
    console.error('Error getting user map settings:', error)
    throw error
  }
}

// Save user's map settings
export const saveMapSettings = async (settings: Omit<FirestoreMapSettings, 'id' | 'updatedAt'>): Promise<string> => {
  try {
    // Check if settings already exist
    const existingSettings = await getUserMapSettings(settings.userId)
    
    if (existingSettings) {
      // Update existing settings
      const settingsRef = doc(db, MAP_SETTINGS_COLLECTION, existingSettings.id!)
      await updateDoc(settingsRef, {
        ...settings,
        updatedAt: new Date()
      })
      return existingSettings.id!
    } else {
      // Create new settings
      const docRef = await addDoc(collection(db, MAP_SETTINGS_COLLECTION), {
        ...settings,
        updatedAt: new Date()
      })
      return docRef.id
    }
  } catch (error) {
    console.error('Error saving map settings:', error)
    throw error
  }
}

// Listen to user's markers in real-time
export const subscribeToUserMarkers = (
  userId: string, 
  callback: (markers: FirestoreMarker[]) => void
): (() => void) => {
  const q = query(
    collection(db, MARKERS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  
  return onSnapshot(q, (querySnapshot) => {
    const markers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FirestoreMarker))
    callback(markers)
  })
}

// Marker Groups Management
export const createMarkerGroup = async (group: Omit<MarkerGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, MARKER_GROUPS_COLLECTION), {
      ...group,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    return docRef.id
  } catch (error) {
    console.error('Error creating marker group:', error)
    throw error
  }
}

export const updateMarkerGroup = async (groupId: string, updates: Partial<MarkerGroup>): Promise<void> => {
  try {
    const groupRef = doc(db, MARKER_GROUPS_COLLECTION, groupId)
    await updateDoc(groupRef, {
      ...updates,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Error updating marker group:', error)
    throw error
  }
}

export const deleteMarkerGroup = async (groupId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, MARKER_GROUPS_COLLECTION, groupId))
  } catch (error) {
    console.error('Error deleting marker group:', error)
    throw error
  }
}

export const getUserMarkerGroups = async (userId: string, mapId?: string): Promise<MarkerGroup[]> => {
  try {
    let q = query(
      collection(db, MARKER_GROUPS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
    
    if (mapId) {
      q = query(
        collection(db, MARKER_GROUPS_COLLECTION),
        where('userId', '==', userId),
        where('mapId', '==', mapId),
        orderBy('createdAt', 'desc')
      )
    }
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MarkerGroup))
  } catch (error) {
    console.error('Error getting user marker groups:', error)
    throw error
  }
}

export const getMarkerGroupByName = async (userId: string, groupName: string, mapId?: string): Promise<MarkerGroup | null> => {
  try {
    let q = query(
      collection(db, MARKER_GROUPS_COLLECTION),
      where('userId', '==', userId),
      where('groupName', '==', groupName)
    )
    
    if (mapId) {
      q = query(
        collection(db, MARKER_GROUPS_COLLECTION),
        where('userId', '==', userId),
        where('mapId', '==', mapId),
        where('groupName', '==', groupName)
      )
    }
    
    const querySnapshot = await getDocs(q)
    
    if (querySnapshot.empty) {
      return null
    }
    
    const doc = querySnapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data()
    } as MarkerGroup
  } catch (error) {
    console.error('Error getting marker group by name:', error)
    throw error
  }
}

// Upload folder icon as base64 (temporary solution until Firebase Storage is enabled)
export const uploadFolderIconBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Validate file size (max 1MB for base64)
      if (file.size > 1024 * 1024) {
        reject(new Error('File size must be less than 1MB for base64 storage'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Upload folder icon to Firebase Storage (original implementation)
export const uploadFolderIcon = async (userId: string, groupName: string, file: File): Promise<string> => {
  try {
    // Create a unique filename
    const timestamp = Date.now()
    const fileName = `folder-icons/${userId}/${groupName}-${timestamp}.${file.name.split('.').pop()}`
    
    // Upload file to Firebase Storage
    const storageRef = ref(storage, fileName)
    await uploadBytes(storageRef, file)
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef)
    return downloadURL
  } catch (error) {
    console.error('Error uploading folder icon:', error)
    throw error
  }
}

// Delete folder icon from Firebase Storage
export const deleteFolderIcon = async (iconUrl: string): Promise<void> => {
  try {
    const storageRef = ref(storage, iconUrl)
    await deleteObject(storageRef)
  } catch (error) {
    console.error('Error deleting folder icon:', error)
    throw error
  }
}

// Update marker group with icon URL
export const updateMarkerGroupIcon = async (groupId: string, iconUrl: string): Promise<void> => {
  try {
    const groupRef = doc(db, MARKER_GROUPS_COLLECTION, groupId)
    await updateDoc(groupRef, {
      iconUrl,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Error updating marker group icon:', error)
    throw error
  }
}

// Remove marker group icon URL
export const removeMarkerGroupIcon = async (groupId: string): Promise<void> => {
  try {
    const groupRef = doc(db, MARKER_GROUPS_COLLECTION, groupId)
    await updateDoc(groupRef, {
      iconUrl: null,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Error removing marker group icon:', error)
    throw error
  }
}
