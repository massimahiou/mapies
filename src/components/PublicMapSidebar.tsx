import React from 'react'
import { Search, X, Navigation, MapPin } from 'lucide-react'
import { applyNameRules } from '../utils/markerUtils'

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

interface PublicMapSidebarProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  searchResults: Marker[]
  nearbyMarkers: Marker[]
  showNearbyPlaces: boolean
  onNavigateToMarker: (marker: Marker) => void
  userLocation: {lat: number, lng: number} | null
  calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number
  renamedMarkers: Record<string, string>
  allMarkers: Marker[]
  onToggleLocation: () => void
  locationModeActive: boolean
  mapSettings: {
    searchBarBackgroundColor: string
    searchBarTextColor: string
    searchBarHoverColor: string
    nameRules: Array<{ id: string; contains: string; renameTo: string }>
  }
}

// RenamedMarkerName component for consistent naming
const RenamedMarkerName: React.FC<{ 
  marker: Marker; 
  renamedMarkers: Record<string, string>;
  mapSettings: { nameRules: Array<{ id: string; contains: string; renameTo: string }> }
}> = ({ marker, renamedMarkers, mapSettings }) => {
  return (
    <span>
      {renamedMarkers[marker.id] || applyNameRules(marker.name, mapSettings.nameRules)}
    </span>
  )
}

const PublicMapSidebar: React.FC<PublicMapSidebarProps> = ({
  searchTerm,
  onSearchChange,
  searchResults,
  nearbyMarkers,
  showNearbyPlaces,
  onNavigateToMarker,
  userLocation,
  calculateDistance,
  renamedMarkers,
  allMarkers,
  onToggleLocation,
  locationModeActive,
  mapSettings
}) => {
  const clearSearch = () => {
    onSearchChange('')
  }

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'pharmacy': return '🏥'
      case 'grocery': return '🛒'
      case 'retail': return '🏪'
      default: return '•'
    }
  }

  // Determine which markers to show - always show all results
  const markersToShow = searchTerm.trim() === '' ? allMarkers : searchResults
  
  console.log('PublicMapSidebar - searchTerm:', searchTerm)
  console.log('PublicMapSidebar - searchResults.length:', searchResults.length)
  console.log('PublicMapSidebar - allMarkers.length:', allMarkers.length)
  console.log('PublicMapSidebar - markersToShow.length:', markersToShow.length)
  
  // Sort markers based on context - make it obvious!
  const sortedMarkers = markersToShow.sort((a, b) => {
    // If location mode is active, sort by distance
    if (showNearbyPlaces && userLocation) {
      const aDistance = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng)
      const bDistance = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
      return aDistance - bDistance
    }
    
    // Otherwise sort alphabetically (obvious default)
    return a.name.localeCompare(b.name)
  })

  // Always show all results - location button only changes sorting priority
  const markersToDisplay = sortedMarkers

  return (
    <div className="w-80 flex flex-col h-full hidden md:flex" style={{ backgroundColor: mapSettings.searchBarBackgroundColor, color: mapSettings.searchBarTextColor }}>
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
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm"
          />
          <div className="absolute inset-y-0 right-0 flex items-center">
            {searchTerm ? (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-12 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              onClick={onToggleLocation}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {markersToShow.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No locations found</p>
              <p className="text-xs mt-1">Try adjusting your search terms</p>
            </div>
          ) : (
            <>
              {/* Location status header */}
              {showNearbyPlaces && nearbyMarkers.length > 0 && (
                <div className="mb-3 px-2 py-1">
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

              {/* Unified marker list */}
              {markersToDisplay.map((marker) => {
                const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng) : 0
                const isNearby = nearbyMarkers.some(nearby => nearby.id === marker.id)
                
                return (
                  <button
                    key={marker.id}
                    onClick={() => onNavigateToMarker(marker)}
                    className={`w-full flex items-center gap-3 p-3 transition-all duration-200 text-left rounded-lg mb-2 group ${
                      isNearby && showNearbyPlaces 
                        ? 'bg-pinz-50/30' 
                        : ''
                    }`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = mapSettings.searchBarHoverColor
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isNearby && showNearbyPlaces ? 'rgba(236, 72, 153, 0.1)' : 'transparent'
                    }}
                  >
                    <span className="text-lg">{getMarkerIcon(marker.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: mapSettings.searchBarTextColor }}>
                        <RenamedMarkerName marker={marker} renamedMarkers={renamedMarkers} mapSettings={mapSettings} />
                      </p>
                      <p className="text-xs truncate" style={{ color: mapSettings.searchBarTextColor, opacity: 0.7 }}>
                        {marker.address}
                      </p>
                      {/* Show distance when location mode is active */}
                      {showNearbyPlaces && distance > 0 && (
                        <p className={`text-xs font-medium mt-1 ${
                          isNearby ? 'text-pinz-600' : 'text-gray-600'
                        }`}>
                          {distance.toFixed(1)} km away
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isNearby && showNearbyPlaces && (
                        <div className="w-2 h-2 bg-pinz-500 rounded-full"></div>
                      )}
                      <MapPin className={`w-4 h-4 transition-colors ${
                        isNearby && showNearbyPlaces 
                          ? 'text-pinz-500 group-hover:text-pinz-600' 
                          : 'group-hover:text-gray-500'
                      }`} style={{ color: mapSettings.searchBarTextColor }} />
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicMapSidebar