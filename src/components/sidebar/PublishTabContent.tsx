import React from 'react'
import { Globe, Copy, Maximize2 } from 'lucide-react'

interface PublishTabContentProps {
  onShowPublishModal: () => void
  currentMapId: string | null
  onOpenModal?: () => void
}

const PublishTabContent: React.FC<PublishTabContentProps> = ({
  onShowPublishModal,
  currentMapId,
  onOpenModal
}) => {
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
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy: ', err)
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
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-pinz-300 transition-colors"
            title="Open in full screen"
          >
            <Maximize2 className="w-4 h-4" />
            Open in Modal
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

      <div className="text-sm text-gray-600">
        <p className="mb-2">Your map is automatically published and accessible via the public link above.</p>
        <p>Use the embed code to integrate your map into websites and blogs.</p>
      </div>
    </div>
  )
}

export default PublishTabContent
