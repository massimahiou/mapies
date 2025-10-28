import React, { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { Navigation, MapPin, Search, X, List, Shapes } from 'lucide-react'
import { Rnd } from 'react-rnd'
import PublicMapSidebar from './PublicMapSidebar'
import { createMarkerHTML, createClusterOptions, applyNameRules } from '../utils/markerUtils'
import { formatAddressForPopup } from '../utils/addressUtils'
import { useSharedMapFeatureAccess } from '../hooks/useSharedMapFeatureAccess'
import MapFeatureLevelHeader from './MapFeatureLevelHeader'
import { useResponsive } from '../hooks/useResponsive'
import { useAuth } from '../contexts/AuthContext'
import InteractiveWatermark from './InteractiveWatermark'
import { validateMapAgainstPlan, getPremiumFeatureDescription } from '../utils/mapValidation'
import { isMapOwnedByUser } from '../firebase/maps'
import PolygonPropertiesModal from './PolygonPropertiesModal'
import { usePolygonLoader } from '../hooks/usePolygonLoader'

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
  onOpenSubscription?: () => void // New prop for opening subscription modal
  currentMap?: any // Add current map data to determine ownership
  showPolygonDrawing?: boolean // Enable polygon drawing mode
}

const Map: React.FC<MapProps> = ({ markers, activeTab, mapSettings, isPublishMode, userLocation, locationError, onGetCurrentLocation, iframeDimensions, onIframeDimensionsChange, folderIcons = {}, onOpenSubscription, currentMap, showPolygonDrawing: _showPolygonDrawing }) => {
  console.log('🔷 Map component rendered, showPolygonDrawing:', _showPolygonDrawing)
  const { isMobile } = useResponsive()
  const { showWatermark, planLimits, currentPlan, mapInheritance } = useSharedMapFeatureAccess(currentMap)
  const { user } = useAuth()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const markerClusterRef = useRef<any>(null)
  const userLocationRef = useRef<L.Marker | null>(null)
  const userLocationCircleRef = useRef<L.Circle | null>(null)
  const userLocationPulseRef = useRef<L.Circle | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const drawControlRef = useRef<L.Control.Draw | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  // polygonLayersRef removed - now managed by usePolygonLoader hook
  const [mapLoaded, setMapLoaded] = useState(false)
  const [showPolygonModal, setShowPolygonModal] = useState(false)
  const [pendingPolygonData, setPendingPolygonData] = useState<{type: string, coords: any} | null>(null)
  const [isLoadingTiles, setIsLoadingTiles] = useState(false)
  const [showEmbedMobileResults, setShowEmbedMobileResults] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [nearbyMarkers, setNearbyMarkers] = useState<Marker[]>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [locationModeActive, setLocationModeActive] = useState(false)
  const [searchResults, setSearchResults] = useState<Marker[]>([])
  const [renamedMarkers] = useState<Record<string, string>>({})
  
  // Use the polygon loader hook for consistent polygon loading
  usePolygonLoader({
    mapInstance: mapInstance.current,
    mapLoaded,
    userId: user?.uid || '',
    mapId: currentMap?.id || '',
    activeTab
  })
  
  const visibleMarkers = useMemo(() => 
    markers.filter(marker => marker.visible), 
    [markers]
  )
  
  // Determine if this is a shared map or owned map
  const isOwnedMap = currentMap && user ? isMapOwnedByUser(currentMap, user.uid) : true
  
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


  // Initialize map - only once, but check container
  useEffect(() => {
    if (!mapRef.current) {
      console.log('Map ref not ready yet')
      return
    }
    
    // Don't recreate if already exists and container matches
    if (mapInstance.current && mapInstance.current.getContainer() === mapRef.current) {
      console.log('Map already initialized on correct container')
      return
    }

    console.log('Initializing Leaflet map')
    
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
  }, []) // Only initialize once on mount, don't recreate on tab switches

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
    if (visibleMarkers.length > 0 && markerClusterRef.current) {
      // Ensure map size is correct before fitting bounds
      mapInstance.current.invalidateSize()
      mapInstance.current.fitBounds(markerClusterRef.current.getBounds().pad(0.1))
    }
  }, [visibleMarkers, mapLoaded, mapSettings, folderIcons, isPublishMode, isMapDisabled])

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
          remove: false
        }
      }

      drawControlRef.current = new L.Control.Draw(drawOptions)
      mapInstance.current.addControl(drawControlRef.current)
      console.log('🔷 Leaflet Draw control added to map')
      
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
  
  // Force map resize when switching modes
  useEffect(() => {
    if (mapInstance.current && mapLoaded) {
      setTimeout(() => {
        mapInstance.current?.invalidateSize()
      }, 100)
    }
  }, [isPublishMode, mapLoaded])

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
      
      {/* Map container - always rendered */}
      <div className="relative" style={{ height: '100%', width: '100%' }}>
        <div 
          ref={mapRef} 
          style={{ height: '100%', width: '100%', zIndex: 1 }} 
          className="relative"
        />
        
        {/* Interactive Watermark - Only show if required by subscription */}
        {showWatermark && !isPublishMode && (
          <InteractiveWatermark 
            mode="dashboard"
            onUpgrade={onOpenSubscription}
          />
        )}
        {showWatermark && isPublishMode && (
          <InteractiveWatermark 
            mode="static"
          />
        )}
      </div>
      
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
                  <div className="text-center p-6">
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
                    <p className="text-sm text-gray-500">
                      Consider upgrading your plan to continue using this map.
                    </p>
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
                {/* Sidebar */}
                <div className={`${isMobile ? 'hidden' : 'w-80'} flex-shrink-0`}>
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
                
                {/* Map - container already rendered above */}
                <div className="flex-1 relative">
                  {/* Mobile Search Bar - Always show in embed preview */}
              <div className="absolute top-2 left-2 right-2 z-[1000]">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search locations or postal code..."
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
          {/* Map container already rendered above */}
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
                              {applyNameRules(marker.name, mapSettings.nameRules, true)}
                            </p>
                            <p className="text-xs truncate" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                              {marker.address}
                            </p>
                            {showNearbyPlaces && locationModeActive && distance > 0 && (
                              <p className="text-xs text-pinz-600 font-medium mt-1">
                                {distance.toFixed(1)} km away
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isNearby && showNearbyPlaces && locationModeActive && (
                              <div className="w-2 h-2 bg-pinz-500 rounded-full"></div>
                            )}
                            <MapPin className="w-4 h-4 group-hover:text-pinz-500 transition-colors" style={{ color: mapSettings.searchBarTextColor }} />
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
                   ? 'bg-pinz-50 border-2 border-pinz-300 hover:bg-pinz-100' 
                   : 'bg-white hover:bg-gray-50 border border-gray-300'
               }`}
               title={locationModeActive ? "Clear location mode" : "Use my location"}
             >
               <Navigation className={`w-5 h-5 transition-colors ${
                 locationModeActive ? 'text-pinz-600' : 'text-gray-700'
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