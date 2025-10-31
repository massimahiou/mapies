import React from 'react'
import { X, AlertTriangle, Lock, Info } from 'lucide-react'

interface LimitationInfoModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'marker-usage' | 'name-rules'
  currentCount?: number
  limit?: number
  isError?: boolean
  onOpenSubscription?: () => void
}

const LimitationInfoModal: React.FC<LimitationInfoModalProps> = ({
  isOpen,
  onClose,
  type,
  currentCount,
  limit,
  isError = false,
  onOpenSubscription
}) => {
  if (!isOpen) return null

  const getContent = () => {
    if (type === 'marker-usage') {
      return {
        icon: AlertTriangle,
        iconColor: isError ? 'text-red-600' : 'text-yellow-600',
        bgColor: isError ? 'bg-red-100' : 'bg-yellow-100',
        title: isError ? 'Marker Limit Reached' : 'Approaching Marker Limit',
        message: isError
          ? `You've used all ${limit} markers in your current plan. Consider upgrading for more markers.`
          : `You're using ${currentCount} of ${limit} markers. Consider upgrading for more capacity.`,
        recommendation: 'Upgrade to Starter plan or higher to increase your marker limit and unlock more features.'
      }
    } else {
      return {
        icon: Lock,
        iconColor: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        title: 'Name Rules Available with Upgrade',
        message: 'Name rules (smart grouping) are available with Professional plan or higher. Upgrade to automatically rename and group markers.',
        recommendation: 'Upgrade to Professional plan to access smart grouping features that automatically organize your markers based on naming patterns.'
      }
    }
  }

  const content = getContent()
  const Icon = content.icon

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 ${content.bgColor} rounded-full flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${content.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {content.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 mb-3">
              {content.message}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  {content.recommendation}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Got it
            </button>
            <button
              onClick={() => {
                onClose()
                if (onOpenSubscription) {
                  onOpenSubscription()
                }
              }}
              className="px-4 py-2 bg-pinz-500 hover:bg-pinz-600 text-white rounded-md transition-colors"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LimitationInfoModal

