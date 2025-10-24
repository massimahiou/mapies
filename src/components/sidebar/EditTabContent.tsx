import React from 'react'
import { Maximize2 } from 'lucide-react'

interface MapSettings {
  style: string
  markerShape: string
  markerColor: string
  markerSize: string
  markerBorder: string
  markerBorderWidth: number
  // Clustering settings
  clusteringEnabled: boolean
  clusterRadius: number
  // Search bar settings
  searchBarBackgroundColor: string
  searchBarTextColor: string
  searchBarHoverColor: string
  // Name rules settings
  nameRules: Array<{ id: string; contains: string; renameTo: string }>
}

interface EditTabContentProps {
  mapSettings: MapSettings
  onMapSettingsChange: (settings: MapSettings) => void
  onOpenModal?: () => void
}

const EditTabContent: React.FC<EditTabContentProps> = ({
  mapSettings,
  onMapSettingsChange,
  onOpenModal
}) => {
  return (
    <div className="p-4">
      {/* Header with Modal Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Map Settings</h3>
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
      
      {/* Map Style */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Map Style</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onMapSettingsChange({...mapSettings, style: 'light'})}
            className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
              mapSettings.style === 'light' 
                ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="mb-2">
              <div className="w-full h-12 rounded-md bg-gradient-to-br from-blue-100 to-green-100 border border-gray-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-white opacity-60"></div>
                <div className="absolute top-1 left-1 w-2 h-2 bg-gray-300 rounded-sm"></div>
                <div className="absolute top-2 left-4 w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="absolute top-3 left-6 w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="absolute top-4 left-2 w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="absolute bottom-1 right-1 w-3 h-3 bg-pinz-200 rounded-sm"></div>
              </div>
            </div>
            Light
          </button>
          <button
            onClick={() => onMapSettingsChange({...mapSettings, style: 'dark'})}
            className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
              mapSettings.style === 'dark' 
                ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="mb-2">
              <div className="w-full h-12 rounded-md bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-200 relative overflow-hidden">
                <div className="absolute top-1 left-1 w-2 h-2 bg-gray-600 rounded-sm"></div>
                <div className="absolute top-2 left-4 w-1 h-1 bg-gray-500 rounded-full"></div>
                <div className="absolute top-3 left-6 w-1 h-1 bg-gray-500 rounded-full"></div>
                <div className="absolute top-4 left-2 w-1 h-1 bg-gray-500 rounded-full"></div>
                <div className="absolute bottom-1 right-1 w-3 h-3 bg-gray-700 rounded-sm"></div>
              </div>
            </div>
            Dark
          </button>
          <button
            onClick={() => onMapSettingsChange({...mapSettings, style: 'toner'})}
            className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
              mapSettings.style === 'toner' 
                ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="mb-2">
              <div className="w-full h-12 rounded-md bg-white border border-gray-200 relative overflow-hidden">
                <div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-sm"></div>
                <div className="absolute top-2 left-4 w-1 h-1 bg-gray-800 rounded-full"></div>
                <div className="absolute top-3 left-6 w-1 h-1 bg-gray-800 rounded-full"></div>
                <div className="absolute top-4 left-2 w-1 h-1 bg-gray-800 rounded-full"></div>
                <div className="absolute bottom-1 right-1 w-3 h-3 bg-gray-200 rounded-sm"></div>
                <div className="absolute top-0 left-0 w-full h-full">
                  <div className="w-full h-px bg-gray-300 absolute top-2"></div>
                  <div className="w-full h-px bg-gray-300 absolute top-4"></div>
                  <div className="w-full h-px bg-gray-300 absolute top-6"></div>
                  <div className="w-full h-px bg-gray-300 absolute top-8"></div>
                </div>
              </div>
            </div>
            Toner
          </button>
          <button
            onClick={() => onMapSettingsChange({...mapSettings, style: 'satellite'})}
            className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
              mapSettings.style === 'satellite' 
                ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="mb-2">
              <div className="w-full h-12 rounded-md bg-gradient-to-br from-green-400 via-green-500 to-green-600 border border-gray-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-300 to-green-700 opacity-80"></div>
                <div className="absolute top-1 left-1 w-2 h-2 bg-gray-600 rounded-sm"></div>
                <div className="absolute top-2 left-4 w-1 h-1 bg-gray-700 rounded-full"></div>
                <div className="absolute top-3 left-6 w-1 h-1 bg-gray-700 rounded-full"></div>
                <div className="absolute top-4 left-2 w-1 h-1 bg-gray-700 rounded-full"></div>
                <div className="absolute bottom-1 right-1 w-3 h-3 bg-pinz-400 rounded-sm"></div>
                <div className="absolute top-0 left-0 w-full h-full">
                  <div className="absolute top-1 left-2 w-1 h-1 bg-green-200 rounded-full"></div>
                  <div className="absolute top-2 right-2 w-1 h-1 bg-green-200 rounded-full"></div>
                  <div className="absolute bottom-2 left-3 w-1 h-1 bg-green-200 rounded-full"></div>
                </div>
              </div>
            </div>
            Satellite
          </button>
        </div>
      </div>

      {/* Markers Design */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Markers Design</h3>
        
        {/* Marker Shape */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Shape</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'circle'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerShape === 'circle' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              ●
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'square'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerShape === 'square' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              ■
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'diamond'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerShape === 'diamond' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              ◆
            </button>
          </div>
        </div>

        {/* Marker Color */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#000000'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerColor === '#000000' 
                  ? 'border-pinz-600 bg-pinz-50' 
                  : 'border-gray-300 bg-black text-white hover:bg-gray-800'
              }`}
            >
              Black
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#3B82F6'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerColor === '#3B82F6' 
                  ? 'border-pinz-600 bg-pinz-50' 
                  : 'border-gray-300 bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Blue
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#EF4444'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerColor === '#EF4444' 
                  ? 'border-pinz-600 bg-pinz-50' 
                  : 'border-gray-300 bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Red
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#10B981'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerColor === '#10B981' 
                  ? 'border-pinz-600 bg-pinz-50' 
                  : 'border-gray-300 bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Green
            </button>
          </div>
        </div>

        {/* Marker Size */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Size</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'small'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerSize === 'small' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Small
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'medium'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerSize === 'medium' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'large'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerSize === 'large' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Large
            </button>
          </div>
        </div>

        {/* Marker Border */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Border</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerBorder: 'white'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerBorder === 'white' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              White
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerBorder: 'black'})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerBorder === 'black' 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-black text-white hover:bg-gray-800'
              }`}
            >
              Black
            </button>
          </div>
        </div>

        {/* Border Width */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Border Width</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 1})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerBorderWidth === 1 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              1px
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 2})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerBorderWidth === 2 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              2px
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 3})}
              className={`p-2 border rounded text-xs ${
                mapSettings.markerBorderWidth === 3 
                  ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              3px
            </button>
          </div>
        </div>
      </div>

      {/* Clustering Settings */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Clustering</h3>
        
        {/* Clustering Toggle */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Enable Clustering</label>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onMapSettingsChange({...mapSettings, clusteringEnabled: true})}
              className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${
                mapSettings.clusteringEnabled 
                  ? 'border-pinz-600 bg-pinz-600 text-white' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Enabled
            </button>
            <button
              onClick={() => onMapSettingsChange({...mapSettings, clusteringEnabled: false})}
              className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${
                !mapSettings.clusteringEnabled 
                  ? 'border-red-600 bg-red-600 text-white' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Disabled
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {mapSettings.clusteringEnabled 
              ? 'Markers will be grouped into clusters when zoomed out' 
              : 'All markers will be shown individually (no clustering)'}
          </p>
        </div>

        {/* Cluster Radius - Only show when clustering is enabled */}
        {mapSettings.clusteringEnabled && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">Cluster Sensitivity</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 30})}
                className={`p-2 border rounded text-xs ${
                  mapSettings.clusterRadius === 30 
                    ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                High
              </button>
              <button
                onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 50})}
                className={`p-2 border rounded text-xs ${
                  mapSettings.clusterRadius === 50 
                    ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 80})}
                className={`p-2 border rounded text-xs ${
                  mapSettings.clusterRadius === 80 
                    ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Low
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Lower values = more clusters, higher values = fewer clusters</p>
          </div>
        )}

      </div>

      {/* Search Bar Settings */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Bar</h3>
        
        {/* Background Color */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Search Panel Background</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={mapSettings.searchBarBackgroundColor}
              onChange={(e) => onMapSettingsChange({...mapSettings, searchBarBackgroundColor: e.target.value})}
              className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={mapSettings.searchBarBackgroundColor}
              onChange={(e) => onMapSettingsChange({...mapSettings, searchBarBackgroundColor: e.target.value})}
              placeholder="#ffffff"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-pinz-500 focus:border-pinz-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Match your website's color scheme</p>
        </div>

        {/* Text Color */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Marker List Text Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={mapSettings.searchBarTextColor}
              onChange={(e) => onMapSettingsChange({...mapSettings, searchBarTextColor: e.target.value})}
              className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={mapSettings.searchBarTextColor}
              onChange={(e) => onMapSettingsChange({...mapSettings, searchBarTextColor: e.target.value})}
              placeholder="#000000"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-pinz-500 focus:border-pinz-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Color for marker names and addresses in the list</p>
        </div>

        {/* Hover Color */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Hover Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={mapSettings.searchBarHoverColor}
              onChange={(e) => onMapSettingsChange({...mapSettings, searchBarHoverColor: e.target.value})}
              className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={mapSettings.searchBarHoverColor}
              onChange={(e) => onMapSettingsChange({...mapSettings, searchBarHoverColor: e.target.value})}
              placeholder="#f3f4f6"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-pinz-500 focus:border-pinz-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Color for hover effects on marker list items</p>
        </div>

        {/* Reset Button */}
        <div className="mb-4">
          <button
            onClick={() => onMapSettingsChange({
              ...mapSettings,
              searchBarBackgroundColor: '#ffffff',
              searchBarTextColor: '#000000',
              searchBarHoverColor: '#f3f4f6'
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditTabContent

