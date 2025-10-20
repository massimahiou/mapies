import React, { useEffect } from 'react'
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react'

interface ToastProps {
  isVisible: boolean
  onClose: () => void
  type: 'warning' | 'success' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

const Toast: React.FC<ToastProps> = ({
  isVisible,
  onClose,
  type,
  title,
  message,
  duration = 5000
}) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />
      default:
        return <Info className="w-5 h-5 text-blue-600" />
    }
  }

  const getStyles = () => {
    switch (type) {
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 text-yellow-800'
      case 'success':
        return 'border-l-green-500 bg-green-50 text-green-800'
      case 'error':
        return 'border-l-red-500 bg-red-50 text-red-800'
      case 'info':
        return 'border-l-blue-500 bg-blue-50 text-blue-800'
      default:
        return 'border-l-blue-500 bg-blue-50 text-blue-800'
    }
  }

  return (
    <div className="transform transition-all duration-300 ease-in-out animate-in slide-in-from-right-full">
      <div className={`max-w-sm w-full bg-white border-l-4 rounded-lg shadow-xl p-4 backdrop-blur-sm ${getStyles()}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-semibold">
              {title}
            </p>
            <p className="mt-1 text-sm opacity-90">
              {message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded-full p-1 hover:bg-gray-100 transition-colors"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Toast

