import React, { useState } from 'react'
import { Copy, Check, X } from 'lucide-react'

interface PublishProps {
  isOpen: boolean
  onClose: () => void
  currentMapId: string
  iframeDimensions?: { width: number; height: number }
}

const Publish: React.FC<PublishProps> = ({ isOpen, onClose, currentMapId, iframeDimensions = { width: 800, height: 600 } }) => {
  const [copied, setCopied] = useState(false)
  
  // Generate Firestore-based iframe code
  const generateIframeCode = () => {
    if (!currentMapId) {
      return 'Please select a map to generate embed code'
    }

    // Add cache-busting parameter to force refresh
    const timestamp = Date.now()
    const mapUrl = `${window.location.origin}/${currentMapId}?v=${timestamp}`
    
    const iframeCode = `<iframe 
  src="${mapUrl}" 
  width="${iframeDimensions.width}" 
  height="${iframeDimensions.height}" 
  frameborder="0" 
  allow="geolocation"
  style="border-radius: 8px;">
</iframe>`
    
    console.log('Generated iframe code:', iframeCode)
    return iframeCode
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateIframeCode()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Publish Your Map</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Embed Code Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Copy className="w-5 h-5 text-pinz-600" />
                  Embed Code
                </h3>
                <p className="text-sm text-gray-600">Embed your map in websites and blogs</p>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-pinz-600 text-white rounded-lg hover:bg-pinz-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm text-gray-800 overflow-x-auto">
              {generateIframeCode()}
            </div>
            
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <span className="font-medium">No login required</span>
                <span>•</span>
                <span>Public access</span>
                <span>•</span>
                <span>Location button enabled</span>
              </div>
              <div className="mt-2 text-xs text-blue-700">
                <strong>Note:</strong> The iframe includes geolocation permissions for the location button to work properly.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Publish