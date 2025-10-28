import React, { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { generateSimplifiedPolygon, findBoundaryWithReverseGeocoding } from '../utils/cityPolygonGenerator'

interface CityPolygonModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (coordinates: Array<{lat: number, lng: number}>, name: string) => void
}

const CityPolygonModal: React.FC<CityPolygonModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [input, setInput] = useState('')
  const [type, setType] = useState<'city' | 'postal_code'>('city')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [progress, setProgress] = useState({ current: 0, total: 10, message: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!input.trim()) {
      setError('Please enter a city name or postal code')
      return
    }

    setLoading(true)
    setProgress({ current: 0, total: 10, message: 'Starting...' })
    
    try {
      // Postal codes: use Mapbox geocoding + boundary detection algorithm
      // Cities: use Nominatim directly (better results for cities)
      const result = type === 'postal_code'
        ? await findBoundaryWithReverseGeocoding(input.trim(), type, (current, total, message) => {
            setProgress({ current, total, message })
          })
        : await generateSimplifiedPolygon(input.trim(), type)
      
      if (!result.success) {
        setError(result.error || 'Failed to generate polygon')
        return
      }

      if (result.coordinates.length > 0) {
        console.log('🔷 Modal calling onSubmit with:', { name: result.name, coordsCount: result.coordinates.length })
        console.log('🔷 onSubmit function exists?:', typeof onSubmit === 'function')
        if (typeof onSubmit === 'function') {
          onSubmit(result.coordinates, result.name)
          console.log('🔷 Modal onSubmit called successfully')
        } else {
          console.error('❌ onSubmit is not a function!')
        }
        onClose()
        setInput('')
        setProgress({ current: 0, total: 10, message: '' })
      } else {
        setError('No boundary found for this location')
      }
    } catch (err) {
      console.error('Error generating polygon:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
      setProgress({ current: 0, total: 10, message: '' })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Generate Region by Location</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('city')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    type === 'city'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  City
                </button>
                <button
                  type="button"
                  onClick={() => setType('postal_code')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    type === 'postal_code'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  Postal Code
                </button>
              </div>
            </div>

            {/* Input Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === 'city' ? 'City Name' : 'Postal Code'}
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={type === 'city' ? 'e.g., Montreal' : 'e.g., H3A 1Y1'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Progress Bar */}
            {loading && progress.message && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{progress.message}</span>
                  <span className="text-gray-500">{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </button>
            </div>
          </form>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              {type === 'postal_code' 
                ? 'Postal codes: Boundary is detected by testing postal codes at different distances (may take 20-30 seconds).'
                : 'This will automatically create a polygon boundary for the specified location using OpenStreetMap data.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CityPolygonModal

