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
}

const MapArea: React.FC<MapAreaProps> = ({ markers, activeTab, mapSettings, userLocation, locationError, onGetCurrentLocation, iframeDimensions, onIframeDimensionsChange, folderIcons = {} }) => {
  const isPublishMode = activeTab === 'publish'
  return <Map markers={markers} activeTab={activeTab} mapSettings={mapSettings} isPublishMode={isPublishMode} userLocation={userLocation} locationError={locationError} onGetCurrentLocation={onGetCurrentLocation} iframeDimensions={iframeDimensions} onIframeDimensionsChange={onIframeDimensionsChange} folderIcons={folderIcons} />
}

export default MapArea
