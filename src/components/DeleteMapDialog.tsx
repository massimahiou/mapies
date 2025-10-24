import React from 'react'
import { AlertTriangle } from 'lucide-react'

interface DeleteMapDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  mapName: string
  markerCount: number
  isDeleting: boolean
  isOwnedMap?: boolean
}

const DeleteMapDialog: React.FC<DeleteMapDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mapName,
  markerCount,
  isDeleting,
  isOwnedMap = true
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isOwnedMap ? 'Delete Map' : 'Leave Map'}
              </h3>
              <p className="text-sm text-gray-500">
                {isOwnedMap ? 'This action cannot be undone' : 'You can rejoin if invited again'}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Are you sure you want to {isOwnedMap ? 'delete' : 'leave'} <strong>"{mapName}"</strong>?
            </p>
            <p className="text-sm text-gray-600">
              {isOwnedMap 
                ? `This will permanently delete the map and all ${markerCount} markers in it.`
                : `You will no longer have access to this map and its ${markerCount} markers.`
              }
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isOwnedMap ? 'Deleting...' : 'Leaving...'}
                </>
              ) : (
                isOwnedMap ? 'Delete Map' : 'Leave Map'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteMapDialog
