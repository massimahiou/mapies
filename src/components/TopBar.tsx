import React from 'react'

interface TopBarProps {
  activeTab: string
}

const TopBar: React.FC<TopBarProps> = ({
  activeTab
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'data': return 'Add Data'
      case 'manage': return 'Manage Markers'
      case 'edit': return 'Edit Map'
      case 'publish': return 'Publish Map'
      default: return 'Add Data'
    }
  }

  const getDescription = () => {
    switch (activeTab) {
      case 'data': return 'Add markers manually or import from CSV'
      case 'manage': return 'View, search, and manage your markers'
      case 'edit': return 'Customize map style and appearance'
      case 'publish': return 'Generate embed code for your website'
      default: return 'Add markers manually or import from CSV'
    }
  }

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {getTitle()}
          </h2>
          <p className="text-sm text-gray-500">
            {getDescription()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default TopBar
