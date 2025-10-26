import React from 'react'
import { X, Sparkles, Star, CheckCircle } from 'lucide-react'

interface StarterPlanModalProps {
  isOpen: boolean
  onClose: () => void
}

const StarterPlanModal: React.FC<StarterPlanModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="text-center">
          {/* Cute Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-pink-500 to-rose-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
            <Sparkles className="w-10 h-10 text-white animate-pulse" />
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Get the Starter Plan! ✨
          </h3>

          {/* Cute Message */}
          <p className="text-gray-600 mb-6 text-lg leading-relaxed">
            <span className="text-pink-600 font-semibold">You won't see that watermark</span> with our Starter plan! 
            <br />
            <span className="text-sm text-gray-500 mt-2 block">
              ;) 
            </span>
          </p>

          {/* Benefits */}
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-6 mb-6 border border-pink-100">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-center gap-2">
              <Star className="w-5 h-5 text-pink-500" />
              What you'll get:
            </h4>
            <ul className="text-sm text-gray-700 space-y-3 text-left">
              <li className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>No watermark on your maps</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Up to 5 maps</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>500 markers per map</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Bulk import & geocoding</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Professional customization</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-pink-600 hover:to-rose-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              View Starter Plan - $14/month
            </button>
            <button
              onClick={onClose}
              className="w-full text-gray-500 py-3 px-6 rounded-xl font-medium hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Maybe Later
            </button>
          </div>

          {/* Small print */}
          <p className="text-xs text-gray-400 mt-4">
            Starting from $14/month • Cancel anytime • 7-day free trial
          </p>
        </div>
      </div>
    </div>
  )
}

export default StarterPlanModal
