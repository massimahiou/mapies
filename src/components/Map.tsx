import React, { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { Navigation, MapPin, Search, X, List, Shapes, Tag } from 'lucide-react'
import { Rnd } from 'react-rnd'
import PublicMapTagFilter from './PublicMapTagFilter'
import LanguageToggle from './LanguageToggle'
import { createMarkerHTML, createClusterOptions, applyNameRules } from '../utils/markerUtils'
import { useEmbedMapLanguage } from '../hooks/useEmbedMapLanguage'
import { formatAddressForPopup, formatAddressForList } from '../utils/addressUtils'
import { useSharedMapFeatureAccess } from '../hooks/useSharedMapFeatureAccess'
import MapFeatureLevelHeader from './MapFeatureLevelHeader'
import { useResponsive } from '../hooks/useResponsive'
import { useAuth } from '../contexts/AuthContext'
import InteractiveWatermark from './InteractiveWatermark'
import { validateMapAgainstPlan, getPremiumFeatureDescription } from '../utils/mapValidation'
import { isMapOwnedByUser } from '../firebase/maps'
import PolygonPropertiesModal from './PolygonPropertiesModal'
import { usePolygonLoader } from '../hooks/usePolygonLoader'
import { ensureFreemiumCompliance } from '../utils/freemiumDefaults'
import { useToast } from '../contexts/ToastContext'

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: undefined // Disable shadows completely
})

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
  tags?: string[]
  businessCategory?: {
    id: string
    name: string
    icon: string
    color: string
    mapColor: string
    confidence: number
    matchedTerm: string
  }
}

interface MapProps {
  markers: Marker[]
  activeTab: string
  mapSettings: any
  isPublishMode: boolean
  userLocation: {lat: number, lng: number} | null
  locationError: string
  onGetCurrentLocation: () => void
  iframeDimensions: { width: number; height: number }
  onIframeDimensionsChange: (dimensions: { width: number; height: number }) => void
  folderIcons?: Record<string, string>
  onOpenSubscription?: () => void // New prop for opening subscription modal
  currentMap?: any // Add current map data to determine ownership
  showPolygonDrawing?: boolean // Enable polygon drawing mode
  onMapSettingsChange?: (settings: any) => void // Callback to update map settings
}

const Map: React.FC<MapProps> = ({ markers, activeTab, mapSettings, isPublishMode, userLocation, locationError, onGetCurrentLocation, iframeDimensions, onIframeDimensionsChange, folderIcons = {}, onOpenSubscription, currentMap, showPolygonDrawing: _showPolygonDrawing, onMapSettingsChange }) => {
  console.log('🔷 Map component rendered, showPolygonDrawing:', _showPolygonDrawing)
  const { isMobile } = useResponsive()
  const { showWatermark, planLimits, currentPlan, mapInheritance } = useSharedMapFeatureAccess(currentMap)
  const { user } = useAuth()
  const { showToast } = useToast()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const markerClusterRef = useRef<any>(null)
  const userLocationCircleRef = useRef<L.Circle | null>(null)
  const userLocationPulseRef = useRef<L.Circle | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const drawControlRef = useRef<L.Control.Draw | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const polygonLayersRef = useRef<L.Layer[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [showPolygonModal, setShowPolygonModal] = useState(false)
  const [pendingPolygonData, setPendingPolygonData] = useState<{type: string, coords: any} | null>(null)
  const [isLoadingTiles, setIsLoadingTiles] = useState(false)
  const [showEmbedMobileResults, setShowEmbedMobileResults] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [nearbyMarkers, setNearbyMarkers] = useState<Marker[]>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [locationModeActive, setLocationModeActive] = useState(false)
  const [isSettingLocation, setIsSettingLocation] = useState(false) // Track when location is being set
  const [searchResults, setSearchResults] = useState<Marker[]>([])
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const { language, setLanguage } = useEmbedMapLanguage()

  // Calculate available tags and counts
  const availableTags = React.useMemo(() => {
    const tagSet = new Set<string>()
    markers.forEach(marker => {
      (marker.tags || []).forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [markers])

  const tagMarkerCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    availableTags.forEach((tag: string) => {
      counts[tag] = markers.filter(m => (m.tags || []).includes(tag)).length
    })
    return counts
  }, [markers, availableTags])

  // Filter markers by selected tags
  const filteredMarkersByTags = React.useMemo(() => {
    if (selectedTags.size === 0) return markers
    return markers.filter(marker => {
      const markerTags = marker.tags || []
      return Array.from(selectedTags).some(tag => markerTags.includes(tag))
    })
  }, [markers, selectedTags])

  // Tag filter handlers
  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tag)) {
        newSet.delete(tag)
      } else {
        newSet.add(tag)
      }
      return newSet
    })
  }

  const clearTagFilters = () => {
    setSelectedTags(new Set())
  }

  // Function to adjust map view to show filtered markers
  const adjustMapToFilteredMarkers = React.useCallback(() => {
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current) {
      return
    }

    try {
      if (markerClusterRef.current.getLayers().length > 0) {
        const clusterBounds = markerClusterRef.current.getBounds()
        if (clusterBounds.isValid()) {
          mapInstance.current.fitBounds(clusterBounds.pad(0.1), {
            animate: true,
            duration: 0.5,
            maxZoom: 15
          })
          return
        }
      }
      if (filteredMarkersByTags.length > 0) {
        const bounds = L.latLngBounds(
          filteredMarkersByTags.map(marker => [marker.lat, marker.lng] as [number, number])
        )
        if (bounds.isValid()) {
          mapInstance.current.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15,
            animate: true,
            duration: 0.5
          })
        }
      }
    } catch (error) {
      console.error('Error adjusting map to filtered markers:', error)
    }
  }, [filteredMarkersByTags, mapLoaded])

  // Auto-adjust map view when tags are selected/deselected
  React.useEffect(() => {
    if (!mapLoaded || !markerClusterRef.current) return

    if (selectedTags.size > 0 && filteredMarkersByTags.length > 0) {
      const timer = setTimeout(() => {
        adjustMapToFilteredMarkers()
      }, 300)
      return () => clearTimeout(timer)
    } else if (selectedTags.size === 0 && markers.length > 0) {
      // Reset to show all markers when filters are cleared
      const timer = setTimeout(() => {
        if (markerClusterRef.current && mapInstance.current) {
          const clusterBounds = markerClusterRef.current.getBounds()
          if (clusterBounds.isValid()) {
            mapInstance.current.fitBounds(clusterBounds.pad(0.15), {
              animate: true,
              duration: 0.5,
              maxZoom: 13,
              padding: [40, 40]
            })
          }
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [selectedTags, filteredMarkersByTags, mapLoaded, adjustMapToFilteredMarkers, markers.length])
  
  // Listen for polygon edit mode toggle from ManageTabContent
  useEffect(() => {
    const handleEditModeToggle = (e: CustomEvent) => {
      const enabled = e.detail.enabled
      
      // Disable map dragging when edit mode is on
      if (mapInstance.current) {
        if (enabled) {
          // Disable map dragging and zoom behaviors
          mapInstance.current.dragging.disable()
          mapInstance.current.doubleClickZoom.disable()
          if (mapInstance.current.boxZoom) {
            mapInstance.current.boxZoom.disable()
          }
          console.log('🔷 Edit Mode ON - Map dragging and box zoom disabled')
        } else {
          // Re-enable map dragging and zoom behaviors
          mapInstance.current.dragging.enable()
          mapInstance.current.doubleClickZoom.enable()
          if (mapInstance.current.boxZoom) {
            mapInstance.current.boxZoom.enable()
          }
          console.log('🔷 Edit Mode OFF - Map dragging and box zoom enabled')
        }
      }
    }
    
    window.addEventListener('polygonEditModeToggle', handleEditModeToggle as EventListener)
    return () => {
      window.removeEventListener('polygonEditModeToggle', handleEditModeToggle as EventListener)
    }
  }, [mapInstance])
  
  // Handle polygon edit callback
  const handlePolygonEdit = async (polygonId: string, coordinates: Array<{lat: number, lng: number}>) => {
    if (!user || !currentMap) return
    
    try {
      console.log('🔷 Saving edited polygon:', polygonId, coordinates.length)
      const { updateMapPolygon } = await import('../firebase/maps')
      await updateMapPolygon(user.uid, currentMap.id, polygonId, {
        coordinates
      })
      
      console.log('✅ Polygon edited successfully')
    } catch (error) {
      console.error('Error editing polygon:', error)
    }
  }

  // Use the polygon loader hook for consistent polygon loading
  const polygonLoaderResult = usePolygonLoader({
    mapInstance: mapInstance.current,
    mapLoaded,
    userId: user?.uid || '',
    mapId: currentMap?.id || '',
    activeTab,
    onPolygonEdit: handlePolygonEdit
  })
  
  // Expose save function via custom event for ManageTabContent
  useEffect(() => {
    if (polygonLoaderResult?.saveAllUnsavedPolygons) {
      const handleSaveAll = () => {
        const savedCount = polygonLoaderResult.saveAllUnsavedPolygons()
        if (savedCount > 0) {
          console.log('✅ Saved', savedCount, 'polygon(s) to Firestore')
        }
      }
      window.addEventListener('saveAllPolygons', handleSaveAll)
      return () => {
        window.removeEventListener('saveAllPolygons', handleSaveAll)
      }
    }
  }, [polygonLoaderResult])
  
  // Use filtered markers by tags if tags are selected, otherwise use all visible markers
  const visibleMarkers = useMemo(() => {
    const baseMarkers = selectedTags.size > 0 ? filteredMarkersByTags : markers
    return baseMarkers.filter(marker => marker.visible !== false)
  }, [markers, selectedTags, filteredMarkersByTags])
  
  // Determine if this is a shared map or owned map
  const isOwnedMap = currentMap && user ? isMapOwnedByUser(currentMap, user.uid, user.email) : true
  
  // For owned maps: validate against owner's plan (current behavior)
  // For shared maps: allow shared user to use their own permissions without disabling the map
  const mapValidation = isOwnedMap 
    ? validateMapAgainstPlan(markers, mapSettings, currentPlan, folderIcons)
    : { isValid: true, premiumFeaturesUsed: [] } // Always allow shared maps
  
  // Proper validation: Disable maps that use premium features without proper subscription
  const isMapDisabled = !mapValidation.isValid
  
  console.log('📍 Map component - visibleMarkers:', {
    isPublishMode,
    dashboardMarkersCount: markers.length,
    visibleMarkersCount: visibleMarkers.length,
    visibleMarkers: visibleMarkers,
    isMapDisabled,
    maxMarkersPerMap: planLimits.maxMarkersPerMap,
    isOwnedMap,
    currentPlan
  })

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Find nearby markers within 5km radius
  const findNearbyMarkers = (userLat: number, userLng: number): Marker[] => {
    return visibleMarkers.filter(marker => {
      const distance = calculateDistance(userLat, userLng, marker.lat, marker.lng)
      return distance <= 5 // 5km radius
    }).sort((a, b) => {
      const distanceA = calculateDistance(userLat, userLng, a.lat, a.lng)
      const distanceB = calculateDistance(userLat, userLng, b.lat, b.lng)
      return distanceA - distanceB
    })
  }

  // Calculate optimal zoom level to frame a 5km radius circle
  const getOptimalZoomForCircle = (): number => {
    // For a 5km radius circle, we want to show it with some padding
    // This gives us a good view of the circle with surrounding context
    return 11 // This level works well for 5km radius circles
  }

  // Enhanced location functionality
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.')
      return
    }

    // Set flag to prevent fitBounds during location setting
    setIsSettingLocation(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        
        // Find nearby markers
        const nearby = findNearbyMarkers(latitude, longitude)
        setNearbyMarkers(nearby)
        setShowNearbyPlaces(true)
        setLocationModeActive(true)
        
        // Center map on user location with 5km radius
        if (mapInstance.current) {
          // Calculate optimal zoom level to properly frame the 5km circle
          const optimalZoom = getOptimalZoomForCircle()
          mapInstance.current.setView([latitude, longitude], optimalZoom)
          
          // Add blue circle to show 5km radius
          // Remove existing circles
          if (userLocationCircleRef.current) {
            mapInstance.current.removeLayer(userLocationCircleRef.current)
          }
          if (userLocationPulseRef.current) {
            mapInstance.current.removeLayer(userLocationPulseRef.current)
          }
          
          // Create main radius circle with cool effects
          userLocationCircleRef.current = L.circle([latitude, longitude], {
            radius: 5000, // 5km in meters
            color: '#ff3670',
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 2,
            dashArray: '12, 8'
          }).addTo(mapInstance.current)
          
          // Add pulsing inner circle
          userLocationPulseRef.current = L.circle([latitude, longitude], {
            radius: 5000,
            color: '#ff3670',
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 1,
            dashArray: '6, 6'
          }).addTo(mapInstance.current)
          
          // Add CSS animation for breathing effect (same as PublicMap)
          const pulseElement = userLocationPulseRef.current.getElement() as HTMLElement
          if (pulseElement) {
            setTimeout(() => {
              pulseElement.style.animation = 'soft-breathing-glow 3s ease-in-out infinite'
              pulseElement.classList.add('soft-breathing-glow-animation')
              console.log('🎯 Soft breathing glow animation applied to dashboard location circle')
            }, 100)
          } else {
            console.error('❌ Could not get circle element for animation')
          }
          
        }
        
        // Reset flag after a short delay to allow map to settle
        setTimeout(() => {
          setIsSettingLocation(false)
        }, 500)
        
        // Call the parent's location handler
        onGetCurrentLocation()
        
        console.log('Found', nearby.length, 'nearby markers within 5km')
      },
      (error) => {
        console.error('Geolocation error:', error)
        setIsSettingLocation(false)
        // Still call parent handler for error handling
        onGetCurrentLocation()
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    )
  }

  // Clear location circle and reset location mode
  const clearLocationMode = () => {
    if (mapInstance.current && userLocationCircleRef.current) {
      mapInstance.current.removeLayer(userLocationCircleRef.current)
      userLocationCircleRef.current = null
    }
    if (mapInstance.current && userLocationPulseRef.current) {
      mapInstance.current.removeLayer(userLocationPulseRef.current)
      userLocationPulseRef.current = null
    }
    setLocationModeActive(false)
    setShowNearbyPlaces(false)
    setNearbyMarkers([])
  }

  // Search functionality
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    // Use filtered markers by tags if tags are selected
    const markersToSearch = selectedTags.size > 0 ? filteredMarkersByTags : markers
    const filteredMarkersToUse = markersToSearch.filter(marker => 
      marker.name.toLowerCase().includes(term.toLowerCase()) ||
      marker.address.toLowerCase().includes(term.toLowerCase())
    )
    
    if (term.trim()) {
      setSearchResults(filteredMarkersToUse)
    } else {
      setSearchResults(markersToSearch) // Show all markers when search is cleared
    }
  }

  const navigateToMarker = (marker: Marker) => {
    if (mapInstance.current) {
      mapInstance.current.setView([marker.lat, marker.lng], 16)
      
      // Open popup for the marker
      const markerInstance = markersRef.current.find(m => 
        m.getLatLng().lat === marker.lat && m.getLatLng().lng === marker.lng
      )
      if (markerInstance) {
        markerInstance.openPopup()
      }
    }
  }

  // Initialize search results when markers are loaded
  useEffect(() => {
    if (markers.length > 0) {
      setSearchResults(markers)
    }
  }, [markers])

  // Get marker icon based on type


  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return

    // Only skip re-initialization if map is loaded AND we're not switching modes
    // This prevents re-initialization on state changes but allows proper initialization
    if (mapInstance.current && mapLoaded) {
      // Check if we're switching publish mode - if so, allow re-initialization
      const storedPublishMode = (mapInstance.current as any)._pinzPublishMode
      const isCurrentlyPublishMode = storedPublishMode === isPublishMode
      
      // Only skip if the publish mode matches (i.e., we're not switching modes)
      if (isCurrentlyPublishMode || (storedPublishMode === undefined && !isPublishMode)) {
        console.log('Map already initialized and loaded with same mode, skipping re-initialization')
        return
      }
      
      // If we're switching modes, allow re-initialization by continuing to cleanup
      console.log('Switching publish mode, re-initializing map')
    }

    // Clean up existing map instance if it exists (only if not loaded)
    if (mapInstance.current) {
      console.log('Cleaning up existing map instance')
      
      // Clear polygon layers
      polygonLayersRef.current.forEach(layer => {
        if (mapInstance.current && mapInstance.current.hasLayer(layer)) {
          mapInstance.current.removeLayer(layer)
        }
      })
      polygonLayersRef.current = []
      
      mapInstance.current.remove()
      mapInstance.current = null
      setMapLoaded(false)
    }

    console.log('Initializing Leaflet map...', 'isPublishMode:', isPublishMode)
    
    mapInstance.current = L.map(mapRef.current, {
      center: [45.5017, -73.5673],
      zoom: 10,
      attributionControl: false,
      zoomControl: false,
      zoomAnimation: true,
      fadeAnimation: false, // Disable fade animations to prevent flashing
      markerZoomAnimation: true,
      // Fix tile flashing during zoom
      preferCanvas: false,
      zoomAnimationThreshold: 4,
      // Additional options to prevent flashing
      worldCopyJump: false,
      maxBoundsViscosity: 1.0
    })

    // Add simple tile layer
    tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
      // More aggressive tile flashing prevention
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 3,
      updateInterval: 100,
      // Disable tile fade animations
      noWrap: false,
      bounds: undefined
    }).addTo(mapInstance.current)

    // Store publish mode flag on map instance for comparison
    ;(mapInstance.current as any)._pinzPublishMode = isPublishMode
    
    mapInstance.current.whenReady(() => {
      console.log('Leaflet map loaded successfully')
      setMapLoaded(true)
      
      // Add debugging for zoom events
      if (mapInstance.current) {
        mapInstance.current.on('zoomstart', () => {
          console.log('🔍 Zoom start - tiles should not update')
        })
        
        mapInstance.current.on('zoomend', () => {
          console.log('🔍 Zoom end - tiles can update now')
        })
        
        mapInstance.current.on('movestart', () => {
          console.log('📍 Move start')
        })
        
        mapInstance.current.on('moveend', () => {
          console.log('📍 Move end')
        })
      }
      
      // Initialize marker cluster group with user's clustering settings
      const iconCreateFunction = function(cluster: any) {
        const childCount = cluster.getChildCount()
        let className = 'marker-cluster marker-cluster-'
        let size = 35
        
        if (childCount < 10) {
          className += 'small'
          size = 35
        } else if (childCount < 100) {
          className += 'medium'
          size = 45
        } else {
          className += 'large'
          size = 55
        }
        
        // Use user's chosen marker color for clusters
        const clusterBg = mapSettings.markerColor || '#3B82F6'
        const clusterBorder = '#ffffff'
        
        return L.divIcon({
          html: `<div class="${className}" style="background: ${clusterBg} !important; border-color: ${clusterBorder} !important; color: #ffffff !important;"><span>${childCount}</span></div>`,
          className: '',
          iconSize: L.point(size, size),
          iconAnchor: L.point(size / 2, size / 2)
        })
      }
      
      const clusterOptions = createClusterOptions(mapSettings, iconCreateFunction)
      console.log('🎨 Map.tsx: Initial cluster group creation:', {
        clusteringEnabled: mapSettings.clusteringEnabled,
        clusterRadius: mapSettings.clusterRadius,
        clusterOptions: clusterOptions ? 'enabled' : 'disabled'
      })
      
      if (clusterOptions) {
        markerClusterRef.current = (L as any).markerClusterGroup(clusterOptions)
      } else {
        // Clustering disabled - create empty cluster group that won't cluster
        markerClusterRef.current = (L as any).markerClusterGroup({
          disableClusteringAtZoom: 0, // Disable clustering at all zoom levels
          iconCreateFunction
        })
      }
      
      // Add cluster group to map
      if (mapInstance.current && markerClusterRef.current) {
        mapInstance.current.addLayer(markerClusterRef.current)
      }
      
      // Forcefully remove any remaining controls
      if (mapInstance.current) {
        // Remove any other default controls
        const controlContainer = mapInstance.current.getContainer().querySelector('.leaflet-control-container')
        if (controlContainer) {
          (controlContainer as any).style.display = 'none'
        }
      }
    })
  }, [isPublishMode])

  // Update cluster group when mapSettings change
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current) return

    console.log('🎨 Map.tsx: Updating cluster group with settings:', {
      clusteringEnabled: mapSettings.clusteringEnabled,
      clusterRadius: mapSettings.clusterRadius,
      markerColor: mapSettings.markerColor,
      isPublishMode
    })

    // Remove old cluster group
    mapInstance.current.removeLayer(markerClusterRef.current)
    
    // Create new cluster group with updated settings
    const iconCreateFunction = function(cluster: any) {
      const childCount = cluster.getChildCount()
      let className = 'marker-cluster marker-cluster-'
      let size = 35
      
      if (childCount < 10) {
        className += 'small'
        size = 35
      } else if (childCount < 100) {
        className += 'medium'
        size = 45
      } else {
        className += 'large'
        size = 55
      }
      
      // Use user's chosen marker color for clusters
      const clusterBg = mapSettings.markerColor || '#3B82F6'
      const clusterBorder = '#ffffff'
      
      return L.divIcon({
        html: `<div class="${className}" style="background: ${clusterBg} !important; border-color: ${clusterBorder} !important; color: #ffffff !important;"><span>${childCount}</span></div>`,
        className: '',
        iconSize: L.point(size, size),
        iconAnchor: L.point(size / 2, size / 2)
      })
    }
    
    const clusterOptions = createClusterOptions(mapSettings, iconCreateFunction)
    console.log('🎨 Map.tsx: Cluster options result:', {
      clusteringEnabled: mapSettings.clusteringEnabled,
      clusterRadius: mapSettings.clusterRadius,
      clusterOptions: clusterOptions ? 'enabled' : 'disabled'
    })
    if (clusterOptions) {
      markerClusterRef.current = (L as any).markerClusterGroup(clusterOptions)
    } else {
      // Clustering disabled - create empty cluster group that won't cluster
      markerClusterRef.current = (L as any).markerClusterGroup({
        disableClusteringAtZoom: 0, // Disable clustering at all zoom levels
        iconCreateFunction
      })
    }
    
    // Add new cluster group to map
    mapInstance.current.addLayer(markerClusterRef.current)
    
    // Re-add existing markers to the new cluster group
    if (markersRef.current.length > 0) {
      markersRef.current.forEach(marker => {
        markerClusterRef.current.addLayer(marker)
      })
    }
  }, [mapSettings.markerColor, mapSettings.clusteringEnabled, mapSettings.clusterRadius, mapLoaded])

  // Force map resize when switching to embed preview mode or when dimensions change
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return
    
    // Force map to resize when switching to embed preview mode or dimensions change
    if (isPublishMode) {
      // Use multiple timeouts to ensure map resizes properly after container resize
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize()
        }
      }, 100)
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize()
        }
      }, 300)
    }
  }, [isPublishMode, mapLoaded, iframeDimensions.width, iframeDimensions.height])

  // Update map style based on settings
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return

    console.log('🎨 Updating map style:', mapSettings.style, 'isPublishMode:', isPublishMode, 'mapLoaded:', mapLoaded)

    // Show loading indicator for satellite tiles
    if (mapSettings.style === 'satellite') {
      setIsLoadingTiles(true)
    }

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    let tileOptions = {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      // More aggressive tile flashing prevention
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 3,
      updateInterval: 100,
      // Disable tile fade animations
      noWrap: false,
      bounds: undefined
    }
    
    switch (mapSettings.style) {
      case 'osm':
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        tileOptions.attribution = '© OpenStreetMap contributors'
        break
      case 'voyager':
        tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        tileOptions.attribution = '© CARTO © OpenStreetMap'
        break
      case 'dark':
        tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        tileOptions.attribution = '© OpenStreetMap contributors, © CARTO'
        break
      case 'satellite':
        // Use Esri satellite tiles which are free
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        // Optimize satellite tiles for faster loading
        tileOptions = {
          attribution: '© Esri',
          maxZoom: 18,
          // More aggressive tile flashing prevention
          updateWhenZooming: false,
          updateWhenIdle: true,
          keepBuffer: 3,
          updateInterval: 100,
          // Disable tile fade animations
          noWrap: false,
          bounds: undefined
        }
        break
      case 'light':
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        tileOptions.attribution = '© OpenStreetMap contributors © CARTO'
        break
      case 'toner':
        // Use light tiles and apply CSS filters for toner effect
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        tileOptions = {
          attribution: '© OpenStreetMap contributors © CARTO',
          // Apply toner-like CSS filter
          className: 'toner-filter'
        } as any
        break
      case 'topo':
        tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        tileOptions.attribution = '© OpenStreetMap contributors, © OpenTopoMap'
        break
      default:
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        tileOptions.attribution = '© OpenStreetMap contributors © CARTO'
        break
    }

    console.log('🎨 Switching to tile URL:', tileUrl)

    // Remove old tile layer and add new one
    if (tileLayerRef.current) {
      mapInstance.current.removeLayer(tileLayerRef.current)
    }
    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions).addTo(mapInstance.current)
    
    // Note: Toner style uses dark tiles (same as dark but different name for legacy support)

    // Hide loading indicator when tiles are loaded
    if (mapSettings.style === 'satellite') {
      tileLayerRef.current.on('load', () => {
        setIsLoadingTiles(false)
      })
    } else {
      setIsLoadingTiles(false)
    }
  }, [mapSettings.style, mapLoaded, isPublishMode])

  // Update markers
  useEffect(() => {
    console.log('📍 Markers update effect triggered:', {
      mapInstance: !!mapInstance.current,
      mapLoaded,
      markerClusterRef: !!markerClusterRef.current,
      visibleMarkersCount: visibleMarkers.length,
      isPublishMode,
      isMapDisabled
    })
    
    // Only disable markers in publish mode (embed preview), not in manage tab
    const shouldDisableMarkers = isPublishMode && isMapDisabled
    
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current || shouldDisableMarkers) {
      console.log('📍 Skipping markers update - missing requirements or map disabled in publish mode:', {
        mapInstance: !!mapInstance.current,
        mapLoaded,
        markerCluster: !!markerClusterRef.current,
        isPublishMode,
        isMapDisabled,
        shouldDisableMarkers
      })
      return
    }

    console.log('📍 Updating markers with clustering:', visibleMarkers.length)

    // Clear existing markers from cluster group
    markerClusterRef.current.clearLayers()
    markersRef.current = []

    // Add new markers to cluster group
    visibleMarkers.forEach(marker => {
      // Check if marker belongs to a folder with custom icon
      const markerRenamedName = applyNameRules(marker.name, mapSettings.nameRules || [], true)
      
      // Try to find folder icon with case-insensitive matching
      let folderIconUrl = folderIcons[markerRenamedName]
      if (!folderIconUrl) {
        // Try case-insensitive matching
        const availableKeys = Object.keys(folderIcons)
        const matchingKey = availableKeys.find(key => 
          key.toLowerCase() === markerRenamedName.toLowerCase() ||
          markerRenamedName.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(markerRenamedName.toLowerCase())
        )
        if (matchingKey) {
          folderIconUrl = folderIcons[matchingKey]
        }
      }
      
      // Create marker using unified utility that respects ALL user settings
      // Use 24px for publish mode (embed preview), otherwise use user's size setting
      const overrideSize = isPublishMode ? 24 : undefined
      const markerData = createMarkerHTML({ mapSettings, markerSize: overrideSize, folderIconUrl })
      const markerHtml = markerData.html
      const iconSize = markerData.iconSize
      const iconAnchor = markerData.iconAnchor

      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: markerHtml,
        iconSize: iconSize as [number, number],
        iconAnchor: iconAnchor as [number, number]
      })

      const markerInstance = L.marker([marker.lat, marker.lng], { icon: customIcon })
        .bindPopup(`
          <div style="padding: 8px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 600; color: #000; font-size: 14px; margin: 0 0 4px 0;">${applyNameRules(marker.name, mapSettings.nameRules, true)}</div>
            <div style="color: #666; font-size: 12px; margin: 0;">${formatAddressForPopup(marker.address)}</div>
          </div>
        `)

      // Add marker to cluster group instead of directly to map
      markerClusterRef.current.addLayer(markerInstance)
      markersRef.current.push(markerInstance)
    })

    // Fit bounds to show all markers using cluster group
    // Skip fitBounds if location mode is active OR if location is currently being set
    if (visibleMarkers.length > 0 && markerClusterRef.current && !locationModeActive && !isSettingLocation) {
      // Don't invalidate size here if map is already loaded to prevent unnecessary reloads
      if (mapLoaded) {
        mapInstance.current.fitBounds(markerClusterRef.current.getBounds().pad(0.1))
      }
    }
  }, [visibleMarkers, mapLoaded, mapSettings, folderIcons, isPublishMode, isMapDisabled, locationModeActive, isSettingLocation])

  // Clear markers when map becomes disabled in publish mode
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current) return
    
    const shouldDisableMarkers = isPublishMode && isMapDisabled
    
    if (shouldDisableMarkers) {
      console.log('📍 Clearing markers due to map disabled in publish mode')
      markerClusterRef.current.clearLayers()
      markersRef.current = []
    }
  }, [isPublishMode, isMapDisabled, mapLoaded])

  // Update user location marker - REMOVED: No automatic location marker display
  // User location is only shown when location mode is actively requested by the user

  // Polygon loading is now handled by the usePolygonLoader hook above

  // Initialize Leaflet Draw for polygon drawing
  useEffect(() => {
    console.log('🔷 Polygon drawing useEffect:', {
      mapInstance: !!mapInstance.current,
      mapLoaded,
      showPolygonDrawing: _showPolygonDrawing,
      shouldInit: !!mapInstance.current && mapLoaded && _showPolygonDrawing
    })
    
    if (!mapInstance.current || !mapLoaded || !_showPolygonDrawing) return
    
    console.log('🔷 Initializing Leaflet Draw controls...')

    // Initialize draw control
    if (!drawControlRef.current) {
      drawnItemsRef.current = new L.FeatureGroup()
      mapInstance.current.addLayer(drawnItemsRef.current)

      const drawOptions: L.Control.DrawConstructorOptions = {
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true
          },
          rectangle: {},
          circle: {},
          marker: false,
          polyline: false,
          circlemarker: false
        },
        edit: {
          featureGroup: drawnItemsRef.current!,
          remove: false,
          edit: {
            selectedPathOptions: {
              color: '#ff0000',
              weight: 3
            }
          }
        }
      }
      
      // Enable snapping if available
      if ((window as any).L && (window as any).L.handler && (window as any).L.handler.PolylineSnap) {
        console.log('🔷 Leaflet Snap plugin detected')
      }

      drawControlRef.current = new L.Control.Draw(drawOptions)
      mapInstance.current.addControl(drawControlRef.current)
      console.log('🔷 Leaflet Draw control added to map')
      
      // Listen for draw:editstart event to know when edit mode is triggered
      mapInstance.current.on('draw:editstart', () => {
        console.log('🔷 Leaflet.draw edit started')
      })
      
      mapInstance.current.on('draw:editstop', () => {
        console.log('🔷 Leaflet.draw edit stopped')
      })
      
      // Check and style the toolbar
      setTimeout(function() {
        const toolbar = document.querySelector('.leaflet-draw-toolbar')
        if (toolbar) {
          console.log('🔷 Draw toolbar found in DOM:', toolbar)
          console.log('🔷 Draw toolbar classes:', toolbar.className)
          console.log('🔷 Draw toolbar computed styles:', window.getComputedStyle(toolbar as Element))
          
          const htmlEl = toolbar as HTMLElement
          htmlEl.style.display = 'block'
          htmlEl.style.visibility = 'visible'
          htmlEl.style.opacity = '1'
          htmlEl.style.zIndex = '10000'
          htmlEl.style.position = 'absolute'
          htmlEl.style.top = '10px'
          htmlEl.style.left = '20px'
          console.log('🔷 Draw toolbar styled and should be visible')
        } else {
          console.log('⚠️ Draw toolbar NOT found in DOM')
        }
        
        // Check for collapsed toolbar
        const collapsed = document.querySelector('.leaflet-draw-toolbar.collapsed')
        if (collapsed) {
          console.log('🔷 Found collapsed toolbar, removing collapsed class')
          collapsed.classList.remove('collapsed')
        } else {
          console.log('🔷 No collapsed class found on toolbar')
        }
        
        // Force expand all sections and show all buttons
        const sections = document.querySelectorAll('.leaflet-draw-toolbar')
        console.log('🔷 Found', sections.length, 'toolbar sections')
        sections.forEach((section: any) => {
          section.classList.remove('leaflet-draw-toolbar-collapsed')
          section.style.height = 'auto'
          section.style.display = 'block'
        })
        
        // Show ALL the action buttons
        const allButtons = document.querySelectorAll('.leaflet-draw-toolbar a')
        console.log('🔷 Found', allButtons.length, 'drawing buttons')
        allButtons.forEach((button: any) => {
          button.style.display = 'block'
          button.style.visibility = 'visible'
          button.style.opacity = '1'
          button.style.pointerEvents = 'auto'
        })
        
        console.log('🔷 All buttons should now be visible')
      }, 500)
    }

    // Handle draw:created event
    const handleDrawCreated = (e: any) => {
      const { layerType, layer } = e

      // Extract coordinates based on layer type
      let coords: any = null
      let type = 'polygon'

      if (layerType === 'circle') {
        const circle = layer as L.Circle
        coords = circle
        type = 'circle'
      } else if (layerType === 'rectangle') {
        const rect = layer as L.Rectangle
        coords = rect
        type = 'rectangle'
      } else if (layerType === 'polygon') {
        const polygon = layer as L.Polygon
        coords = (polygon.getLatLngs()[0] as L.LatLng[])
        type = 'polygon'
      }

      // Store the drawn layer and type
      setPendingPolygonData({ type, coords })
      setShowPolygonModal(true)

      // Remove the drawn layer from the map (we'll add it back with saved styles)
      if (drawnItemsRef.current) {
        drawnItemsRef.current.removeLayer(layer)
      }
    }

    mapInstance.current.on('draw:created', handleDrawCreated)

    // Cleanup
    return () => {
      if (mapInstance.current && drawControlRef.current) {
        mapInstance.current.off('draw:created', handleDrawCreated)
        mapInstance.current.removeControl(drawControlRef.current)
        drawControlRef.current = null
        if (drawnItemsRef.current) {
          mapInstance.current.removeLayer(drawnItemsRef.current)
          drawnItemsRef.current = null
        }
      }
    }
  }, [mapLoaded, _showPolygonDrawing])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        // Remove circles if they exist
        if (userLocationCircleRef.current) {
          mapInstance.current.removeLayer(userLocationCircleRef.current)
        }
        if (userLocationPulseRef.current) {
          mapInstance.current.removeLayer(userLocationPulseRef.current)
        }
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  console.log('Map component rendering, markers:', markers, 'mapLoaded:', mapLoaded, 'userLocation:', userLocation)
  console.log('Debug - isMobile:', isMobile, 'showEmbedMobileResults:', showEmbedMobileResults)

  // Handle polygon modal submission
  const handlePolygonSubmit = async (polygonProps: any) => {
    if (!user || !currentMap || !pendingPolygonData) return

    try {
      // Extract coordinates based on the drawn layer type
      let coordinates: number[][] = []
      let center: { lat: number, lng: number } | undefined
      let radius: number | undefined

      if (pendingPolygonData.type === 'circle') {
        const circle = pendingPolygonData.coords as L.Circle
        center = { lat: circle.getLatLng().lat, lng: circle.getLatLng().lng }
        radius = circle.getRadius()
      } else if (pendingPolygonData.type === 'polygon') {
        const latlngs = pendingPolygonData.coords as L.LatLng[]
        coordinates = latlngs.map(latlng => [latlng.lat, latlng.lng])
      } else if (pendingPolygonData.type === 'rectangle') {
        const bounds = (pendingPolygonData.coords as L.Rectangle).getBounds()
        coordinates = [
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()],
          [bounds.getSouth(), bounds.getEast()],
          [bounds.getSouth(), bounds.getWest()]
        ]
      }

      const polygonData: any = {
        name: polygonProps.name,
        description: polygonProps.description,
        type: pendingPolygonData.type as 'polygon' | 'rectangle' | 'circle',
        fillColor: polygonProps.fillColor,
        fillOpacity: polygonProps.fillOpacity,
        strokeColor: polygonProps.strokeColor,
        strokeWeight: polygonProps.strokeWeight,
        strokeOpacity: polygonProps.strokeOpacity,
        visible: true,
        category: polygonProps.category,
        properties: polygonProps.properties
      }
      
      // Only add coordinates if not empty (for polygons/rectangles)
      // Convert nested array to array of objects for Firestore compatibility
      if (coordinates.length > 0) {
        polygonData.coordinates = coordinates.map((coord: number[]) => ({
          lat: coord[0],
          lng: coord[1]
        }))
      }
      
      // Only add center and radius for circles
      if (center) {
        polygonData.center = center
      }
      if (radius !== undefined) {
        polygonData.radius = radius
      }

      // Import and call the save function
      const { addPolygonToMap } = await import('../firebase/maps')
      await addPolygonToMap(user.uid, currentMap.id, polygonData)
      
      setShowPolygonModal(false)
      setPendingPolygonData(null)
    } catch (error) {
      console.error('Error saving polygon:', error)
    }
  }

  return (
    <div className={`flex-1 bg-gray-100 relative ${isPublishMode ? 'publish-mode overflow-visible' : ''}`}>
      {/* Drawing Mode Banner */}
      {_showPolygonDrawing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[10001] bg-pinz-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <Shapes className="w-5 h-5" />
          <div>
            <p className="font-semibold text-sm">Drawing Mode Active</p>
            <p className="text-xs opacity-90">Use the tools in the top-left corner to draw</p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('🔷 Canceling drawing mode from banner')
              // Emit event or callback to parent to turn off drawing mode
              window.dispatchEvent(new CustomEvent('cancelDrawingMode'))
            }}
            className="ml-4 text-white hover:text-pinz-200 transition-colors"
            title="Cancel drawing"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      
      {/* Map Feature Level Header - Only show for shared maps */}
      {mapInheritance && !isPublishMode && (
        <MapFeatureLevelHeader 
          mapInheritance={mapInheritance} 
          onUpgrade={onOpenSubscription}
        />
      )}
      
      {isPublishMode ? (
        // Embed preview mode - full page resizable container
        <div className="w-full h-full relative overflow-visible">
          {/* Resizable Preview Container - Full Page */}
          <Rnd
            size={{ 
              width: isMobile ? Math.min(iframeDimensions.width, window.innerWidth - 32) : iframeDimensions.width, 
              height: isMobile ? Math.min(iframeDimensions.height, window.innerHeight - 100) : iframeDimensions.height 
            }}
            position={{ x: isMobile ? 16 : 0, y: isMobile ? 16 : 0 }}
            minWidth={isMobile ? 280 : 300}
            minHeight={isMobile ? 200 : 200}
            bounds="parent"
            onResize={(_, __, ref) => {
              const newWidth = parseInt(ref.style.width)
              const newHeight = parseInt(ref.style.height)
              onIframeDimensionsChange({ width: newWidth, height: newHeight })
              
              // Force map to resize immediately when container is resized
              if (mapInstance.current && mapLoaded) {
                setTimeout(() => {
                  if (mapInstance.current) {
                    mapInstance.current.invalidateSize()
                  }
                }, 50)
              }
            }}
            onResizeStop={() => {
              // Force map resize again when resize stops to ensure it fills the space
              if (mapInstance.current && mapLoaded) {
                setTimeout(() => {
                  if (mapInstance.current) {
                    mapInstance.current.invalidateSize()
                  }
                }, 100)
              }
            }}
            enableResizing={{
              top: !isMobile,
              right: !isMobile,
              bottom: !isMobile,
              left: !isMobile,
              topRight: !isMobile,
              bottomRight: !isMobile,
              bottomLeft: !isMobile,
              topLeft: !isMobile
            }}
            className="z-10"
            style={{
              border: '3px dashed #3B82F6',
              borderRadius: isMobile ? '8px' : '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              boxShadow: isMobile ? '0 10px 20px rgba(0, 0, 0, 0.1)' : '0 20px 40px rgba(0, 0, 0, 0.15)',
              maxWidth: isMobile ? 'calc(100vw - 32px)' : 'none',
              maxHeight: isMobile ? 'calc(100vh - 100px)' : 'none'
            }}
          >
            <div className="w-full h-full flex flex-col">
              {/* Header */}
              <div className={`flex items-center justify-between ${isMobile ? 'p-2' : 'p-3'} bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-pinz-500 rounded-full"></div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-pinz-800`}>
                    Embed Preview
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'} text-pinz-600 font-mono bg-white rounded border border-pinz-200`}>
                    {iframeDimensions.width} × {iframeDimensions.height}px
                  </div>
                  {isMobile && (
                    <button
                      onClick={() => {/* Close embed preview - would need to be passed as prop */}}
                      className="p-1 hover:bg-pinz-100 rounded transition-colors"
                      title="Close preview"
                    >
                      <X className="w-4 h-4 text-pinz-600" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Disabled Map Message - Show if limits exceeded */}
              {isMapDisabled && (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center p-6 max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Disabled</h3>
                    <p className="text-gray-600 mb-4">
                      This map uses premium features available with upgraded plans.
                    </p>
                    {mapValidation.premiumFeaturesUsed.length > 0 && (
                      <div className="text-sm text-gray-500 mb-4">
                        <p className="font-medium mb-2">Premium features used:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {mapValidation.premiumFeaturesUsed.map(feature => (
                            <li key={feature}>{getPremiumFeatureDescription(feature)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-6">
                      {onMapSettingsChange && user && currentMap && isOwnedMap && (
                        <button
                          onClick={async () => {
                            try {
                              const simplifiedSettings = ensureFreemiumCompliance(mapSettings, currentPlan)
                              console.log('🔄 Simplifying map settings:', {
                                old: mapSettings,
                                new: simplifiedSettings,
                                plan: currentPlan
                              })
                              
                              if (onMapSettingsChange) {
                                await onMapSettingsChange(simplifiedSettings)
                                
                                // Wait a moment for the state to update, then show success
                                setTimeout(() => {
                                  showToast({
                                    type: 'success',
                                    title: 'Map Simplified',
                                    message: 'Your map has been simplified to fit your current plan. You can now use it without premium features.'
                                  })
                                }, 500)
                              }
                            } catch (error) {
                              console.error('Error simplifying map:', error)
                              showToast({
                                type: 'error',
                                title: 'Error',
                                message: 'Failed to simplify map. Please try again.'
                              })
                            }
                          }}
                          className="px-4 py-2 bg-pinz-600 text-white rounded-lg hover:bg-pinz-700 transition-colors text-sm font-medium"
                        >
                          Simplify Map to Fit Plan
                        </button>
                      )}
                      {onOpenSubscription && (
                        <button
                          onClick={onOpenSubscription}
                          className="px-4 py-2 bg-white border-2 border-pinz-600 text-pinz-600 rounded-lg hover:bg-pinz-50 transition-colors text-sm font-medium"
                        >
                          Upgrade Plan
                        </button>
                      )}
                    </div>
                    {!onMapSettingsChange || !user || !currentMap || !isOwnedMap ? (
                      <p className="text-sm text-gray-500 mt-4">
                        {!user ? 'Sign in to simplify or upgrade your map.' : 
                         !currentMap ? 'Please select a map first.' :
                         !isOwnedMap ? 'Only the map owner can simplify or upgrade.' :
                         'Contact the map owner to simplify or upgrade this map.'}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
              
              {/* Map Content - Only show if not disabled */}
              {!isMapDisabled && (
                <>
                  {/* Show Results Button - Only show in mobile-sized embed preview */}
                  {isMobile && !showEmbedMobileResults && (
                <button
                  onClick={() => setShowEmbedMobileResults(true)}
                  className="absolute bottom-2 left-2 z-[1000] p-2 rounded-lg shadow-lg border bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-xl transition-all duration-200"
                  style={{
                    minWidth: '36px',
                    minHeight: '36px'
                  }}
                  title="Show locations list"
                >
                  <List className="w-4 h-4" />
                </button>
              )}
              
              {/* Mobile Results Horizontal Bar - Always show in embed preview */}
              {showEmbedMobileResults && (
                <div className="absolute bottom-3 left-3 right-3 z-[1000]">
                  {/* Close button */}
                  <div className="flex justify-end mb-1">
                    <button
                      onClick={() => setShowEmbedMobileResults(false)}
                      className="p-1.5 bg-white/90 backdrop-blur-sm text-gray-500 hover:text-gray-700 rounded-full shadow-lg hover:bg-white transition-all"
                      title="Close results"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  
                  {/* Ultra-thin horizontal scrolling results */}
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 overflow-hidden">
                    <div className="flex overflow-x-auto scrollbar-hide py-2 px-3 space-x-2">
                      {(searchTerm || locationModeActive ? searchResults : (isMapDisabled ? [] : markers.sort(() => Math.random() - 0.5))).slice(0, 30).map((marker) => (
                        <button
                          key={marker.id}
                          onClick={() => navigateToMarker(marker)}
                          className="flex-shrink-0 w-32 p-2 text-left bg-gray-50/80 hover:bg-gray-100/90 rounded-lg border border-gray-200/50 transition-all hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-xs truncate leading-tight">
                                {marker.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate mt-0.5 leading-tight">
                                {marker.address}
                              </div>
                              {userLocation && (
                                <div className="text-xs text-pinz-600 mt-0.5 leading-tight">
                                  {calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng).toFixed(1)}km
                                </div>
                              )}
                            </div>
                            <MapPin className="h-2.5 w-2.5 text-gray-400 flex-shrink-0 ml-1" />
                          </div>
                        </button>
                      ))}
                      
                      {(searchTerm || locationModeActive ? searchResults : markers).length === 0 && (
                        <div className="flex-shrink-0 w-full flex items-center justify-center py-4 text-gray-500">
                          <div className="text-center">
                            <div className="text-sm">No locations found</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Actual Map Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Only show on desktop */}
                {!isMobile && (
                  <div className="w-80 flex-shrink-0 flex flex-col" style={{ backgroundColor: mapSettings.searchBarBackgroundColor, color: mapSettings.searchBarTextColor }}>
                    {/* Search Bar */}
                    <div className="flex-shrink-0 p-3 pb-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search locations"
                          value={searchTerm}
                          onChange={(e) => handleSearch(e.target.value)}
                          className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm min-w-0"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                          {searchTerm ? (
                            <button
                              onClick={() => handleSearch('')}
                              className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded transition-colors"
                              title="Clear search"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button
                            onClick={locationModeActive ? clearLocationMode : getCurrentLocation}
                            className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
                              locationModeActive
                                ? 'text-pinz-600 hover:text-pinz-700'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                            title="Find my location"
                          >
                            <Navigation className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Tag Filter */}
                      {availableTags.length > 0 && (
                        <div className="mt-2 mb-0 transition-all duration-200 ease-in-out">
                          <PublicMapTagFilter
                            availableTags={availableTags}
                            selectedTags={selectedTags}
                            onTagToggle={toggleTagFilter}
                            onClearAll={clearTagFilters}
                            markerCounts={tagMarkerCounts}
                            mapSettings={mapSettings}
                          />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <div className="px-4 pt-1 pb-4">
                        {(() => {
                          const markersToShow = searchTerm.trim() !== '' ? searchResults : (selectedTags.size > 0 ? filteredMarkersByTags : visibleMarkers)
                          
                          const sortedMarkers = markersToShow.sort((a, b) => {
                            if (showNearbyPlaces && userLocation) {
                              const aDistance = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng)
                              const bDistance = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
                              return aDistance - bDistance
                            }
                            return a.name.localeCompare(b.name)
                          })

                          if (sortedMarkers.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm">No results found</p>
                                <p className="text-xs mt-1">Try adjusting your search</p>
                              </div>
                            )
                          }

                          return (
                            <>
                              {showNearbyPlaces && nearbyMarkers.length > 0 && (
                                <div className="mb-2 px-2 py-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-pinz-200 rounded-full flex items-center justify-center">
                                      <Navigation className="w-2 h-2 text-pinz-500" />
                                    </div>
                                    <span className="text-xs text-pinz-600 font-medium">
                                      Sorted by distance
                                    </span>
                                  </div>
                                </div>
                              )}

                              {sortedMarkers.map((marker) => {
                                const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng) : 0
                                const isNearby = nearbyMarkers.some(nearby => nearby.id === marker.id)
                                
                                return (
                                  <button
                                    key={marker.id}
                                    onClick={() => navigateToMarker(marker)}
                                    className="w-full flex items-center gap-3 p-3 transition-all duration-200 text-left rounded-lg mb-2 group"
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = mapSettings.searchBarHoverColor
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent'
                                    }}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate" style={{ color: mapSettings.searchBarTextColor }}>
                                        {applyNameRules(marker.name, mapSettings.nameRules, true)}
                                      </p>
                                      <p className="text-xs truncate" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                                        {formatAddressForList(marker.address)}
                                      </p>
                                      {(marker.tags || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {(marker.tags || []).slice(0, 2).map((tag) => (
                                            <span
                                              key={tag}
                                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-pink-100 text-pink-700 border border-pink-200"
                                            >
                                              <Tag className="w-2.5 h-2.5" />
                                              {tag}
                                            </span>
                                          ))}
                                          {(marker.tags || []).length > 2 && (
                                            <span className="text-[10px] text-gray-500 px-1">
                                              +{(marker.tags || []).length - 2}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {showNearbyPlaces && distance > 0 && (
                                        <p className="text-xs font-medium mt-1 text-pinz-600">
                                          {distance.toFixed(1)} km away
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isNearby && showNearbyPlaces && (
                                        <div className="w-2 h-2 bg-pinz-500 rounded-full"></div>
                                      )}
                                      <MapPin className="w-4 h-4 transition-colors" style={{ color: mapSettings.searchBarTextColor }} />
                                    </div>
                                  </button>
                                )
                              })}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Map */}
                <div className="flex-1 relative overflow-hidden min-w-0 min-h-0">
                  <div 
                    ref={mapRef} 
                    style={{ 
                      height: '100%', 
                      width: '100%', 
                      zIndex: 1,
                      minHeight: 0,
                      minWidth: 0
                    }} 
                    className="relative embed-map-container"
                  >
                    {/* Interactive Watermark - Only show if required by subscription */}
                    {showWatermark && (
                      <InteractiveWatermark 
                        mode="static"
                      />
                    )}
                  </div>
                  
              {/* Mobile Search Bar - Show only on mobile in embed preview */}
              {isMobile && (
                <div className="absolute top-2 left-2 right-2 z-[1000]">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search locations"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-lg text-sm"
                      style={{ fontSize: '16px' }} // Prevents zoom on iOS
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      {searchTerm ? (
                        <button
                          onClick={() => handleSearch('')}
                          className="absolute inset-y-0 right-12 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={locationModeActive ? clearLocationMode : getCurrentLocation}
                        className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors ${
                          locationModeActive
                            ? 'text-pinz-600 hover:text-pinz-700'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title={locationModeActive ? "Turn off location mode" : "Find my location"}
                      >
                        <Navigation className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
                  
                  {/* Location Button - Hidden in embed preview since mobile search bar has location button */}
                </div>
              </div>
                </>
              )}
            </div>
          </Rnd>
        </div>
      ) : (
        // Regular dashboard mode - use existing layout
        <>
          <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} className="relative">
            {/* Interactive Watermark - Only show if required by subscription */}
            {showWatermark && (
              <InteractiveWatermark 
                mode="dashboard"
                onUpgrade={onOpenSubscription}
              />
            )}
          </div>
          {isLoadingTiles && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 z-10">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-700">Loading satellite imagery...</span>
            </div>
          )}
          {/* Store Locator List - Only show on Edit tab */}
          {activeTab === 'edit' && (
            <>
              <div className="absolute top-0 left-0 z-10 w-80 h-full flex flex-col" style={{ backgroundColor: mapSettings.searchBarBackgroundColor, color: mapSettings.searchBarTextColor }}>
                {/* Search Bar */}
                <div className="flex-shrink-0 p-3 pb-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search locations"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm min-w-0"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                      {searchTerm ? (
                        <button
                          onClick={() => handleSearch('')}
                          className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Clear search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={locationModeActive ? clearLocationMode : getCurrentLocation}
                        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
                          locationModeActive
                            ? 'text-pinz-600 hover:text-pinz-700'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title="Find my location"
                      >
                        <Navigation className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Tag Filter */}
                  {availableTags.length > 0 && (
                    <div className="mt-2 mb-0 transition-all duration-200 ease-in-out">
                      <PublicMapTagFilter
                        availableTags={availableTags}
                        selectedTags={selectedTags}
                        onTagToggle={toggleTagFilter}
                        onClearAll={clearTagFilters}
                        markerCounts={tagMarkerCounts}
                        mapSettings={mapSettings}
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="px-4 pt-1 pb-4">
                    {(() => {
                      // Determine which markers to show
                      const markersToShow = searchTerm.trim() !== '' ? searchResults : (selectedTags.size > 0 ? filteredMarkersByTags : visibleMarkers)
                      
                      // Sort markers
                      const sortedMarkers = markersToShow.sort((a, b) => {
                        // If location mode is active, sort by distance
                        if (showNearbyPlaces && userLocation) {
                          const aDistance = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng)
                          const bDistance = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
                          return aDistance - bDistance
                        }
                        // Otherwise sort alphabetically
                        return a.name.localeCompare(b.name)
                      })

                      if (sortedMarkers.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">No results found</p>
                            <p className="text-xs mt-1">Try adjusting your search</p>
                          </div>
                        )
                      }

                      return (
                        <>
                          {/* Location status header */}
                          {showNearbyPlaces && nearbyMarkers.length > 0 && (
                            <div className="mb-2 px-2 py-1">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-pinz-200 rounded-full flex items-center justify-center">
                                  <Navigation className="w-2 h-2 text-pinz-500" />
                                </div>
                                <span className="text-xs text-pinz-600 font-medium">
                                  Sorted by distance
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Marker list */}
                          {sortedMarkers.map((marker) => {
                            const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng) : 0
                            const isNearby = nearbyMarkers.some(nearby => nearby.id === marker.id)
                            
                            return (
                              <button
                                key={marker.id}
                                onClick={() => navigateToMarker(marker)}
                                className="w-full flex items-center gap-3 p-3 transition-all duration-200 text-left rounded-lg mb-2 group"
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = mapSettings.searchBarHoverColor
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: mapSettings.searchBarTextColor }}>
                                    {applyNameRules(marker.name, mapSettings.nameRules, true)}
                                  </p>
                                  <p className="text-xs truncate" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                                    {formatAddressForList(marker.address)}
                                  </p>
                                  {/* Show tags */}
                                  {(marker.tags || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {(marker.tags || []).slice(0, 2).map((tag) => (
                                        <span
                                          key={tag}
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-pink-100 text-pink-700 border border-pink-200"
                                        >
                                          <Tag className="w-2.5 h-2.5" />
                                          {tag}
                                        </span>
                                      ))}
                                      {(marker.tags || []).length > 2 && (
                                        <span className="text-[10px] text-gray-500 px-1">
                                          +{(marker.tags || []).length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {/* Show distance when location mode is active */}
                                  {showNearbyPlaces && distance > 0 && (
                                    <p className="text-xs font-medium mt-1 text-pinz-600">
                                      {distance.toFixed(1)} km away
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isNearby && showNearbyPlaces && (
                                    <div className="w-2 h-2 bg-pinz-500 rounded-full"></div>
                                  )}
                                  <MapPin className="w-4 h-4 transition-colors" style={{ color: mapSettings.searchBarTextColor }} />
                                </div>
                              </button>
                            )
                          })}
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
              
              {/* Language Toggle */}
              <LanguageToggle 
                language={language} 
                onLanguageChange={setLanguage}
                isMobile={isMobile}
                showToggle={true}
              />
            </>
          )}
          {locationError && (
               <div className="absolute top-16 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm z-10 max-w-xs">
                 <div className="font-semibold">Location Error</div>
                 <div className="text-xs mt-1">{locationError}</div>
               </div>
             )}
             {/* Location Button - Positioned below LanguageToggle */}
             <button
               onClick={locationModeActive ? clearLocationMode : getCurrentLocation}
               className={`absolute top-16 right-4 z-[1000] p-3 rounded-lg shadow-lg border transition-all duration-200 ${
                 locationModeActive
                   ? 'bg-pinz-50 hover:bg-pinz-100 text-pinz-600 border-pinz-200 shadow-pinz-100'
                   : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-xl'
               }`}
               title={locationModeActive ? "Clear location mode" : "Use my location"}
             >
               <Navigation className={`w-5 h-5 transition-colors ${
                 locationModeActive ? 'text-pinz-600' : 'text-gray-700'
               }`} />
             </button>
             
             {/* Zoom Controls - Desktop only, positioned like PublicMap */}
             <div className="hidden md:flex absolute bottom-4 right-4 z-[1000] flex-col gap-1">
               <button
                 onClick={() => {
                   if (mapInstance.current) {
                     mapInstance.current.zoomIn()
                   }
                 }}
                 className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 transition-colors"
                 title="Zoom in"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                 </svg>
               </button>
               <button
                 onClick={() => {
                   if (mapInstance.current) {
                     mapInstance.current.zoomOut()
                   }
                 }}
                 className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 transition-colors"
                 title="Zoom out"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                 </svg>
               </button>
             </div>
           </>
        )}

        {/* Polygon Properties Modal */}
        <PolygonPropertiesModal
          isOpen={showPolygonModal}
          onClose={() => {
            setShowPolygonModal(false)
            setPendingPolygonData(null)
          }}
          onSubmit={handlePolygonSubmit}
        />
    </div>
  )
}

export default Map