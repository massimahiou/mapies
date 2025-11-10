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
  serverTimestamp,
  deleteField
} from 'firebase/firestore'
import { db } from './config'
import { UsageTracker } from '../utils/usageTracker'
import { detectBusinessType } from '../utils/businessDetection'
import { isAdmin } from '../utils/admin'

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
    // Tags settings
    tags?: string[]
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
  role: 'viewer' | 'editor'
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
  order?: number // Display order for markers
  tags?: string[] // Tags for filtering and categorization
  businessCategory?: {
    id: string
    name: string
    icon: string
    color: string
    confidence: number
    matchedTerm: string
  }
}

// Polygon/Region interface for drawing areas on maps
export interface PolygonDocument {
  id?: string
  name: string
  description?: string
  type: 'polygon' | 'rectangle' | 'circle'
  
  // Geometric data
  coordinates?: Array<{lat: number, lng: number}>  // For polygon/rectangle: [{lat, lng}, {lat, lng}, ...]
  center?: { lat: number, lng: number }  // For circle center
  radius?: number  // For circle radius (in meters)
  
  // Styling
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeWeight: number
  strokeOpacity: number
  
  // Metadata
  userId: string
  mapId: string
  visible: boolean
  createdAt: Date
  updatedAt: Date
  
  // Category/grouping (for government districts, zones)
  category?: {
    id: string
    name: string  // e.g., "Downtown", "Zone A", "Service Area"
    color: string
  }
  
  // Properties for cities/governments
  properties?: {
    district?: string
    zone?: string
    administrativeLevel?: string  // e.g., "Borough", "Ward", "Precinct"
    population?: number
    notes?: string
  }
}

// Create a new map
export const createMap = async (userId: string, mapData: Omit<MapDocument, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<string> => {
  try {
    // Check map limit before creating
    const userMaps = await getUserMaps(userId)
    const mapLimitCheck = await UsageTracker.checkMapLimit(userId, userMaps.length)
    
    if (!mapLimitCheck.allowed) {
      throw new Error(`Map limit reached: ${mapLimitCheck.message}`)
    }
    
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
    
    // Update usage statistics
    await UsageTracker.updateUsage(userId, 'maps', userMaps.length + 1)
    
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
    
    // Get all markers from user collection
    const userMarkersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    const userMarkersSnapshot = await getDocs(userMarkersRef)
    
    if (userMarkersSnapshot.empty) {
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
    
  } catch (error) {
    console.error('Error copying markers to public collection:', error)
    throw error
  }
}

// Subscribe to public markers (faster than user subcollection)
export const subscribeToPublicMarkers = (mapId: string, callback: (markers: MarkerDocument[]) => void) => {
  
  const publicMarkersRef = collection(db, 'publicMaps', mapId, 'markers')
  
  return onSnapshot(publicMarkersRef, (snapshot) => {
    const markers: MarkerDocument[] = []
    snapshot.forEach((doc) => {
      markers.push({
        id: doc.id,
        ...doc.data()
      } as MarkerDocument)
    })
    
    callback(markers)
  }, (error) => {
    console.error('Error in public markers listener:', error)
    console.error('Error details:', error.code, error.message)
    
    // If public markers fail, fallback to user markers
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
  } catch (error) {
    console.error('Error removing marker from public collection:', error)
    // Don't throw - this is a background sync operation
  }
}

export const getMapById = async (mapId: string): Promise<MapDocument | null> => {
  try {
    
    // Try to get from a public maps collection first
    const publicMapRef = doc(db, 'publicMaps', mapId)
    const publicMapDoc = await getDoc(publicMapRef)
    
    if (publicMapDoc.exists()) {
      const mapData = publicMapDoc.data()
      return {
        id: mapId,
        ...mapData
      } as MapDocument
    }
    
    
    // If not found in public collection, search through user collections
    // This is for migrating existing maps
    const usersQuery = query(collection(db, 'users'))
    const usersSnapshot = await getDocs(usersQuery)
    
    for (const userDoc of usersSnapshot.docs) {
      const mapRef = doc(db, 'users', userDoc.id, 'maps', mapId)
      const mapDoc = await getDoc(mapRef)
      
            if (mapDoc.exists()) {
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
    
    return null
  } catch (error) {
    console.error('Error getting map by ID:', error)
    throw error
  }
}

// Find map owner by mapId (searches all users)
export const findMapOwner = async (mapId: string): Promise<{ userId: string, map: MapDocument | null } | null> => {
  try {
    const usersQuery = query(collection(db, 'users'))
    const usersSnapshot = await getDocs(usersQuery)
    
    for (const userDoc of usersSnapshot.docs) {
      const mapRef = doc(db, 'users', userDoc.id, 'maps', mapId)
      const mapSnap = await getDoc(mapRef)
      
      if (mapSnap.exists()) {
        return {
          userId: userDoc.id,
          map: {
            id: mapSnap.id,
            ...mapSnap.data()
          } as MapDocument
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error finding map owner:', error)
    return null
  }
}

// Update a map
// If userEmail is provided and is admin, can update any map regardless of userId
export const updateMap = async (
  userId: string, 
  mapId: string, 
  updates: Partial<MapDocument>,
  userEmail?: string | null
): Promise<void> => {
  try {
    // If admin, find the actual map owner
    let actualUserId = userId
    if (userEmail && isAdmin(userEmail)) {
      const mapOwner = await findMapOwner(mapId)
      if (mapOwner) {
        actualUserId = mapOwner.userId
      } else {
        throw new Error(`Map ${mapId} not found`)
      }
    }
    
    const mapRef = doc(db, 'users', actualUserId, 'maps', mapId)
    
    // Use updateDoc directly instead of setDoc with merge
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    }
    
    
    // Update the user's private map collection
    await updateDoc(mapRef, updateData)
    
    // Also update the public map collection
    try {
      const publicMapRef = doc(db, 'publicMaps', mapId)
      const publicMapSnap = await getDoc(publicMapRef)
      
      if (publicMapSnap.exists()) {
        await updateDoc(publicMapRef, updateData)
      } else {
      }
    } catch (publicError) {
      console.error('Error updating public map collection:', publicError)
      // Don't throw - we don't want to fail the entire operation if public update fails
    }
    
  } catch (error) {
    console.error('Error updating map:', error)
    throw error
  }
}

// Delete a map and all its markers
// If userEmail is provided and is admin, can delete any map regardless of userId
export const deleteMap = async (
  userId: string, 
  mapId: string,
  userEmail?: string | null
): Promise<void> => {
  try {
    // If admin, find the actual map owner
    let actualUserId = userId
    if (userEmail && isAdmin(userEmail)) {
      const mapOwner = await findMapOwner(mapId)
      if (mapOwner) {
        actualUserId = mapOwner.userId
      } else {
        throw new Error(`Map ${mapId} not found`)
      }
    }
    
    
    // First, delete all markers in the user's private map
    const markersRef = collection(db, 'users', actualUserId, 'maps', mapId, 'markers')
    const markersSnapshot = await getDocs(markersRef)
    
    
    // Delete all markers from user's private collection
    const deletePromises = markersSnapshot.docs.map(markerDoc => 
      deleteDoc(doc(db, 'users', userId, 'maps', mapId, 'markers', markerDoc.id))
    )
    await Promise.all(deletePromises)
    
    // Also delete markers from public collection
    try {
      const publicMarkersRef = collection(db, 'publicMaps', mapId, 'markers')
      const publicMarkersSnapshot = await getDocs(publicMarkersRef)
      
      if (publicMarkersSnapshot.docs.length > 0) {
        const publicDeletePromises = publicMarkersSnapshot.docs.map(markerDoc => 
          deleteDoc(doc(db, 'publicMaps', mapId, 'markers', markerDoc.id))
        )
        await Promise.all(publicDeletePromises)
      }
    } catch (publicError) {
      console.error('Error deleting public markers:', publicError)
      // Don't throw - we don't want to fail the entire operation if public deletion fails
    }
    
    // Delete the map from user's private collection
    const mapRef = doc(db, 'users', actualUserId, 'maps', mapId)
    await deleteDoc(mapRef)
    
    // Also delete the map from public collection
    try {
      const publicMapRef = doc(db, 'publicMaps', mapId)
      const publicMapSnap = await getDoc(publicMapRef)
      
      if (publicMapSnap.exists()) {
        await deleteDoc(publicMapRef)
      }
    } catch (publicError) {
      console.error('Error deleting public map:', publicError)
      // Don't throw - we don't want to fail the entire operation if public deletion fails
    }
    
  } catch (error) {
    console.error('Error deleting map:', error)
    throw error
  }
}

// Get map's markers
export const getMapMarkers = async (userId: string, mapId: string): Promise<MarkerDocument[]> => {
  try {
    const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    // Query all markers (don't use orderBy to avoid index issues, sort client-side)
    const q = query(markersRef)
    const querySnapshot = await getDocs(q)
    
    const markers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MarkerDocument))
    
    // Sort by order if available, otherwise by createdAt
    return markers.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order
      }
      if (a.order !== undefined) return -1
      if (b.order !== undefined) return 1
      // Fallback to createdAt if no order field
      const aTime = a.createdAt?.getTime?.() || 0
      const bTime = b.createdAt?.getTime?.() || 0
      return bTime - aTime
    })
  } catch (error) {
    console.error('Error getting map markers:', error)
    throw error
  }
}

// Add marker to map
export const addMarkerToMap = async (userId: string, mapId: string, markerData: Omit<MarkerDocument, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'mapId'>, hasSmartGrouping: boolean = true): Promise<string> => {
  try {
    // Detect business category
    const businessDetection = detectBusinessType(markerData.name, markerData.address, hasSmartGrouping)
    
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
    
    const statsUpdate = {
      'stats.markerCount': markers.length,
      'stats.lastUpdated': serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    // Update user's private map collection
    await updateDoc(mapRef, statsUpdate)
    
    // Also update the public map collection
    try {
      const publicMapRef = doc(db, 'publicMaps', mapId)
      const publicMapSnap = await getDoc(publicMapRef)
      
      if (publicMapSnap.exists()) {
        await updateDoc(publicMapRef, statsUpdate)
      }
    } catch (publicError) {
      console.error('Error updating public map stats:', publicError)
      // Don't throw - we don't want to fail the entire operation if public update fails
    }
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
  
  // Query all markers (don't use orderBy to avoid index issues, sort client-side)
  const q = query(markersRef)
  
  return onSnapshot(q, (querySnapshot) => {
    const markers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MarkerDocument))
    
    // Sort by order if available, otherwise by createdAt
    const sortedMarkers = markers.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order
      }
      if (a.order !== undefined) return -1
      if (b.order !== undefined) return 1
      // Fallback to createdAt if no order field
      const aTime = a.createdAt?.getTime?.() || 0
      const bTime = b.createdAt?.getTime?.() || 0
      return bTime - aTime
    })
    
    callback(sortedMarkers)
  })
}

// Get all maps from all users (admin only)
export const getAllMaps = async (): Promise<MapDocument[]> => {
  try {
    const allMaps: MapDocument[] = []
    
    // Get all users
    const usersQuery = query(collection(db, 'users'))
    const usersSnapshot = await getDocs(usersQuery)
    
    // For each user, get their maps
    for (const userDoc of usersSnapshot.docs) {
      const mapsRef = collection(db, 'users', userDoc.id, 'maps')
      const mapsQuery = query(mapsRef, orderBy('createdAt', 'desc'))
      const mapsSnapshot = await getDocs(mapsQuery)
      
      
      mapsSnapshot.docs.forEach(mapDoc => {
        const mapData = mapDoc.data() as MapDocument
        allMaps.push({
          id: mapDoc.id,
          ...mapData
        } as MapDocument)
      })
    }
    
    
    // Sort all maps by createdAt descending
    return allMaps.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.seconds * 1000 || 0
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.seconds * 1000 || 0
      return bTime - aTime
    })
  } catch (error) {
    console.error('Error getting all maps:', error)
    throw error
  }
}

// Listen to user's maps in real-time
// If userEmail is provided and is admin, subscribes to all maps
export const subscribeToUserMaps = (
  userId: string,
  callback: (maps: MapDocument[]) => void,
  userEmail?: string | null
): (() => void) => {
  
  // Check if admin BEFORE doing anything else
  const adminCheck = userEmail ? isAdmin(userEmail) : false
  
  // If admin, subscribe to all maps
  if (adminCheck) {
    return subscribeToAllMaps(callback)
  }
  
  // Otherwise, subscribe to user's maps only
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

// Listen to all maps from all users (admin only)
// Uses polling with getAllMaps to ensure we get all maps
// Only updates if maps actually changed (by ID and count)
export const subscribeToAllMaps = (
  callback: (maps: MapDocument[]) => void
): (() => void) => {
  let isActive = true
  let pollInterval: ReturnType<typeof setInterval> | null = null
  let lastMapsHash: string = ''
  
  // Helper to create a hash of maps for comparison
  const getMapsHash = (maps: MapDocument[]): string => {
    const ids = maps.map(m => m.id || '').sort().join(',')
    return `${maps.length}:${ids}`
  }
  
  // Function to fetch and compare maps
  const fetchAndUpdateMaps = async () => {
    if (!isActive) return
    
    try {
      const allMapsList = await getAllMaps()
      const newHash = getMapsHash(allMapsList)
      
      // Only call callback if maps actually changed
      if (newHash !== lastMapsHash) {
        lastMapsHash = newHash
        if (isActive) {
          callback(allMapsList)
        }
      } else {
      }
    } catch (error) {
      console.error('Error polling all maps:', error)
    }
  }
  
  // Initial load
  fetchAndUpdateMaps()
  
  // Poll every 5 seconds for updates (reduced frequency)
  // This is simpler than subscribing to each user's maps individually
  pollInterval = setInterval(() => {
    fetchAndUpdateMaps()
  }, 5000)
  
  // Return cleanup function
  return () => {
    isActive = false
    if (pollInterval) {
      clearInterval(pollInterval)
    }
  }
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
  role: 'viewer' | 'editor' = 'viewer'
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
    
    // Handle different sharing data structures (old vs new maps)
    let sharedWithList: any[] = []
    if (Array.isArray(currentSharing.sharedWith)) {
      sharedWithList = currentSharing.sharedWith
    } else if (currentSharing.sharedWith && typeof currentSharing.sharedWith === 'object') {
      // Handle case where sharedWith might be an object instead of array
      sharedWithList = Object.values(currentSharing.sharedWith)
    } else {
      throw new Error('Map sharing data is invalid')
    }
    
    
    // Validate that the user is actually in the shared list
    const userInSharedList = sharedWithList.some((user: any) => {
      // Handle different user object structures
      const userEmail = user.email || user.userEmail || user
      return userEmail === email
    })
    
    
    if (!userInSharedList) {
      throw new Error('User is not in the shared list')
    }
    
    const updatedSharedWith = sharedWithList.filter((user: any) => {
      const userEmail = user.email || user.userEmail || user
      return userEmail !== email
    })
    
    const updatedSharing = {
      ...currentSharing,
      sharedWith: updatedSharedWith,
      isShared: updatedSharedWith.length > 0
    }
    
    
    // Ensure we're updating with the correct structure
    const updateData: any = {
      sharing: updatedSharing,
      updatedAt: serverTimestamp()
    }
    
    
    await updateDoc(mapRef, updateData)
    
  } catch (error) {
    console.error('❌ Error removing user from map:', error)
    throw error
  }
}

// Update user role in shared map
export const updateUserRole = async (
  mapId: string,
  ownerId: string,
  email: string,
  newRole: 'viewer' | 'editor'
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

// Helper function to determine if a map is owned by the current user
// If userEmail is provided and is admin, always returns true
export const isMapOwnedByUser = (
  map: MapDocument, 
  userId: string,
  userEmail?: string | null
): boolean => {
  // Admin always has ownership permissions
  if (userEmail && isAdmin(userEmail)) {
    return true
  }
  return map.userId === userId
}

// Leave a shared map (remove current user from shared map)
export const leaveSharedMap = async (
  mapId: string,
  ownerId: string,
  userEmail: string
): Promise<void> => {
  try {
    await removeUserFromMap(mapId, ownerId, userEmail)
  } catch (error) {
    console.error('Error leaving shared map:', error)
    throw error
  }
}

// Get map's owner ID from shared maps
export const getMapOwnerId = (map: MapDocument): string => {
  return map.userId
}

// POLYGON FUNCTIONS - Regions/Areas on Maps

// Get all polygons for a map
export const getMapPolygons = async (userId: string, mapId: string): Promise<PolygonDocument[]> => {
  try {
    const polygonsRef = collection(db, 'users', userId, 'maps', mapId, 'polygons')
    const q = query(polygonsRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    
    const polygons: PolygonDocument[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      polygons.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as PolygonDocument)
    })
    
    return polygons
  } catch (error) {
    console.error('Error getting map polygons:', error)
    throw error
  }
}

// Add polygon to map
export const addPolygonToMap = async (
  userId: string, 
  mapId: string, 
  polygonData: Omit<PolygonDocument, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'mapId'>
): Promise<string> => {
  try {
    const polygonsRef = collection(db, 'users', userId, 'maps', mapId, 'polygons')
    const docRef = await addDoc(polygonsRef, {
      ...polygonData,
      userId,
      mapId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    return docRef.id
  } catch (error) {
    console.error('Error adding polygon to map:', error)
    throw error
  }
}

// Update polygon in map
export const updateMapPolygon = async (
  userId: string, 
  mapId: string, 
  polygonId: string, 
  updates: Partial<PolygonDocument>
): Promise<void> => {
  try {
    const polygonRef = doc(db, 'users', userId, 'maps', mapId, 'polygons', polygonId)
    await updateDoc(polygonRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
    
  } catch (error) {
    console.error('Error updating polygon:', error)
    throw error
  }
}

// Delete polygon from map
export const deleteMapPolygon = async (
  userId: string, 
  mapId: string, 
  polygonId: string
): Promise<void> => {
  try {
    const polygonRef = doc(db, 'users', userId, 'maps', mapId, 'polygons', polygonId)
    await deleteDoc(polygonRef)
    
  } catch (error) {
    console.error('Error deleting polygon:', error)
    throw error
  }
}

// Tag management functions
export const addTagToMap = async (userId: string, mapId: string, tagName: string): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    const mapDoc = await getDoc(mapRef)
    
    if (!mapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const currentSettings = mapDoc.data().settings || {}
    const currentTags = currentSettings.tags || []
    
    // Normalize tag name (lowercase, trim)
    const normalizedTag = tagName.toLowerCase().trim()
    
    // Check for duplicates (case-insensitive)
    if (currentTags.some((tag: string) => tag.toLowerCase().trim() === normalizedTag)) {
      throw new Error('Tag already exists')
    }
    
    const updatedTags = [...currentTags, tagName.trim()]
    
    await updateDoc(mapRef, {
      'settings.tags': updatedTags,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error adding tag to map:', error)
    throw error
  }
}

export const removeTagFromMap = async (userId: string, mapId: string, tagName: string, removeFromMarkers: boolean = false): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    const mapDoc = await getDoc(mapRef)
    
    if (!mapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const currentSettings = mapDoc.data().settings || {}
    const currentTags = currentSettings.tags || []
    
    // Remove tag from map settings
    const updatedTags = currentTags.filter((tag: string) => tag !== tagName)
    
    await updateDoc(mapRef, {
      'settings.tags': updatedTags,
      updatedAt: serverTimestamp()
    })
    
    // Optionally remove tag from all markers
    if (removeFromMarkers) {
      const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
      const markersSnapshot = await getDocs(markersRef)
      
      const batch = markersSnapshot.docs.map(markerDoc => {
        const markerData = markerDoc.data()
        const markerTags = markerData.tags || []
        const updatedMarkerTags = markerTags.filter((tag: string) => tag !== tagName)
        
        if (updatedMarkerTags.length !== markerTags.length) {
          return updateDoc(markerDoc.ref, {
            tags: updatedMarkerTags,
            updatedAt: serverTimestamp()
          })
        }
        return Promise.resolve()
      })
      
      await Promise.all(batch)
    }
  } catch (error) {
    console.error('Error removing tag from map:', error)
    throw error
  }
}

export const updateTagName = async (userId: string, mapId: string, oldName: string, newName: string): Promise<void> => {
  try {
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    const mapDoc = await getDoc(mapRef)
    
    if (!mapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const currentSettings = mapDoc.data().settings || {}
    const currentTags = currentSettings.tags || []
    
    // Update tag in map settings
    const updatedTags = currentTags.map((tag: string) => tag === oldName ? newName.trim() : tag)
    
    await updateDoc(mapRef, {
      'settings.tags': updatedTags,
      updatedAt: serverTimestamp()
    })
    
    // Update tag in all markers
    const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    const markersSnapshot = await getDocs(markersRef)
    
    const batch = markersSnapshot.docs.map(markerDoc => {
      const markerData = markerDoc.data()
      const markerTags = markerData.tags || []
      const updatedMarkerTags = markerTags.map((tag: string) => tag === oldName ? newName.trim() : tag)
      
      if (JSON.stringify(updatedMarkerTags) !== JSON.stringify(markerTags)) {
        return updateDoc(markerDoc.ref, {
          tags: updatedMarkerTags,
          updatedAt: serverTimestamp()
        })
      }
      return Promise.resolve()
    })
    
    await Promise.all(batch)
  } catch (error) {
    console.error('Error updating tag name:', error)
    throw error
  }
}

export const applyTagsToMarkers = async (
  userId: string,
  mapId: string,
  markerIds: string[],
  tags: string[],
  mode: 'add' | 'replace' | 'remove'
): Promise<void> => {
  try {
    const markersRef = collection(db, 'users', userId, 'maps', mapId, 'markers')
    
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500
    for (let i = 0; i < markerIds.length; i += batchSize) {
      const batch = markerIds.slice(i, i + batchSize)
      const updatePromises = batch.map(async (markerId) => {
        const markerRef = doc(markersRef, markerId)
        const markerDoc = await getDoc(markerRef)
        
        if (!markerDoc.exists()) {
          return Promise.resolve()
        }
        
        const currentTags = markerDoc.data().tags || []
        let updatedTags: string[]
        
        switch (mode) {
          case 'add':
            // Add tags, avoiding duplicates
            updatedTags = [...new Set([...currentTags, ...tags])]
            break
          case 'replace':
            // Replace all tags
            updatedTags = tags
            break
          case 'remove':
            // Remove specified tags
            updatedTags = currentTags.filter((tag: string) => !tags.includes(tag))
            break
          default:
            updatedTags = currentTags
        }
        
        return updateDoc(markerRef, {
          tags: updatedTags,
          updatedAt: serverTimestamp()
        })
      })
      
      await Promise.all(updatePromises)
    }
  } catch (error) {
    console.error('Error applying tags to markers:', error)
    throw error
  }
}

// Find user ID by email
export const findUserIdByEmail = async (email: string): Promise<string | null> => {
  try {
    const usersQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()))
    const usersSnapshot = await getDocs(usersQuery)
    
    if (usersSnapshot.empty) {
      return null
    }
    
    return usersSnapshot.docs[0].id
  } catch (error) {
    console.error('Error finding user by email:', error)
    return null
  }
}

// Transfer map ownership to another user
export const transferMapOwnership = async (
  mapId: string,
  currentOwnerId: string,
  newOwnerEmail: string
): Promise<void> => {
  try {
    
    // Find new owner's user ID
    const newOwnerId = await findUserIdByEmail(newOwnerEmail)
    if (!newOwnerId) {
      throw new Error(`User with email ${newOwnerEmail} not found`)
    }
    
    if (newOwnerId === currentOwnerId) {
      throw new Error('Cannot transfer map to the same owner')
    }
    
    // Get map document from current owner
    const currentMapRef = doc(db, 'users', currentOwnerId, 'maps', mapId)
    const currentMapDoc = await getDoc(currentMapRef)
    
    if (!currentMapDoc.exists()) {
      throw new Error('Map not found')
    }
    
    const mapData = currentMapDoc.data() as MapDocument
    
    // Get all markers from current owner
    const currentMarkersRef = collection(db, 'users', currentOwnerId, 'maps', mapId, 'markers')
    const currentMarkersSnapshot = await getDocs(currentMarkersRef)
    
    // Create map document in new owner's collection
    const newMapRef = doc(db, 'users', newOwnerId, 'maps', mapId)
    const newMapData: MapDocument = {
      ...mapData,
      userId: newOwnerId,
      updatedAt: new Date()
    }
    await setDoc(newMapRef, newMapData)
    
    // Transfer all markers to new owner's collection
    const newMarkersRef = collection(db, 'users', newOwnerId, 'maps', mapId, 'markers')
    const transferMarkerPromises = currentMarkersSnapshot.docs.map(async (markerDoc) => {
      const markerData = markerDoc.data() as MarkerDocument
      const newMarkerRef = doc(newMarkersRef, markerDoc.id)
      
      await setDoc(newMarkerRef, {
        ...markerData,
        userId: newOwnerId,
        updatedAt: serverTimestamp()
      })
    })
    
    await Promise.all(transferMarkerPromises)
    
    // Update publicMaps collection
    try {
      const publicMapRef = doc(db, 'publicMaps', mapId)
      const publicMapDoc = await getDoc(publicMapRef)
      
      if (publicMapDoc.exists()) {
        await updateDoc(publicMapRef, {
          userId: newOwnerId,
          updatedAt: serverTimestamp()
        })
      }
    } catch (publicError) {
      console.warn('⚠️ Failed to update publicMaps collection:', publicError)
    }
    
    // Update publicMaps markers
    try {
      const publicMarkersRef = collection(db, 'publicMaps', mapId, 'markers')
      const publicMarkersSnapshot = await getDocs(publicMarkersRef)
      
      const updatePublicMarkerPromises = publicMarkersSnapshot.docs.map(async (markerDoc) => {
        const publicMarkerRef = doc(publicMarkersRef, markerDoc.id)
        await updateDoc(publicMarkerRef, {
          userId: newOwnerId,
          updatedAt: serverTimestamp()
        })
      })
      
      await Promise.all(updatePublicMarkerPromises)
    } catch (publicMarkerError) {
      console.warn('⚠️ Failed to update publicMaps markers:', publicMarkerError)
    }
    
    // Update sharing - remove old owner from shared users if present, or clear sharing
    const updateData: any = {
      updatedAt: serverTimestamp()
    }
    
    if (mapData.sharing) {
      const updatedSharedWith = mapData.sharing.sharedWith.filter(user => user.email.toLowerCase() !== newOwnerEmail.toLowerCase())
      if (updatedSharedWith.length > 0) {
        updateData.sharing = {
          ...mapData.sharing,
          sharedWith: updatedSharedWith
        }
      } else {
        // If no shared users left, remove the sharing field
        updateData.sharing = deleteField()
      }
    }
    
    await updateDoc(newMapRef, updateData)
    
    // Delete map and markers from old owner's collection
    const deleteMarkerPromises = currentMarkersSnapshot.docs.map(async (markerDoc) => {
      await deleteDoc(doc(currentMarkersRef, markerDoc.id))
    })
    
    await Promise.all(deleteMarkerPromises)
    await deleteDoc(currentMapRef)
    
    // Update usage stats for both users
    try {
      await UsageTracker.updateUsage(currentOwnerId, 'maps', -1)
      await UsageTracker.updateUsage(newOwnerId, 'maps', 1)
    } catch (statsError) {
      console.warn('⚠️ Failed to update usage statistics:', statsError)
    }
    
  } catch (error) {
    console.error('❌ Error transferring map ownership:', error)
    throw error
  }
}

