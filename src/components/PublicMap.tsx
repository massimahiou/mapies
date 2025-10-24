import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { MapPin, Navigation, Plus, Minus, Search, X, List } from 'lucide-react'
import { detectBusinessType } from '../utils/businessDetection'
import { createMarkerHTML, createClusterOptions, applyNameRules } from '../utils/markerUtils'
import PublicMapSidebar from './PublicMapSidebar'
import { MAPBOX_CONFIG } from '../config/mapbox'
import { usePublicFeatureAccess } from '../hooks/useFeatureAccess'
import { useMapFeatureInheritance } from '../hooks/useMapFeatureInheritance'
import MapFeatureLevelHeader from './MapFeatureLevelHeader'
import InteractiveWatermark from './InteractiveWatermark'
import { validateMapAgainstPlan } from '../utils/mapValidation'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

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
}

const PublicMap: React.FC = () => {
  const { mapId } = useParams<{ mapId: string }>()
  const { showWatermark: defaultShowWatermark, hasGeocoding, planLimits } = usePublicFeatureAccess()
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
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Marker[]>([])
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [nearbyMarkers, setNearbyMarkers] = useState<Marker[]>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [locationModeActive, setLocationModeActive] = useState(false)
  const [renamedMarkers] = useState<Record<string, string>>({})
  const [showMobileResults, setShowMobileResults] = useState(false)
  const [isMapDisabled, setIsMapDisabled] = useState(false)
  const [ownerPlanLimits, setOwnerPlanLimits] = useState(planLimits) // Store map owner's actual limits
  const [ownerSubscriptionLoaded, setOwnerSubscriptionLoaded] = useState(false) // Track if owner subscription is loaded
  const [ownerPlan, setOwnerPlan] = useState<keyof typeof SUBSCRIPTION_PLANS>('freemium') // Store owner's plan
  const [hasSmartGrouping, setHasSmartGrouping] = useState(false) // Store map owner's smart grouping capability
  
  // Get map feature inheritance
  const mapInheritance = useMapFeatureInheritance(mapData)
  
  // Re-check limits when subscription is loaded
  useEffect(() => {
    if (ownerSubscriptionLoaded && markers.length > 0 && mapSettings) {
      // Use comprehensive validation against owner's plan
      const validation = validateMapAgainstPlan(markers, mapSettings, ownerPlan, folderIcons)
      setIsMapDisabled(!validation.isValid)
      console.log('🔄 Re-checking map validation after subscription loaded:', {
        ownerPlan,
        markersCount: markers.length,
        validation: validation,
        disabled: !validation.isValid
      })
    }
  }, [ownerSubscriptionLoaded, markers.length, mapSettings, ownerPlan, folderIcons])

  // Geocoding function for postal codes - Using Mapbox API
  const geocodePostalCode = async (postalCode: string): Promise<{lat: number, lng: number} | null> => {
    try {
      // Check if user has geocoding access
      if (!hasGeocoding) {
        console.log('❌ Geocoding not available in current plan')
        return null
      }

      const cleanedPostalCode = postalCode.trim().replace(/\s+/g, '')
      console.log('🌐 Attempting to geocode with Mapbox:', cleanedPostalCode)
      
      // Use Mapbox Geocoding API for postal codes
      const response = await fetch(
        `${MAPBOX_CONFIG.GEOCODING_API_URL}/${cleanedPostalCode}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&country=CA&types=postcode`
      )
      
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('📍 Mapbox geocoding response:', data)
      
      if (data.features && data.features.length > 0) {
        const coordinates = data.features[0].center
        console.log(`✅ Found coordinates for ${cleanedPostalCode}:`, coordinates)
        return {
          lat: coordinates[1], // Mapbox returns [lng, lat]
          lng: coordinates[0]
        }
      }
      
      console.log(`❌ No coordinates found for postal code: ${cleanedPostalCode}`)
      return null
    } catch (error) {
      console.error('Mapbox geocoding error:', error)
      return null
    }
  }

  // Check if search term is a postal code (Canadian format: A1A 1A1 or A1A1A1)
  const isPostalCode = (term: string): boolean => {
    const cleaned = term.trim().replace(/\s+/g, '') // Remove all spaces
    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/
    return postalCodeRegex.test(cleaned)
  }

  // Search functionality with postal code support
  const handleSearch = async (term: string) => {
    console.log('Search term:', term, 'Markers count:', markers.length)
    setSearchTerm(term)
    
    if (!term.trim()) {
      setSearchResults(markers)
      setShowMobileResults(false) // Hide results when search is cleared
          return
        }

    // Show mobile results panel when searching
    setShowMobileResults(true)
    
    // Check if it's a postal code
    if (isPostalCode(term)) {
      console.log('🔍 Detected postal code:', term)
      const coordinates = await geocodePostalCode(term)
      if (coordinates) {
        console.log('📍 Postal code coordinates:', coordinates)
        
        // For postal codes, use only first 3 characters for broader area search
        const postalCodePrefix = term.trim().replace(/\s+/g, '').substring(0, 3)
        console.log('🎯 Using postal code prefix for broader search:', postalCodePrefix)
        
        // Calculate distance for ALL markers and sort by distance
        const markersWithDistance = markers.map(marker => ({
          ...marker,
          distance: calculateDistance(coordinates.lat, coordinates.lng, marker.lat, marker.lng)
        })).sort((a, b) => a.distance - b.distance)
        
        // Show the closest 30 markers (regardless of distance)
        const closestMarkers = markersWithDistance.slice(0, 30)
        
        console.log(`🎯 Showing ${closestMarkers.length} closest markers to ${postalCodePrefix} area`)
        console.log('📍 Closest markers:', closestMarkers.map(m => ({ name: m.name, distance: m.distance })))
        
        setSearchResults(closestMarkers)
        
        // Center map on postal code location
        if (mapInstance.current) {
          mapInstance.current.setView([coordinates.lat, coordinates.lng], 12)
        }
        return
      } else {
        console.log('❌ Could not geocode postal code:', term)
        console.log('🔄 Falling back to regular text search...')
        // Fall through to regular text search
      }
    }
    
    // Regular text search
    const filtered = markers.filter(marker => 
      marker.name.toLowerCase().includes(term.toLowerCase()) ||
      marker.address.toLowerCase().includes(term.toLowerCase())
    )
    
    console.log('Filtered results:', filtered.length, filtered)
    setSearchResults(filtered)
  }





  // Component for live renaming marker names

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
            return Math.abs(latLng.lat - marker.lat) < 0.0001 && 
                   Math.abs(latLng.lng - marker.lng) < 0.0001
          }
          return false
        })
        
        // Open popup if marker found
        if (targetMarker && targetMarker.openPopup) {
          targetMarker.openPopup()
        }
      }, 800) // Wait for animation to complete
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
      console.log('🎲 Getting location - showing random results temporarily')
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
        .bindPopup('📍 Your current location')
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
          console.log('🎯 Soft breathing glow animation applied to location circle')
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
      // Use fallback location
      const fallbackLat = 45.5017
      const fallbackLng = -73.5673
      setUserLocation({ lat: fallbackLat, lng: fallbackLng })
      setLocationModeActive(true)
      
      // Show nearest results to fallback location
      console.log('📍 Geolocation not supported - showing nearest results to fallback')
      const markersWithDistance = markers.map(marker => ({
        ...marker,
        distance: calculateDistance(fallbackLat, fallbackLng, marker.lat, marker.lng)
      })).sort((a, b) => a.distance - b.distance)
      
      // Show the closest 30 markers
      const nearestMarkers = markersWithDistance.slice(0, 30)
      
      console.log(`🎯 Showing ${nearestMarkers.length} nearest markers to fallback location`)
      setSearchResults(nearestMarkers)
      setSearchTerm('') // Clear search term to show "nearest" results
      
      createLocationCircles(fallbackLat, fallbackLng)
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
        setLocationModeActive(true) // Activate location mode
        
        // Show nearest results now that we have the location
        console.log('📍 Location obtained - showing nearest results')
        const markersWithDistance = markers.map(marker => ({
          ...marker,
          distance: calculateDistance(latitude, longitude, marker.lat, marker.lng)
        })).sort((a, b) => a.distance - b.distance)
        
        // Show the closest 30 markers
        const nearestMarkers = markersWithDistance.slice(0, 30)
        
        console.log(`🎯 Showing ${nearestMarkers.length} nearest markers to user location`)
        console.log('📍 Nearest markers:', nearestMarkers.map(m => ({ name: m.name, distance: m.distance })))
        
        setSearchResults(nearestMarkers)
        setSearchTerm('') // Clear search term to show "nearest" results
        
        // Create the circles using the same logic as blue test
        createLocationCircles(latitude, longitude)
      },
      (error) => {
        console.error('Error getting location:', error)
        console.log('📍 Geolocation failed, using fallback location (Montreal)')
        
        // Use fallback location
        const fallbackLat = 45.5017
        const fallbackLng = -73.5673
        setUserLocation({ lat: fallbackLat, lng: fallbackLng })
        setLocationModeActive(true)
        
        // Show nearest results to fallback location
        console.log('📍 Using fallback location - showing nearest results')
        const markersWithDistance = markers.map(marker => ({
          ...marker,
          distance: calculateDistance(fallbackLat, fallbackLng, marker.lat, marker.lng)
        })).sort((a, b) => a.distance - b.distance)
        
        // Show the closest 30 markers
        const nearestMarkers = markersWithDistance.slice(0, 30)
        
        console.log(`🎯 Showing ${nearestMarkers.length} nearest markers to fallback location`)
        setSearchResults(nearestMarkers)
        setSearchTerm('') // Clear search term to show "nearest" results
        
        createLocationCircles(fallbackLat, fallbackLng)
        
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

  // Initialize map
  useEffect(() => {
    console.log('Map initialization useEffect triggered:', {
      mapRef: !!mapRef.current,
      mapInstance: !!mapInstance.current,
      mapRefElement: mapRef.current,
      mapRefDimensions: mapRef.current ? {
        width: mapRef.current.offsetWidth,
        height: mapRef.current.offsetHeight
      } : 'No element'
    })
    
    const initMap = () => {
      if (!mapRef.current) {
        console.log('Map ref not ready, retrying in 100ms...')
        setTimeout(initMap, 100)
        return
      }
      
      if (mapInstance.current) {
        console.log('Map already initialized')
        return
      }

      console.log('Initializing public map...')
      
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
        console.log('Public map loaded successfully')
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
        console.log('Marker cluster group initialized and added to map')
        
        // Remove attribution control if it exists
        if (mapInstance.current && mapInstance.current.attributionControl) {
          mapInstance.current.attributionControl.remove()
        }
        
        console.log('Map state after initialization:', {
          mapLoaded: true,
          mapInstance: !!mapInstance.current,
          markerClusterRef: !!markerClusterRef.current
        })
      })
    }
    
    // Try to initialize immediately, if that fails, try again after a short delay
    initMap()
  }, [])

  // Load map data from Firestore
  useEffect(() => {
    const loadMapData = async () => {
      if (!mapId) {
        setError('Map ID not found')
        setLoading(false)
        return
      }

      try {
        console.log('Loading public map data for:', mapId)
        
        // Import Firebase functions dynamically
        console.log('Importing Firebase functions...')
        const { subscribeToMapDocument, subscribeToMapMarkers } = await import('../firebase/maps')
        console.log('Firebase functions imported successfully')
        
        // Search for the map in user collections
        console.log('Searching for map ID:', mapId, 'in user collections...')
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
            console.log('Found map in user collection:', userDoc.id)
            break
          }
        }
        
        if (!mapDoc || !foundUserId) {
          console.log('Map not found')
          setError('Map not found or not publicly accessible')
          setLoading(false)
          return
        }
        
        console.log('Found map data:', mapDoc)
        
        // Set map data
        setMapData({
          id: mapId,
          name: mapDoc.name,
          description: mapDoc.description,
          userId: foundUserId,
          createdAt: mapDoc.createdAt?.toDate() || new Date(),
          updatedAt: mapDoc.updatedAt?.toDate() || new Date(),
          settings: mapDoc.settings
        })
        
        // Check map owner's subscription for watermark
        try {
          const { getUserDocument } = await import('../firebase/users')
          const ownerDoc = await getUserDocument(foundUserId)
          const ownerPlan = ownerDoc?.subscription?.plan || 'freemium'
          const { SUBSCRIPTION_PLANS } = await import('../config/subscriptionPlans')
          const ownerPlanLimits = SUBSCRIPTION_PLANS[ownerPlan] || SUBSCRIPTION_PLANS.freemium
          setShowWatermark(ownerPlanLimits.watermark)
          setOwnerPlanLimits(ownerPlanLimits) // Store the actual plan limits
          setOwnerPlan(ownerPlan) // Store the owner's plan
          setHasSmartGrouping(ownerPlanLimits.smartGrouping) // Store the owner's smart grouping capability
          setOwnerSubscriptionLoaded(true) // Mark subscription as loaded
          console.log('Map owner subscription:', ownerPlan, 'watermark:', ownerPlanLimits.watermark, 'maxMarkers:', ownerPlanLimits.maxMarkersPerMap, 'smartGrouping:', ownerPlanLimits.smartGrouping)
        } catch (error) {
          console.error('Error loading map owner subscription:', error)
          setOwnerSubscriptionLoaded(true) // Mark as loaded even on error to prevent infinite disabled state
          // Keep default watermark setting if error
        }
        
        // Load map settings
        if (mapDoc.settings) {
          console.log('🎨 Loading initial map settings:', mapDoc.settings)
          setMapSettings({
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
          })
        } else {
          console.log('⚠️ No map settings found in document')
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
            console.log('📁 Folder icons loaded for public map:', Object.keys(iconStates).length, 'icons:', iconStates)
          } catch (error) {
            console.error('Error loading folder icons for public map:', error)
          }
        }
        loadFolderIcons()
        
        // Set up real-time listeners for markers and settings
        console.log('Setting up real-time listeners...')
        
              // Use direct user markers subscription
              const unsubscribeMarkers = subscribeToMapMarkers(foundUserId, mapId, (markers: any[]) => {
                console.log('Public map markers updated:', markers.length, 'markers:', markers)
                setMarkers(markers as Marker[])
                
                // Check if map should be disabled due to limits (only after subscription is loaded)
                if (ownerSubscriptionLoaded) {
                  const isMapDisabled = markers.length > ownerPlanLimits.maxMarkersPerMap
                  setIsMapDisabled(isMapDisabled)
                  if (isMapDisabled) {
                    console.log('⚠️ Map disabled due to marker limit exceeded:', markers.length, '>', ownerPlanLimits.maxMarkersPerMap)
                  } else {
                    console.log('✅ Map enabled - within limits:', markers.length, '<=', ownerPlanLimits.maxMarkersPerMap)
                  }
                } else {
                  console.log('⏳ Waiting for owner subscription data before checking limits...')
                }
              })
        
        const unsubscribeSettings = subscribeToMapDocument(foundUserId, mapId, (mapDoc) => {
          if (mapDoc && mapDoc.settings) {
            console.log('🎨 Public map settings updated via real-time listener:', mapDoc.settings)
            setMapSettings({
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
            })
          } else {
            console.log('⚠️ Real-time listener: No settings found in map document')
          }
        })
        
        console.log('Real-time listeners set up successfully')
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

    console.log('🎨 PublicMap: Updating cluster group with new settings:', mapSettings)

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

    console.log('🎨 PublicMap: Updating map style based on settings:', mapSettings.style)

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
        tileUrl = 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png'
        tileOptions.attribution = '© OpenStreetMap contributors © Stamen Design'
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

    console.log('🎨 PublicMap: Switching to tile URL:', tileUrl)

    // Remove old tile layer and add new one
    if (tileLayerRef.current) {
      mapInstance.current.removeLayer(tileLayerRef.current)
    }
    
    console.log('🎨 Adding tile layer:', tileUrl, tileOptions)
    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions).addTo(mapInstance.current)
  }, [mapSettings.style, mapLoaded])

  // Update markers
  useEffect(() => {
    console.log('📍 PublicMap markers useEffect triggered:', {
      mapInstance: !!mapInstance.current,
      mapLoaded,
      markerClusterRef: !!markerClusterRef.current,
      markersCount: markers.length,
      markers: markers,
      folderIconsCount: Object.keys(folderIcons).length,
      folderIcons: folderIcons,
      loading
    })
    
    if (!mapInstance.current || !mapLoaded || !markerClusterRef.current || loading) {
      console.log('📍 Skipping markers update - missing requirements or still loading')
      return
    }

    console.log('Updating public map markers with clustering:', markers.length)

    // Clear existing markers from cluster group
    markerClusterRef.current.clearLayers()
    markersRef.current = []

    // Add new markers to cluster group
    const visibleMarkers = markers.filter(marker => marker.visible)
    visibleMarkers.forEach(marker => {
      // Get business category for this marker
      const businessCategory = marker.businessCategory || detectBusinessType(marker.name, marker.address, hasSmartGrouping)
      const categoryProps = getCategoryProps(businessCategory)
      
      // Get the renamed name to check for folder icons
      const markerRenamedName = applyNameRules(marker.name, mapSettings.nameRules, hasSmartGrouping)
      
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
      
      console.log('🔍 PublicMap marker icon check:', {
        markerName: marker.name,
        markerRenamedName,
        folderIconUrl,
        availableFolderIcons: Object.keys(folderIcons),
        folderIcons
      })
      
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
          <div style="padding: 12px; font-family: system-ui, sans-serif; min-width: 200px; position: relative;">
            <div style="font-weight: 600; color: #000; font-size: 14px; margin: 0 0 6px 0; padding-right: 20px; position: relative;">
              ${renamedMarkers[marker.id] || applyNameRules(marker.name, mapSettings.nameRules, hasSmartGrouping)}
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
  }, [markers, mapLoaded, mapSettings.markerShape, mapSettings.markerColor, mapSettings.markerSize, mapSettings.markerBorder, mapSettings.markerBorderWidth, mapSettings.clusteringEnabled, mapSettings.clusterRadius, folderIcons, loading, hasSmartGrouping])

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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Map Not Found</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex md:flex-row">
      {/* Cache-busting meta tag */}
      <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
      <meta httpEquiv="Pragma" content="no-cache" />
      <meta httpEquiv="Expires" content="0" />
      
      {/* Map Feature Level Header - Only show for shared maps */}
      {mapInheritance && (
        <div className="absolute top-0 left-0 right-0 z-50">
          <MapFeatureLevelHeader mapInheritance={mapInheritance} />
        </div>
      )}
      
      {isMapDisabled ? (
        // Disabled Map - Show only the deactivation message
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">This map is currently unavailable</h3>
            <p className="text-gray-600 mb-4">
              This map is temporarily disabled. Please check back later or contact the map owner for more information.
            </p>
          </div>
        </div>
      ) : (
        // Active Map - Show full interface
        <>
          {/* Mobile Search Bar - Float on map */}
          <div className="md:hidden absolute top-4 left-4 right-4 z-[1000]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search locations or postal code..."
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
            onToggleLocation={toggleLocationMode}
            locationModeActive={locationModeActive}
            mapSettings={mapSettings}
          />

          {/* Map Container */}
          <div className="flex-1 relative h-full">
            <div 
              ref={mapRef} 
              className="w-full h-full bg-gray-100"
            />
            
            {/* Interactive Watermark - Only show if required by subscription */}
            {showWatermark && (
              <InteractiveWatermark 
                mode="static"
              />
            )}
            
            {/* Location Button */}
            <button
              onClick={toggleLocationMode}
              className={`absolute top-4 right-4 z-[1000] p-3 rounded-lg shadow-lg border transition-all duration-200 ${
                locationModeActive
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 shadow-blue-100'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-xl'
              }`}
              title={locationModeActive ? "Turn off location mode" : "Find my location"}
            >
              <Navigation className={`w-5 h-5 transition-all duration-200 ${
                locationModeActive ? 'text-blue-600' : 'text-gray-700'
              }`} />
            </button>

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
              {(searchTerm || locationModeActive ? searchResults : markers.sort(() => Math.random() - 0.5)).slice(0, 30).map((marker) => (
                <button
                  key={marker.id}
                  onClick={() => navigateToMarker(marker)}
                  className="flex-shrink-0 w-32 p-2 text-left bg-gray-50/80 hover:bg-gray-100/90 rounded-lg border border-gray-200/50 transition-all hover:shadow-sm"
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
                        <div className="text-xs text-blue-600 mt-0.5 leading-tight">
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
                    <MapPin className="h-6 w-6 mx-auto mb-1 text-gray-300" />
                    <div className="text-xs">No locations found</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}

export default PublicMap
