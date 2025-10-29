import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { PolygonDocument, updateMapPolygon } from '../firebase/maps'

interface PolygonEditModalProps {
  isOpen: boolean
  onClose: () => void
  polygon: PolygonDocument | null
  userId: string
  mapId: string
  currentMap?: any
  onSave: () => void
}

const PolygonEditModal: React.FC<PolygonEditModalProps> = ({
  isOpen,
  onClose,
  polygon,
  userId,
  mapId,
  currentMap,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fillColor: '#3388ff',
    fillOpacity: 0.2,
    strokeColor: '#3388ff',
    strokeWeight: 3,
    strokeOpacity: 0.8
  })

  useEffect(() => {
    if (polygon) {
      setFormData({
        name: polygon.name || '',
        description: polygon.description || '',
        fillColor: polygon.fillColor || '#3388ff',
        fillOpacity: polygon.fillOpacity ?? 0.2,
        strokeColor: polygon.strokeColor || '#3388ff',
        strokeWeight: polygon.strokeWeight ?? 3,
        strokeOpacity: polygon.strokeOpacity ?? 0.8
      })
    }
  }, [polygon])

  if (!isOpen || !polygon) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!polygon.id) return

    try {
      const polygonOwnerId = currentMap?.userId || userId
      await updateMapPolygon(polygonOwnerId, mapId, polygon.id, {
        name: formData.name,
        description: formData.description || undefined,
        fillColor: formData.fillColor,
        fillOpacity: formData.fillOpacity,
        strokeColor: formData.strokeColor,
        strokeWeight: formData.strokeWeight,
        strokeOpacity: formData.strokeOpacity
      })
      
      onSave()
      onClose()
    } catch (error) {
      console.error('Error updating polygon:', error)
      alert('Failed to update polygon. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Edit Region</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Region name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional description"
            />
          </div>

          {/* Fill Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fill Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.fillColor}
                onChange={(e) => setFormData({ ...formData, fillColor: e.target.value })}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.fillColor}
                onChange={(e) => setFormData({ ...formData, fillColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="#3388ff"
              />
            </div>
          </div>

          {/* Fill Opacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fill Opacity: {formData.fillOpacity}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.fillOpacity}
              onChange={(e) => setFormData({ ...formData, fillOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Stroke Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Border Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.strokeColor}
                onChange={(e) => setFormData({ ...formData, strokeColor: e.target.value })}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.strokeColor}
                onChange={(e) => setFormData({ ...formData, strokeColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="#3388ff"
              />
            </div>
          </div>

          {/* Stroke Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Border Width: {formData.strokeWeight}px
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={formData.strokeWeight}
              onChange={(e) => setFormData({ ...formData, strokeWeight: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Stroke Opacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Border Opacity: {formData.strokeOpacity}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.strokeOpacity}
              onChange={(e) => setFormData({ ...formData, strokeOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PolygonEditModal

