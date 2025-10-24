import React from 'react'
import { Upload, X, FileText, MapPin, CheckCircle } from 'lucide-react'

interface CsvProgressBarProps {
  isVisible: boolean
  uploadProgress: { processed: number; total: number; currentAddress: string }
  onClose: () => void
  processingDetails?: {
    totalRows: number
    processedRows: number
    skippedRows: number
    addressDataCount: number
    duplicateCount: number
    currentStep: string
  }
}

const CsvProgressBar: React.FC<CsvProgressBarProps> = ({
  isVisible,
  uploadProgress,
  onClose,
  processingDetails
}) => {
  if (!isVisible) return null

  const progressPercentage = uploadProgress.total > 0 
    ? Math.round((uploadProgress.processed / uploadProgress.total) * 100)
    : 0

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[10000] w-full max-w-md mx-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Upload className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">CSV Processing</h3>
              <p className="text-xs text-gray-500">{processingDetails?.currentStep || 'Processing markers...'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Main Progress */}
        <div className="mb-3">
          <div className="flex justify-between text-sm text-blue-700 mb-1">
            <span>Markers: {uploadProgress.processed} / {uploadProgress.total}</span>
            <span>{progressPercentage}%</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Processing Details */}
        {processingDetails && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-gray-500" />
                <span className="text-gray-700">CSV rows: <strong>{processingDetails.totalRows}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-gray-500" />
                <span className="text-gray-700">Addresses: <strong>{processingDetails.addressDataCount}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span className="text-gray-700">Processed: <strong>{processingDetails.processedRows}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-3 h-3 text-red-500" />
                <span className="text-gray-700">Skipped: <strong>{processingDetails.skippedRows}</strong></span>
              </div>
            </div>
            {processingDetails.duplicateCount > 0 && (
              <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                ⚠️ {processingDetails.duplicateCount} duplicates found
              </div>
            )}
          </div>
        )}

        {/* Current Address */}
        {uploadProgress.currentAddress && uploadProgress.currentAddress !== 'Complete' && (
          <div className="text-xs text-gray-600 truncate bg-blue-50 p-2 rounded-lg border border-blue-100">
            <span className="font-medium text-blue-700">Processing:</span> {uploadProgress.currentAddress}
          </div>
        )}

        {/* Completion Message */}
        {uploadProgress.currentAddress === 'Complete' && (
          <div className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded-lg border border-green-100">
            ✅ Upload complete! {uploadProgress.processed} markers added to map.
          </div>
        )}
      </div>
    </div>
  )
}

export default CsvProgressBar
