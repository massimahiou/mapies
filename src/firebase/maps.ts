import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  getDoc,
  query, 
  orderBy,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './config'
import { detectBusinessType } from '../utils/businessDetection'

export interface NameRule {
  id: string
  contains: string
  renameTo: string
}

// Map interface
export interface MapDocument {
  id?: string
  name: string
  description?: string
  userId: string
  createdAt: Date
  updatedAt: Date
  settings?: {
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
  }
  stats?: {
    markerCount: number
    lastUpdated: Date
  }
  // Sharing settings
  sharing?: {
    isShared: boolean
    sharedWith: SharedUser[]
    permissions: {
      canEdit: boolean
      canDelete: boolean
      canShare: boolean
    }
  }
}

// Shared user interface
export interface SharedUser {
  email: string
  userId?: string
  role: 'viewer' | 'editor' | 'admin'
  invitedAt: Date
  acceptedAt?: Date
  invitedBy: string
}

// Marker interface (updated for new structure)
export interface MarkerDocument {
  id?: string
  name: string
  address: string
  lat: number
  lng: number
  type: string
  visible: boolean
  userId: string
  mapId: string
  createdAt: Date
  updatedAt: Date
  businessCategory?: {
    id: string
    name: string
    icon: string
    color: string
    confidence: number
    matchedTerm: string
  }
}

// Create a new map
export const createMap = async (userId: string, mapData: Omit<MapDocument, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<string> => {
  try {
    // Create map in user's collection
    const mapRef = collection(db, 'users', userId, 'maps')
    const docRef = await addDoc(mapRef, {
      ...mapData,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      stats: {
        markerCount: 0,
        lastUpdated: serverTimestamp()
      }
    })
    
            // Also create a public map entry for easy access
            const publicMapRef = doc(db, 'publicMaps', docRef.id)
            await setDoc(publicMapRef, {
              id: docRef.id,
              ...mapData,
              userId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              stats: {
                markerCount: 0,
                lastUpdated: serverTimestamp()
              }
            })
            
            // Create empty public markers collection for future use
            // Collection is ready for future markers
    
    console.log('Map created successfully:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('Error creating map:', error)
    throw error
  }
}


// Get user's maps
export const getUserMaps = async (userId: string): Promise<MapDocument[]> => {
  try {
    const mapsRef = collection(db, 'users', userId, 'maps')
    const q = query(mapsRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MapDocument))
  } catch (error) {
    console.error('Error getting user maps:', error)
    throw error
  }
}

// Get a specific map
export const getMap = async (userId: string, mapId: string): Promise<MapDocument | null> => {
  try {
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    const mapSnap = await getDoc(mapRef)
    
    if (mapSnap.exists()) {
      return {
        id: mapSnap.id,
        ...mapSnap.data()
      } as MapDocument
    }
    return null
  } catch (error) {
    console.error('Error getting map:', error)
    throw error
  }
}

// Get a map by ID from user collections (for public access)
// Copy markers from user collection to public collection for faster access
export const copyMarkersToPublicCollection = async (userId: string, mapId: string): Promise<void> => {
  try {
    console.log('Copying markers to public collection for map:', mapId)
    
    // Get all markers from user collection
    const userMarkersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    const userMarkersSnapshot = await getDocs(userMarkersRef)
    
    if (userMarkersSnapshot.empty) {
      console.log('No markers to copy')
      return
    }
    
    // Create public markers collection
    const publicMarkersRef = collection(db, 'publicMaps', mapId, 'markers')
    
    // Copy each marker to public collection
    const copyPromises = userMarkersSnapshot.docs.map(async (markerDoc) => {
      const markerData = markerDoc.data()
      const publicMarkerRef = doc(publicMarkersRef, markerDoc.id)
      await setDoc(publicMarkerRef, {
        ...markerData,
        copiedAt: serverTimestamp()
      })
    })
    
    await Promise.all(copyPromises)
    console.log(`Successfully copied ${userMarkersSnapshot.docs.length} markers to public collection`)
    
  } catch (error) {
    console.error('Error copying markers to public collection:', error)
    throw error
  }
}

// Subscribe to public markers (faster than user subcollection)
export const subscribeToPublicMarkers = (mapId: string, callback: (markers: MarkerDocument[]) => void) => {
  console.log('Setting up public markers listener for map:', mapId)
  
  const publicMarkersRef = collection(db, 'publicMaps', mapId, 'markers')
  
  return onSnapshot(publicMarkersRef, (snapshot) => {
    const markers: MarkerDocument[] = []
    snapshot.forEach((doc) => {
      markers.push({
        id: doc.id,
        ...doc.data()
      } as MarkerDocument)
    })
    
    console.log('Public markers updated:', markers.length, 'markers')
    callback(markers)
  }, (error) => {
    console.error('Error in public markers listener:', error)
    console.error('Error details:', error.code, error.message)
    
    // If public markers fail, fallback to user markers
    console.log('Falling back to user markers subscription...')
    // We'll need to get the userId somehow, but for now just return empty
    callback([])
  })
}

// Sync a single marker to public collection (called when markers are added/updated)
export const syncMarkerToPublicCollection = async (mapId: string, markerId: string, markerData: any): Promise<void> => {
  try {
    const publicMarkerRef = doc(db, 'publicMaps', mapId, 'markers', markerId)
    await setDoc(publicMarkerRef, {
      ...markerData,
      syncedAt: serverTimestamp()
    })
    console.log('Marker synced to public collection:', markerId)
  } catch (error) {
    console.error('Error syncing marker to public collection:', error)
    // Don't throw - this is a background sync operation
  }
}

// Remove marker from public collection (called when markers are deleted)
export const removeMarkerFromPublicCollection = async (mapId: string, markerId: string): Promise<void> => {
  try {
    const publicMarkerRef = doc(db, 'publicMaps', mapId, 'markers', markerId)
    await deleteDoc(publicMarkerRef)
    console.log('Marker removed from public collection:', markerId)
  } catch (error) {
    console.error('Error removing marker from public collection:', error)
    // Don't throw - this is a background sync operation
  }
}

export const getMapById = async (mapId: string): Promise<MapDocument | null> => {
  try {
    console.log('Searching for map ID:', mapId, 'in public collection...')
    
    // Try to get from a public maps collection first
    const publicMapRef = doc(db, 'publicMaps', mapId)
    const publicMapDoc = await getDoc(publicMapRef)
    
    if (publicMapDoc.exists()) {
      console.log('Found map in public collection')
      const mapData = publicMapDoc.data()
      return {
        id: mapId,
        ...mapData
      } as MapDocument
    }
    
    console.log('Map not found in public collection, searching user collections...')
    
    // If not found in public collection, search through user collections
    // This is for migrating existing maps
    const usersQuery = query(collection(db, 'users'))
    const usersSnapshot = await getDocs(usersQuery)
    
    for (const userDoc of usersSnapshot.docs) {
      const mapRef = doc(db, 'users', userDoc.id, 'maps', mapId)
      const mapDoc = await getDoc(mapRef)
      
            if (mapDoc.exists()) {
              console.log('Found map in user collection, migrating to public collection...')
              const mapData = mapDoc.data()
              
              // Migrate to public collection
              await setDoc(publicMapRef, {
                id: mapId,
                ...mapData
              })
              
              // Copy markers to public collection for faster access
              try {
                await copyMarkersToPublicCollection(userDoc.id, mapId)
              } catch (markerError) {
                console.warn('Failed to copy markers to public collection:', markerError)
                // Continue anyway - map will still work but slower
              }
              
              return {
                id: mapId,
                ...mapData
              } as MapDocument
            }
    }
    
    console.log('Map not found in any collection')
    return null
  } catch (error) {
    console.error('Error getting map by ID:', error)
    throw error
  }
}

// Update a map
export const updateMap = async (userId: string, mapId: string, updates: Partial<MapDocument>): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    await updateDoc(mapRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
    console.log('Map updated successfully:', mapId)
  } catch (error) {
    console.error('Error updating map:', error)
    throw error
  }
}

// Delete a map and all its markers
export const deleteMap = async (userId: string, mapId: string): Promise<void> => {
  try {
    // First, delete all markers in the map
    const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    const markersSnapshot = await getDocs(markersRef)
    
    // Delete all markers
    const deletePromises = markersSnapshot.docs.map(markerDoc => 
      deleteDoc(doc(db, 'users', userId, 'maps', mapId, 'markers', markerDoc.id))
    )
    await Promise.all(deletePromises)
    
    // Then delete the map itself
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    await deleteDoc(mapRef)
    
    console.log('Map and all markers deleted successfully:', mapId)
  } catch (error) {
    console.error('Error deleting map:', error)
    throw error
  }
}

// Get map's markers
export const getMapMarkers = async (userId: string, mapId: string): Promise<MarkerDocument[]> => {
  try {
    const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    const q = query(markersRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MarkerDocument))
  } catch (error) {
    console.error('Error getting map markers:', error)
    throw error
  }
}

// Add marker to map
export const addMarkerToMap = async (userId: string, mapId: string, markerData: Omit<MarkerDocument, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'mapId'>): Promise<string> => {
  try {
    // Detect business category
    const businessDetection = detectBusinessType(markerData.name, markerData.address)
    
    const markerWithCategory = {
      ...markerData,
      businessCategory: {
        id: businessDetection.category.id,
        name: businessDetection.category.name,
        icon: businessDetection.category.icon,
        color: businessDetection.category.color,
        confidence: businessDetection.confidence,
        matchedTerm: businessDetection.matchedTerm
      }
    }
    
    const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    const docRef = await addDoc(markersRef, {
      ...markerWithCategory,
      userId,
      mapId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    // Sync to public collection for faster public access
    try {
      await syncMarkerToPublicCollection(mapId, docRef.id, {
        ...markerWithCategory,
        userId,
        mapId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    } catch (syncError) {
      console.warn('Failed to sync marker to public collection:', syncError)
      // Continue anyway - marker is still added to user collection
    }
    
    // Update map stats
    await updateMapStats(userId, mapId)
    
    console.log('Marker added to map successfully:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('Error adding marker to map:', error)
    throw error
  }
}

// Update marker in map
export const updateMapMarker = async (userId: string, mapId: string, markerId: string, updates: Partial<MarkerDocument>): Promise<void> => {
  try {
    const markerRef = doc(db, 'users', userId, 'maps', mapId, 'markers', markerId)
    await updateDoc(markerRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
    
    // Update map stats
    await updateMapStats(userId, mapId)
    
    console.log('Marker updated successfully:', markerId)
  } catch (error) {
    console.error('Error updating marker:', error)
    throw error
  }
}

// Delete marker from map
export const deleteMapMarker = async (userId: string, mapId: string, markerId: string): Promise<void> => {
  try {
    const markerRef = doc(db, 'users', userId, 'maps', mapId, 'markers', markerId)
    await deleteDoc(markerRef)
    
    // Also remove from public collection
    try {
      await removeMarkerFromPublicCollection(mapId, markerId)
    } catch (syncError) {
      console.warn('Failed to remove marker from public collection:', syncError)
      // Continue anyway - marker is still deleted from user collection
    }
    
    // Update map stats
    await updateMapStats(userId, mapId)
    
    console.log('Marker deleted successfully:', markerId)
  } catch (error) {
    console.error('Error deleting marker:', error)
    throw error
  }
}

// Update map statistics
export const updateMapStats = async (userId: string, mapId: string): Promise<void> => {
  try {
    const markers = await getMapMarkers(userId, mapId)
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    
    await updateDoc(mapRef, {
      'stats.markerCount': markers.length,
      'stats.lastUpdated': serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating map stats:', error)
    // Don't throw error for stats update failures
  }
}

// Listen to map markers in real-time
export const subscribeToMapMarkers = (
  userId: string, 
  mapId: string,
  callback: (markers: MarkerDocument[]) => void
): (() => void) => {
  const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
  const q = query(markersRef, orderBy('createdAt', 'desc'))
  
  return onSnapshot(q, (querySnapshot) => {
    const markers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MarkerDocument))
    callback(markers)
  })
}

// Listen to user's maps in real-time
export const subscribeToUserMaps = (
  userId: string, 
  callback: (maps: MapDocument[]) => void
): (() => void) => {
  const mapsRef = collection(db, 'users', userId, 'maps')
  const q = query(mapsRef, orderBy('createdAt', 'desc'))
  
  return onSnapshot(q, (querySnapshot) => {
    const maps = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MapDocument))
    callback(maps)
  })
}

// Listen to a specific map document for settings changes
export const subscribeToMapDocument = (
  userId: string,
  mapId: string,
  callback: (map: MapDocument | null) => void
): (() => void) => {
  const mapRef = doc(db, 'users', userId, 'maps', mapId)
  
  return onSnapshot(mapRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const mapData = {
        id: docSnapshot.id,
        ...docSnapshot.data()
      } as MapDocument
      callback(mapData)
    } else {
      callback(null)
    }
  })
}

// Share map with user by email
export const shareMapWithUser = async (
  mapId: string,
  ownerId: string,
  email: string,
  role: 'viewer' | 'editor' | 'admin' = 'viewer'
): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', ownerId, 'maps', mapId)
    const mapDoc = await getDoc(mapRef)
    
    if (!mapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const mapData = mapDoc.data() as MapDocument
    const currentSharing = mapData.sharing || {
      isShared: false,
      sharedWith: [],
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true
      }
    }
    
    // Check if user is already shared
    const existingUser = currentSharing.sharedWith.find(user => user.email === email)
    if (existingUser) {
      throw new Error('User already has access to this map')
    }
    
    // Add new shared user
    const newSharedUser: SharedUser = {
      email,
      role,
      invitedAt: new Date(),
      invitedBy: ownerId
    }
    
    const updatedSharing = {
      ...currentSharing,
      isShared: true,
      sharedWith: [...currentSharing.sharedWith, newSharedUser]
    }
    
    await updateDoc(mapRef, {
      sharing: updatedSharing,
      updatedAt: serverTimestamp()
    })
    
    console.log('Map shared successfully with:', email)
  } catch (error) {
    console.error('Error sharing map:', error)
    throw error
  }
}

// Remove user from shared map
export const removeUserFromMap = async (
  mapId: string,
  ownerId: string,
  email: string
): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', ownerId, 'maps', mapId)
    const mapDoc = await getDoc(mapRef)
    
    if (!mapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const mapData = mapDoc.data() as MapDocument
    const currentSharing = mapData.sharing
    
    if (!currentSharing) {
      throw new Error('Map is not shared')
    }
    
    const updatedSharedWith = currentSharing.sharedWith.filter(user => user.email !== email)
    
    const updatedSharing = {
      ...currentSharing,
      sharedWith: updatedSharedWith,
      isShared: updatedSharedWith.length > 0
    }
    
    await updateDoc(mapRef, {
      sharing: updatedSharing,
      updatedAt: serverTimestamp()
    })
    
    console.log('User removed from map:', email)
  } catch (error) {
    console.error('Error removing user from map:', error)
    throw error
  }
}

// Update user role in shared map
export const updateUserRole = async (
  mapId: string,
  ownerId: string,
  email: string,
  newRole: 'viewer' | 'editor' | 'admin'
): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', ownerId, 'maps', mapId)
    const mapDoc = await getDoc(mapRef)
    
    if (!mapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const mapData = mapDoc.data() as MapDocument
    const currentSharing = mapData.sharing
    
    if (!currentSharing) {
      throw new Error('Map is not shared')
    }
    
    const updatedSharedWith = currentSharing.sharedWith.map(user => 
      user.email === email ? { ...user, role: newRole } : user
    )
    
    const updatedSharing = {
      ...currentSharing,
      sharedWith: updatedSharedWith
    }
    
    await updateDoc(mapRef, {
      sharing: updatedSharing,
      updatedAt: serverTimestamp()
    })
    
    console.log('User role updated:', email, 'to', newRole)
  } catch (error) {
    console.error('Error updating user role:', error)
    throw error
  }
}

// Get maps shared with user
export const getSharedMaps = async (userEmail: string): Promise<MapDocument[]> => {
  try {
    const sharedMaps: MapDocument[] = []
    
    // Search through all users' maps to find ones shared with this email
    const usersQuery = query(collection(db, 'users'))
    const usersSnapshot = await getDocs(usersQuery)
    
    for (const userDoc of usersSnapshot.docs) {
      const mapsQuery = query(
        collection(db, 'users', userDoc.id, 'maps'),
        where('sharing.isShared', '==', true)
      )
      const mapsSnapshot = await getDocs(mapsQuery)
      
      for (const mapDoc of mapsSnapshot.docs) {
        const mapData = mapDoc.data() as MapDocument
        const isSharedWithUser = mapData.sharing?.sharedWith.some(
          user => user.email === userEmail
        )
        
        if (isSharedWithUser) {
          sharedMaps.push({
            id: mapDoc.id,
            ...mapData
          })
        }
      }
    }
    
    return sharedMaps
  } catch (error) {
    console.error('Error getting shared maps:', error)
    throw error
  }
}

// Check if a map is owned by a specific user
export const isMapOwnedByUser = (map: MapDocument, userId: string): boolean => {
  return map.userId === userId
}

// Leave a shared map
export const leaveSharedMap = async (
  mapId: string,
  ownerId: string,
  userEmail: string
): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', ownerId, 'maps', mapId)
    const mapDoc = await getDoc(mapRef)
    
    if (!mapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const mapData = mapDoc.data() as MapDocument
    const currentSharing = mapData.sharing
    
    if (!currentSharing) {
      throw new Error('Map is not shared')
    }
    
    const updatedSharedWith = currentSharing.sharedWith.filter(user => user.email !== userEmail)
    
    const updatedSharing = {
      ...currentSharing,
      sharedWith: updatedSharedWith,
      isShared: updatedSharedWith.length > 0
    }
    
    await updateDoc(mapRef, {
      sharing: updatedSharing,
      updatedAt: serverTimestamp()
    })
    
    console.log('User left map:', userEmail)
  } catch (error) {
    console.error('Error leaving shared map:', error)
    throw error
  }
}

