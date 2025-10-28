import React, { useState } from 'react'
import { X, MapPin } from 'lucide-react'

interface PolygonPropertiesModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    description: string
    fillColor: string
    fillOpacity: number
    strokeColor: string
    strokeWeight: number
    strokeOpacity: number
    category?: { id: string; name: string; color: string }
    properties?: { district?: string; zone?: string; administrativeLevel?: string; population?: number; notes?: string }
  }) => void
  initialData?: {
    name?: string
    description?: string
  }
}

const PolygonPropertiesModal: React.FC<PolygonPropertiesModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [fillColor, setFillColor] = useState('#ff3670')
  const [fillOpacity, setFillOpacity] = useState(0.3)
  const [strokeColor, setStrokeColor] = useState('#ff3670')
  const [strokeWeight, setStrokeWeight] = useState(2)
  const [strokeOpacity] = useState(1.0)
  const [categoryName, setCategoryName] = useState('')
  const [district, setDistrict] = useState('')
  const [administrativeLevel, setAdministrativeLevel] = useState('')
  const [population, setPopulation] = useState('')
  const [notes, setNotes] = useState('')

  const presetColors = [
    '#ff3670', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899'
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const data = {
      name,
      description,
      fillColor,
      fillOpacity,
      strokeColor,
      strokeWeight,
      strokeOpacity,
      category: categoryName ? {
        id: categoryName.toLowerCase().replace(/\s+/g, '_'),
        name: categoryName,
        color: strokeColor
      } : undefined,
      properties: (district || administrativeLevel || population || notes) ? {
        district: district || undefined,
        administrativeLevel: administrativeLevel || undefined,
        population: population ? parseInt(population) : undefined,
        notes: notes || undefined
      } : undefined
    }

    onSubmit(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-pinz-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-pinz-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Region Properties</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
                placeholder="e.g., Downtown Service Zone"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
                placeholder="Describe this region or zone"
                rows={3}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category/Zone Name
              </label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
                placeholder="e.g., Zone A, Ward 1, Service Area"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex gap-2 mb-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setFillColor(color)
                      setStrokeColor(color)
                    }}
                    className={`w-10 h-10 rounded-lg border-2 ${
                      fillColor === color ? 'border-pinz-600' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => {
                    setFillColor(e.target.value)
                    setStrokeColor(e.target.value)
                  }}
                  className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={fillColor}
                  onChange={(e) => {
                    setFillColor(e.target.value)
                    setStrokeColor(e.target.value)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="#ff3670"
                />
              </div>
            </div>

            {/* Fill Opacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fill Opacity: {Math.round(fillOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={fillOpacity}
                onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Stroke Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Border Width: {strokeWeight}px
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={strokeWeight}
                onChange={(e) => setStrokeWeight(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* District */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                District
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
                placeholder="e.g., Old Montreal"
              />
            </div>

            {/* Administrative Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Administrative Level
              </label>
              <select
                value={administrativeLevel}
                onChange={(e) => setAdministrativeLevel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
              >
                <option value="">Select...</option>
                <option value="Borough">Borough</option>
                <option value="Ward">Ward</option>
                <option value="Precinct">Precinct</option>
                <option value="District">District</option>
                <option value="Zone">Zone</option>
                <option value="Neighborhood">Neighborhood</option>
              </select>
            </div>

            {/* Population */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Population
              </label>
              <input
                type="number"
                value={population}
                onChange={(e) => setPopulation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
                placeholder="e.g., 25000"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
                placeholder="Additional notes about this region"
                rows={2}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name}
              className={`flex-1 px-4 py-2 bg-pinz-600 text-white rounded-lg font-medium transition-colors ${
                !name ? 'opacity-50 cursor-not-allowed' : 'hover:bg-pinz-700'
              }`}
            >
              Add Region
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PolygonPropertiesModal

