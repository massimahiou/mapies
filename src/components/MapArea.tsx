import React from 'react'
import Map from './Map'

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
}

interface MapAreaProps {
  markers: Marker[]
  activeTab: string
  mapSettings: any
  userLocation: {lat: number, lng: number} | null
  locationError: string
  onGetCurrentLocation: () => void
  iframeDimensions: { width: number; height: number }
  onIframeDimensionsChange: (dimensions: { width: number; height: number }) => void
  folderIcons?: Record<string, string>
  onOpenSubscription?: () => void
  currentMap?: any // Add current map data to determine ownership
  showPolygonDrawing?: boolean // Pass through polygon drawing mode
  onMapSettingsChange?: (settings: any) => void // Callback to update map settings
}

const MapArea: React.FC<MapAreaProps> = ({ markers, activeTab, mapSettings, userLocation, locationError, onGetCurrentLocation, iframeDimensions, onIframeDimensionsChange, folderIcons = {}, onOpenSubscription, currentMap, showPolygonDrawing, onMapSettingsChange }) => {
  const isPublishMode = activeTab === 'publish'
  return <Map markers={markers} activeTab={activeTab} mapSettings={mapSettings} isPublishMode={isPublishMode} userLocation={userLocation} locationError={locationError} onGetCurrentLocation={onGetCurrentLocation} iframeDimensions={iframeDimensions} onIframeDimensionsChange={onIframeDimensionsChange} folderIcons={folderIcons} onOpenSubscription={onOpenSubscription} currentMap={currentMap} showPolygonDrawing={showPolygonDrawing} onMapSettingsChange={onMapSettingsChange} />
}

export default MapArea
