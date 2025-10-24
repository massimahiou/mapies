import React from 'react'
import { Info, AlertCircle, CheckCircle } from 'lucide-react'
import { MapFeatureInheritance } from '../hooks/useMapFeatureInheritance'

interface MapFeatureLevelHeaderProps {
  mapInheritance: MapFeatureInheritance
  onUpgrade?: () => void
}

const MapFeatureLevelHeader: React.FC<MapFeatureLevelHeaderProps> = ({ 
  mapInheritance, 
  onUpgrade 
}) => {
  // Don't show header for owned maps
  if (mapInheritance.isOwnedMap) {
    return null
  }

  const getIcon = () => {
    switch (mapInheritance.headerType) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-pink-500" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-pink-500" />
      default:
        return <Info className="w-4 h-4 text-pink-500" />
    }
  }

  const getBackgroundColor = () => {
    switch (mapInheritance.headerType) {
      case 'success':
        return 'bg-pink-50 border-pink-200'
      case 'warning':
        return 'bg-pink-50 border-pink-200'
      default:
        return 'bg-pink-50 border-pink-200'
    }
  }

  const getTextColor = () => {
    switch (mapInheritance.headerType) {
      case 'success':
        return 'text-pink-800'
      case 'warning':
        return 'text-pink-800'
      default:
        return 'text-pink-800'
    }
  }

  return (
    <div className={`${getBackgroundColor()} p-3 mb-3 rounded-lg border border-pink-200 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getTextColor()}`}>
              {mapInheritance.mapOwnerPlanName} map
            </span>
            {mapInheritance.userRole && (
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">
                {mapInheritance.userRole}
              </span>
            )}
          </div>
        </div>
        
        {/* Upgrade prompt if user has lower plan */}
        {mapInheritance.mapOwnerPlan !== mapInheritance.currentUserPlan && 
         mapInheritance.headerType === 'success' && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-pink-500 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>
      
      <p className={`mt-1 text-xs ${getTextColor()} opacity-80`}>
        {mapInheritance.headerMessage}
      </p>
    </div>
  )
}

export default MapFeatureLevelHeader
