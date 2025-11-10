import React from 'react'
import { Search, X, Navigation, MapPin, Tag } from 'lucide-react'
import { applyNameRules } from '../utils/markerUtils'
import { formatAddressForList } from '../utils/addressUtils'
import { usePublicFeatureAccess } from '../hooks/useFeatureAccess'
import { useEmbedMapLanguage } from '../hooks/useEmbedMapLanguage'
import PublicMapTagFilter from './PublicMapTagFilter'

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
  viewportMarkers?: Marker[] // Markers visible in current viewport (optional, used in public maps)
  mapSettings: {
    searchBarBackgroundColor: string
    searchBarTextColor: string
    searchBarHoverColor: string
    nameRules: Array<{ id: string; contains: string; renameTo: string }>
    tags?: string[] // Available tags from map settings
  }
  availableTags?: string[]
  selectedTags?: Set<string>
  onTagToggle?: (tag: string) => void
  onClearTagFilters?: () => void
  tagMarkerCounts?: Record<string, number>
}

// RenamedMarkerName component for consistent naming
const RenamedMarkerName: React.FC<{ 
  marker: Marker; 
  renamedMarkers: Record<string, string>;
  mapSettings: { nameRules: Array<{ id: string; contains: string; renameTo: string }> }
}> = ({ marker, renamedMarkers, mapSettings }) => {
  const { hasSmartGrouping } = usePublicFeatureAccess()
  return (
    <span>
      {renamedMarkers[marker.id] || applyNameRules(marker.name, mapSettings.nameRules, hasSmartGrouping)}
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
  viewportMarkers,
  mapSettings,
  availableTags = [],
  selectedTags = new Set(),
  onTagToggle,
  onClearTagFilters,
  tagMarkerCounts = {}
}) => {
  const { t } = useEmbedMapLanguage()
  
  const clearSearch = () => {
    onSearchChange('')
  }


  // Check if a marker is in the current viewport
  const isMarkerInViewport = (marker: Marker): boolean => {
    if (!viewportMarkers || viewportMarkers.length === 0) return true // If no viewport data, assume all visible
    return viewportMarkers.some(vm => vm.id === marker.id)
  }

  // Determine which markers to show - always show ALL markers, but visually distinguish by viewport
  const markersToShow = (() => {
    // When searching, use searchResults
    if (searchTerm.trim() !== '') {
      return searchResults
    }
    // Always show all markers (not filtered by viewport)
    return allMarkers
  })()
  
  // Sort markers based on context - viewport markers first, then hidden ones
  const sortedMarkers = markersToShow.sort((a, b) => {
    // First, prioritize viewport visibility (viewport markers come first)
    if (!locationModeActive && viewportMarkers && viewportMarkers.length > 0) {
      const aInViewport = isMarkerInViewport(a)
      const bInViewport = isMarkerInViewport(b)
      if (aInViewport !== bInViewport) {
        return aInViewport ? -1 : 1 // Viewport markers first
      }
    }
    
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
    <div className="w-80 min-w-[320px] flex flex-col h-full hidden md:flex" style={{ backgroundColor: mapSettings.searchBarBackgroundColor, color: mapSettings.searchBarTextColor }}>
      {/* Search Bar - Flex shrink to allow content to grow */}
      <div className="flex-shrink-0 p-3 pb-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm min-w-0"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">
            {searchTerm ? (
              <button
                onClick={clearSearch}
                className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title={t('search.clear') || 'Clear search'}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              onClick={onToggleLocation}
              className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
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
        
        {/* Tag Filter - Compact spacing with smooth transitions */}
        {availableTags.length > 0 && onTagToggle && onClearTagFilters && (
          <div className="mt-2 mb-0 transition-all duration-200 ease-in-out">
            <PublicMapTagFilter
              availableTags={availableTags}
              selectedTags={selectedTags}
              onTagToggle={onTagToggle}
              onClearAll={onClearTagFilters}
              markerCounts={tagMarkerCounts}
              mapSettings={mapSettings}
            />
          </div>
        )}
      </div>

      {/* Content - Flex grow to fill remaining space, with min-h-0 for proper scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-1 pb-4">
          {markersToShow.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">{t('search.noResults')}</p>
              <p className="text-xs mt-1">{t('search.tryAdjusting')}</p>
            </div>
          ) : (
            <>
              {/* Location status header */}
              {showNearbyPlaces && nearbyMarkers.length > 0 && (
                <div className="mb-2 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-pinz-200 rounded-full flex items-center justify-center">
                      <Navigation className="w-2 h-2 text-pinz-500" />
                    </div>
                    <span className="text-xs text-pinz-600 font-medium">
                      {t('location.sortedByDistance')}
                    </span>
                  </div>
                </div>
              )}

              {/* Unified marker list */}
              {markersToDisplay.map((marker) => {
                const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng) : 0
                const isNearby = nearbyMarkers.some(nearby => nearby.id === marker.id)
                // Check if marker is in viewport (only when not in location mode and viewport data exists)
                const isInViewport = locationModeActive || !viewportMarkers || viewportMarkers.length === 0 ? true : isMarkerInViewport(marker)
                
                // Visual distinction: reduce opacity and apply grayscale for hidden markers
                const markerOpacity = isInViewport ? 1.0 : 0.4
                const markerFilter = isInViewport ? 'none' : 'grayscale(100%)'
                
                return (
                  <button
                    key={marker.id}
                    onClick={() => onNavigateToMarker(marker)}
                    className="w-full flex items-center gap-3 p-3 transition-all duration-200 text-left rounded-lg mb-2 group"
                    style={{
                      opacity: markerOpacity,
                      filter: markerFilter,
                    }}
                    onMouseEnter={(e) => {
                      // On hover, slightly increase opacity for hidden markers
                      if (!isInViewport) {
                        e.currentTarget.style.opacity = '0.6'
                      }
                      e.currentTarget.style.backgroundColor = mapSettings.searchBarHoverColor
                    }}
                    onMouseLeave={(e) => {
                      // Restore original opacity on mouse leave
                      e.currentTarget.style.opacity = markerOpacity.toString()
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: mapSettings.searchBarTextColor }}>
                        <RenamedMarkerName marker={marker} renamedMarkers={renamedMarkers} mapSettings={mapSettings} />
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
                          {distance.toFixed(1)} {t('location.kmAway')}
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
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicMapSidebar