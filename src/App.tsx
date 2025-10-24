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
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { debugFirebase, testFirebaseConnection } from './firebase/debug'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import Toast from './components/Toast'
import { testFirebaseAuth } from './firebase/test-auth'
import { createMap, addMarkerToMap, MapDocument, getMapMarkers, deleteMapMarker, updateMapMarker, updateMap, subscribeToMapMarkers, subscribeToUserMaps, subscribeToMapDocument, NameRule, getSharedMaps } from './firebase/maps'
import { migrateSpecificMap } from './firebase/migration'
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
  const { user, loading, signOut } = useAuth()
  const { hasGeocoding, hasSmartGrouping, canAddMarkers } = useFeatureAccess()

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
  
  // Map design settings
  const [mapSettings, setMapSettings] = useState({
    style: 'light',
    markerShape: 'circle',
    markerColor: '#000000',
    markerSize: 'medium',
    markerBorder: 'white',
    markerBorderWidth: 2,
    // Clustering settings
    clusteringEnabled: true,
    clusterRadius: 50,
    // Search bar settings
    searchBarBackgroundColor: '#ffffff',
    searchBarTextColor: '#000000',
    searchBarHoverColor: '#f3f4f6',
    // Name rules settings
    nameRules: [] as NameRule[]
  })

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
    setMarkers(prev => [...prev, ...newMarkers])
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
      
      // Only update if markers actually changed
      setMarkers(prevMarkers => {
        const hasChanged = prevMarkers.length !== localMarkers.length || 
          prevMarkers.some((prev, index) => {
            const current = localMarkers[index]
            return !current || prev.id !== current.id || prev.visible !== current.visible || prev.name !== current.name
          })
        
        if (hasChanged) {
          console.log('📍 Markers changed, updating local state')
          return localMarkers
        }
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
          console.log('🔄 Clustering settings missing, migrating map:', currentMapId)
          try {
            await migrateSpecificMap(user.uid, currentMapId)
            console.log('✅ Map migrated successfully')
            return // The listener will be called again with updated data
          } catch (error) {
            console.error('❌ Migration failed:', error)
          }
        }
        
        // Only update if settings actually changed
        setMapSettings(prevSettings => {
          const newSettings = {
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
          
          const hasChanged = JSON.stringify(prevSettings) !== JSON.stringify(newSettings)
          if (hasChanged) {
            console.log('✅ Map settings changed, updating local state')
            return newSettings
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
      // Check if user has geocoding access
      if (!hasGeocoding) {
        console.log('❌ Geocoding not available in current plan')
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
          const hasCoordinates = csvData.some(row => 
            (columnMapping.lat && row[columnMapping.lat] && row[columnMapping.lat].trim()) ||
            (columnMapping.lng && row[columnMapping.lng] && row[columnMapping.lng].trim())
          )
          
          // If no coordinates and no geocoding access, stop processing
          if (!hasCoordinates && !hasGeocoding) {
            setUploadError('❌ Cannot process CSV: No latitude/longitude columns found and geocoding is not available in your current plan. Please add coordinate columns to your CSV or upgrade your plan to use geocoding.')
            setIsUploading(false)
            return
          }
          
          // Set total count early for progress bar
          setUploadProgress({
            processed: 0,
            total: csvData.length,
            currentAddress: '📊 Parsing CSV data...'
          })

          // Use current map or create a new one if none exists
          let mapId = currentMapId
          if (!mapId) {
            const mapName = file.name.replace('.csv', '') || `Map ${new Date().toLocaleDateString()}`
            // Create map with default settings, ensuring nameRules is empty
            const defaultMapSettings = {
              ...mapSettings,
              nameRules: [] // Always start with empty name rules
            }
            mapId = await createMap(user.uid, {
              name: mapName,
              description: `Imported from ${file.name}`,
              settings: defaultMapSettings
            })
            setCurrentMapId(mapId)
            console.log('Created new map with empty name rules:', mapId)
          } else {
            console.log('Adding to existing map:', mapId)
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
            
            // Log the raw row data first
            console.log(`\n📋 Raw Row ${rowIndex + 1}:`, row)
            
            const name = columnMapping.name ? (row[columnMapping.name] || '').toString().trim() : ''
            const address = columnMapping.address ? (row[columnMapping.address] || '').toString().trim() : ''
            const lat = columnMapping.lat ? parseFloat(row[columnMapping.lat]) : null
            const lng = columnMapping.lng ? parseFloat(row[columnMapping.lng]) : null
            
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
              console.log(`❌ Row ${rowIndex + 1} SKIPPED: Missing name or address/coordinates`)
              console.log(`   - Name: "${name}" (${!!name ? 'HAS' : 'MISSING'})`)
              console.log(`   - Address: "${address}" (${!!address ? 'HAS' : 'MISSING'})`)
              console.log(`   - Coords: lat=${lat}, lng=${lng} (${!!(lat && lng) ? 'HAS' : 'MISSING'})`)
            }
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
                    
                    // Use provided coordinates or geocode the address
                    let coordinates: { lat: number; lng: number } | null = null
                    
                    if (addressData.lat && addressData.lng) {
                      // Use provided coordinates
                      coordinates = { lat: addressData.lat, lng: addressData.lng }
                      console.log(`✅ Using provided coordinates: ${coordinates.lat}, ${coordinates.lng}`)
                    } else if (hasGeocoding) {
                      // Geocode the address (only if user has geocoding access)
                      console.log(`🌐 Geocoding address: ${addressData.address}`)
                      coordinates = await geocodeAddress(addressData.address, i, uniqueAddresses.length)
                    } else {
                      // No coordinates and no geocoding access - skip this marker
                      console.log(`❌ Skipping ${addressData.name}: No coordinates provided and geocoding not available in current plan`)
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
                      
                      // Add marker to Firestore
                      try {
                        const markerId = await addMarkerToMap(user.uid, mapId, {
                          name: addressData.name,
                          address: addressData.address,
                          lat: coordinates.lat,
                          lng: coordinates.lng,
                          type: 'other',
                          visible: true
                        }, hasSmartGrouping)
                        
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

          if (newMarkers.length > 0) {
            setMarkers(prev => [...prev, ...newMarkers])
            console.log(`✅ Successfully imported ${newMarkers.length} markers to map`)
          } else if (totalDuplicates > 0) {
            // All addresses were duplicates, just show notification
            console.log('All addresses were duplicates')
          } else {
            // No valid addresses found (empty CSV or invalid format)
            setUploadError('No valid markers found. Please check your CSV format.')
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
  }, [user, mapSettings])

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

  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="mb-8">
            <div className="flex items-center justify-center mb-6">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
                alt="Pinz Logo"
                className="h-20 w-auto"
              />
            </div>
            <p className="text-gray-600 mb-6">Create and manage your interactive store locator maps</p>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-pinz-600 hover:bg-pinz-700 text-white font-medium py-4 px-8 rounded-lg transition-colors w-full text-lg shadow-lg hover:shadow-xl"
            >
              Sign In / Create Account
            </button>
            <div className="text-sm text-gray-500">
              Free to get started • No credit card required
            </div>
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="signup"
        />
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
         initialMode="login"
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

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/embed" element={<EmbedMap />} />
        <Route path="/:mapId" element={<PublicMap />} />
        <Route path="/*" element={
          <AuthProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </AuthProvider>
        } />
      </Routes>
    </Router>
  )
}

export default App
