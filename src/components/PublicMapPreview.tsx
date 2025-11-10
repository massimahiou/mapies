import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { Search, Navigation, X } from 'lucide-react'
import { createMarkerHTML, createClusterOptions, MarkerCreationOptions } from '../utils/markerUtils'
import InteractiveWatermark from './InteractiveWatermark'
import PublicMapTagFilter from './PublicMapTagFilter'
import { useEmbedMapLanguage } from '../hooks/useEmbedMapLanguage'
import LanguageToggle from './LanguageToggle'

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: undefined
})

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  tags?: string[]
}

interface MapSettings {
  style?: string
  markerShape?: string
  markerColor?: string
  markerSize?: string
  markerBorder?: string
  markerBorderWidth?: number
  clusteringEnabled?: boolean
  clusterRadius?: number
  searchBarBackgroundColor?: string
  searchBarTextColor?: string
  searchBarHoverColor?: string
  tags?: string[]
}

interface PublicMapPreviewProps {
  markers: Marker[]
  mapSettings: MapSettings
  height?: string
}

const PublicMapPreview: React.FC<PublicMapPreviewProps> = ({ 
  markers, 
  mapSettings,
  height = '500px'
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const markerClusterRef = useRef<any>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const { language, setLanguage, t } = useEmbedMapLanguage()

  // Get available tags from mapSettings
  const availableTags = mapSettings.tags || []
  
  // Calculate tag marker counts
  const tagMarkerCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    availableTags.forEach((tag) => {
      counts[tag] = markers.filter(m => (m.tags || []).includes(tag)).length
    })
    return counts
  }, [markers, availableTags])

  // Filter markers by tags
  const filteredMarkers = React.useMemo(() => {
    if (selectedTags.size === 0) return markers
    return markers.filter(marker => {
      const markerTags = marker.tags || []
      return Array.from(selectedTags).some(tag => markerTags.includes(tag))
    })
  }, [markers, selectedTags])

  // Filter by search term
  const displayMarkers = React.useMemo(() => {
    if (!searchTerm) return filteredMarkers
    const term = searchTerm.toLowerCase()
    return filteredMarkers.filter(m => 
      m.name.toLowerCase().includes(term) || 
      m.address.toLowerCase().includes(term)
    )
  }, [filteredMarkers, searchTerm])

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

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, {
      center: [46.8, -71.2], // Quebec center
      zoom: 7,
      zoomControl: false,
      attributionControl: false
    })

    mapInstance.current = map

    // Add tile layer based on style
    const style = mapSettings.style || 'dark'
    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    let tileOptions: any = {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2,
      updateInterval: 200
    }
    
    switch (style) {
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
      case 'topo':
        tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        tileOptions.attribution = '© OpenStreetMap contributors, © OpenTopoMap'
        break
      default:
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        tileOptions.attribution = '© OpenStreetMap contributors © CARTO'
        break
    }

    const tileLayer = L.tileLayer(tileUrl, tileOptions)
    tileLayer.addTo(map)
    tileLayerRef.current = tileLayer

    setMapLoaded(true)

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // Update map style when it changes
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current || !mapLoaded) return

    const style = mapSettings.style || 'dark'
    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    let tileOptions: any = {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2,
      updateInterval: 200
    }
    
    switch (style) {
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
    
    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions)
    tileLayerRef.current.addTo(mapInstance.current)
  }, [mapSettings.style, mapLoaded])

  // Update markers on map
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return

    // Clear existing markers
    markersRef.current.forEach(marker => {
      if (markerClusterRef.current) {
        markerClusterRef.current.removeLayer(marker)
      } else {
        mapInstance.current!.removeLayer(marker)
      }
    })
    markersRef.current = []

    if (displayMarkers.length === 0) return

    // Create cluster group if clustering is enabled
    if (mapSettings.clusteringEnabled) {
      if (!markerClusterRef.current) {
        const iconCreateFunction = (cluster: any) => {
          const count = cluster.getChildCount()
          const clusterBg = mapSettings.markerColor || '#3B82F6'
          const clusterBorder = '#ffffff'
          
          return L.divIcon({
            html: `<div style="background-color: ${clusterBg}; border: 2px solid ${clusterBorder}; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${count}</div>`,
            className: 'custom-cluster-icon',
            iconSize: [40, 40]
          })
        }

        const clusterOptions = createClusterOptions(mapSettings as any, iconCreateFunction)
        if (clusterOptions) {
          markerClusterRef.current = (L as any).markerClusterGroup(clusterOptions)
          mapInstance.current.addLayer(markerClusterRef.current)
        }
      }
    }

    // Add markers
    displayMarkers.forEach(marker => {
      if (!marker.visible) return

      const markerHTMLResult = createMarkerHTML({
        mapSettings: {
          markerShape: mapSettings.markerShape || 'pin',
          markerColor: mapSettings.markerColor || '#3B82F6',
          markerSize: mapSettings.markerSize || 'medium',
          markerBorder: mapSettings.markerBorder || 'white',
          markerBorderWidth: mapSettings.markerBorderWidth || 2
        } as any
      } as MarkerCreationOptions)

      const leafletMarker = L.marker([marker.lat, marker.lng], {
        icon: L.divIcon({
          html: markerHTMLResult.html,
          className: 'custom-marker',
          iconSize: markerHTMLResult.iconSize,
          iconAnchor: markerHTMLResult.iconAnchor
        })
      })

      if (markerClusterRef.current && mapSettings.clusteringEnabled) {
        markerClusterRef.current.addLayer(leafletMarker)
      } else {
        leafletMarker.addTo(mapInstance.current!)
      }

      markersRef.current.push(leafletMarker)
    })

    // Fit bounds to markers
    if (displayMarkers.length > 0) {
      const bounds = L.latLngBounds(displayMarkers.map(m => [m.lat, m.lng]))
      mapInstance.current.fitBounds(bounds.pad(0.1), { maxZoom: 13, padding: [20, 20] })
    }
  }, [displayMarkers, mapLoaded, mapSettings.clusteringEnabled, mapSettings.markerShape, mapSettings.markerColor, mapSettings.markerSize, mapSettings.markerBorder, mapSettings.markerBorderWidth])

  return (
    <div className="w-full border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm" style={{ height }}>
      {/* Preview Header */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-medium text-gray-600">Public Map Preview</p>
      </div>

      {/* Map Container */}
      <div className="relative" style={{ height: `calc(${height} - 40px)` }}>
        <div ref={mapRef} className="w-full h-full" />

        {/* Search Bar - Desktop */}
        <div className="absolute top-4 left-4 right-4 z-[1000] hidden md:block">
          <div 
            className="rounded-lg shadow-lg p-3"
            style={{ backgroundColor: mapSettings.searchBarBackgroundColor || '#ffffff' }}
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4" style={{ color: mapSettings.searchBarTextColor || '#374151' }} />
              </div>
              <input
                type="text"
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm"
                style={{ color: '#374151' }}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  title="Location"
                >
                  <Navigation className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <div className="mt-2">
                <PublicMapTagFilter
                  availableTags={availableTags}
                  selectedTags={selectedTags}
                  onTagToggle={toggleTagFilter}
                  onClearAll={clearTagFilters}
                  markerCounts={tagMarkerCounts}
                  mapSettings={{
                    searchBarBackgroundColor: mapSettings.searchBarBackgroundColor || '#ffffff',
                    searchBarTextColor: mapSettings.searchBarTextColor || '#374151'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="absolute top-0 left-0 right-0 z-[1000] md:hidden">
          <div 
            className="p-3 border-b border-gray-200"
            style={{ backgroundColor: mapSettings.searchBarBackgroundColor || '#ffffff' }}
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  title="Location"
                >
                  <Navigation className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mobile Tag Filter */}
            {availableTags.length > 0 && (
              <div className="mt-2">
                <PublicMapTagFilter
                  availableTags={availableTags}
                  selectedTags={selectedTags}
                  onTagToggle={toggleTagFilter}
                  onClearAll={clearTagFilters}
                  markerCounts={tagMarkerCounts}
                  mapSettings={{
                    searchBarBackgroundColor: mapSettings.searchBarBackgroundColor || '#ffffff',
                    searchBarTextColor: mapSettings.searchBarTextColor || '#374151'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Watermark */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[999]">
          <InteractiveWatermark mode="static" />
        </div>

        {/* Language Toggle - Mobile */}
        <div className="absolute bottom-4 right-4 z-[999] md:hidden">
          <LanguageToggle 
            language={language} 
            onLanguageChange={setLanguage}
            isMobile={true}
            showToggle={true}
          />
        </div>
      </div>
    </div>
  )
}

export default PublicMapPreview

