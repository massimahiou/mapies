import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, X } from 'lucide-react'

interface DuplicateNotificationProps {
  isVisible: boolean
  onClose: () => void
  duplicateCount: number
  totalProcessed: number
  type: 'csv' | 'manual'
}

const DuplicateNotification: React.FC<DuplicateNotificationProps> = ({
  isVisible,
  onClose,
  duplicateCount,
  totalProcessed,
  type
}) => {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true)
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  const handleClose = () => {
    setIsAnimating(false)
    setTimeout(onClose, 200) // Allow animation to complete
  }

  if (!isVisible) return null

  const successCount = totalProcessed - duplicateCount
  const isSuccess = duplicateCount === 0
  const isPartial = duplicateCount > 0 && successCount > 0

  return (
    <div className={`fixed top-4 right-4 z-[10000] transition-all duration-300 ${
      isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`max-w-sm bg-white rounded-lg shadow-lg border-l-4 ${
        isSuccess ? 'border-green-500' : isPartial ? 'border-yellow-500' : 'border-red-500'
      }`}>
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {isSuccess ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className={`w-5 h-5 ${isPartial ? 'text-yellow-500' : 'text-red-500'}`} />
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${
                isSuccess ? 'text-green-800' : isPartial ? 'text-yellow-800' : 'text-red-800'
              }`}>
                {type === 'csv' ? 'CSV Upload Complete' : 'Markers Added'}
              </h3>
              <div className="mt-1 text-sm text-gray-600">
                {isSuccess ? (
                  <p>✅ All {totalProcessed} addresses processed successfully!</p>
                ) : isPartial ? (
                  <div>
                    <p>✅ {successCount} addresses added successfully</p>
                    <p className="text-yellow-700 font-medium">
                      ⚠️ {duplicateCount} addresses skipped (already exist)
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-red-700 font-medium">
                      ⚠️ All {duplicateCount} addresses already exist
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      No new markers were added
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={handleClose}
                className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DuplicateNotification
