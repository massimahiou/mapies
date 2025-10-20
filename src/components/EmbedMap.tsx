import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useSearchParams } from 'react-router-dom'
import { Navigation, MapPin, X } from 'lucide-react'
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
  const [mapSettings, setMapSettings] = useState<MapSettings>({
    style: 'light',
    markerShape: 'circle',
    markerColor: '#3B82F6',
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
    nameRules: []
  })
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [nearbyMarkers, setNearbyMarkers] = useState<Marker[]>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)

  // Get map ID from URL parameters
  const mapId = searchParams.get('mapId')
  const userId = searchParams.get('userId')

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    console.log('Initializing embed map...')
    
    mapInstance.current = L.map(mapRef.current, {
      center: [45.5017, -73.5673],
      zoom: 10,
      attributionControl: false,
      zoomControl: false,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      // Fix tile flashing during zoom
      preferCanvas: false,
      zoomAnimationThreshold: 4
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
      if (!mapId || !userId) {
        setError('Missing map ID or user ID')
        setLoading(false)
        return
      }

      try {
        console.log('Loading map data for embed:', { mapId, userId })
        
        // Import Firebase functions dynamically to avoid issues in embed context
        const { getMap, getMapMarkers } = await import('../firebase/maps')
        
        // Load map settings
        const mapData = await getMap(userId, mapId)
        if (mapData && mapData.settings) {
          console.log('🔍 EmbedMap: Loading map settings from Firestore:', mapData.settings)
          setMapSettings({
            ...mapData.settings,
            clusteringEnabled: mapData.settings.clusteringEnabled !== undefined ? mapData.settings.clusteringEnabled : true,
            clusterRadius: mapData.settings.clusterRadius || 50,
            // Search bar settings with defaults
            searchBarBackgroundColor: mapData.settings.searchBarBackgroundColor || '#ffffff',
            searchBarTextColor: mapData.settings.searchBarTextColor || '#000000',
            searchBarHoverColor: mapData.settings.searchBarHoverColor || '#f3f4f6',
            // Name rules settings with defaults
            nameRules: mapData.settings.nameRules || []
          })
          console.log('🔍 EmbedMap: Final clustering settings:', {
            clusteringEnabled: mapData.settings.clusteringEnabled,
            clusterRadius: mapData.settings.clusterRadius
          })
        }

        // Load folder icons for this map
        const loadFolderIcons = async () => {
          try {
            const { getUserMarkerGroups } = await import('../firebase/firestore')
            const groups = await getUserMarkerGroups(userId, mapId)
            
            const iconStates: Record<string, string> = {}
            groups.forEach(group => {
              if (group.iconUrl) {
                iconStates[group.groupName] = group.iconUrl
              }
            })
            setFolderIcons(iconStates)
            console.log('📁 Folder icons loaded for embed map:', Object.keys(iconStates).length)
          } catch (error) {
            console.error('Error loading folder icons for embed map:', error)
          }
        }
        loadFolderIcons()

        // Load markers
        const mapMarkers = await getMapMarkers(userId, mapId)
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
  }, [mapId, userId])

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
      const markerRenamedName = applyNameRules(marker.name, mapSettings.nameRules)
      const folderIconUrl = folderIcons[markerRenamedName]
      
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

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.')
      alert('Geolocation is not supported by this browser.')
      return
    }

    // Check if we're in an iframe and warn user
    const isInIframe = window !== window.top
    if (isInIframe) {
      console.log('Running in iframe - geolocation may require user permission')
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
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Location Button */}
      <button
        onClick={getCurrentLocation}
        className="absolute top-4 right-4 z-[1000] bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 transition-colors"
        title="Find my location"
      >
        <Navigation className="w-5 h-5" />
      </button>

      {/* Nearby Places Panel */}
      {showNearbyPlaces && nearbyMarkers.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] w-80 rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-hidden" style={{ backgroundColor: mapSettings.searchBarBackgroundColor }}>
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
                  className="w-full flex items-center gap-3 p-3 transition-colors text-left border-b border-gray-100 last:border-b-0"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = mapSettings.searchBarHoverColor
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: mapSettings.searchBarTextColor }}>
                      {applyNameRules(marker.name, mapSettings.nameRules)}
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
