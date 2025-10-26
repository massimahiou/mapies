import React, { useState, useCallback } from 'react'
import { Plus, Upload, Maximize2 } from 'lucide-react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import { canUserPerformAction, debugUserLimits } from '../../utils/featureAccess'
import { useAuth } from '../../contexts/AuthContext'

interface DataTabContentProps {
  onShowAddMarkerModal: () => void
  onShowCsvModal: () => void
  isUploading?: boolean
  uploadProgress?: { processed: number; total: number; currentAddress: string }
  onOpenModal?: () => void
  currentMarkerCount?: number
}

const DataTabContent: React.FC<DataTabContentProps> = ({
  onShowAddMarkerModal,
  onShowCsvModal,
  isUploading = false,
  uploadProgress = { processed: 0, total: 0, currentAddress: '' },
  onOpenModal,
  currentMarkerCount = 0
}) => {
  const { userDocument } = useAuth()
  const { canAddMarkers, planLimits } = useFeatureAccess()
  const [isAddingMarker, setIsAddingMarker] = useState(false)
  
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
      <div className="mt-6 text-sm text-gray-600">
        <p>Add markers manually or import them from a CSV file with name and address columns.</p>
      </div>
    </div>
  )
}

export default DataTabContent

