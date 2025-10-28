import React, { useState } from 'react'
import { useResponsive } from '../hooks/useResponsive'
import Sidebar from './Sidebar'
import MobileBottomBar from './MobileBottomBar'
import MobileContentPanel from './MobileContentPanel'
import DataTabContent from './sidebar/DataTabContent'
import ManageTabContent from './sidebar/ManageTabContent'
import EditTabContent from './sidebar/EditTabContent'
import PublishTabContent from './sidebar/PublishTabContent'
import UserProfile from './UserProfile'

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
}

import { MapDocument } from '../firebase/maps'

interface ResponsiveSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  markers: Marker[]
  searchTerm: string
  onSearchChange: (term: string) => void
  onToggleMarkerVisibility: (id: string) => void
  onDeleteMarker: (id: string) => void
  onShowCsvModal: () => void
  onShowAddMarkerModal: () => void
  onShowPolygonModal?: () => void
  onShowPublishModal: () => void
  onOpenMarkerManagementModal: () => void
  onOpenDataManagementModal: () => void
  onOpenEditManagementModal: () => void
  onOpenPublishManagementModal: () => void
  onGenerateCityPolygon?: (coordinates: Array<{lat: number, lng: number}>, name: string) => void
  mapSettings: any
  onMapSettingsChange: (settings: any) => void
  currentMapId: string | null
  onMapChange: (mapId: string) => void
  maps: MapDocument[]
  onMapsChange: (maps: MapDocument[]) => void
  isUploading?: boolean
  uploadProgress?: { processed: number; total: number; currentAddress: string }
  onSignOut: () => void
  userId: string
  onOpenSubscription?: () => void
}

const ResponsiveSidebar: React.FC<ResponsiveSidebarProps> = (props) => {
  const { isMobile } = useResponsive()
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)
  const [showUserProfile, setShowUserProfile] = useState(false)

  const handleMobileTabChange = (tab: string) => {
    props.onTabChange(tab)
    setIsMobilePanelOpen(true)
  }

  const handleCloseMobilePanel = () => {
    setIsMobilePanelOpen(false)
  }

  const handleUserProfileClick = () => {
    setShowUserProfile(true)
  }

  const handleCloseUserProfile = () => {
    setShowUserProfile(false)
  }

  if (isMobile) {
    return (
      <>
        {/* Mobile Bottom Bar */}
        <MobileBottomBar
          activeTab={props.activeTab}
          onTabChange={handleMobileTabChange}
          onUserProfileClick={handleUserProfileClick}
        />

        {/* Mobile Content Panels */}
        <MobileContentPanel
          isOpen={isMobilePanelOpen}
          onClose={handleCloseMobilePanel}
          title={props.activeTab.charAt(0).toUpperCase() + props.activeTab.slice(1)}
        >
          {props.activeTab === 'data' && (
            <DataTabContent
              onShowAddMarkerModal={props.onShowAddMarkerModal}
              onShowCsvModal={props.onShowCsvModal}
              isUploading={props.isUploading}
              uploadProgress={props.uploadProgress}
              onOpenModal={props.onOpenDataManagementModal}
            />
          )}
          
          {props.activeTab === 'manage' && (
            <ManageTabContent
              markers={props.markers}
              searchTerm={props.searchTerm}
              onSearchChange={props.onSearchChange}
              onToggleMarkerVisibility={props.onToggleMarkerVisibility}
              onDeleteMarker={props.onDeleteMarker}
              mapSettings={props.mapSettings}
              onMapSettingsChange={props.onMapSettingsChange}
              userId={props.userId}
              mapId={props.currentMapId || undefined}
              onOpenModal={props.onOpenMarkerManagementModal}
            />
          )}
          
          {props.activeTab === 'edit' && (
            <EditTabContent
              mapSettings={props.mapSettings}
              onMapSettingsChange={props.onMapSettingsChange}
              onOpenModal={props.onOpenEditManagementModal}
            />
          )}
          
          {props.activeTab === 'publish' && (
            <PublishTabContent
              onShowPublishModal={props.onShowPublishModal}
              currentMapId={props.currentMapId}
              onOpenModal={props.onOpenPublishManagementModal}
            />
          )}
        </MobileContentPanel>

        {/* User Profile Panel */}
        <MobileContentPanel
          isOpen={showUserProfile}
          onClose={handleCloseUserProfile}
          title="User Profile"
        >
          <div className="p-4">
            <UserProfile onSignOut={props.onSignOut} />
          </div>
        </MobileContentPanel>
      </>
    )
  }

  // Desktop - use original sidebar
  return <Sidebar {...props} />
}

export default ResponsiveSidebar
