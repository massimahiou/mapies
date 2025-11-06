import React, { useState } from 'react'
import { Copy, Check, X } from 'lucide-react'

interface PublishProps {
  isOpen: boolean
  onClose: () => void
  currentMapId: string
  iframeDimensions?: { width: number; height: number }
}

const Publish: React.FC<PublishProps> = ({ isOpen, onClose, currentMapId }) => {
  const [copied, setCopied] = useState(false)
  const [embedLanguage, setEmbedLanguage] = useState<'auto' | 'en' | 'fr'>('auto')
  const [showToggle, setShowToggle] = useState(true)
  
  // Generate Firestore-based iframe code (responsive)
  const generateIframeCode = () => {
    if (!currentMapId) {
      return 'Please select a map to generate embed code'
    }

    // Build URL with parameters
    const params = new URLSearchParams()
    params.set('v', Date.now().toString())
    
    // Add language parameter if not auto
    if (embedLanguage !== 'auto') {
      params.set('lang', embedLanguage)
    }
    
    // Add showToggle parameter
    params.set('showToggle', showToggle.toString())
    
    const mapUrl = `${window.location.origin}/${currentMapId}?${params.toString()}`
    
    // Generate responsive iframe code with relative CSS values
    const iframeCode = `<iframe 
  src="${mapUrl}" 
  frameborder="0" 
  allow="geolocation"
  style="width: 100%; height: 50vh; min-height: 700px; display: block; margin-inline: auto; border-radius: 8px;">
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
            
            {/* Language and Toggle Controls */}
            <div className="mb-4 space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Language Settings
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                    <input
                      type="radio"
                      name="embedLanguage"
                      value="auto"
                      checked={embedLanguage === 'auto'}
                      onChange={(e) => setEmbedLanguage(e.target.value as 'auto' | 'en' | 'fr')}
                      className="text-pinz-600 focus:ring-pinz-500"
                    />
                    <span className="text-sm text-gray-700">Auto (Browser default)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                    <input
                      type="radio"
                      name="embedLanguage"
                      value="en"
                      checked={embedLanguage === 'en'}
                      onChange={(e) => setEmbedLanguage(e.target.value as 'auto' | 'en' | 'fr')}
                      className="text-pinz-600 focus:ring-pinz-500"
                    />
                    <span className="text-sm text-gray-700">English Only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                    <input
                      type="radio"
                      name="embedLanguage"
                      value="fr"
                      checked={embedLanguage === 'fr'}
                      onChange={(e) => setEmbedLanguage(e.target.value as 'auto' | 'en' | 'fr')}
                      className="text-pinz-600 focus:ring-pinz-500"
                    />
                    <span className="text-sm text-gray-700">French Only</span>
                  </label>
                </div>
              </div>
              
              <div className="pt-3 border-t border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={showToggle}
                    onChange={(e) => setShowToggle(e.target.checked)}
                    className="text-pinz-600 focus:ring-pinz-500 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Show language toggle button
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Allow users to switch between English and French
                    </p>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm text-gray-800 overflow-x-auto border border-gray-300">
              <div className="text-xs text-gray-500 mb-2 font-sans">Embed Code (updates automatically):</div>
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