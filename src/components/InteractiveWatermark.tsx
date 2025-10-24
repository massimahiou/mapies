import React, { useState } from 'react'
import { X, Sparkles, ArrowUpRight } from 'lucide-react'

interface InteractiveWatermarkProps {
  onUpgrade?: () => void
  mode?: 'public' | 'dashboard' | 'static' // Added static mode for non-clickable
}

const InteractiveWatermark: React.FC<InteractiveWatermarkProps> = ({ onUpgrade, mode = 'dashboard' }) => {
  const [showPopup, setShowPopup] = useState(false)

  const handleWatermarkClick = () => {
    if (mode === 'public') {
      // For public maps, redirect directly to dashboard
      onUpgrade?.()
    } else if (mode === 'dashboard') {
      // For dashboard, show the upgrade popup
      setShowPopup(true)
    }
    // For static mode, do nothing (non-clickable)
  }

  const handleUpgrade = () => {
    setShowPopup(false)
    onUpgrade?.()
  }

  const handleClosePopup = () => {
    setShowPopup(false)
  }

  return (
    <>
      {/* Interactive Watermark */}
      <div 
        onClick={mode !== 'static' ? handleWatermarkClick : undefined}
        className={`absolute bottom-2 right-2 md:right-auto md:left-2 z-[500] flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-lg border border-gray-200/50 transition-all duration-200 group ${
          mode === 'static' 
            ? '' // No cursor or hover effects for static mode
            : 'cursor-pointer hover:bg-white hover:shadow-xl' // Interactive styling for other modes
        }`}
        title={mode === 'public' ? "Click to create your own map" : mode === 'dashboard' ? "Click to upgrade and remove watermark" : "Powered by Pinz"}
      >
        <img 
          src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
          alt="Pinz Logo"
          className="h-3 w-auto"
        />
        <span className={`text-xs text-gray-600 font-medium transition-colors ${
          mode === 'static' ? '' : 'group-hover:text-gray-800'
        }`}>
          Powered by Pinz
        </span>
        {mode !== 'static' && (
          <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
        )}
      </div>

      {/* Upgrade Popup - Only show for dashboard mode */}
      {showPopup && mode === 'dashboard' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={handleClosePopup}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Content */}
            <div className="text-center">
              {/* Icon */}
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-pinz-500 to-pinz-600 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Remove Watermark
              </h3>

              {/* Description */}
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                Upgrade to any paid plan to remove the "Powered by Pinz" watermark from your maps and give them a professional, clean look.
              </p>

              {/* Benefits */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">What you'll get:</h4>
                <ul className="text-xs text-gray-600 space-y-2 text-left">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pinz-500 rounded-full"></div>
                    No watermark on your maps
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pinz-500 rounded-full"></div>
                    More markers and maps
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pinz-500 rounded-full"></div>
                    Advanced features like geocoding
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pinz-500 rounded-full"></div>
                    Professional customization
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleUpgrade}
                  className="w-full bg-gradient-to-r from-pinz-500 to-pinz-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-pinz-600 hover:to-pinz-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  View Plans & Upgrade
                </button>
                <button
                  onClick={handleClosePopup}
                  className="w-full text-gray-500 py-2 px-4 rounded-lg font-medium hover:text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Maybe Later
                </button>
              </div>

              {/* Small print */}
              <p className="text-xs text-gray-400 mt-4">
                Starting from $14/month • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default InteractiveWatermark
