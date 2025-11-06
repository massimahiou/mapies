import React, { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { MapPin, Navigation, Plus, Minus, Search, X, List } from 'lucide-react'
import { detectBusinessType } from '../utils/businessDetection'
import { createMarkerHTML, createClusterOptions, applyNameRules } from '../utils/markerUtils'
import { formatAddressForPopup } from '../utils/addressUtils'
import PublicMapSidebar from './PublicMapSidebar'
import { MAPBOX_CONFIG } from '../config/mapbox'
import { usePublicFeatureAccess } from '../hooks/useFeatureAccess'
import InteractiveWatermark from './InteractiveWatermark'
import { getFreemiumCompliantDefaults, ensureFreemiumCompliance } from '../utils/freemiumDefaults'
import { validateMapAgainstPlan } from '../utils/mapValidation'
import { usePolygonLoader } from '../hooks/usePolygonLoader'
import { useResponsive } from '../hooks/useResponsive'
import SEO from './SEO'
import { useEmbedMapLanguage } from '../hooks/useEmbedMapLanguage'
import LanguageToggle from './LanguageToggle'

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

interface MapDocument {
  id: string
  name: string
  description: string
  userId: string
  createdAt: Date
  updatedAt: Date
  settings?: MapSettings
  ownerPlan?: string
}

interface PublicMapProps {
  mapId?: string
  customSettings?: {
    style?: string
    markerShape?: string
    markerColor?: string
    markerSize?: string
    clusteringEnabled?: boolean
  }
}

const PublicMap: React.FC<PublicMapProps> = ({ mapId: propMapId, customSettings }) => {
  const urlMapId = useParams<{ mapId: string }>().mapId
  const mapId = propMapId || urlMapId
  const [searchParams] = useSearchParams()
  const { showWatermark: defaultShowWatermark, hasGeocoding } = usePublicFeatureAccess()
  const { isMobile } = useResponsive()
  const { language, setLanguage, t } = useEmbedMapLanguage()
  
  // Get language and toggle visibility from URL parameters
  const showToggleParam = searchParams.get('showToggle')
  const showToggle = showToggleParam === null || showToggleParam === 'true' // Default to true if not specified
  
  const [showWatermark, setShowWatermark] = useState(defaultShowWatermark)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const markerClusterRef = useRef<any>(null)
  const userLocationCircleRef = useRef<L.Circle | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [mapData, setMapData] = useState<MapDocument | null>(null)
  const [mapSettings, setMapSettings] = useState<MapSettings>(getFreemiumCompliantDefaults())

  // Merge custom settings with default settings
  const effectiveSettings = {
    ...mapSettings,
    ...(customSettings && {
      style: customSettings.style || mapSettings.style,
      markerShape: customSettings.markerShape || mapSettings.markerShape,
      markerColor: customSettings.markerColor || mapSettings.markerColor,
      markerSize: customSettings.markerSize || mapSettings.markerSize
    })
  }
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Marker[]>([])
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [nearbyMarkers, setNearbyMarkers] = useState<Marker[]>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [locationModeActive, setLocationModeActive] = useState(false)
  const [renamedMarkers] = useState<Record<string, string>>({})
  const [showMobileResults, setShowMobileResults] = useState(false)
  const [viewportMarkers, setViewportMarkers] = useState<Marker[]>([]) // Markers visible in current viewport
  
  // Load polygons for public maps
  usePolygonLoader({
    mapInstance: mapInstance.current,
    mapLoaded,
    userId: mapData?.userId || '',
    mapId: mapData?.id || mapId || ''
  })
  
  // Validate map against owner's plan for public viewing
  const mapValidation = mapData ? validateMapAgainstPlan(markers, mapSettings, mapData.ownerPlan || 'freemium', folderIcons) : { isValid: true, premiumFeaturesUsed: [] }
  
  // Check if map should be disabled for public viewing
  const isMapDisabled = !mapValidation.isValid

  // Geocoding function for postal codes - Using Mapbox API (primary) with Nominatim fallback
  const geocodePostalCode = async (postalCode: string): Promise<{lat: number, lng: number} | null> => {
    try {
      const cleanedPostalCode = postalCode.trim().replace(/\s+/g, '').toUpperCase()
      
      // PRIORITY 1: Always try Mapbox first (even if hasGeocoding is false - Mapbox public token should work for basic geocoding)
      const encodedPostalCode = encodeURIComponent(cleanedPostalCode)
      
      // Try Mapbox with postal code autocomplete/geocoding
      // Method 1: Query parameter style (more reliable for postal codes)
      const mapboxQueryUrl = `${MAPBOX_CONFIG.GEOCODING_API_URL}/${encodedPostalCode}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&country=CA&types=postcode&limit=1`
      
      try {
        const response = await fetch(mapboxQueryUrl)
        const data = await response.json()
        
        
        if (response.ok && data.features && data.features.length > 0) {
          const feature = data.features[0]
          const coordinates = feature.center
          return {
            lat: coordinates[1], // Mapbox returns [lng, lat]
            lng: coordinates[0]
          }
        }
        
        // If no results with types=postcode, try without types restriction
        if (!data.features || data.features.length === 0) {
          const mapboxUrlNoTypes = `${MAPBOX_CONFIG.GEOCODING_API_URL}/${encodedPostalCode}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&country=CA&limit=5`
          
          const response2 = await fetch(mapboxUrlNoTypes)
          const data2 = await response2.json()
          
          if (response2.ok && data2.features && data2.features.length > 0) {
            // Look for postal code features first, or any Canadian location
            const postalCodeFeature = data2.features.find((f: any) => 
              f.place_type?.includes('postcode') || 
              f.properties?.type === 'postcode' ||
              f.context?.some((ctx: any) => ctx.id?.startsWith('postcode'))
            )
            
            const feature = postalCodeFeature || data2.features[0]
            const coordinates = feature.center
            return {
              lat: coordinates[1],
              lng: coordinates[0]
            }
          }
        }
        
        if (data.error || data.message) {
        }
      } catch (mapboxError) {
        console.error('⚠️ Mapbox error:', mapboxError)
      }
      
      
      // Always try Nominatim - it's FREE and works for postal codes
      // Fallback to Nominatim - full postal code
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleanedPostalCode)}&countrycodes=ca&format=json&limit=1`
        const response = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'Pinz Map App - pinz.app'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data && data.length > 0) {
            const result = data[0]
            return {
              lat: parseFloat(result.lat),
              lng: parseFloat(result.lon)
            }
          }
        }
      } catch (nominatimError) {
      }
      
      // If full postal code fails, try first 3 characters (postal code prefix)
      if (cleanedPostalCode.length >= 3) {
        const postalCodePrefix = cleanedPostalCode.substring(0, 3)
        
        // Try Mapbox with prefix (only if geocoding is available)
        if (hasGeocoding) {
          try {
            const mapboxUrl = `${MAPBOX_CONFIG.GEOCODING_API_URL}/${postalCodePrefix}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&country=CA&limit=1`
            const response = await fetch(mapboxUrl)
            
            if (response.ok) {
              const data = await response.json()
              
              if (data.features && data.features.length > 0) {
                const coordinates = data.features[0].center
                return {
                  lat: coordinates[1],
                  lng: coordinates[0]
                }
              }
            }
          } catch (mapboxError) {
          }
        }
        
        // Try Nominatim with prefix (always available, it's free)
        try {
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCodePrefix)}&countrycodes=ca&format=json&limit=1`
          const response = await fetch(nominatimUrl, {
            headers: {
              'User-Agent': 'Pinz Map App - pinz.app'
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            
            if (data && data.length > 0) {
              const result = data[0]
              return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon)
              }
            }
          }
        } catch (nominatimError) {
        }
      }
      
      return null
    } catch (error) {
      console.error('Postal code geocoding error:', error)
      return null
    }
  }

  // Check if search term is a postal code (Canadian format: A1A 1A1 or A1A1A1)
  // Also checks for partial postal codes (3+ characters matching pattern)
  const isPostalCode = (term: string): boolean => {
    if (!term || !term.trim()) return false
    
    const cleaned = term.trim().replace(/\s+/g, '').toUpperCase() // Remove all spaces and normalize to uppercase
    
    // Full postal code: A1A1A1 (6 characters)
    const fullPostalCodeRegex = /^[A-Z]\d[A-Z]\d[A-Z]\d$/
    // Partial postal code: A1A (3 characters - postal code prefix)
    const partialPostalCodeRegex = /^[A-Z]\d[A-Z]$/
    
    const isFullMatch = fullPostalCodeRegex.test(cleaned)
    const isPartialMatch = partialPostalCodeRegex.test(cleaned)
    const result = isFullMatch || isPartialMatch
    
    
    return result
  }

  // Debounced search to avoid excessive API calls during typing
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Search functionality with postal code support
  const handleSearch = async (term: string) => {
    setSearchTerm(term)
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    if (!term.trim()) {
      setSearchResults(markers)
      setShowMobileResults(false) // Hide results when search is cleared
      return
    }

    // Show mobile results panel when searching
    setShowMobileResults(true)
    
    // PRIORITY 1: Check if it's a postal code FIRST - postal codes ONLY use geocoding, no text search fallback
    const isPostal = isPostalCode(term)
    
    if (isPostal) {
      
      // For postal codes, show loading state immediately but debounce the geocoding
      // Show empty results initially to indicate geocoding is in progress
      setSearchResults([])
      
      // Debounce postal code geocoding slightly to avoid excessive API calls
      searchTimeoutRef.current = setTimeout(async () => {
        
        // Reverse geocode postal code to get latitude/longitude
        const coordinates = await geocodePostalCode(term)
        
        if (coordinates && coordinates.lat && coordinates.lng) {
          
          // Use the geocoded coordinates to find nearest markers
          // Calculate distance for ALL markers from the postal code location
          const markersWithDistance = markers.map(marker => {
            const distance = calculateDistance(coordinates.lat, coordinates.lng, marker.lat, marker.lng)
            return {
              ...marker,
              distance
            }
          }).sort((a, b) => a.distance - b.distance)
          
          
          // Show the closest markers sorted by distance (nearest first)
          const nearestMarkers = markersWithDistance.slice(0, 50) // Show up to 50 nearest
          
          
          setSearchResults(nearestMarkers)
          
          // Center map on postal code location
          if (mapInstance.current) {
            mapInstance.current.setView([coordinates.lat, coordinates.lng], 12)
          }
          
          // Set user location to the postal code location for distance display
          setUserLocation({ lat: coordinates.lat, lng: coordinates.lng })
        } else {
          console.error('❌ Could not geocode postal code:', term)
          console.error('❌ Geocoding returned null or invalid coordinates')
          // NO FALLBACK - postal codes only use geocoding, no text search
          setSearchResults([])
        }
      }, 500) // Wait 500ms after user stops typing before geocoding
      
      return
    }
    
    // Regular text search (only for non-postal-code terms)
    searchTimeoutRef.current = setTimeout(() => {
      const filtered = markers.filter(marker => 
        marker.name.toLowerCase().includes(term.toLowerCase()) ||
        marker.address.toLowerCase().includes(term.toLowerCase())
      )
      setSearchResults(filtered)
    }, 300) // 300ms debounce for text search
  }





  // Helper function to get category properties from businessCategory
  const getCategoryProps = (businessCategory: any) => {
    if (businessCategory.category) {
      // BusinessMatch format
      return {
        icon: businessCategory.category.icon,
        name: businessCategory.category.name,
        mapColor: businessCategory.category.mapColor,
        confidence: businessCategory.confidence
      }
    } else {
      // Direct object format
      return {
        icon: businessCategory.icon,
        name: businessCategory.name,
        mapColor: businessCategory.mapColor,
        confidence: businessCategory.confidence
      }
    }
  }

  // Component for live renaming marker names


  // Zoom functions
  const zoomIn = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomIn()
    }
  }

  const zoomOut = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomOut()
    }
  }

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

  // Navigate to marker and show its details
  const navigateToMarker = (marker: Marker) => {
    
    if (mapInstance.current) {
      // Smooth pan to marker location
      mapInstance.current.setView([marker.lat, marker.lng], 16, {
        animate: true,
        duration: 0.8
      })
      
      // Find the marker on the map and open its popup
      setTimeout(() => {
        // Get all markers from the cluster group
        const allMarkers = markerClusterRef.current?.getLayers() || []
        
        // Find the specific marker by coordinates
        const targetMarker = allMarkers.find((layer: any) => {
          if (layer.getLatLng) {
            const latLng = layer.getLatLng()
            const isMatch = Math.abs(latLng.lat - marker.lat) < 0.0001 && 
                   Math.abs(latLng.lng - marker.lng) < 0.0001
            if (isMatch) {
            }
            return isMatch
          }
          return false
        })
        
        // Open popup if marker found
        if (targetMarker && targetMarker.openPopup) {
          targetMarker.openPopup()
        } else {
        }
      }, 800) // Wait for animation to complete
    } else {
    }
  }

  // Toggle location mode on/off
  const toggleLocationMode = () => {
    if (locationModeActive) {
      // Turn off location mode
      setLocationModeActive(false)
      setShowNearbyPlaces(false)
      setShowMobileResults(false) // Hide results when location is deactivated
      
      // Remove any visual elements from the map
      if (mapInstance.current) {
        // Remove any existing location markers and circles
        mapInstance.current.eachLayer((layer: any) => {
          if (layer.isLocationMarker || layer.isLocationCircle) {
            mapInstance.current?.removeLayer(layer)
          }
        })
      }
      
      // Clear the circle ref
      userLocationCircleRef.current = null
    } else {
      // Turn on location mode - get current location
      getCurrentLocation()
      setShowMobileResults(true) // Show results when location is activated
      
      // Show random results initially while waiting for location
      const shuffledMarkers = [...markers].sort(() => Math.random() - 0.5)
      setSearchResults(shuffledMarkers.slice(0, 30))
      setSearchTerm('') // Clear search term
    }
  }

  // Get current location
  // Create location circles using the same logic as blue test
  const createLocationCircles = (latitude: number, longitude: number) => {
    if (mapInstance.current) {
      // Calculate optimal zoom level to properly frame the 5km circle
      const optimalZoom = getOptimalZoomForCircle()
      mapInstance.current.setView([latitude, longitude], optimalZoom)
      
      // Find nearby markers within 5km radius
      const nearby = findNearbyMarkers(latitude, longitude, 5)
      setNearbyMarkers(nearby)
      setShowNearbyPlaces(true)
      
      // Add a subtle marker for current location
      const currentLocationIcon = L.divIcon({
        className: 'current-location-marker',
        html: '<div style="width: 16px; height: 16px; background-color: #ff3670; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(255, 54, 112, 0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
      
      const currentLocationMarker = L.marker([latitude, longitude], { icon: currentLocationIcon })
        .bindPopup(t('location.currentLocation'))
        .addTo(mapInstance.current)
      
      // Add a static radius circle
      const radiusCircle = L.circle([latitude, longitude], {
        color: '#ff3670', // Pinz pink color
        fillColor: 'transparent', // No fill
        weight: 2, // Thin line
        radius: 5000 // 5km radius
      }).addTo(mapInstance.current)
      
      // Add soft breathing glow animation
      const circleElement = radiusCircle.getElement() as HTMLElement
      if (circleElement) {
        setTimeout(() => {
          circleElement.style.animation = 'soft-breathing-glow 3s ease-in-out infinite'
          circleElement.classList.add('soft-breathing-glow-animation')
        }, 100)
      } else {
        console.error('❌ Could not get circle element for animation')
      }
      
      // Store references for cleanup when toggling off
      ;(currentLocationMarker as any).isLocationMarker = true
      ;(radiusCircle as any).isLocationCircle = true
      
      // Store circle refs for direct access
      userLocationCircleRef.current = radiusCircle
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.')
      alert(t('errors.geolocationNotSupported'))
      // Use fallback location
      const fallbackLat = 45.5017
      const fallbackLng = -73.5673
      setUserLocation({ lat: fallbackLat, lng: fallbackLng })
      setLocationModeActive(true)
      
      // Show nearest results to fallback location
      const markersWithDistance = markers.map(marker => ({
        ...marker,
        distance: calculateDistance(fallbackLat, fallbackLng, marker.lat, marker.lng)
      })).sort((a, b) => a.distance - b.distance)
      
      // Show the closest 30 markers
      const nearestMarkers = markersWithDistance.slice(0, 30)
      
      setSearchResults(nearestMarkers)
      setSearchTerm('') // Clear search term to show "nearest" results
      
      createLocationCircles(fallbackLat, fallbackLng)
      return
    }

    // Check if we're in an iframe and warn user
    const isInIframe = window !== window.top
    if (isInIframe) {
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        
        // Store user location
        setUserLocation({ lat: latitude, lng: longitude })
        setLocationModeActive(true) // Activate location mode
        
        // Show nearest results now that we have the location
        const markersWithDistance = markers.map(marker => ({
          ...marker,
          distance: calculateDistance(latitude, longitude, marker.lat, marker.lng)
        })).sort((a, b) => a.distance - b.distance)
        
        // Show the closest 30 markers
        const nearestMarkers = markersWithDistance.slice(0, 30)
        
        
        setSearchResults(nearestMarkers)
        setSearchTerm('') // Clear search term to show "nearest" results
        
        // Create the circles using the same logic as blue test
        createLocationCircles(latitude, longitude)
      },
      (error) => {
        console.error('Error getting location:', error)
        
        // Use fallback location
        const fallbackLat = 45.5017
        const fallbackLng = -73.5673
        setUserLocation({ lat: fallbackLat, lng: fallbackLng })
        setLocationModeActive(true)
        
        // Show nearest results to fallback location
        const markersWithDistance = markers.map(marker => ({
          ...marker,
          distance: calculateDistance(fallbackLat, fallbackLng, marker.lat, marker.lng)
        })).sort((a, b) => a.distance - b.distance)
        
        // Show the closest 30 markers
        const nearestMarkers = markersWithDistance.slice(0, 30)
        
        setSearchResults(nearestMarkers)
        setSearchTerm('') // Clear search term to show "nearest" results
        
        createLocationCircles(fallbackLat, fallbackLng)
        
        let errorMessage = t('errors.locationUnavailable')
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += ' ' + t('errors.allowLocationAccess')
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += ' ' + t('errors.locationInfoUnavailable')
            break
          case error.TIMEOUT:
            errorMessage += ' ' + t('errors.locationTimeout')
            break
          default:
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

  // Initialize map
  useEffect(() => {
    
    const initMap = () => {
      if (!mapRef.current) {
        setTimeout(initMap, 100)
        return
      }
      
      if (mapInstance.current) {
        return
      }

      
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

      // Add simple tile layer (using same as dashboard)
      tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        // Fix tile flashing
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 2,
        updateInterval: 200
      } as any).addTo(mapInstance.current)

      mapInstance.current.whenReady(() => {
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
            const clusterBg = effectiveSettings.markerColor || '#3B82F6'
            const clusterBorder = '#ffffff'
            
            return L.divIcon({
              html: `<div class="${className}" style="background: ${clusterBg} !important; border-color: ${clusterBorder} !important; color: #ffffff !important;"><span>${childCount}</span></div>`,
              className: '',
              iconSize: L.point(size, size),
              iconAnchor: L.point(size / 2, size / 2)
            })
          }
          
          // For demo map, use custom clustering settings
          let clusterOptions
          if (mapId === 'demo-map-1000-markers') {
            const clusteringEnabled = customSettings?.clusteringEnabled !== undefined ? customSettings.clusteringEnabled : effectiveSettings.clusteringEnabled
            
            if (clusteringEnabled) {
              clusterOptions = {
                disableClusteringAtZoom: 12,
                maxClusterRadius: 50,
                iconCreateFunction
              }
          } else {
              clusterOptions = {
                disableClusteringAtZoom: 0, // Disable clustering at all zoom levels
                iconCreateFunction
              }
            }
          } else {
            clusterOptions = createClusterOptions(effectiveSettings, iconCreateFunction)
            if (!clusterOptions) {
            // Clustering disabled - create empty cluster group that won't cluster
              clusterOptions = {
              disableClusteringAtZoom: 0, // Disable clustering at all zoom levels
              iconCreateFunction
              }
            }
          }
          
          markerClusterRef.current = (L as any).markerClusterGroup(clusterOptions)
        
        // Add cluster group to map
        if (mapInstance.current && markerClusterRef.current) {
          mapInstance.current.addLayer(markerClusterRef.current)
          
          // Add click event listener to cluster group for debugging
          markerClusterRef.current.on('clusterclick', () => {
          })
        }
        
        // Remove attribution control if it exists
        if (mapInstance.current && mapInstance.current.attributionControl) {
          mapInstance.current.attributionControl.remove()
        }
        
        
        // Listen to map move/zoom events to update visible markers in viewport
        // Event handlers will be set up in a separate useEffect to access current state
      })
    }
    
    // Try to initialize immediately, if that fails, try again after a short delay
    initMap()
  }, [])

  // Update viewport markers when map moves or zooms (always track, but only show when location is not active)
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return
    
    const updateViewportMarkers = () => {
      if (!mapInstance.current) return
      
      try {
        const bounds = mapInstance.current.getBounds()
        const visibleInViewport = markers.filter(marker => {
          // Check if marker is within the current map viewport bounds
          return bounds.contains([marker.lat, marker.lng])
        })
        
        setViewportMarkers(visibleInViewport)
        
        // Update search results to show viewport markers ONLY when location is not active and no search term
        if (!locationModeActive && !searchTerm && showMobileResults) {
          setSearchResults(visibleInViewport)
        }
      } catch (error) {
        console.error('Error updating viewport markers:', error)
      }
    }
    
    // Update on map move and zoom (always track, regardless of location mode)
    mapInstance.current.on('moveend', updateViewportMarkers)
    mapInstance.current.on('zoomend', updateViewportMarkers)
    
    // Initial update after a short delay
    const timeoutId = setTimeout(updateViewportMarkers, 500)
    
    return () => {
      if (mapInstance.current) {
        mapInstance.current.off('moveend', updateViewportMarkers)
        mapInstance.current.off('zoomend', updateViewportMarkers)
      }
      clearTimeout(timeoutId)
    }
  }, [mapLoaded, markers, locationModeActive, searchTerm, showMobileResults])

  // Load map data from Firestore
  useEffect(() => {
    const loadMapData = async () => {
      if (!mapId) {
        setError('Map ID not found')
        setLoading(false)
        return
      }

      try {
        
        // Import Firebase functions dynamically
        const { subscribeToMapDocument, subscribeToMapMarkers } = await import('../firebase/maps')
        
        // Search for the map in user collections
        const { collection, getDocs, doc, getDoc } = await import('firebase/firestore')
        const { db } = await import('../firebase/config')
        
        // Get all users and search for the map
        const usersQuery = collection(db, 'users')
        const usersSnapshot = await getDocs(usersQuery)
        
        let mapDoc = null
        let foundUserId = null
        
        for (const userDoc of usersSnapshot.docs) {
          const mapRef = doc(db, 'users', userDoc.id, 'maps', mapId)
          const mapDocSnapshot = await getDoc(mapRef)
          
          if (mapDocSnapshot.exists()) {
            mapDoc = mapDocSnapshot.data()
            foundUserId = userDoc.id
            break
          }
        }
        
        if (!mapDoc || !foundUserId) {
          setError('Map not found or not publicly accessible')
          setLoading(false)
          return
        }
        
        
        // Set map data
        const mapDataWithPlan = {
          id: mapId,
          name: mapDoc.name,
          description: mapDoc.description,
          userId: foundUserId,
          createdAt: mapDoc.createdAt?.toDate() || new Date(),
          updatedAt: mapDoc.updatedAt?.toDate() || new Date(),
          settings: mapDoc.settings,
          ownerPlan: 'freemium' // Default, will be updated below
        }
        
        // Check map owner's subscription for watermark and validation
        try {
          const { getUserDocument } = await import('../firebase/users')
          const ownerDoc = await getUserDocument(foundUserId)
          const ownerPlan = ownerDoc?.subscription?.plan || 'freemium'
          const { SUBSCRIPTION_PLANS } = await import('../config/subscriptionPlans')
          const ownerPlanLimits = SUBSCRIPTION_PLANS[ownerPlan] || SUBSCRIPTION_PLANS.freemium
          setShowWatermark(ownerPlanLimits.watermark)
          
          // Update owner plan in mapData
          mapDataWithPlan.ownerPlan = ownerPlan
        } catch (error) {
          console.error('Error loading map owner subscription:', error)
          // Keep default watermark setting if error
        }
        
        setMapData(mapDataWithPlan)
        
        // Load map settings
        if (mapDoc.settings) {
          const rawSettings = {
            ...mapDoc.settings,
            // Ensure markerShape defaults to 'pin' if missing (for existing maps)
            markerShape: mapDoc.settings.markerShape || 'pin',
            // Ensure clustering settings have defaults
            clusteringEnabled: mapDoc.settings.clusteringEnabled !== undefined ? mapDoc.settings.clusteringEnabled : true,
            clusterRadius: mapDoc.settings.clusterRadius || 50,
            // Search bar settings with defaults
            searchBarBackgroundColor: mapDoc.settings.searchBarBackgroundColor || '#ffffff',
            searchBarTextColor: mapDoc.settings.searchBarTextColor || '#000000',
            searchBarHoverColor: mapDoc.settings.searchBarHoverColor || '#f3f4f6',
            // Name rules settings with defaults
            nameRules: mapDoc.settings.nameRules || []
          }
          
          // Automatically fix any premium settings to be freemium-compliant
          const compliantSettings = ensureFreemiumCompliance(rawSettings, 'freemium')
          setMapSettings(compliantSettings)
        } else {
        }
        
        // Load folder icons for this map
        const loadFolderIcons = async () => {
          try {
            const { getUserMarkerGroups } = await import('../firebase/firestore')
            const groups = await getUserMarkerGroups(foundUserId, mapId)
            
            const iconStates: Record<string, string> = {}
            groups.forEach(group => {
              if (group.iconUrl) {
                iconStates[group.groupName] = group.iconUrl
              }
            })
            setFolderIcons(iconStates)
          } catch (error) {
            console.error('Error loading folder icons for public map:', error)
          }
        }
        loadFolderIcons()
        
        // Set up real-time listeners for markers and settings
        
              // Use direct user markers subscription with optimized updates and throttling
              let lastUpdateTime = 0
              const throttleDelay = 500 // Throttle updates to max once per 500ms
              
              const unsubscribeMarkers = subscribeToMapMarkers(foundUserId, mapId, (markers: any[]) => {
                const now = Date.now()
                if (now - lastUpdateTime < throttleDelay && mapId === 'demo-map-1000-markers') {
                  // Skip update if throttled (especially important for demo map with many markers)
                  return
                }
                lastUpdateTime = now
                
                
                // Transform markers to ensure correct coordinate structure
                let transformedMarkers = markers.map((marker: any) => ({
                  ...marker,
                  lat: marker.coordinates?.lat || marker.lat,
                  lng: marker.coordinates?.lng || marker.lng,
                  visible: marker.visible !== false // Default to true if not set
                }))
                
                // Limit demo map to 250 markers for performance (keep all in Firestore)
                // Prioritize Quebec/Montreal markers
                if (mapId === 'demo-map-1000-markers' && transformedMarkers.length > 250) {
                  // Define Quebec/Montreal regions (approximate bounding box)
                  const quebecMontrealBounds = {
                    north: 47.0,  // Northern Quebec
                    south: 45.0,  // South of Montreal
                    east: -70.0,  // East of Quebec City
                    west: -74.0   // West of Montreal area
                  }
                  
                  // Helper to check if marker is in Quebec/Montreal region
                  const isInQuebecMontreal = (marker: any) => {
                    const lat = marker.lat || marker.coordinates?.lat
                    const lng = marker.lng || marker.coordinates?.lng
                    return lat >= quebecMontrealBounds.south &&
                           lat <= quebecMontrealBounds.north &&
                           lng >= quebecMontrealBounds.west &&
                           lng <= quebecMontrealBounds.east
                  }
                  
                  // Separate markers into Quebec/Montreal and others
                  const quebecMontrealMarkers = transformedMarkers.filter(isInQuebecMontreal)
                  const otherMarkers = transformedMarkers.filter(m => !isInQuebecMontreal(m))
                  
                  // Prioritize Quebec/Montreal markers, then fill with others
                  const prioritizedMarkers = [
                    ...quebecMontrealMarkers,
                    ...otherMarkers
                  ].slice(0, 250)
                  
                  transformedMarkers = prioritizedMarkers
                }
                
                // Only update if markers actually changed (optimized comparison)
                setMarkers(prevMarkers => {
                  // Quick length check first
                  if (prevMarkers.length !== transformedMarkers.length) {
                    return transformedMarkers as Marker[]
                  }
                  
                  // Create a map for O(1) lookups instead of O(n²) comparison
                  const prevMarkersMap = new Map(prevMarkers.map(m => [m.id, m]))
                  
                  const hasChanged = transformedMarkers.some(current => {
                    const prev = prevMarkersMap.get(current.id)
                    return !prev || 
                           prev.visible !== current.visible || 
                           prev.name !== current.name ||
                           prev.lat !== current.lat ||
                           prev.lng !== current.lng ||
                           prev.address !== current.address
                  })
                  
                  if (hasChanged) {
                    return transformedMarkers as Marker[]
                  }
                  
                  return prevMarkers
                })
              })
        
        const unsubscribeSettings = subscribeToMapDocument(foundUserId, mapId, (mapDoc) => {
          if (mapDoc && mapDoc.settings) {
            const rawSettings = {
              ...mapDoc.settings,
              // Ensure clustering settings have defaults
              clusteringEnabled: mapDoc.settings.clusteringEnabled !== undefined ? mapDoc.settings.clusteringEnabled : true,
              clusterRadius: mapDoc.settings.clusterRadius || 50,
              // Search bar settings with defaults
              searchBarBackgroundColor: mapDoc.settings.searchBarBackgroundColor || '#ffffff',
              searchBarTextColor: mapDoc.settings.searchBarTextColor || '#000000',
              searchBarHoverColor: mapDoc.settings.searchBarHoverColor || '#f3f4f6',
              // Name rules settings with defaults
              nameRules: mapDoc.settings.nameRules || []
            }
            
            // Automatically fix any premium settings to be freemium-compliant
            const compliantSettings = ensureFreemiumCompliance(rawSettings, 'freemium')
            setMapSettings(compliantSettings)
          } else {
          }
        })
        
        setLoading(false)
        
        // Cleanup function
        return () => {
          unsubscribeMarkers()
          unsubscribeSettings()
        }
        
      } catch (error) {
        console.error('Error loading public map data:', error)
        setError('Failed to load map data')
        setLoading(false)
      }
    }

    loadMapData()
  }, [mapId])

  // Update cluster group when mapSettings change
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current) return


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
    
    switch (effectiveSettings.style) {
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
  }, [effectiveSettings.style, mapLoaded])

  // Update markers
  useEffect(() => {
    
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current || loading) {
      return
    }


    // Clear existing markers from cluster group
    markerClusterRef.current.clearLayers()
    markersRef.current = []

    // Add new markers to cluster group
    const visibleMarkers = markers.filter(marker => marker.visible !== false)
    visibleMarkers.forEach((marker) => {
      
      // Get business category for this marker
      const businessCategory = marker.businessCategory || detectBusinessType(marker.name, marker.address, true)
      const categoryProps = getCategoryProps(businessCategory)
      
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
      
      
      // For demo map, use simple shapes. For regular maps, use full marker system
      let customIcon
      
      if (mapId === 'demo-map-1000-markers') {
        // Demo map: Simple shapes based on customSettings
        const markerColor = customSettings?.markerColor || effectiveSettings.markerColor || '#3B82F6'
        const markerShape = customSettings?.markerShape || effectiveSettings.markerShape || 'circle'
        const markerSize = customSettings?.markerSize || effectiveSettings.markerSize || 'medium'
        
        let size = 20
        if (markerSize === 'small') size = 15
        else if (markerSize === 'large') size = 25
        else if (markerSize === 'extra-large') size = 30
        
        // Create shape-specific styling for initial render
        let shapeStyle = ''
        switch (markerShape) {
          case 'circle':
            shapeStyle = 'border-radius: 50%;'
            break
          case 'square':
            shapeStyle = 'border-radius: 4px;'
            break
          case 'triangle':
            shapeStyle = 'border-radius: 0; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);'
            break
          case 'pin':
            shapeStyle = 'border-radius: 50% 50% 50% 0; transform: rotate(-45deg);'
            break
          default:
            shapeStyle = 'border-radius: 50%;'
        }

        customIcon = L.divIcon({
          className: 'simple-marker',
          html: `<div style="
            width: ${size}px;
            height: ${size}px;
            background: ${markerColor};
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ${shapeStyle}
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        })
      } else {
        // Regular maps: Use full marker system with business detection
        const markerData = createMarkerHTML({ mapSettings: effectiveSettings, folderIconUrl })
      const markerHtml = markerData.html
      const iconSize = markerData.iconSize
      const iconAnchor = markerData.iconAnchor

        customIcon = L.divIcon({
        className: 'custom-marker',
        html: markerHtml,
        iconSize: iconSize as [number, number],
        iconAnchor: iconAnchor as [number, number]
      })
      }

      const markerInstance = L.marker([marker.lat, marker.lng], { icon: customIcon })
        .bindPopup(`
          <div style="padding: 12px; font-family: system-ui, sans-serif; min-width: 200px; position: relative;">
            <div style="font-weight: 600; color: #000; font-size: 14px; margin: 0 0 6px 0; padding-right: 20px; position: relative;">
              ${renamedMarkers[marker.id] || applyNameRules(marker.name, mapSettings.nameRules, true)}
              <button 
                onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'flex' : 'none'"
                style="
                  position: absolute; 
                  top: -2px; 
                  right: 0; 
                  width: 16px; 
                  height: 16px; 
                  border: none; 
                  background: #f3f4f6; 
                  border-radius: 50%; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center; 
                  cursor: pointer; 
                  font-size: 9px; 
                  color: #6b7280;
                  transition: all 0.2s ease;
                "
                onmouseover="this.style.background='#e5e7eb'; this.style.color='#374151'"
                onmouseout="this.style.background='#f3f4f6'; this.style.color='#6b7280'"
                title="Show detection details"
              >
                i
              </button>
              <div style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #f8f9fa; border-radius: 4px; padding: 4px 6px; margin-top: 2px;  align-items: center; gap: 4px; z-index: 1000;">
                <span style="font-size: 12px;">${categoryProps.icon}</span>
                <span style="color: #374151; font-size: 10px; font-weight: 500;">${categoryProps.name}</span>
                ${categoryProps.confidence > 0 ? `<span style="color: #6b7280; font-size: 9px; margin-left: auto;">${categoryProps.confidence}%</span>` : ''}
              </div>
            </div>
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
  }, [markers, mapLoaded, folderIcons, loading])

  // Update clustering when settings change
  useEffect(() => {
    if (!mapInstance.current || !markerClusterRef.current || !mapLoaded) return


    // Remove existing cluster group
    if (mapInstance.current.hasLayer(markerClusterRef.current)) {
      mapInstance.current.removeLayer(markerClusterRef.current)
    }

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
      const clusterBg = effectiveSettings.markerColor || '#3B82F6'
      const clusterBorder = '#ffffff'
      
      return L.divIcon({
        html: `<div class="${className}" style="background: ${clusterBg} !important; border-color: ${clusterBorder} !important; color: #ffffff !important;"><span>${childCount}</span></div>`,
        className: '',
        iconSize: L.point(size, size),
        iconAnchor: L.point(size / 2, size / 2)
      })
    }

    // For demo map, use custom clustering settings
    let clusterOptions
    if (mapId === 'demo-map-1000-markers') {
      const clusteringEnabled = customSettings?.clusteringEnabled !== undefined ? customSettings.clusteringEnabled : effectiveSettings.clusteringEnabled
      
      if (clusteringEnabled) {
        clusterOptions = {
          disableClusteringAtZoom: 12,
          maxClusterRadius: 50,
          iconCreateFunction
        }
      } else {
        clusterOptions = {
          disableClusteringAtZoom: 0, // Disable clustering at all zoom levels
          iconCreateFunction
        }
      }
    } else {
      clusterOptions = createClusterOptions(effectiveSettings, iconCreateFunction)
      if (!clusterOptions) {
        // Clustering disabled - create empty cluster group that won't cluster
        clusterOptions = {
          disableClusteringAtZoom: 0, // Disable clustering at all zoom levels
          iconCreateFunction
        }
      }
    }
    
    // Create new cluster group
    markerClusterRef.current = (L as any).markerClusterGroup(clusterOptions)
    
    // Add cluster group to map
    if (mapInstance.current && markerClusterRef.current) {
      mapInstance.current.addLayer(markerClusterRef.current)
      
      // Re-add all existing markers to the new cluster group
      markersRef.current.forEach(marker => {
        markerClusterRef.current.addLayer(marker)
      })
    }

  }, [customSettings?.clusteringEnabled, effectiveSettings.clusteringEnabled, effectiveSettings.markerColor, mapLoaded, mapId])

  // Optimized marker style updates - only update CSS, don't recreate markers
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || mapId !== 'demo-map-1000-markers') return


    // Update CSS custom properties for all markers
    const root = document.documentElement
    const markerColor = customSettings?.markerColor || effectiveSettings.markerColor || '#3B82F6'
    const markerShape = customSettings?.markerShape || effectiveSettings.markerShape || 'circle'
    const markerSize = customSettings?.markerSize || effectiveSettings.markerSize || 'medium'
    
    // Calculate size
    let size = 20
    if (markerSize === 'small') size = 15
    else if (markerSize === 'large') size = 25
    else if (markerSize === 'extra-large') size = 30

    // Update CSS custom properties
    root.style.setProperty('--marker-color', markerColor)
    root.style.setProperty('--marker-size', `${size}px`)
    root.style.setProperty('--marker-border-radius', markerShape === 'circle' ? '50%' : markerShape === 'triangle' ? '0' : '4px')
    root.style.setProperty('--marker-clip-path', markerShape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none')

    // Update all existing marker icons using CSS
    const markerElements = document.querySelectorAll('.simple-marker div')
    markerElements.forEach((element: any) => {
      element.style.background = markerColor
      element.style.width = `${size}px`
      element.style.height = `${size}px`
      
      // Handle different shapes
      switch (markerShape) {
        case 'circle':
          element.style.borderRadius = '50%'
          element.style.clipPath = 'none'
          element.style.transform = 'none'
          break
        case 'square':
          element.style.borderRadius = '4px'
          element.style.clipPath = 'none'
          element.style.transform = 'none'
          break
        case 'triangle':
          element.style.borderRadius = '0'
          element.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'
          element.style.transform = 'none'
          break
        case 'pin':
          element.style.borderRadius = '50% 50% 50% 0'
          element.style.clipPath = 'none'
          element.style.transform = 'rotate(-45deg)'
          break
        default:
          element.style.borderRadius = '50%'
          element.style.clipPath = 'none'
          element.style.transform = 'none'
      }
    })

  }, [customSettings?.markerColor, customSettings?.markerShape, customSettings?.markerSize, effectiveSettings.markerColor, effectiveSettings.markerShape, effectiveSettings.markerSize, mapLoaded, mapId])

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md mx-auto p-6">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('errors.mapNotFound')}</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // Show disabled map message if map uses premium features
  if (isMapDisabled) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('errors.mapUnavailable')}</h3>
          <p className="text-gray-600 mb-4">
            {t('errors.mapUpdating')}
          </p>
          <p className="text-sm text-gray-500">
            {t('errors.contactOwner')}
          </p>
        </div>
      </div>
    )
  }

  // SEO for public map
  const seoTitle = mapData?.name 
    ? `${mapData.name} - PINZ Interactive Map`
    : 'PINZ - Interactive Map'
  const seoDescription = mapData?.description || 
    'Explore this interactive map created with PINZ. View markers, search locations, and navigate the map.'
  
  return (
    <>
      <SEO 
        title={seoTitle}
        description={seoDescription}
        language="en"
        canonical={mapId ? `https://pinzapp.com/${mapId}` : undefined}
        noindex={false}
      />
      <div className="w-full h-screen flex md:flex-row">
      {/* Cache-busting meta tag */}
      <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
      <meta httpEquiv="Pragma" content="no-cache" />
      <meta httpEquiv="Expires" content="0" />
      
      {/* Active Map - Show full interface */}
      <>
        {/* Mobile Search Bar - Float on map */}
        <div className="md:hidden absolute top-4 left-4 right-4 z-[1000]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="block w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-lg text-base"
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
                  onClick={toggleLocationMode}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors ${
                    locationModeActive
                      ? 'text-pinz-600 hover:text-pinz-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={t('location.findMyLocation')}
                >
                  <Navigation className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Mobile Watermark - Under search bar */}
            {isMobile && mapId !== 'demo-map-1000-markers' && showWatermark && (
              <div className="mt-2 flex justify-center">
                <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-600"
                  style={{ fontSize: '10px' }}
                >
                  <img 
                    src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
                    alt="Pinz Logo"
                    style={{ height: '10px', width: 'auto' }}
                  />
                  <span>{t('watermark.poweredBy')}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
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
            allMarkers={markers}
            viewportMarkers={viewportMarkers}
            onToggleLocation={toggleLocationMode}
            locationModeActive={locationModeActive}
            mapSettings={mapSettings}
          />
          
          {/* Language Toggle */}
          <LanguageToggle 
            language={language} 
            onLanguageChange={setLanguage}
            isMobile={isMobile}
            showToggle={showToggle}
          />

          {/* Small Watermark under search bar for Demo Map */}
          {mapId === 'demo-map-1000-markers' && (
            <div className="absolute top-16 left-4 z-[10000]">
              <div 
                onClick={() => {
                  // Show mini modal
                  const modal = document.createElement('div')
                  modal.innerHTML = `
                    <div style="
                      position: fixed;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      background: rgba(255, 255, 255, 0.95);
                      backdrop-filter: blur(12px);
                      border-radius: 12px;
                      padding: 16px 20px;
                      box-shadow: 0 8px 32px rgba(236, 72, 153, 0.15);
                      z-index: 10001;
                      max-width: 280px;
                      border: 1px solid rgba(236, 72, 153, 0.2);
                      text-align: center;
                      animation: fadeInScale 0.2s ease-out;
                    ">
                      <div style="
                        font-size: 14px;
                        color: #374151;
                        font-weight: 500;
                        line-height: 1.4;
                        margin-bottom: 12px;
                      ">Just upgrade to Starter plan to remove this watermark</div>
                      <button onclick="this.parentElement.parentElement.remove()" style="
                        background: linear-gradient(135deg, #ec4899, #be185d);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        padding: 8px 16px;
                        font-size: 12px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3);
                      " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 12px rgba(236, 72, 153, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(236, 72, 153, 0.3)'">
                        Got it!
                      </button>
                    </div>
                    <div style="
                      position: fixed;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      background: rgba(0,0,0,0.2);
                      z-index: 10000;
                      animation: fadeIn 0.2s ease-out;
                    " onclick="this.parentElement.remove()"></div>
                  `
                  
                  // Add CSS animations
                  const style = document.createElement('style')
                  style.textContent = `
                    @keyframes fadeInScale {
                      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    }
                    @keyframes fadeIn {
                      from { opacity: 0; }
                      to { opacity: 1; }
                    }
                  `
                  document.head.appendChild(style)
                  
                  document.body.appendChild(modal)
                  
                  // Auto remove after 5 seconds
                  setTimeout(() => {
                    if (modal.parentElement) {
                      modal.style.animation = 'fadeOut 0.2s ease-in forwards'
                      setTimeout(() => {
                        if (modal.parentElement) {
                          modal.remove()
                        }
                      }, 200)
                    }
                  }, 5000)
                  
                  // Add fadeOut animation
                  const fadeOutStyle = document.createElement('style')
                  fadeOutStyle.textContent = `
                    @keyframes fadeOut {
                      from { opacity: 1; }
                      to { opacity: 0; }
                    }
                  `
                  document.head.appendChild(fadeOutStyle)
                }}
                className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-600 cursor-pointer hover:bg-white hover:shadow-md transition-all duration-200"
                style={{ fontSize: '10px' }}
                title="Click to learn about upgrading"
              >
                <img 
                  src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
                  alt="Pinz Logo"
                  style={{ height: '10px', width: 'auto' }}
                />
                <span>Powered by Pinz</span>
              </div>
            </div>
          )}

          {/* Map Container */}
          <div className="flex-1 relative h-full">
            <div 
              ref={mapRef} 
              className="w-full h-full bg-gray-100"
            />
            
            {/* Interactive Watermark - Show for other maps if required by subscription (Desktop only) */}
            {!isMobile && mapId !== 'demo-map-1000-markers' && showWatermark && (
              <InteractiveWatermark 
                mode="static"
              />
            )}
            
            {/* Language Toggle */}
            <LanguageToggle 
              language={language} 
              onLanguageChange={setLanguage}
              isMobile={isMobile}
              showToggle={showToggle}
            />

            {/* Location Button - Desktop only (mobile has it in search bar) */}
            {!isMobile && (
              <button
                onClick={toggleLocationMode}
                className={`absolute top-16 right-4 z-[1000] p-3 rounded-lg shadow-lg border transition-all duration-200 ${
                  locationModeActive
                    ? 'bg-pinz-50 hover:bg-pinz-100 text-pinz-600 border-pinz-200 shadow-pinz-100'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-xl'
                }`}
                title={t('location.findMyLocation')}
              >
                <Navigation className={`w-5 h-5 transition-all duration-200 ${
                  locationModeActive ? 'text-pinz-600' : 'text-gray-700'
                }`} />
              </button>
            )}

            {/* Show Results Button - Only show when results panel is hidden and on mobile */}
            {!showMobileResults && (
              <button
                onClick={() => setShowMobileResults(true)}
                className="md:hidden absolute bottom-4 left-4 z-[1000] p-3 rounded-lg shadow-lg border bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-xl transition-all duration-200"
                title="Show locations list"
              >
                <List className="w-5 h-5" />
              </button>
            )}

            {/* Zoom Controls - Desktop only */}
            <div className="hidden md:flex absolute bottom-4 right-4 z-[1000] flex-col gap-1">
              <button
                onClick={zoomIn}
                className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 transition-colors"
                title="Zoom in"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={zoomOut}
                className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 transition-colors"
                title="Zoom out"
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>

            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading map...</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile Results Horizontal Bar - Ultra-thin and efficient */}
          {showMobileResults && (
        <div className="md:hidden absolute bottom-3 left-3 right-3 z-[1000]">
          {/* Close button */}
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setShowMobileResults(false)}
              className="p-1.5 bg-white/90 backdrop-blur-sm text-gray-500 hover:text-gray-700 rounded-full shadow-lg hover:bg-white transition-all"
              title="Close results"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          
          {/* Ultra-thin horizontal scrolling results */}
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 overflow-hidden">
            <div className="flex overflow-x-auto scrollbar-hide py-2 px-3 space-x-2">
              {(() => {
                // When searching, use searchResults
                if (searchTerm) {
                  return searchResults
                }
                // On mobile, show all markers but prioritize viewport markers (works with or without location mode)
                return markers
              })().slice(0, 30).map((marker) => {
                // Check if marker is in viewport (on mobile, when not searching - works with location mode active)
                const isInViewport = isMobile && !searchTerm && viewportMarkers.some(vm => vm.id === marker.id)
                const markerOpacity = isInViewport ? 1.0 : 0.4
                
                return (
                  <button
                    key={marker.id}
                    onClick={() => navigateToMarker(marker)}
                    className="flex-shrink-0 w-32 p-2 text-left bg-gray-50/80 hover:bg-gray-100/90 rounded-lg border border-gray-200/50 transition-all hover:shadow-sm"
                    style={{
                      opacity: markerOpacity,
                    }}
                    onMouseEnter={(e) => {
                      // On hover, slightly increase opacity for hidden markers
                      if (!isInViewport) {
                        e.currentTarget.style.opacity = '0.6'
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Restore original opacity on mouse leave
                      e.currentTarget.style.opacity = markerOpacity.toString()
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-xs truncate leading-tight">
                          {renamedMarkers[marker.id] || marker.name}
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
                )
              })}
              
              {(() => {
                const markersToShow = searchTerm 
                  ? searchResults 
                  : markers
                return markersToShow.length === 0
              })() && (
                <div className="flex-shrink-0 w-full flex items-center justify-center py-4 text-gray-500">
                  <div className="text-center">
                    <MapPin className="h-6 w-6 mx-auto mb-1 text-gray-300" />
                    <div className="text-xs">{t('search.noResults')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    </div>
    </>
  )
}

export default PublicMap
