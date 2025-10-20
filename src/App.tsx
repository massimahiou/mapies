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
import { ToastProvider } from './contexts/ToastContext'
import EmbedMap from './components/EmbedMap'
import PublicMap from './components/PublicMap'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { debugFirebase, testFirebaseConnection } from './firebase/debug'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import Toast from './components/Toast'
import { testFirebaseAuth } from './firebase/test-auth'
import { createMap, addMarkerToMap, MapDocument, getMapMarkers, deleteMapMarker, updateMapMarker, updateMap, subscribeToMapMarkers, subscribeToUserMaps, subscribeToMapDocument, NameRule } from './firebase/maps'
import { migrateSpecificMap } from './firebase/migration'
import { checkForDuplicates, checkForInternalDuplicates, AddressData } from './utils/duplicateDetection'
import DuplicateNotification from './components/DuplicateNotification'


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
  const [showCsvModal, setShowCsvModal] = useState(false)
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
  const [nameRules, setNameRules] = useState<NameRule[]>([])
  
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
      // Update in Firestore
      await updateMapMarker(user.uid, currentMapId, id, {
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
      // Delete from Firestore
      await deleteMapMarker(user.uid, currentMapId, id)
      
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

    // Listen to map markers in real-time
    const unsubscribeMarkers = subscribeToMapMarkers(user.uid, currentMapId, (mapMarkers) => {
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
    const unsubscribeMapSettings = subscribeToMapDocument(user.uid, currentMapId, async (mapData) => {
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
        const groups = await getUserMarkerGroups(user.uid, currentMapId)
        
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
  }, [currentMapId, user])

  // Set up real-time listeners for maps and markers
  useEffect(() => {
    if (!user) return

    console.log('🔄 Setting up real-time listeners for user:', user.uid)

    // Listen to user's maps in real-time
    const unsubscribeMaps = subscribeToUserMaps(user.uid, (userMaps) => {
      console.log('📊 Maps updated from Firestore:', userMaps.length)
      
      // Only update if maps actually changed
      setMaps(prevMaps => {
        const hasChanged = prevMaps.length !== userMaps.length ||
          prevMaps.some((prev, index) => {
            const current = userMaps[index]
            return !current || prev.id !== current.id || prev.name !== current.name
          })
        
        if (hasChanged) {
          console.log('📊 Maps changed, updating local state')
          return userMaps
        }
        return prevMaps
      })
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
    console.log('CSV Modal state:', showCsvModal)
  }, [showCsvModal])

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
      setCurrentProcessingAddress(address)
      setProcessingProgress({ current: currentIndex + 1, total: totalCount })
      console.log('Using Nominatim for geocoding:', address) // Debug log
      
      // Try multiple address variations
      const addressVariations = [
        address, // Original address
        address.replace(/,\s*QC\s+\w+\s+\w+/, ', QC'), // Remove postal code
        address.replace(/,\s*QC.*/, ', QC'), // Remove everything after QC
        address.split(',')[0] + ', Saint-Hubert, QC', // Just street + city + province
        address.split(',')[0] + ', QC' // Just street + province
      ]
      
      for (const variation of addressVariations) {
        console.log('Trying address variation:', variation)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(variation)}&limit=1&countrycodes=ca`)
        const data = await response.json()
        
        console.log('Nominatim response for variation:', variation, data) // Debug log
        
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
      console.error('Geocoding error:', error)
      return null
    }
  }

  // Process CSV file
  const processCsvFile = useCallback(async (file: File, columnMapping: { name: string | null; address: string | null; lat: string | null; lng: string | null }) => {
    if (!user) {
      setUploadError('You must be logged in to upload CSV files.')
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

          // Use current map or create a new one if none exists
          let mapId = currentMapId
          if (!mapId) {
            const mapName = file.name.replace('.csv', '') || `Map ${new Date().toLocaleDateString()}`
            mapId = await createMap(user.uid, {
              name: mapName,
              description: `Imported from ${file.name}`,
              settings: mapSettings
            })
            setCurrentMapId(mapId)
            console.log('Created new map with settings:', mapId, mapSettings)
          } else {
            console.log('Adding to existing map:', mapId)
          }

          // Prepare address data for duplicate checking using column mapping
          const addressData: AddressData[] = []
          for (const row of csvData) {
            const name = columnMapping.name ? (row[columnMapping.name] || '').toString().trim() : ''
            const address = columnMapping.address ? (row[columnMapping.address] || '').toString().trim() : ''
            const lat = columnMapping.lat ? parseFloat(row[columnMapping.lat]) : null
            const lng = columnMapping.lng ? parseFloat(row[columnMapping.lng]) : null
            
            // Only process rows that have a name and either address or coordinates
            if (name && (address || (lat && lng))) {
              addressData.push({ 
                name, 
                address: address || `${lat}, ${lng}`, // Use coordinates as address if no address provided
                lat: lat || undefined,
                lng: lng || undefined
              })
            }
          }

          // Check for internal duplicates within the CSV
          const duplicateCheck = checkForInternalDuplicates(addressData)
          console.log(`Found ${duplicateCheck.duplicateCount} internal duplicates in CSV`)

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
            } catch (error) {
              console.error('Error loading existing markers:', error)
            }
          }

          // Check for duplicates against existing markers
          const finalDuplicateCheck = checkForDuplicates(duplicateCheck.unique, existingMarkers)
          console.log(`Found ${finalDuplicateCheck.duplicateCount} duplicates against existing markers`)

          const totalDuplicates = duplicateCheck.duplicateCount + finalDuplicateCheck.duplicateCount
          const uniqueAddresses = finalDuplicateCheck.unique

                  // Process only unique addresses
                  for (let i = 0; i < uniqueAddresses.length; i++) {
                    const addressData = uniqueAddresses[i]
                    
                    // Update progress
                    setUploadProgress({
                      processed: i,
                      total: uniqueAddresses.length,
                      currentAddress: addressData.name
                    })
                    
                    // Add delay between requests to avoid rate limiting (only for geocoding)
                    if (i > 0 && !addressData.lat && !addressData.lng) {
                      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
                    }

                    console.log(`Processing: ${addressData.name} - ${addressData.address}`) // Debug log
                    
                    // Use provided coordinates or geocode the address
                    let coordinates: { lat: number; lng: number } | null = null
                    
                    if (addressData.lat && addressData.lng) {
                      // Use provided coordinates
                      coordinates = { lat: addressData.lat, lng: addressData.lng }
                      console.log(`Using provided coordinates: ${coordinates.lat}, ${coordinates.lng}`)
                    } else {
                      // Geocode the address
                      coordinates = await geocodeAddress(addressData.address, i, uniqueAddresses.length)
                    }
                    
                    if (coordinates) {
                      console.log(`✅ Successfully geocoded ${addressData.name}:`, coordinates) // Debug log
                      
                      // Add marker to Firestore
                      try {
                        const markerId = await addMarkerToMap(user.uid, mapId, {
                          name: addressData.name,
                          address: addressData.address,
                          lat: coordinates.lat,
                          lng: coordinates.lng,
                          type: 'other',
                          visible: true
                        })
                        
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
                      } catch (markerError) {
                        console.error('Error adding marker to map:', markerError)
                      }
                    } else {
                      console.log(`❌ Failed to geocode: ${addressData.name} - ${addressData.address}`) // Debug log
                    }
                  }
                  
                  // Final progress update
                  setUploadProgress({
                    processed: uniqueAddresses.length,
                    total: uniqueAddresses.length,
                    currentAddress: 'Complete'
                  })

          if (newMarkers.length > 0) {
            setMarkers(prev => [...prev, ...newMarkers])
            setShowCsvModal(false)
            console.log(`✅ Successfully imported ${newMarkers.length} markers to map`)
          } else if (totalDuplicates > 0) {
            // All addresses were duplicates, just close modal and show notification
            setShowCsvModal(false)
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2">MAPIES</h1>
            <p className="text-gray-600">Create and manage your store locator maps</p>
                      </div>
          <div className="space-y-4">
                      <button
              onClick={() => setShowAuthModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Get Started
                      </button>
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
        onShowCsvModal={() => setShowCsvModal(true)}
        onShowAddMarkerModal={() => setShowAddMarkerModal(true)}
        onShowPublishModal={() => setShowPublishModal(true)}
        mapSettings={mapSettings}
        onMapSettingsChange={handleMapSettingsChange}
        currentMapId={currentMapId}
        onMapChange={setCurrentMapId}
        maps={maps}
        onMapsChange={() => {}} // Not needed with real-time listeners
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onSignOut={handleSignOut}
        nameRules={nameRules}
        onNameRulesChange={setNameRules}
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
        />
      </div>

       {/* CSV Upload Modal */}
        <CsvUploadModal
          isOpen={showCsvModal}
          onClose={() => setShowCsvModal(false)}
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
         userId={user?.uid || null}
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
