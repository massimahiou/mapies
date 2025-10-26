import React, { useState, useCallback, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Papa from 'papaparse'
import CsvUploadModal from './components/CsvUploadModal'
import ResponsiveSidebar from './components/ResponsiveSidebar'
import TopBar from './components/TopBar'
import MapArea from './components/MapArea'
import AddMarkerModal from './components/AddMarkerModal'
import Publish from './components/Publish'
import AuthModal from './components/AuthModal'
import MarkerManagementModal from './components/MarkerManagementModal'
import DataManagementModal from './components/DataManagementModal'
import EditManagementModal from './components/EditManagementModal'
import PublishManagementModal from './components/PublishManagementModal'
import { ToastProvider } from './contexts/ToastContext'
import EmbedMap from './components/EmbedMap'
import PublicMap from './components/PublicMap'
import LandingPage from './components/LandingPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { debugFirebase, testFirebaseConnection } from './firebase/debug'
import { validateCoordinates, logSecurityViolation } from './utils/coordinateValidation'
import { getFreemiumCompliantDefaults, ensureFreemiumCompliance } from './utils/freemiumDefaults'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import Toast from './components/Toast'
import { testFirebaseAuth } from './firebase/test-auth'
import { addMarkerToMap, MapDocument, getMapMarkers, deleteMapMarker, updateMapMarker, updateMap, subscribeToMapMarkers, subscribeToUserMaps, subscribeToMapDocument, getSharedMaps } from './firebase/maps'
import { checkForDuplicates, checkForInternalDuplicates, AddressData } from './utils/duplicateDetection'
import DuplicateNotification from './components/DuplicateNotification'
import SubscriptionManagementModal from './components/SubscriptionManagementModal'
import { useFeatureAccess } from './hooks/useFeatureAccess'

// Types
interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
}

// Start with empty markers array
const mockMarkers: Marker[] = []

const AppContent: React.FC = () => {
  const { user, loading, signOut, userDocument } = useAuth()
  const { canAddMarkers } = useFeatureAccess()

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }
  const [activeTab, setActiveTab] = useState('data')
  const [markers, setMarkers] = useState<Marker[]>(mockMarkers)
  const [searchTerm, setSearchTerm] = useState('')
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Warning for page leave during upload
  const showWarningToast = () => {
    setToastType('warning')
    setToastTitle('Upload in Progress')
    setToastMessage('Please wait for the upload to complete before leaving the page.')
    setShowToast(true)
  }

  useBeforeUnload({ 
    isUploading, 
    onShowWarning: showWarningToast
  })
  const [uploadError, setUploadError] = useState('')
  const [currentProcessingAddress, setCurrentProcessingAddress] = useState('')
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, currentAddress: '' })
  const [showAddMarkerModal, setShowAddMarkerModal] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastType, setToastType] = useState<'warning' | 'success' | 'error' | 'info'>('warning')
  const [toastTitle, setToastTitle] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showMarkerManagementModal, setShowMarkerManagementModal] = useState(false)
  const [showDataManagementModal, setShowDataManagementModal] = useState(false)
  const [showEditManagementModal, setShowEditManagementModal] = useState(false)
  const [showPublishManagementModal, setShowPublishManagementModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [locationError, setLocationError] = useState('')
  
  // Iframe dimensions for publish mode
  const [iframeDimensions, setIframeDimensions] = useState({ width: 800, height: 600 })
  
  // Map management state
  const [currentMapId, setCurrentMapId] = useState<string | null>(null)
  const [maps, setMaps] = useState<MapDocument[]>([])
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>({})
  
  // Duplicate notification state
  const [showDuplicateNotification, setShowDuplicateNotification] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [notificationType, setNotificationType] = useState<'csv' | 'manual'>('csv')
  
  // Map design settings - use freemium-compliant defaults
  const [mapSettings, setMapSettings] = useState(getFreemiumCompliantDefaults())

  const toggleMarkerVisibility = async (id: string) => {
    if (!user || !currentMapId) {
      console.error('No user or map selected for marker visibility toggle')
      return
    }

    const marker = markers.find(m => m.id === id)
    if (!marker) return

    const newVisibility = !marker.visible

    try {
      // Determine the correct user ID for marker operations
      // For owned maps: use current user's ID
      // For shared maps: use map owner's ID
      const currentMap = maps.find(m => m.id === currentMapId)
      const mapOwnerId = currentMap?.userId || user.uid

      // Update in Firestore
      await updateMapMarker(mapOwnerId, currentMapId, id, {
        visible: newVisibility
      })
      
      // Update local state
      setMarkers(markers.map(m => 
        m.id === id ? { ...m, visible: newVisibility } : m
      ))
      
      console.log('Marker visibility updated successfully:', id, newVisibility)
    } catch (error) {
      console.error('Error updating marker visibility:', error)
      alert('Failed to update marker visibility. Please try again.')
    }
  }

  const deleteMarker = async (id: string) => {
    if (!user || !currentMapId) {
      console.error('No user or map selected for marker deletion')
      return
    }

    try {
      // Determine the correct user ID for marker operations
      // For owned maps: use current user's ID
      // For shared maps: use map owner's ID
      const currentMap = maps.find(m => m.id === currentMapId)
      const mapOwnerId = currentMap?.userId || user.uid

      // Delete from Firestore
      await deleteMapMarker(mapOwnerId, currentMapId, id)
      
      // Update local state
      setMarkers(markers.filter(marker => marker.id !== id))
      
      console.log('Marker deleted successfully:', id)
    } catch (error) {
      console.error('Error deleting marker:', error)
      alert('Failed to delete marker. Please try again.')
    }
  }

  const handleMarkersAdded = (newMarkers: Marker[]) => {
    setMarkers(prev => {
      // Filter out any markers that already exist (by ID or by coordinates)
      const existingIds = new Set(prev.map(m => m.id))
      const existingCoordinates = new Set(prev.map(m => `${m.lat},${m.lng}`))
      
      const uniqueNewMarkers = newMarkers.filter(marker => {
        // Check if marker ID already exists
        if (existingIds.has(marker.id)) {
          console.log('🚫 Duplicate marker ID detected:', marker.id)
          return false
        }
        
        // Check if marker coordinates already exist
        const coordinateKey = `${marker.lat},${marker.lng}`
        if (existingCoordinates.has(coordinateKey)) {
          console.log('🚫 Duplicate marker coordinates detected:', coordinateKey)
          return false
        }
        
        return true
      })
      
      if (uniqueNewMarkers.length !== newMarkers.length) {
        console.log(`🚫 Filtered out ${newMarkers.length - uniqueNewMarkers.length} duplicate markers`)
      }
      
      return [...prev, ...uniqueNewMarkers]
    })
  }

  const handleShowDuplicateNotification = (duplicateCount: number, totalProcessed: number) => {
    setDuplicateCount(duplicateCount)
    setTotalProcessed(totalProcessed)
    setNotificationType('manual')
    setShowDuplicateNotification(true)
  }


  // Save map settings to Firestore
  const saveMapSettings = async (newSettings: typeof mapSettings) => {
    if (!user || !currentMapId) {
      console.log('No user or map selected for saving settings', { user: !!user, currentMapId })
      return
    }

    try {
      console.log('Saving map settings to Firestore:', { mapId: currentMapId, settings: newSettings })
      await updateMap(user.uid, currentMapId, {
        settings: newSettings
      })
      console.log('✅ Map settings saved successfully to Firestore')
    } catch (error) {
      console.error('❌ Error saving map settings:', error)
    }
  }

  // Handle map settings change
  const handleMapSettingsChange = (newSettings: typeof mapSettings) => {
    console.log('🎨 Map settings changed:', { 
      currentMapId, 
      user: !!user,
      oldSettings: mapSettings,
      newSettings 
    })
    setMapSettings(newSettings)
    saveMapSettings(newSettings)
  }

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.')
      return
    }

    setLocationError('')
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ lat: latitude, lng: longitude })
        console.log('User location obtained:', { lat: latitude, lng: longitude })
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.'
            break
        }
        setLocationError(errorMessage)
        console.error('Geolocation error:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    )
  }, [])


  // Set up real-time listeners for markers and map settings when map changes
  useEffect(() => {
    if (!currentMapId || !user) return

    console.log('🔄 Setting up real-time listeners for map:', currentMapId)

    // Determine the correct user ID for marker loading
    // For owned maps: use current user's ID
    // For shared maps: use map owner's ID
    const currentMap = maps.find(m => m.id === currentMapId)
    const mapOwnerId = currentMap?.userId || user.uid
    
    console.log('📍 Loading markers for map:', currentMapId, 'owner:', mapOwnerId, 'current user:', user.uid)
    
    // Listen to map markers in real-time
    const unsubscribeMarkers = subscribeToMapMarkers(mapOwnerId, currentMapId, (mapMarkers) => {
      console.log('📍 Markers updated from Firestore:', mapMarkers.length)
      
      // Convert Firestore markers to local Marker format
      const localMarkers: Marker[] = mapMarkers.map(marker => ({
        id: marker.id || `marker-${Date.now()}-${Math.random()}`,
        name: marker.name,
        address: marker.address,
        lat: marker.lat,
        lng: marker.lng,
        visible: marker.visible,
        type: marker.type as 'pharmacy' | 'grocery' | 'retail' | 'other'
      }))
      
      // Only update if markers actually changed (optimized comparison)
      setMarkers(prevMarkers => {
        // Quick length check first
        if (prevMarkers.length !== localMarkers.length) {
          console.log('📍 Markers count changed, updating local state')
          return localMarkers
        }
        
        // Create a map for O(1) lookups instead of O(n²) comparison
        const prevMarkersMap = new Map(prevMarkers.map(m => [m.id, m]))
        
        const hasChanged = localMarkers.some(current => {
          const prev = prevMarkersMap.get(current.id)
          return !prev || 
                 prev.visible !== current.visible || 
                 prev.name !== current.name ||
                 prev.lat !== current.lat ||
                 prev.lng !== current.lng ||
                 prev.address !== current.address
        })
        
        if (hasChanged) {
          console.log('📍 Markers content changed, updating local state')
          return localMarkers
        }
        
        console.log('📍 No marker changes detected, keeping existing state')
        return prevMarkers
      })
    })

    // Listen to map document changes for settings updates
    const unsubscribeMapSettings = subscribeToMapDocument(mapOwnerId, currentMapId, async (mapData) => {
      if (mapData && mapData.settings) {
        console.log('⚙️ Map settings updated from Firestore')
        
        // Check if clustering settings are missing and migrate if needed
        if (mapData.settings.clusteringEnabled === undefined || 
            mapData.settings.clusterRadius === undefined) {
          console.log('🔄 Clustering settings missing, skipping migration for now')
        }
        
        // Only update if settings actually changed
        setMapSettings((prevSettings: any) => {
          const rawSettings = {
            ...mapData.settings!,
            // Ensure clustering settings have defaults
            clusteringEnabled: mapData.settings!.clusteringEnabled !== undefined ? mapData.settings!.clusteringEnabled : true,
            clusterRadius: mapData.settings!.clusterRadius || 50,
            // Search bar settings with defaults
            searchBarBackgroundColor: mapData.settings!.searchBarBackgroundColor || '#ffffff',
            searchBarTextColor: mapData.settings!.searchBarTextColor || '#000000',
            searchBarHoverColor: mapData.settings!.searchBarHoverColor || '#f3f4f6',
            // Name rules settings with defaults
            nameRules: mapData.settings!.nameRules || []
          }
          
          // Automatically fix any premium settings to be freemium-compliant
          const userPlan = userDocument?.subscription?.plan || 'freemium'
          const compliantSettings = ensureFreemiumCompliance(rawSettings, userPlan)
          
          // DON'T save settings back to database from listener - this causes infinite loops!
          // Settings compliance should be handled when user makes changes, not on every read
          
          const hasChanged = JSON.stringify(prevSettings) !== JSON.stringify(compliantSettings)
          if (hasChanged) {
            console.log('✅ Map settings changed, updating local state with freemium compliance:', compliantSettings)
            return compliantSettings
          }
          return prevSettings
        })
      }
    })

    // Load folder icons for this map
    const loadFolderIcons = async () => {
      try {
        const { getUserMarkerGroups } = await import('./firebase/firestore')
        
        // For shared maps, use the map owner's ID to load folder icons
        // For owned maps, use the current user's ID
        const currentMap = maps.find(m => m.id === currentMapId)
        const iconOwnerId = currentMap?.userId || user.uid
        
        console.log('📁 Loading folder icons for map:', currentMapId, 'owner:', iconOwnerId, 'current user:', user.uid)
        const groups = await getUserMarkerGroups(iconOwnerId, currentMapId)
        
        const iconStates: Record<string, string> = {}
        groups.forEach(group => {
          if (group.iconUrl) {
            iconStates[group.groupName] = group.iconUrl
          }
        })
        setFolderIcons(iconStates)
        console.log('📁 Folder icons loaded:', Object.keys(iconStates).length, 'icons:', iconStates)
      } catch (error) {
        console.error('Error loading folder icons:', error)
      }
    }

    loadFolderIcons()

    return () => {
      console.log('🔄 Cleaning up map listeners')
      unsubscribeMarkers()
      unsubscribeMapSettings()
    }
  }, [currentMapId, user, maps])

  // Set up real-time listeners for maps and markers
  useEffect(() => {
    if (!user) return

    console.log('🔄 Setting up real-time listeners for user:', user.uid)

    // Listen to user's maps in real-time
    const unsubscribeMaps = subscribeToUserMaps(user.uid, async (userMaps) => {
      console.log('📊 User maps updated from Firestore:', userMaps.length)
      
      // Also load shared maps
      try {
        const sharedMaps = await getSharedMaps(user.email || '')
        console.log('📊 Shared maps loaded:', sharedMaps.length)
        
        // Combine user maps and shared maps
        const allMaps = [...userMaps, ...sharedMaps]
        
        // Only update if maps actually changed
        setMaps(prevMaps => {
          const hasChanged = prevMaps.length !== allMaps.length ||
            prevMaps.some((prev, index) => {
              const current = allMaps[index]
              return !current || prev.id !== current.id || prev.name !== current.name
            })
          
          if (hasChanged) {
            console.log('📊 Maps changed, updating local state')
            return allMaps
          }
          return prevMaps
        })
      } catch (error) {
        console.error('Error loading shared maps:', error)
        // Fallback to just user maps
        setMaps(userMaps)
      }
    })

    return () => {
      console.log('🔄 Cleaning up real-time listeners')
      unsubscribeMaps()
    }
  }, [user])

  // Auto-select first map when maps are loaded
  useEffect(() => {
    if (user && maps.length > 0 && !currentMapId) {
      const firstMap = maps[0]
      console.log('🎯 Auto-selecting first map:', firstMap.name)
      setCurrentMapId(firstMap.id!)
    }
  }, [user, maps, currentMapId])

  // Debug modal state changes
  useEffect(() => {
    console.log('🔍 CSV Modal state changed:', csvModalOpen)
    console.log('🔍 Stack trace:', new Error().stack)
  }, [csvModalOpen])

  useEffect(() => {
    console.log('Add Marker Modal state:', showAddMarkerModal)
  }, [showAddMarkerModal])

  // Debug Firebase on app load
  useEffect(() => {
    debugFirebase()
    testFirebaseConnection()
    testFirebaseAuth()
  }, [])


  // Geocoding function using OpenStreetMap Nominatim (free, no API key required)
  const geocodeAddress = async (address: string, currentIndex: number, totalCount: number): Promise<{lat: number, lng: number} | null> => {
    try {
      // Check if user has geocoding access using limits field
      if (!userDocument?.limits?.geocoding) {
        console.log('❌ Geocoding not available in current settings')
        
        // Log security violation for direct geocoding attempt
        if (user) {
          logSecurityViolation(user.uid, 'Direct geocoding attempt without permission', {
            address,
            currentIndex,
            totalCount
          })
        }
        
        return null
      }

      setCurrentProcessingAddress(address)
      setProcessingProgress({ current: currentIndex + 1, total: totalCount })
      console.log('🌐 Starting dual geocoding for:', address)
      
      // Try OpenStreetMap Nominatim first (primary)
      const nominatimResult = await geocodeWithNominatim(address)
      if (nominatimResult) {
        console.log('✅ Nominatim success:', nominatimResult)
        return nominatimResult
      }
      
      // Fallback to Mapbox if Nominatim fails
      console.log('🔄 Nominatim failed, trying Mapbox fallback...')
      const mapboxResult = await geocodeWithMapbox(address)
      if (mapboxResult) {
        console.log('✅ Mapbox success:', mapboxResult)
        return mapboxResult
      }
      
      console.log('❌ Both geocoding services failed for:', address)
      return null
    } catch (error) {
      console.error('Geocoding error:', error)
      return null
    }
  }

  // OpenStreetMap Nominatim geocoding (primary)
  const geocodeWithNominatim = async (address: string): Promise<{lat: number, lng: number} | null> => {
    try {
      console.log('🗺️ Trying Nominatim for:', address)
      
      // Try multiple address variations
      const addressVariations = [
        address, // Original address
        address.replace(/,\s*QC\s+\w+\s+\w+/, ', QC'), // Remove postal code
        address.replace(/,\s*QC.*/, ', QC'), // Remove everything after QC
        address.split(',')[0] + ', Saint-Hubert, QC', // Just street + city + province
        address.split(',')[0] + ', QC' // Just street + province
      ]
      
      for (const variation of addressVariations) {
        console.log('📍 Nominatim trying variation:', variation)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(variation)}&limit=1&countrycodes=ca`)
        
        if (!response.ok) {
          console.log('❌ Nominatim HTTP error:', response.status)
          continue
        }
        
        const data = await response.json()
        console.log('📍 Nominatim response:', data)
        
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          }
        }
        
        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      return null
    } catch (error) {
      console.error('Nominatim geocoding error:', error)
      return null
    }
  }

  // Mapbox geocoding (fallback)
  const geocodeWithMapbox = async (address: string): Promise<{lat: number, lng: number} | null> => {
    try {
      console.log('🗺️ Trying Mapbox for:', address)
      
      // Import Mapbox config
      const { MAPBOX_CONFIG } = await import('./config/mapbox')
      
      // Try multiple address variations
      const addressVariations = [
        address, // Original address
        address.replace(/,\s*QC\s+\w+\s+\w+/, ', QC'), // Remove postal code
        address.replace(/,\s*QC.*/, ', QC'), // Remove everything after QC
        address.split(',')[0] + ', Saint-Hubert, QC', // Just street + city + province
        address.split(',')[0] + ', QC' // Just street + province
      ]
      
      for (const variation of addressVariations) {
        console.log('📍 Mapbox trying variation:', variation)
        const response = await fetch(
          `${MAPBOX_CONFIG.GEOCODING_API_URL}/${encodeURIComponent(variation)}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&country=CA&limit=1`
        )
        
        if (!response.ok) {
          console.log('❌ Mapbox HTTP error:', response.status)
          continue
        }
        
        const data = await response.json()
        console.log('📍 Mapbox response:', data)
        
        if (data.features && data.features.length > 0) {
          const coordinates = data.features[0].center
          return {
            lat: coordinates[1], // Mapbox returns [lng, lat]
            lng: coordinates[0]
          }
        }
        
        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      return null
    } catch (error) {
      console.error('Mapbox geocoding error:', error)
      return null
    }
  }

  // Process CSV file
  const processCsvFile = useCallback(async (file: File, columnMapping: { name: string | null; address: string | null; lat: string | null; lng: string | null }) => {
    if (!user) {
      setUploadError('You must be logged in to upload CSV files.')
      return
    }

    // Check marker limits before processing
    if (!canAddMarkers(markers.length)) {
      setUploadError(`Cannot add more markers. You've reached your limit of ${markers.length} markers. Upgrade your plan to add more.`)
      return
    }

    // SECURITY CHECK: Validate geocoding permissions using limits field
    const hasCoordinates = !!(columnMapping.lat && columnMapping.lng)
    const canUseGeocoding = userDocument?.limits?.geocoding === true
    
    // 🔍 DEBUG: Log user document and limits for geocoding access
    console.log('🔍 CSV Upload Debug - Geocoding Access Check:')
    console.log('  - userDocument:', userDocument)
    console.log('  - userDocument.limits:', userDocument?.limits)
    console.log('  - userDocument.limits.geocoding:', userDocument?.limits?.geocoding)
    console.log('  - canUseGeocoding:', canUseGeocoding)
    console.log('  - hasCoordinates:', hasCoordinates)
    console.log('  - columnMapping:', columnMapping)
    console.log('  - userDocument.subscription:', userDocument?.subscription)
    console.log('  - userDocument.subscription.plan:', userDocument?.subscription?.plan)
    
    if (!canUseGeocoding && !hasCoordinates) {
      console.log('❌ BLOCKING CSV UPLOAD: No geocoding access and no coordinates provided')
      setUploadError('❌ Security Error: You must provide latitude and longitude columns. Address geocoding is not available in your current settings.')
      return
    }

    setIsUploading(true)
    setUploadError('')
    setUploadProgress({ processed: 0, total: 0, currentAddress: '' })

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const csvData = results.data as any[]
          const newMarkers: Marker[] = []
          
          console.log('CSV Data:', csvData) // Debug log
          
          // Validate CSV data before processing
          const hasValidCoordinates = csvData.some(row => {
            if (!columnMapping.lat || !columnMapping.lng) return false
            const lat = row[columnMapping.lat]
            const lng = row[columnMapping.lng]
            if (!lat || !lng) return false
            
            // Validate that coordinates are numeric and within valid ranges
            const latNum = parseFloat(lat.toString().trim())
            const lngNum = parseFloat(lng.toString().trim())
            return !isNaN(latNum) && !isNaN(lngNum) && 
                   latNum >= -90 && latNum <= 90 && 
                   lngNum >= -180 && lngNum <= 180
          })
          
          // SECURITY CHECK: If no valid coordinates and no geocoding access, stop processing
          console.log('🔍 CSV Processing Debug - Second Security Check:')
          console.log('  - hasValidCoordinates:', hasValidCoordinates)
          console.log('  - canUseGeocoding:', canUseGeocoding)
          console.log('  - csvData.length:', csvData.length)
          console.log('  - columnMapping.lat:', columnMapping.lat)
          console.log('  - columnMapping.lng:', columnMapping.lng)
          
          if (!hasValidCoordinates && !canUseGeocoding) {
            console.log('❌ BLOCKING CSV PROCESSING: No valid coordinates found and no geocoding access')
            setUploadError('❌ Security Error: No valid latitude/longitude coordinates found and geocoding is not available in your current settings. Please provide valid coordinate columns or upgrade your plan.')
            setIsUploading(false)
            return
          }
          
          // Set total count early for progress bar
          setUploadProgress({
            processed: 0,
            total: csvData.length,
            currentAddress: '📊 Parsing CSV data...'
          })

          // ALWAYS use the current map - CSV import should never create new maps
          let mapId = currentMapId
          
          if (!mapId) {
            // Only if NO map is selected, use the first available map
            if (maps.length > 0) {
              mapId = maps[0].id!
              setCurrentMapId(mapId)
              console.log('No map selected, using first available map for CSV import:', mapId)
            } else {
              // User has no maps at all - they need to create one first
              setUploadError('❌ No maps available. Please create a map first before importing CSV data.')
              setIsUploading(false)
              return
            }
          } else {
            console.log('Adding markers to current map:', mapId)
          }

          // Prepare address data for duplicate checking using column mapping
          const addressData: AddressData[] = []
          let skippedRows = 0
          let processedRows = 0
          
          console.log('📊 CSV Processing Details:')
          console.log('Total CSV rows:', csvData.length)
          console.log('Column mapping:', columnMapping)
          
          // Update progress with current step
          setUploadProgress(prev => ({
            ...prev,
            currentAddress: '🔍 Preparing address data...'
          }))
          
          // Show the first few rows to debug column mapping
          console.log('🔍 First 3 rows for debugging:')
          for (let i = 0; i < Math.min(3, csvData.length); i++) {
            console.log(`Row ${i + 1}:`, csvData[i])
          }
          
          // Show all available column names
          if (csvData.length > 0) {
            console.log('📋 Available columns:', Object.keys(csvData[0]))
          }
          
          for (let rowIndex = 0; rowIndex < csvData.length; rowIndex++) {
            const row = csvData[rowIndex]
            
            // Update progress to show current row being processed
            setUploadProgress(prev => ({
              ...prev,
              processed: rowIndex,
              currentAddress: `🔍 Processing row ${rowIndex + 1} of ${csvData.length}...`
            }))
            
            // Log the raw row data first
            console.log(`\n📋 Raw Row ${rowIndex + 1}:`, row)
            
            const name = columnMapping.name ? (row[columnMapping.name] || '').toString().trim() : ''
            const address = columnMapping.address ? (row[columnMapping.address] || '').toString().trim() : ''
            
            // Parse and validate coordinates using utility function
            let lat: number | null = null
            let lng: number | null = null
            
            if (columnMapping.lat && columnMapping.lng) {
              const latStr = row[columnMapping.lat]?.toString().trim()
              const lngStr = row[columnMapping.lng]?.toString().trim()
              
              if (latStr && lngStr) {
                const coordResult = validateCoordinates(latStr, lngStr)
                
                if (coordResult.isValid) {
                  lat = coordResult.lat!
                  lng = coordResult.lng!
                  console.log(`✅ Row ${rowIndex + 1}: Valid coordinates (${lat}, ${lng})`)
                } else {
                  console.log(`❌ Row ${rowIndex + 1}: Invalid coordinates - ${coordResult.error}`)
                  console.log(`   - Provided: lat="${latStr}", lng="${lngStr}"`)
                  
                  // Update progress to show coordinate validation failure
                  const errorMessage = coordResult.error?.includes('Address detected') 
                    ? `❌ Row ${rowIndex + 1}: Address detected in coordinate column (${latStr}, ${lngStr})`
                    : `❌ Row ${rowIndex + 1}: Invalid coordinates (${latStr}, ${lngStr})`
                  
                  setUploadProgress(prev => ({
                    ...prev,
                    currentAddress: errorMessage
                  }))
                  
                  // Log security violation for invalid coordinates
                  if (user) {
                    logSecurityViolation(user.uid, 'Invalid coordinates provided', {
                      row: rowIndex + 1,
                      lat: latStr,
                      lng: lngStr,
                      error: coordResult.error
                    })
                  }
                  
                  // Skip this row due to invalid coordinates
                  skippedRows++
                  const skipReason = coordResult.error?.includes('Address detected') 
                    ? 'Address detected in coordinate column'
                    : 'Invalid coordinates'
                  console.log(`❌ Row ${rowIndex + 1} SKIPPED: ${skipReason}`)
                  continue
                }
              }
            }
            
            console.log(`🔍 Processed Row ${rowIndex + 1}:`, {
              rawName: row[columnMapping.name || ''] || 'UNDEFINED',
              rawAddress: row[columnMapping.address || ''] || 'UNDEFINED',
              rawLat: row[columnMapping.lat || ''] || 'UNDEFINED',
              rawLng: row[columnMapping.lng || ''] || 'UNDEFINED',
              processedName: name || 'EMPTY',
              processedAddress: address || 'EMPTY', 
              processedLat: lat || 'EMPTY',
              processedLng: lng || 'EMPTY',
              hasName: !!name,
              hasAddress: !!address,
              hasCoords: !!(lat && lng),
              willProcess: !!(name && (address || (lat && lng)))
            })
            
            // Only process rows that have a name and either address or coordinates
            if (name && (address || (lat && lng))) {
              addressData.push({ 
                name, 
                address: address || `${lat}, ${lng}`, // Use coordinates as address if no address provided
                lat: lat || undefined,
                lng: lng || undefined
              })
              processedRows++
              console.log(`✅ Row ${rowIndex + 1} ADDED to processing queue`)
            } else {
              skippedRows++
              const skipReason = !name ? 'Missing business name' : 
                                !address && !(lat && lng) ? 'Missing address and coordinates' : 
                                'Missing required data'
              
              console.log(`❌ Row ${rowIndex + 1} SKIPPED: ${skipReason}`)
              console.log(`   - Name: "${name}" (${!!name ? 'HAS' : 'MISSING'})`)
              console.log(`   - Address: "${address}" (${!!address ? 'HAS' : 'MISSING'})`)
              console.log(`   - Coords: lat=${lat}, lng=${lng} (${!!(lat && lng) ? 'HAS' : 'MISSING'})`)
              
              // Update progress to show skip reason
              setUploadProgress(prev => ({
                ...prev,
                currentAddress: `❌ Row ${rowIndex + 1}: ${skipReason}`
              }))
            }
          }
          

          // Check if any valid data was found
          if (addressData.length === 0) {
            setUploadError(`No valid data found. All ${csvData.length} rows were skipped due to missing or invalid data. Please check your CSV format and column mapping.`)
            setIsUploading(false)
            setUploadProgress(prev => ({
              ...prev,
              currentAddress: `❌ No valid data found in ${csvData.length} rows`
            }))
            return
          }

          // Check for internal duplicates within the CSV
          const duplicateCheck = checkForInternalDuplicates(addressData)
          console.log(`🔍 Internal Duplicate Check:`)
          console.log(`- Input addresses: ${addressData.length}`)
          console.log(`- Internal duplicates found: ${duplicateCheck.duplicateCount}`)
          
          // Update progress with current step
          setUploadProgress(prev => ({
            ...prev,
            currentAddress: '🔍 Checking for duplicates...'
          }))
          console.log(`- Unique addresses after internal check: ${duplicateCheck.unique.length}`)

          // Get existing markers from the current map for comparison
          let existingMarkers: AddressData[] = []
          if (currentMapId) {
            try {
              const currentMapMarkers = await getMapMarkers(user.uid, currentMapId)
              existingMarkers = currentMapMarkers.map(marker => ({
                name: marker.name,
                address: marker.address,
                lat: marker.lat,
                lng: marker.lng
              }))
              console.log(`🗺️ Found ${existingMarkers.length} existing markers in current map`)
            } catch (error) {
              console.error('Error loading existing markers:', error)
            }
          } else {
            console.log(`🗺️ No existing map - all addresses will be new`)
          }

          // Check for duplicates against existing markers
          const finalDuplicateCheck = checkForDuplicates(duplicateCheck.unique, existingMarkers)
          console.log(`🔍 Final Duplicate Check:`)
          console.log(`- Input addresses: ${duplicateCheck.unique.length}`)
          console.log(`- Duplicates against existing markers: ${finalDuplicateCheck.duplicateCount}`)
          console.log(`- Final unique addresses to process: ${finalDuplicateCheck.unique.length}`)

          const totalDuplicates = duplicateCheck.duplicateCount + finalDuplicateCheck.duplicateCount
          const uniqueAddresses = finalDuplicateCheck.unique
          
          console.log(`- Total duplicates: ${totalDuplicates}`)
          console.log(`- Final addresses to geocode: ${uniqueAddresses.length}`)

          // Update progress with geocoding step
          setUploadProgress(prev => ({
            ...prev,
            currentAddress: '🌍 Starting geocoding...'
          }))

                  // Process only unique addresses
                  console.log(`🚀 Starting geocoding process for ${uniqueAddresses.length} addresses...`)
                  
                  for (let i = 0; i < uniqueAddresses.length; i++) {
                    const addressData = uniqueAddresses[i]
                    
                    // Update progress with detailed information
                    const markerInfo = `${addressData.name || 'Unnamed'} | ${addressData.lat ? addressData.lat.toFixed(6) : 'N/A'}, ${addressData.lng ? addressData.lng.toFixed(6) : 'N/A'}`
                    setUploadProgress({
                      processed: i,
                      total: uniqueAddresses.length,
                      currentAddress: `🌍 Geocoding: ${markerInfo}`
                    })
                    
                    // Add delay between requests to avoid rate limiting (only for geocoding)
                    if (i > 0 && !addressData.lat && !addressData.lng) {
                      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
                    }

                    console.log(`📍 Processing ${i + 1}/${uniqueAddresses.length}: ${addressData.name} - ${addressData.address}`)
                    
                    // Update progress for geocoding/coordinate processing
                    setUploadProgress(prev => ({
                      ...prev,
                      processed: i,
                      currentAddress: `📍 Processing ${i + 1}/${uniqueAddresses.length}: ${addressData.name}`
                    }))
                    
                    // Use provided coordinates or geocode the address
                    let coordinates: { lat: number; lng: number } | null = null
                    
                    if (addressData.lat && addressData.lng) {
                      // Use provided coordinates
                      coordinates = { lat: addressData.lat, lng: addressData.lng }
                      console.log(`✅ Using provided coordinates: ${coordinates.lat}, ${coordinates.lng}`)
                    } else if (canUseGeocoding) {
                      // Geocode the address (only if user has geocoding access)
                      console.log(`🌐 Geocoding address: ${addressData.address}`)
                      setUploadProgress(prev => ({
                        ...prev,
                        currentAddress: `🌐 Geocoding ${i + 1}/${uniqueAddresses.length}: ${addressData.address}`
                      }))
                      coordinates = await geocodeAddress(addressData.address, i, uniqueAddresses.length)
                    } else {
                      // No coordinates and no geocoding access - skip this marker
                      console.log(`❌ Skipping ${addressData.name}: No coordinates provided and geocoding not available in current settings`)
                      
                      // Log security violation for geocoding attempt without permission
                      if (user) {
                        logSecurityViolation(user.uid, 'Geocoding attempt without permission', {
                          markerName: addressData.name,
                          address: addressData.address,
                          hasCoordinates: !!(addressData.lat && addressData.lng),
                          hasGeocoding: canUseGeocoding
                        })
                      }
                      
                      setUploadProgress({
                        processed: i + 1,
                        total: uniqueAddresses.length,
                        currentAddress: `❌ Skipped: ${addressData.name} (No coordinates, geocoding unavailable)`
                      })
                      continue
                    }
                    
                    if (coordinates) {
                      console.log(`✅ Successfully processed ${addressData.name}:`, coordinates)
                      
                      // Update progress with final coordinates
                      const finalInfo = `${addressData.name || 'Unnamed'} | ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`
                      setUploadProgress({
                        processed: i + 1,
                        total: uniqueAddresses.length,
                        currentAddress: `✅ Processed: ${finalInfo}`
                      })
                      
                      // Check marker limit before adding
                      const currentMarkerCount = markers.length + newMarkers.length
                      const maxMarkersPerMap = userDocument?.limits?.maxMarkersPerMap || 50
                      
                      if (currentMarkerCount >= maxMarkersPerMap) {
                        console.log(`❌ Marker limit reached! Current: ${currentMarkerCount}, Max: ${maxMarkersPerMap}`)
                        setUploadError(`❌ Marker limit reached! You can only have ${maxMarkersPerMap} markers per map. Processed ${newMarkers.length} markers before reaching the limit.`)
                        setIsUploading(false)
                        return
                      }

                      // Add marker to Firestore
                      try {
                        const markerId = await addMarkerToMap(user.uid, mapId, {
                          name: addressData.name,
                          address: addressData.address,
                          lat: coordinates.lat,
                          lng: coordinates.lng,
                          type: 'other',
                          visible: true
                        }, userDocument?.limits?.smartGrouping === true)
                        
                        console.log(`💾 Added marker to Firestore with ID: ${markerId}`)
                        
                        // Also add to local state for immediate UI update
                        const marker: Marker = {
                          id: markerId,
                          name: addressData.name,
                          address: addressData.address,
                          lat: coordinates.lat,
                          lng: coordinates.lng,
                          visible: true,
                          type: 'other'
                        }
                        newMarkers.push(marker)
                        console.log(`📝 Added marker to local state. Total markers: ${newMarkers.length}`)
                      } catch (markerError) {
                        console.error('❌ Error adding marker to map:', markerError)
                      }
                    } else {
                      console.log(`❌ Failed to geocode: ${addressData.name} - ${addressData.address}`)
                    }
                  }
                  
                  console.log(`🏁 Geocoding process complete. Successfully processed: ${newMarkers.length} markers`)
                  
                  // Final progress update
                  setUploadProgress({
                    processed: uniqueAddresses.length,
                    total: uniqueAddresses.length,
                    currentAddress: 'Complete'
                  })

          // Comprehensive processing summary
          console.log(`📊 CSV Processing Summary:`)
          console.log(`- Total CSV rows: ${csvData.length}`)
          console.log(`- Rows processed: ${processedRows}`)
          console.log(`- Rows skipped: ${skippedRows}`)
          console.log(`- Rows with invalid coordinates: ${skippedRows - (csvData.length - processedRows)}`)
          console.log(`- Duplicates found: ${totalDuplicates}`)
          console.log(`- Final markers imported: ${newMarkers.length}`)

          if (newMarkers.length > 0) {
            setMarkers(prev => [...prev, ...newMarkers])
            console.log(`✅ Successfully imported ${newMarkers.length} markers to map`)
            
            // Show detailed summary in progress
            setUploadProgress(prev => ({
              ...prev,
              currentAddress: `✅ Imported ${newMarkers.length} markers. ${skippedRows} rows skipped (${skippedRows - (csvData.length - processedRows)} invalid coordinates)`
            }))
          } else if (totalDuplicates > 0) {
            // All addresses were duplicates, just show notification
            console.log('All addresses were duplicates')
            setUploadProgress(prev => ({
              ...prev,
              currentAddress: `❌ All ${csvData.length} rows were duplicates or invalid`
            }))
          } else {
            // No valid addresses found (empty CSV or invalid format)
            setUploadError(`No valid markers found. ${skippedRows} rows skipped due to invalid coordinates or missing data. Please check your CSV format.`)
            setUploadProgress(prev => ({
              ...prev,
              currentAddress: `❌ No valid markers found. ${skippedRows} rows skipped`
            }))
          }

          // Show duplicate notification
          setDuplicateCount(totalDuplicates)
          setTotalProcessed(addressData.length)
          setNotificationType('csv')
          setShowDuplicateNotification(true)
        },
        error: (error) => {
          setUploadError('Error parsing CSV file: ' + error.message)
        }
      })
    } catch (error) {
      setUploadError('Error processing file')
    } finally {
      setIsUploading(false)
      setCurrentProcessingAddress('')
      setProcessingProgress({ current: 0, total: 0 })
      setUploadProgress({ processed: 0, total: 0, currentAddress: '' })
    }
  }, [user, mapSettings, userDocument, currentMapId])

  // Show loading screen while checking authentication
  if (loading) {
              return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading MAPIES...</p>
        </div>
              </div>
    )
  }

  // Redirect to landing page if not authenticated
  if (!user) {
    // Redirect to landing page instead of showing old login page
    window.location.href = '/'
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to landing page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar / Mobile Bottom Bar */}
      <ResponsiveSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        markers={markers}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onToggleMarkerVisibility={toggleMarkerVisibility}
        onDeleteMarker={deleteMarker}
        onShowCsvModal={() => {
          console.log('🚀 CSV Modal button clicked!')
          console.log('🚀 Current csvModalOpen state:', csvModalOpen)
          setCsvModalOpen(true)
          console.log('🚀 Set csvModalOpen to true')
        }}
        onShowAddMarkerModal={() => setShowAddMarkerModal(true)}
        onShowPublishModal={() => setShowPublishModal(true)}
        onOpenMarkerManagementModal={() => setShowMarkerManagementModal(true)}
        onOpenDataManagementModal={() => setShowDataManagementModal(true)}
        onOpenEditManagementModal={() => setShowEditManagementModal(true)}
        onOpenPublishManagementModal={() => setShowPublishManagementModal(true)}
        mapSettings={mapSettings}
        onMapSettingsChange={handleMapSettingsChange}
        currentMapId={currentMapId}
        onMapChange={setCurrentMapId}
        maps={maps}
        onMapsChange={() => {}} // Not needed with real-time listeners
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onSignOut={handleSignOut}
        userId={user?.uid || ''}
        onOpenSubscription={() => setShowSubscriptionModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pb-16 sm:pb-0">
        {/* Top Bar */}
        <TopBar 
          activeTab={activeTab}
        />

        {/* Map Area */}
        <MapArea
          markers={markers}
          activeTab={activeTab}
          mapSettings={mapSettings}
          userLocation={userLocation}
          locationError={locationError}
          onGetCurrentLocation={getCurrentLocation}
          iframeDimensions={iframeDimensions}
          onIframeDimensionsChange={setIframeDimensions}
          folderIcons={folderIcons}
          onOpenSubscription={() => setShowSubscriptionModal(true)}
          currentMap={maps.find(m => m.id === currentMapId)}
        />
      </div>

       {/* CSV Upload Modal */}
        <CsvUploadModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          onFileProcess={processCsvFile}
          isUploading={isUploading}
          uploadError={uploadError}
          uploadProgress={uploadProgress}
          currentMarkerCount={markers.length}
        />

       {/* Add Marker Modal */}
       <AddMarkerModal
         isOpen={showAddMarkerModal}
         onClose={() => setShowAddMarkerModal(false)}
         onMarkersAdded={handleMarkersAdded}
         isUploading={isUploading}
         currentProcessingAddress={currentProcessingAddress}
         processingProgress={processingProgress}
         currentMapId={currentMapId}
         userId={(() => {
           // Determine the correct user ID for marker operations
           // For owned maps: use current user's ID
           // For shared maps: use map owner's ID
           const currentMap = maps.find(m => m.id === currentMapId)
           return currentMap?.userId || user?.uid || null
         })()}
         onShowDuplicateNotification={handleShowDuplicateNotification}
       />

       {/* Publish Modal */}
       <Publish
         isOpen={showPublishModal}
         onClose={() => setShowPublishModal(false)}
         currentMapId={currentMapId || ''}
         iframeDimensions={iframeDimensions}
       />

       {/* Auth Modal */}
       <AuthModal
         isOpen={showAuthModal}
         onClose={() => setShowAuthModal(false)}
         onAuthSuccess={() => setShowAuthModal(false)}
       />

       {/* Marker Management Modal */}
       <MarkerManagementModal
         isOpen={showMarkerManagementModal}
         onClose={() => setShowMarkerManagementModal(false)}
         markers={markers}
         searchTerm={searchTerm}
         onSearchChange={setSearchTerm}
         onToggleMarkerVisibility={toggleMarkerVisibility}
         onDeleteMarker={deleteMarker}
         mapSettings={mapSettings}
         onMapSettingsChange={handleMapSettingsChange}
         userId={user?.uid || ''}
         mapId={currentMapId || undefined}
       />

       {/* Data Management Modal */}
       <DataManagementModal
         isOpen={showDataManagementModal}
         onClose={() => setShowDataManagementModal(false)}
         onShowAddMarkerModal={() => setShowAddMarkerModal(true)}
         onShowCsvModal={() => setCsvModalOpen(true)}
         isUploading={isUploading}
         uploadProgress={uploadProgress}
       />

       {/* Edit Management Modal */}
       <EditManagementModal
         isOpen={showEditManagementModal}
         onClose={() => setShowEditManagementModal(false)}
         mapSettings={mapSettings}
         onMapSettingsChange={handleMapSettingsChange}
       />

       {/* Publish Management Modal */}
       <PublishManagementModal
         isOpen={showPublishManagementModal}
         onClose={() => setShowPublishManagementModal(false)}
         onShowPublishModal={() => setShowPublishModal(true)}
         currentMapId={currentMapId}
       />

       {/* Duplicate Notification */}
       <DuplicateNotification
         isVisible={showDuplicateNotification}
         onClose={() => setShowDuplicateNotification(false)}
         duplicateCount={duplicateCount}
         totalProcessed={totalProcessed}
         type={notificationType}
       />

       {/* Toast Notification */}
       <Toast
         isVisible={showToast}
         onClose={() => setShowToast(false)}
         type={toastType}
         title={toastTitle}
         message={toastMessage}
         duration={5000}
       />

       {/* Subscription Management Modal */}
       {showSubscriptionModal && (
         <SubscriptionManagementModal onClose={() => setShowSubscriptionModal(false)} />
       )}
    </div>
   )
 }

// Dashboard Redirect Component
const DashboardRedirect: React.FC = () => {
  useEffect(() => {
    // Force redirect to root
    window.location.href = '/'
  }, [])
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontSize: '18px',
      color: '#666'
    }}>
      Redirecting to dashboard...
    </div>
  )
}

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/embed" element={<EmbedMap />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/auth" element={<AppContent />} />
            <Route path="/:mapId" element={<PublicMap />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
