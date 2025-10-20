import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { Navigation, MapPin, Search, X } from 'lucide-react'
import { Rnd } from 'react-rnd'
import PublicMapSidebar from './PublicMapSidebar'
import { createMarkerHTML, createClusterOptions, applyNameRules } from '../utils/markerUtils'

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
}

const Map: React.FC<MapProps> = ({ markers, activeTab, mapSettings, isPublishMode, userLocation, locationError, onGetCurrentLocation, iframeDimensions, onIframeDimensionsChange, folderIcons = {} }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const markerClusterRef = useRef<any>(null)
  const userLocationRef = useRef<L.Marker | null>(null)
  const userLocationCircleRef = useRef<L.Circle | null>(null)
  const userLocationPulseRef = useRef<L.Circle | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isLoadingTiles, setIsLoadingTiles] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [nearbyMarkers, setNearbyMarkers] = useState<Marker[]>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [locationModeActive, setLocationModeActive] = useState(false)
  const [searchResults, setSearchResults] = useState<Marker[]>([])
  const [renamedMarkers] = useState<Record<string, string>>({})
  
  const visibleMarkers = markers.filter(marker => marker.visible)
  
  console.log('📍 Map component - visibleMarkers:', {
    isPublishMode,
    dashboardMarkersCount: markers.length,
    visibleMarkersCount: visibleMarkers.length,
    visibleMarkers: visibleMarkers
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
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '12, 8'
          }).addTo(mapInstance.current)
          
          // Add pulsing inner circle
          userLocationPulseRef.current = L.circle([latitude, longitude], {
            radius: 5000,
            color: '#60A5FA',
            fillColor: '#60A5FA',
            fillOpacity: 0.06,
            weight: 1,
            dashArray: '6, 6'
          }).addTo(mapInstance.current)
          
          // Add CSS animation for pulsing effect
          const pulseElement = userLocationPulseRef.current.getElement() as HTMLElement
          if (pulseElement) {
            pulseElement.style.animation = 'pulse 3s ease-in-out infinite'
          }
          
        }
        
        // Call the parent's location handler
        onGetCurrentLocation()
        
        console.log('Found', nearby.length, 'nearby markers within 5km')
      },
      (error) => {
        console.error('Geolocation error:', error)
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
    const filteredMarkersToUse = markers.filter(marker => 
      marker.name.toLowerCase().includes(term.toLowerCase()) ||
      marker.address.toLowerCase().includes(term.toLowerCase())
    )
    
    if (term.trim()) {
      setSearchResults(filteredMarkersToUse)
    } else {
      setSearchResults(markers) // Show all markers when search is cleared
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
  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'pharmacy': return '🏥'
      case 'grocery': return '🛒'
      case 'retail': return '🏪'
      default: return '•'
    }
  }


  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return

    // Clean up existing map instance if it exists
    if (mapInstance.current) {
      console.log('Cleaning up existing map instance')
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

  // Force map resize when switching to embed preview mode
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return
    
    // Force map to resize when switching to embed preview mode
    if (isPublishMode) {
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize()
        }
      }, 100)
    }
  }, [isPublishMode, mapLoaded])

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
        tileUrl = 'https://api.maptiler.com/maps/toner/{z}/{x}/{y}.png?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
        tileOptions.attribution = '© MapTiler © OpenStreetMap contributors'
        break
      case 'satellite':
        tileUrl = 'https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
        tileOptions.attribution = '© MapTiler © OpenStreetMap contributors'
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
      isPublishMode
    })
    
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current) {
      console.log('📍 Skipping markers update - missing requirements')
      return
    }

    console.log('📍 Updating markers with clustering:', visibleMarkers.length)

    // Clear existing markers from cluster group
    markerClusterRef.current.clearLayers()
    markersRef.current = []

    // Add new markers to cluster group
    visibleMarkers.forEach(marker => {
      // Check if marker belongs to a folder with custom icon
      const markerRenamedName = applyNameRules(marker.name, mapSettings.nameRules || [])
      const folderIconUrl = folderIcons[markerRenamedName]
      
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
            <div style="font-weight: 600; color: #000; font-size: 14px; margin: 0 0 4px 0;">${applyNameRules(marker.name, mapSettings.nameRules)}</div>
            <div style="color: #666; font-size: 12px; margin: 0;">${marker.address}</div>
          </div>
        `)

      // Add marker to cluster group instead of directly to map
      markerClusterRef.current.addLayer(markerInstance)
      markersRef.current.push(markerInstance)
    })

    // Fit bounds to show all markers using cluster group
    if (visibleMarkers.length > 0 && markerClusterRef.current) {
      // Ensure map size is correct before fitting bounds
      mapInstance.current.invalidateSize()
      mapInstance.current.fitBounds(markerClusterRef.current.getBounds().pad(0.1))
    }
  }, [visibleMarkers, mapLoaded, mapSettings.markerShape, mapSettings.markerColor, mapSettings.markerSize, mapSettings.markerBorder, mapSettings.markerBorderWidth, mapSettings.clusteringEnabled, mapSettings.clusterRadius, folderIcons])

  // Update user location marker
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return

    // Remove existing user location marker
    if (userLocationRef.current) {
      mapInstance.current.removeLayer(userLocationRef.current)
      userLocationRef.current = null
    }

    // Add new user location marker if available
    if (userLocation) {
      console.log('Adding user location marker:', userLocation)
      
      // Create a distinctive marker for user location (blue circle with pulsing animation)
      const userLocationIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="
          width: 20px; 
          height: 20px; 
          background-color: #3B82F6; 
          border: 3px solid white; 
          border-radius: 50%; 
          animation: pulse 2s infinite;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })

      userLocationRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userLocationIcon })
        .bindPopup(`
          <div style="padding: 8px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 600; color: #000; font-size: 14px; margin: 0 0 4px 0;">📍 Your Location</div>
            <div style="color: #666; font-size: 12px; margin: 0;">Lat: ${userLocation.lat.toFixed(6)}, Lng: ${userLocation.lng.toFixed(6)}</div>
          </div>
        `)
        .addTo(mapInstance.current)

      // Center map on user location if no other markers
      if (visibleMarkers.length === 0) {
        mapInstance.current.setView([userLocation.lat, userLocation.lng], 15)
      }
    }
  }, [userLocation, mapLoaded])

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

  return (
    <div className={`flex-1 bg-gray-100 relative ${isPublishMode ? 'publish-mode overflow-visible' : ''}`}>
      {isPublishMode ? (
        // Embed preview mode - full page resizable container
        <div className="w-full h-full relative overflow-visible">
          {/* Resizable Preview Container - Full Page */}
          <Rnd
            size={{ width: iframeDimensions.width, height: iframeDimensions.height }}
            position={{ x: 0, y: 0 }}
            minWidth={300}
            minHeight={200}
            bounds="parent"
            onResize={(_, __, ref) => {
              const newWidth = parseInt(ref.style.width)
              const newHeight = parseInt(ref.style.height)
              onIframeDimensionsChange({ width: newWidth, height: newHeight })
            }}
            enableResizing={{
              top: true,
              right: true,
              bottom: true,
              left: true,
              topRight: true,
              bottomRight: true,
              bottomLeft: true,
              topLeft: true
            }}
            className="z-50"
            style={{
              border: '3px dashed #3B82F6',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div className="w-full h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="text-sm font-semibold text-blue-800">
                    Embed Preview
                  </div>
                </div>
                <div className="text-sm text-blue-600 font-mono bg-white px-3 py-1 rounded border border-blue-200">
                  {iframeDimensions.width} × {iframeDimensions.height}px
                </div>
              </div>
              
              {/* Actual Map Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-80 flex-shrink-0">
                  <PublicMapSidebar
                    searchTerm={searchTerm}
                    onSearchChange={handleSearch}
                    searchResults={searchResults}
                    nearbyMarkers={nearbyMarkers}
                    showNearbyPlaces={showNearbyPlaces}
                    onNavigateToMarker={navigateToMarker}
                    userLocation={userLocation}
                    calculateDistance={calculateDistance}
                    renamedMarkers={renamedMarkers}
                    allMarkers={visibleMarkers}
                    onToggleLocation={locationModeActive ? clearLocationMode : getCurrentLocation}
                    locationModeActive={locationModeActive}
                    mapSettings={mapSettings}
                  />
                </div>
                
                {/* Map */}
                <div className="flex-1 relative">
                  <div 
                    ref={mapRef} 
                    style={{ 
                      height: '100%', 
                      width: '100%', 
                      zIndex: 1 
                    }} 
                  />
                  
                  {/* Location Button */}
                  <button
                    onClick={locationModeActive ? clearLocationMode : getCurrentLocation}
                    className={`absolute top-2 right-2 rounded p-1 shadow z-10 transition-all duration-200 ${
                      locationModeActive 
                        ? 'bg-blue-50 border border-blue-300 hover:bg-blue-100' 
                        : 'bg-white hover:bg-gray-50 border border-gray-300'
                    }`}
                    title={locationModeActive ? "Clear location mode" : "Use my location"}
                  >
                    <Navigation className={`w-3 h-3 transition-colors ${
                      locationModeActive ? 'text-blue-600' : 'text-gray-700'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </Rnd>
        </div>
      ) : (
        // Regular dashboard mode - use existing layout
        <>
          <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
          {isLoadingTiles && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 z-10">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-700">Loading satellite imagery...</span>
            </div>
          )}
          {/* Store Locator List - Only show on Edit tab */}
          {activeTab === 'edit' && (
            <div className="absolute top-0 left-0 z-10 w-80 h-full flex flex-col" style={{ backgroundColor: mapSettings.searchBarBackgroundColor }}>
                {/* Search Bar */}
                <div className="p-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search locations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      {searchTerm ? (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-12 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={locationModeActive ? clearLocationMode : getCurrentLocation}
                        className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors ${
                          locationModeActive
                            ? 'text-blue-600 hover:text-blue-700'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title={locationModeActive ? "Turn off location mode" : "Find my location"}
                      >
                        <Navigation className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: mapSettings.searchBarTextColor }}>
                      {showNearbyPlaces && locationModeActive ? 'Places Near You' : 'Store Locations'}
                    </h3>
                    <p className="text-xs" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                      {showNearbyPlaces && locationModeActive
                        ? `${nearbyMarkers.length} within 5km`
                        : `${visibleMarkers.length} locations`
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3">
                  {(() => {
                    const displayMarkers = visibleMarkers
                    
                    if (displayMarkers.length === 0) {
                      return (
                        <div className="text-center text-sm" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                          {searchTerm ? (
                            <>
                              <p>No stores found</p>
                              <p className="text-xs mt-1">Try adjusting your search</p>
                            </>
                          ) : showNearbyPlaces && locationModeActive ? (
                            <>
                              <p>No nearby stores</p>
                              <p className="text-xs mt-1">No stores within 5km radius</p>
                            </>
                          ) : (
                            <>
                              <p>No stores added yet</p>
                              <p className="text-xs mt-1">Add stores using the sidebar</p>
                            </>
                          )}
                        </div>
                      )
                    }
                    
                    return displayMarkers.map((marker: Marker) => {
                      const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng) : 0
                      const isNearby = nearbyMarkers.some(nearby => nearby.id === marker.id)
                      
                      return (
                        <button
                          key={marker.id}
                          onClick={() => navigateToMarker(marker)}
                          className="w-full flex items-center gap-3 p-3 transition-all duration-200 text-left group"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = mapSettings.searchBarHoverColor
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <span className="text-lg">{getMarkerIcon(marker.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: mapSettings.searchBarTextColor }}>
                              {applyNameRules(marker.name, mapSettings.nameRules)}
                            </p>
                            <p className="text-xs truncate" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                              {marker.address}
                            </p>
                            {showNearbyPlaces && locationModeActive && distance > 0 && (
                              <p className="text-xs text-blue-600 font-medium mt-1">
                                {distance.toFixed(1)} km away
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isNearby && showNearbyPlaces && locationModeActive && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <MapPin className="w-4 h-4 group-hover:text-blue-500 transition-colors" style={{ color: mapSettings.searchBarTextColor }} />
                          </div>
                        </button>
                      )
                    })
                  })()}
                </div>
              </div>
            )}
          {locationError && (
               <div className="absolute top-16 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm z-10 max-w-xs">
                 <div className="font-semibold">Location Error</div>
                 <div className="text-xs mt-1">{locationError}</div>
               </div>
             )}
             {/* Location Button */}
             <button
               onClick={locationModeActive ? clearLocationMode : getCurrentLocation}
               className={`absolute top-4 right-4 rounded-lg p-2 shadow-lg z-10 transition-all duration-200 ${
                 locationModeActive 
                   ? 'bg-blue-50 border-2 border-blue-300 hover:bg-blue-100' 
                   : 'bg-white hover:bg-gray-50 border border-gray-300'
               }`}
               title={locationModeActive ? "Clear location mode" : "Use my location"}
             >
               <Navigation className={`w-5 h-5 transition-colors ${
                 locationModeActive ? 'text-blue-600' : 'text-gray-700'
               }`} />
             </button>
             
             {/* Zoom Controls */}
             <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
               <button
                 onClick={() => {
                   if (mapInstance.current) {
                     mapInstance.current.zoomIn()
                   }
                 }}
                 className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors"
                 title="Zoom in"
               >
                 <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                 </svg>
               </button>
               <button
                 onClick={() => {
                   if (mapInstance.current) {
                     mapInstance.current.zoomOut()
                   }
                 }}
                 className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors"
                 title="Zoom out"
               >
                 <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                 </svg>
               </button>
             </div>
           </>
        )}
    </div>
  )
}

export default Map