import React from 'react'
import { Plus, Eye, Settings, Share2, User } from 'lucide-react'

interface MobileBottomBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  onUserProfileClick: () => void
}

const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  onTabChange,
  onUserProfileClick
}) => {
  const tabs = [
    { id: 'data', label: 'Data', icon: Plus },
    { id: 'manage', label: 'Manage', icon: Eye },
    { id: 'edit', label: 'Edit', icon: Settings },
    { id: 'publish', label: 'Publish', icon: Share2 }
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {/* User profile button - First on left */}
        <button
          onClick={onUserProfileClick}
          className="flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        >
          <User className="w-5 h-5 mb-1 text-gray-500" />
          <span className="text-xs font-medium truncate text-gray-600">
            Profile
          </span>
        </button>
        
        {/* Main tabs */}
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                isActive
                  ? 'text-pinz-600 bg-pinz-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-pinz-600' : 'text-gray-500'}`} />
              <span className={`text-xs font-medium truncate ${isActive ? 'text-pinz-600' : 'text-gray-600'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MobileBottomBar








