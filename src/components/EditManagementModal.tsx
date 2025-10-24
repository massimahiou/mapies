import React from 'react'
import { X } from 'lucide-react'
import EditTabContent from './sidebar/EditTabContent'

interface MapSettings {
  style: string
  markerShape: string
  markerColor: string
  markerSize: string
  markerBorder: string
  markerBorderWidth: number
  clusteringEnabled: boolean
  clusterRadius: number
  searchBarBackgroundColor: string
  searchBarTextColor: string
  searchBarHoverColor: string
  nameRules: Array<{ id: string; contains: string; renameTo: string }>
}

interface EditManagementModalProps {
  isOpen: boolean
  onClose: () => void
  mapSettings: MapSettings
  onMapSettingsChange: (settings: MapSettings) => void
}

const EditManagementModal: React.FC<EditManagementModalProps> = ({
  isOpen,
  onClose,
  mapSettings,
  onMapSettingsChange
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">Map Settings</h2>
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
          <EditTabContent
            mapSettings={mapSettings}
            onMapSettingsChange={onMapSettingsChange}
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

export default EditManagementModal
