import React from 'react'
import { Globe, Copy, Maximize2, Tag, MapPin } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import PublicMapPreview from '../PublicMapPreview'

interface MapSettings {
  style?: string
  markerShape?: string
  markerColor?: string
  markerSize?: string
  markerBorder?: string
  markerBorderWidth?: number
  clusteringEnabled?: boolean
  clusterRadius?: number
  searchBarBackgroundColor?: string
  searchBarTextColor?: string
  searchBarHoverColor?: string
  tags?: string[]
  [key: string]: any
}

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  tags?: string[]
}

interface PublishTabContentProps {
  onShowPublishModal: () => void
  currentMapId: string | null
  onOpenModal?: () => void
  mapSettings?: MapSettings
  markers?: Marker[]
}

const PublishTabContent: React.FC<PublishTabContentProps> = ({
  onShowPublishModal,
  currentMapId,
  onOpenModal,
  mapSettings = {},
  markers = []
}) => {
  const { showToast } = useToast()

  const generatePublicUrl = () => {
    if (!currentMapId) {
      return 'Please select a map to generate public URL'
    }
    const url = `${window.location.origin}/${currentMapId}`
    return url
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatePublicUrl())
      showToast({
        type: 'success',
        title: 'Link copied!',
        message: 'Link copied to clipboard'
      })
    } catch (err) {
      console.error('Failed to copy: ', err)
      showToast({
        type: 'error',
        title: 'Failed to copy',
        message: 'Could not copy link to clipboard'
      })
    }
  }

  return (
    <div className="p-4">
      {/* Header with Modal Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Publish Your Map</h3>
        {onOpenModal && (
          <button
            onClick={onOpenModal}
            className="hidden sm:flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Open in full screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      
      {/* Public Share Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-pinz-600" />
              Public Share Link
            </h3>
            <p className="text-sm text-gray-600">Share your map with anyone using a simple link</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="p-3 bg-pinz-50 rounded-lg border border-pinz-200">
            <p className="text-sm text-gray-600 mb-2">Your public link:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white p-2 rounded border text-gray-800 break-all">
                {generatePublicUrl()}
              </code>
              <button
                onClick={copyToClipboard}
                className="p-2 text-gray-500 hover:text-pinz-600 hover:bg-pinz-50 rounded transition-colors"
                title="Copy link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <button
            onClick={onShowPublishModal}
            className="w-full bg-pinz-600 text-white px-4 py-2 rounded-lg hover:bg-pinz-700 transition-colors flex items-center justify-center gap-2"
          >
            <Globe className="w-4 h-4" />
            Get Embed Code
          </button>
        </div>
      </div>

      {/* Public Map Preview */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Public Map Preview</h3>
        <p className="text-sm text-gray-600 mb-4">
          This is how your map will appear to public users. All customizations (colors, search bar, tags, watermark) are shown here.
        </p>
        {markers.length > 0 ? (
          <PublicMapPreview 
            markers={markers.filter(m => m.visible)} 
            mapSettings={mapSettings as any}
            height="500px"
          />
        ) : (
          <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-2">No markers to preview</p>
            <p className="text-xs text-gray-400">
              Add markers in the <strong>Data</strong> tab to see the preview.
            </p>
          </div>
        )}
      </div>

      {/* Tags Preview Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-pink-600" />
          Tags in Your Map
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {((mapSettings.tags || []).length > 0) 
            ? "Your map includes the following tags. Users can filter markers by clicking on these tags in the public view."
            : "Tags help users filter markers on your public map. Create tags in the Manage tab to get started."}
        </p>
        
        {/* Preview of tags */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          {(mapSettings.tags || []).length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(mapSettings.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-pink-600 text-white shadow-sm"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                💡 Tags appear as a filter menu in the public map. Users can click tags to show only markers with those tags.
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-2">No tags yet</p>
              <p className="text-xs text-gray-400">
                Go to the <strong>Manage</strong> tab to create tags for your markers.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p className="mb-2">Your map is automatically published and accessible via the public link above.</p>
        <p>Use the embed code to integrate your map into websites and blogs.</p>
      </div>
    </div>
  )
}

export default PublishTabContent
