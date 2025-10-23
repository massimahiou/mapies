import React from 'react'
import { X } from 'lucide-react'
import PublishTabContent from './sidebar/PublishTabContent'

interface PublishManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onShowPublishModal: () => void
  currentMapId: string | null
}

const PublishManagementModal: React.FC<PublishManagementModalProps> = ({
  isOpen,
  onClose,
  onShowPublishModal,
  currentMapId
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">Publish Your Map</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <PublishTabContent
            onShowPublishModal={onShowPublishModal}
            currentMapId={currentMapId}
            // Don't pass onOpenModal to avoid recursive modal opening
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PublishManagementModal
