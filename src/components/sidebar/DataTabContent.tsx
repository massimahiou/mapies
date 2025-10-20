import React from 'react'
import { Plus, Upload } from 'lucide-react'

interface DataTabContentProps {
  onShowAddMarkerModal: () => void
  onShowCsvModal: () => void
  isUploading?: boolean
  uploadProgress?: { processed: number; total: number; currentAddress: string }
}

const DataTabContent: React.FC<DataTabContentProps> = ({
  onShowAddMarkerModal,
  onShowCsvModal,
  isUploading = false,
  uploadProgress = { processed: 0, total: 0, currentAddress: '' }
}) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Data</h3>
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
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-600">Processing markers...</p>
              <p className="text-xs text-blue-500">
                {uploadProgress.total > 0 ? `${uploadProgress.processed}/${uploadProgress.total} markers loaded` : 'Preparing...'}
              </p>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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

