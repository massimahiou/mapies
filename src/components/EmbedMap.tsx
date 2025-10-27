import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useSearchParams } from 'react-router-dom'
import { Navigation, MapPin, X } from 'lucide-react'
import { createMarkerHTML, createClusterOptions, applyNameRules } from '../utils/markerUtils'
import { formatAddressForPopup } from '../utils/addressUtils'
import { getFreemiumCompliantDefaults, ensureFreemiumCompliance } from '../utils/freemiumDefaults'

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
}

interface MapSettings {
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
  nameRules: Array<{ id: string; contains: string; renameTo: string }>
}

const EmbedMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const markerClusterRef = useRef<any>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [mapSettings, setMapSettings] = useState<MapSettings>(getFreemiumCompliantDefaults())
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [nearbyMarkers, setNearbyMarkers] = useState<Marker[]>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Get map ID from URL parameters
  const mapId = searchParams.get('mapId')

  // Mobile detection and responsive behavior - Force mobile detection
  useEffect(() => {
    const checkMobile = () => {
      // More aggressive mobile detection
      const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
      const userAgent = navigator.userAgent.toLowerCase()
      
      // Force mobile for testing - remove this line in production
      const forceMobile = window.location.search.includes('mobile=true')
      
      // Check if we're in an iframe
      const inIframe = window !== window.top
      
      const mobile = 
        forceMobile ||
        screenWidth <= 768 || 
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent) ||
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        // Additional mobile detection for iframe contexts
        (inIframe && screenWidth <= 1024) ||
        // Force mobile for any touch device
        ('ontouchstart' in window && screenWidth <= 1024)
      
      console.log('🔍 Mobile detection:', {
        screenWidth,
        userAgent: navigator.userAgent,
        hasTouch: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints,
        forceMobile,
        inIframe,
        isMobile: mobile,
        windowWidth: window.innerWidth,
        documentWidth: document.documentElement.clientWidth
      })
      
      // Additional debugging
      console.log('📱 Mobile search bar should show:', mobile || window.location.search.includes('mobile=true'))
      
      setIsMobile(mobile)
      
      // Force mobile class on body if mobile detected
      if (mobile) {
        document.body.classList.add('mobile-embed')
        document.documentElement.classList.add('mobile-embed')
        console.log('📱 Mobile mode activated!')
        
        // Force mobile styles immediately
        document.body.style.setProperty('--mobile-mode', '1', 'important')
        document.documentElement.style.setProperty('--mobile-mode', '1', 'important')
      } else {
        document.body.classList.remove('mobile-embed')
        document.documentElement.classList.remove('mobile-embed')
        console.log('🖥️ Desktop mode activated!')
        
        // Remove mobile styles
        document.body.style.removeProperty('--mobile-mode')
        document.documentElement.style.removeProperty('--mobile-mode')
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    window.addEventListener('orientationchange', checkMobile)
    
    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('orientationchange', checkMobile)
    }
  }, [])

  // Send message to parent window to request responsive iframe styling
  useEffect(() => {
    const requestResponsiveIframe = () => {
      try {
        // Send message to parent window requesting responsive iframe styling
        window.parent.postMessage({
          type: 'MAPIES_REQUEST_RESPONSIVE_IFRAME',
          source: 'mapies-embed'
        }, '*')
        console.log('📤 Sent request to parent for responsive iframe styling')
      } catch (e) {
        console.log('📤 Could not send message to parent (cross-origin)')
      }
    }

    // Request responsive styling after a short delay
    const timeoutId = setTimeout(requestResponsiveIframe, 100)
    
    return () => clearTimeout(timeoutId)
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    console.log('Initializing embed map...')
    
    mapInstance.current = L.map(mapRef.current, {
      center: [45.5017, -73.5673],
      zoom: 10,
      attributionControl: false,
      zoomControl: !isMobile, // Show zoom controls on mobile for better UX
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      // Fix tile flashing during zoom
      preferCanvas: false,
      zoomAnimationThreshold: 4,
      // Mobile-specific options
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: !isMobile, // Disable scroll wheel zoom on mobile to prevent conflicts
      dragging: true
    })

    // Add simple tile layer
    tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
      // Fix tile flashing
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2,
      updateInterval: 200
    }).addTo(mapInstance.current)

    mapInstance.current.whenReady(() => {
      console.log('Embed map loaded successfully')
      setMapLoaded(true)
      
      // Initialize basic marker cluster group (will be updated when settings change)
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
    })
  }, [])

  // Load map data from Firestore
  useEffect(() => {
    const loadMapData = async () => {
      if (!mapId) {
        setError('Missing map ID')
        setLoading(false)
        return
      }

      try {
        console.log('Loading map data for embed:', { mapId })
        
        // Import Firebase functions dynamically to avoid issues in embed context
        const { getMapById, getMapMarkers } = await import('../firebase/maps')
        
        // Load map settings using getMapById to find the map regardless of user
        const mapData = await getMapById(mapId)
        if (!mapData) {
          setError('Map not found')
          setLoading(false)
          return
        }

        // Get the map owner's ID for loading folder icons
        const mapOwnerId = mapData.userId
        console.log('📁 Map owner ID for folder icons:', mapOwnerId)

        if (mapData.settings) {
          console.log('🔍 EmbedMap: Loading map settings from Firestore:', mapData.settings)
          const rawSettings = {
            ...mapData.settings,
            clusteringEnabled: mapData.settings.clusteringEnabled !== undefined ? mapData.settings.clusteringEnabled : true,
            clusterRadius: mapData.settings.clusterRadius || 50,
            // Search bar settings with defaults
            searchBarBackgroundColor: mapData.settings.searchBarBackgroundColor || '#ffffff',
            searchBarTextColor: mapData.settings.searchBarTextColor || '#000000',
            searchBarHoverColor: mapData.settings.searchBarHoverColor || '#f3f4f6',
            // Name rules settings with defaults
            nameRules: mapData.settings.nameRules || []
          }
          
          // Automatically fix any premium settings to be freemium-compliant
          const compliantSettings = ensureFreemiumCompliance(rawSettings, 'freemium')
          setMapSettings(compliantSettings)
          
          console.log('🔍 EmbedMap: Final compliant settings:', compliantSettings)
        }

        // Load folder icons for this map using the map owner's ID
        const loadFolderIcons = async () => {
          try {
            const { getUserMarkerGroups } = await import('../firebase/firestore')
            const groups = await getUserMarkerGroups(mapOwnerId, mapId)
            
            const iconStates: Record<string, string> = {}
            groups.forEach(group => {
              if (group.iconUrl) {
                iconStates[group.groupName] = group.iconUrl
              }
            })
            setFolderIcons(iconStates)
            console.log('📁 Folder icons loaded for embed map:', Object.keys(iconStates).length, 'icons:', iconStates)
          } catch (error) {
            console.error('Error loading folder icons for embed map:', error)
          }
        }
        loadFolderIcons()

        // Load markers using the map owner's ID
        const mapMarkers = await getMapMarkers(mapOwnerId, mapId)
        const localMarkers: Marker[] = mapMarkers.map(marker => ({
          id: marker.id || `marker-${Date.now()}-${Math.random()}`,
          name: marker.name,
          address: marker.address,
          lat: marker.lat,
          lng: marker.lng,
          visible: marker.visible,
          type: marker.type as 'pharmacy' | 'grocery' | 'retail' | 'other'
        }))
        
        setMarkers(localMarkers)
        console.log('Loaded markers for embed:', localMarkers.length)
        
      } catch (error) {
        console.error('Error loading map data for embed:', error)
        setError('Failed to load map data')
      } finally {
        setLoading(false)
      }
    }

    loadMapData()
  }, [mapId])

  // Update cluster group when mapSettings change
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current) return

    console.log('🎨 EmbedMap: Updating cluster group with new settings:', mapSettings)

    // Remove old cluster group
    mapInstance.current.removeLayer(markerClusterRef.current)
    
    // Create icon function
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
    
    // Create new cluster group with updated settings
    const clusterOptions = createClusterOptions(mapSettings, iconCreateFunction)
    console.log('🔍 EmbedMap: Cluster options result:', {
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

  // Update map style based on settings
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current || !mapLoaded) return

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    let tileOptions = {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      // Fix tile flashing
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2,
      updateInterval: 200
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
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        tileOptions = {
          attribution: '© Esri',
          maxZoom: 18,
          // Fix tile flashing
          updateWhenZooming: false,
          updateWhenIdle: true,
          keepBuffer: 2,
          updateInterval: 200
        }
        break
      case 'light':
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        tileOptions.attribution = '© OpenStreetMap contributors © CARTO'
        break
      case 'toner':
        // Use light tiles with CSS filters for toner effect (black & white high contrast)
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        tileOptions = {
          attribution: '© OpenStreetMap contributors © CARTO',
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

    // Remove old tile layer and add new one
    if (tileLayerRef.current) {
      mapInstance.current.removeLayer(tileLayerRef.current)
    }
    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions).addTo(mapInstance.current)
  }, [mapSettings.style, mapLoaded])

  // Update markers
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current) return

    console.log('Updating embed markers with clustering:', markers.length)

    // Clear existing markers from cluster group
    markerClusterRef.current.clearLayers()
    markersRef.current = []

    // Add new markers to cluster group
    const visibleMarkers = markers.filter(marker => marker.visible)
    visibleMarkers.forEach(marker => {
      // Get the renamed name to check for folder icons
      const markerRenamedName = applyNameRules(marker.name, mapSettings.nameRules, true)
      
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
      const markerData = createMarkerHTML({ mapSettings, folderIconUrl })
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
      mapInstance.current.fitBounds(markerClusterRef.current.getBounds().pad(0.1))
    }
  }, [markers, mapLoaded, mapSettings.markerShape, mapSettings.markerColor, mapSettings.markerSize, mapSettings.markerBorder, mapSettings.markerBorderWidth, mapSettings.clusteringEnabled, mapSettings.clusterRadius, folderIcons])

  // Calculate distance between two points in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Find nearby markers within a certain radius
  const findNearbyMarkers = (userLat: number, userLng: number, radiusKm: number = 5): Marker[] => {
    return markers.filter(marker => {
      const distance = calculateDistance(userLat, userLng, marker.lat, marker.lng)
      return distance <= radiusKm
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

  // Mobile search function
  const handleMobileSearch = () => {
    if (!searchQuery.trim()) return
    
    const filteredMarkers = markers.filter(marker => 
      marker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      marker.address.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    if (filteredMarkers.length > 0 && mapInstance.current) {
      // Show first result
      const firstMarker = filteredMarkers[0]
      mapInstance.current.setView([firstMarker.lat, firstMarker.lng], 15)
      
      // Show all filtered markers in a mobile-friendly list
      setNearbyMarkers(filteredMarkers)
      setShowNearbyPlaces(true)
    }
  }

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.')
      alert('Geolocation is not supported by this browser.')
      return
    }

    // Check if we're in an iframe and warn user
    const isInIframe = window !== window.top
    
    if (isInIframe && isMobile) {
      console.log('Running in iframe on mobile - geolocation may require user permission')
      // Show a more helpful message for mobile iframe users
      if (confirm('To find your location, you may need to allow location access in your browser. Continue?')) {
        // User confirmed, proceed with geolocation
      } else {
        return
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        console.log('Current location:', latitude, longitude)
        
        // Store user location
        setUserLocation({ lat: latitude, lng: longitude })
        
        if (mapInstance.current) {
          // Calculate optimal zoom level to properly frame the 5km circle
          const optimalZoom = getOptimalZoomForCircle()
          mapInstance.current.setView([latitude, longitude], optimalZoom)
          
          // Find nearby markers within 5km radius
          const nearby = findNearbyMarkers(latitude, longitude, 5)
          setNearbyMarkers(nearby)
          setShowNearbyPlaces(true)
          
          console.log(`Found ${nearby.length} places within 5km of your location`)
          
          // Add a temporary marker for current location
          const currentLocationIcon = L.divIcon({
            className: 'current-location-marker',
            html: '<div style="width: 20px; height: 20px; background-color: #3B82F6; border: 3px solid white; border-radius: 50%;"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
          
          const currentLocationMarker = L.marker([latitude, longitude], { icon: currentLocationIcon })
            .bindPopup('📍 Your current location')
            .addTo(mapInstance.current)
          
          // Add a radius circle to show the search area
          const radiusCircle = L.circle([latitude, longitude], {
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.08,
            weight: 3,
            dashArray: '8, 8',
            radius: 5000 // 5km radius
          }).addTo(mapInstance.current)
          
          // Remove markers and circle after 10 seconds
          setTimeout(() => {
            mapInstance.current?.removeLayer(currentLocationMarker)
            mapInstance.current?.removeLayer(radiusCircle)
            setShowNearbyPlaces(false)
          }, 10000)
        }
      },
      (error) => {
        console.error('Error getting location:', error)
        let errorMessage = 'Unable to get your location. '
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access and try again.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.'
            break
          default:
            errorMessage += 'An unknown error occurred.'
            break
        }
        
        alert(errorMessage)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout for iframe contexts
        maximumAge: 60000
      }
    )
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading map</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative embed-map-container">
      <div ref={mapRef} className="w-full h-full" />
      
           {/* Mobile Search Bar - Show on mobile or in iframe */}
           {(isMobile || window.location.search.includes('mobile=true') || (window !== window.top && window.innerWidth <= 1024)) && (
             <div className="absolute top-0 left-0 right-0 z-[1000] mobile-search-container" style={{
               backgroundColor: 'rgba(255, 255, 255, 0.95)',
               backdropFilter: 'blur(10px)',
               padding: '1rem',
               borderBottom: '1px solid #e5e7eb'
             }}>
               <div className="flex gap-2">
                 <div className="flex-1 relative">
                   <input
                     type="text"
                     placeholder="🔍 Search 255 locations..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     onKeyPress={(e) => e.key === 'Enter' && handleMobileSearch()}
                     className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base mobile-search-input"
                     style={{ 
                       backgroundColor: '#ffffff',
                       color: '#374151',
                       fontSize: '16px' // Prevents zoom on iOS
                     }}
                   />
                   <button
                     onClick={handleMobileSearch}
                     className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                   >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                     </svg>
                   </button>
                 </div>
                 <button
                   onClick={getCurrentLocation}
                   className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 transition-colors mobile-location-btn"
                   title="Find my location"
                 >
                   <Navigation className="w-5 h-5" />
                 </button>
               </div>
               <div className="mt-2 text-center">
                 <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded-full shadow-sm">
                   📱 Search bar - isMobile: {isMobile ? 'true' : 'false'} | Width: {window.innerWidth}px
                 </span>
               </div>
             </div>
           )}
      
      {/* Desktop Location Button */}
      {!isMobile && (
        <button
          onClick={getCurrentLocation}
          className="absolute top-4 right-4 z-[1000] bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 transition-colors"
          title="Find my location"
        >
          <Navigation className="w-5 h-5" />
        </button>
      )}

      {/* Nearby Places Panel - Mobile Responsive */}
      {showNearbyPlaces && nearbyMarkers.length > 0 && (
        <div className={`absolute z-[1000] rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-hidden mobile-nearby-panel ${isMobile ? 'top-20 left-4 right-4' : 'top-4 left-4 w-80'}`} style={{ backgroundColor: mapSettings.searchBarBackgroundColor }}>
          <div className="p-3 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-900">📍 Places Near You</h3>
              <button
                onClick={() => setShowNearbyPlaces(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-blue-700 mt-1">{nearbyMarkers.length} places within 5km</p>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {nearbyMarkers.map((marker) => {
              const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng) : 0
              return (
                <button
                  key={marker.id}
                  onClick={() => {
                    if (mapInstance.current) {
                      mapInstance.current.setView([marker.lat, marker.lng], 16)
                      setShowNearbyPlaces(false)
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 transition-colors text-left border-b border-gray-100 last:border-b-0 touch-manipulation"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = mapSettings.searchBarHoverColor
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  style={{ minHeight: '60px' }} // Ensure touch-friendly height
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: mapSettings.searchBarTextColor }}>
                      {applyNameRules(marker.name, mapSettings.nameRules, true)}
                    </p>
                    <p className="text-xs truncate" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                      {marker.address}
                    </p>
                    <p className="text-xs text-blue-600 font-medium">
                      {distance.toFixed(1)} km away
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default EmbedMap
