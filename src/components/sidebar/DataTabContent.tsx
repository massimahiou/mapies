import React from 'react'
import { Plus, Upload, Maximize2 } from 'lucide-react'

interface DataTabContentProps {
  onShowAddMarkerModal: () => void
  onShowCsvModal: () => void
  isUploading?: boolean
  uploadProgress?: { processed: number; total: number; currentAddress: string }
  onOpenModal?: () => void
}

const DataTabContent: React.FC<DataTabContentProps> = ({
  onShowAddMarkerModal,
  onShowCsvModal,
  isUploading = false,
  uploadProgress = { processed: 0, total: 0, currentAddress: '' },
  onOpenModal
}) => {
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
      
      <div className="space-y-3">
        <button
          onClick={() => {
            console.log('Add marker button clicked')
            onShowAddMarkerModal()
          }}
          className="btn-primary w-full flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add a marker
        </button>
        <button
          onClick={() => {
            console.log('Import CSV button clicked')
            onShowCsvModal()
          }}
          className="btn-secondary w-full flex items-center gap-2"
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

