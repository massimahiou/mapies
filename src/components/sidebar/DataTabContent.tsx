import React, { useState, useCallback } from 'react'
import { Plus, Upload, Maximize2, Shapes } from 'lucide-react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import { canUserPerformAction, debugUserLimits } from '../../utils/featureAccess'
import { useAuth } from '../../contexts/AuthContext'
import CityPolygonModal from '../CityPolygonModal'

interface DataTabContentProps {
  onShowAddMarkerModal: () => void
  onShowCsvModal: () => void
  onShowPolygonModal?: () => void
  onGenerateCityPolygon?: (coordinates: Array<{lat: number, lng: number}>, name: string) => void
  isUploading?: boolean
  uploadProgress?: { processed: number; total: number; currentAddress: string }
  onOpenModal?: () => void
  currentMarkerCount?: number
  currentPolygonCount?: number
}

const DataTabContent: React.FC<DataTabContentProps> = ({
  onShowAddMarkerModal,
  onShowCsvModal,
  onShowPolygonModal,
  onGenerateCityPolygon,
  isUploading = false,
  uploadProgress = { processed: 0, total: 0, currentAddress: '' },
  onOpenModal,
  currentMarkerCount = 0
}) => {
  const { userDocument } = useAuth()
  const { canAddMarkers, planLimits } = useFeatureAccess()
  const [isAddingMarker, setIsAddingMarker] = useState(false)
  const [showCityPolygonModal, setShowCityPolygonModal] = useState(false)
  
  // Debug user limits
  debugUserLimits(userDocument)
  
  // Check if user can add more markers
  const canAddMoreMarkers = canAddMarkers(currentMarkerCount)
  
  // Check specific feature access
  const canUseGeocoding = canUserPerformAction(userDocument, 'useGeocoding')
  
  // Calculate markers remaining
  const markersRemaining = Math.max(0, planLimits.maxMarkersPerMap - currentMarkerCount)
  
  // Debounced handler for adding markers
  const handleAddMarkerClick = useCallback(() => {
    if (isAddingMarker) {
      console.log('🚫 Add marker button clicked while already processing, ignoring')
      return
    }
    
    setIsAddingMarker(true)
    console.log('Add marker button clicked')
    onShowAddMarkerModal()
    
    // Reset the loading state after a short delay
    setTimeout(() => {
      setIsAddingMarker(false)
    }, 1000)
  }, [isAddingMarker, onShowAddMarkerModal])
  return (
    <div className="p-4">
      {/* Header with Modal Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Add Data</h3>
        {onOpenModal && (
          <button
            onClick={onOpenModal}
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
            title="Open in full screen"
          >
            <Maximize2 className="w-4 h-4" />
            Open in Modal
          </button>
        )}
      </div>
      
      {/* Marker Count Display */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Your Markers</p>
            <p className="text-xs text-blue-700">
              {currentMarkerCount} of {planLimits.maxMarkersPerMap} used
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-blue-900">{markersRemaining}</p>
            <p className="text-xs text-blue-700">remaining</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <button
          onClick={handleAddMarkerClick}
          disabled={!canAddMoreMarkers || isAddingMarker}
          className={`w-full flex items-center gap-2 ${
            canAddMoreMarkers && !isAddingMarker
              ? 'btn-primary' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
          }`}
          title={
            isAddingMarker
              ? 'Processing...'
              : !canAddMoreMarkers 
                ? 'Marker limit reached - consider upgrading' 
                : canUseGeocoding
                  ? 'Add a marker by address'
                  : 'Add a marker by coordinates'
          }
        >
          <Plus className="w-4 h-4" />
          {isAddingMarker ? 'Processing...' : 'Add a marker'}
        </button>
        <button
          onClick={() => {
            console.log('Import CSV button clicked')
            onShowCsvModal()
          }}
          disabled={!canAddMoreMarkers}
          className={`w-full flex items-center gap-2 ${
            canAddMoreMarkers
              ? 'btn-secondary' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
          }`}
          title={
            !canAddMoreMarkers 
              ? 'Marker limit reached - consider upgrading' 
              : 'Import markers from CSV file'
          }
        >
          <Upload className="w-4 h-4" />
          Import a Spreadsheet
        </button>
        <button
          onClick={() => {
            console.log('🔷 Draw Region button clicked, calling onShowPolygonModal')
            onShowPolygonModal?.()
            console.log('🔷 onShowPolygonModal called, handler exists:', !!onShowPolygonModal)
          }}
          className="w-full flex items-center gap-2 btn-secondary"
          title="Draw regions/zones on your map"
        >
          <Shapes className="w-4 h-4" />
          Draw a Region
        </button>
        <button
          onClick={() => setShowCityPolygonModal(true)}
          className="w-full flex items-center gap-2 btn-secondary"
          title="Generate polygon from city or postal code automatically"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Generate by City/Postal Code
        </button>
        
        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="mt-3 p-3 bg-pinz-50 border border-pinz-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-pinz-600">Processing markers...</p>
              <p className="text-xs text-pinz-500">
                {uploadProgress.total > 0 ? `${uploadProgress.processed}/${uploadProgress.total} markers loaded` : 'Preparing...'}
              </p>
            </div>
            <div className="w-full bg-pinz-200 rounded-full h-2">
              <div 
                className="bg-pinz-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: uploadProgress.total > 0 
                    ? `${(uploadProgress.processed / uploadProgress.total) * 100}%` 
                    : '0%' 
                }}
              ></div>
            </div>
            {uploadProgress.currentAddress && uploadProgress.currentAddress !== 'Complete' && (
              <p className="text-xs text-blue-500 mt-2 truncate">
                Currently processing: {uploadProgress.currentAddress}
              </p>
            )}
            {uploadProgress.currentAddress === 'Complete' && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                ✅ Upload complete! {uploadProgress.processed} markers added to map.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="mt-6 space-y-3">
        <p className="text-sm text-gray-600">
          Add markers manually or import them from a CSV file with name and address columns.
        </p>
        
        {/* Drawing Tools */}
        {onShowPolygonModal && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Drawing Tools:</p>
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Click a tool below, then use it on the map:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    console.log('Drawing: Polygon tool clicked')
                    const polygonBtn = document.querySelector('.leaflet-draw-draw-polygon') as HTMLElement
                    if (polygonBtn) polygonBtn.click()
                    else console.log('⚠️ Polygon button not found in toolbar')
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs bg-pink-50 border border-pink-300 text-pink-700 rounded hover:bg-pink-100 transition-colors"
                  title="Draw a polygon"
                >
                  <Shapes className="w-4 h-4" />
                  Polygon
                </button>
                <button
                  onClick={() => {
                    console.log('Drawing: Rectangle tool clicked')
                    const rectBtn = document.querySelector('.leaflet-draw-draw-rectangle') as HTMLElement
                    if (rectBtn) rectBtn.click()
                    else console.log('⚠️ Rectangle button not found in toolbar')
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs bg-pink-50 border border-pink-300 text-pink-700 rounded hover:bg-pink-100 transition-colors"
                  title="Draw a rectangle"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 2v10H6V5h8z" />
                  </svg>
                  Rectangle
                </button>
                <button
                  onClick={() => {
                    console.log('Drawing: Circle tool clicked')
                    const circleBtn = document.querySelector('.leaflet-draw-draw-circle') as HTMLElement
                    if (circleBtn) circleBtn.click()
                    else console.log('⚠️ Circle button not found in toolbar')
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs bg-pink-50 border border-pink-300 text-pink-700 rounded hover:bg-pink-100 transition-colors"
                  title="Draw a circle"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Circle
                </button>
                <button
                  onClick={() => {
                    console.log('Drawing: Line tool clicked')
                    const lineBtn = document.querySelector('.leaflet-draw-draw-polyline') as HTMLElement
                    if (lineBtn) lineBtn.click()
                    else console.log('⚠️ Polyline button not found in toolbar')
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs bg-pink-50 border border-pink-300 text-pink-700 rounded hover:bg-pink-100 transition-colors"
                  title="Draw a line"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5h10M5 10h10M5 15h10" />
                  </svg>
                  Line
                </button>
                <button
                  onClick={() => {
                    console.log('Generate from City/Postal Code button clicked')
                    alert('City/Postal code polygon generation coming soon!')
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-50 border border-blue-300 text-blue-700 rounded hover:bg-blue-100 transition-colors col-span-2"
                  title="Generate polygon from city or postal code automatically"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Generate by City/Postal Code
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* City/Postal Code Polygon Modal */}
      <CityPolygonModal
        isOpen={showCityPolygonModal}
        onClose={() => setShowCityPolygonModal(false)}
        onSubmit={(coordinates, name) => {
          console.log('🔷 DataTabContent onSubmit wrapper called:', { coordsCount: coordinates.length, name, hasHandler: !!onGenerateCityPolygon })
          if (onGenerateCityPolygon) {
            console.log('🔷 Calling onGenerateCityPolygon from DataTabContent')
            onGenerateCityPolygon(coordinates, name)
          } else {
            console.error('❌ onGenerateCityPolygon is undefined in DataTabContent!')
          }
        }}
      />
    </div>
  )
}

export default DataTabContent

