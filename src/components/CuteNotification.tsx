import React from 'react'
import { X, Sparkles } from 'lucide-react'

interface CuteNotificationProps {
  isOpen: boolean
  onClose: () => void
}

const CuteNotification: React.FC<CuteNotificationProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed bottom-20 left-4 z-[10001] animate-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white rounded-2xl p-4 shadow-xl border border-pink-100 max-w-xs">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 w-6 h-6 bg-pink-500 text-white rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>

        {/* Content */}
        <div className="flex items-center gap-3">
          {/* Cute Icon */}
          <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          
          {/* Message */}
          <div>
            <p className="text-sm font-semibold text-gray-800">
              With Starter plan min, you won't have the watermark! ✨
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ;)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CuteNotification
