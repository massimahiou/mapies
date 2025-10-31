import React, { useState, useEffect, useRef } from 'react'
import { Eye, Share2, Plus, Trash2, Settings, ChevronDown, Map, Check, GripVertical, Edit2, X, AlertTriangle, MapPin } from 'lucide-react'
import UserProfile from './UserProfile'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getUserMaps, createMap, deleteMap, updateMap, MapDocument, shareMapWithUser, removeUserFromMap, updateUserRole, SharedUser, isMapOwnedByUser, leaveSharedMap, transferMapOwnership } from '../firebase/maps'
import DeleteMapDialog from './DeleteMapDialog'
import ManageTabContent from './sidebar/ManageTabContent'
import DataTabContent from './sidebar/DataTabContent'
import EditTabContent from './sidebar/EditTabContent'
import PublishTabContent from './sidebar/PublishTabContent'
import { useFeatureAccess, useUsageWarning } from '../hooks/useFeatureAccess'
import { ensureFreemiumCompliance } from '../utils/freemiumDefaults'

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
}

interface SidebarProps {
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
  onGenerateCityPolygon?: (postalCodes: string[]) => void
  onSavePolygon?: (coordinates: Array<{lat: number, lng: number}>, name: string) => void
  onShowPublishModal: () => void
  onOpenMarkerManagementModal: () => void
  onOpenDataManagementModal: () => void
  onOpenEditManagementModal: () => void
  onOpenPublishManagementModal: () => void
  mapSettings: any
  onMapSettingsChange: (settings: any) => void
  currentMapId: string | null
  onMapChange: (mapId: string) => void
  maps: MapDocument[]
  onMapsChange: (maps: MapDocument[]) => void
  isUploading?: boolean
  uploadProgress?: { processed: number; total: number; currentAddress: string }
  userId: string
  onOpenSubscription?: () => void
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  markers,
  searchTerm,
  onSearchChange,
  onToggleMarkerVisibility,
  onDeleteMarker,
  onShowCsvModal,
  onShowAddMarkerModal,
  onShowPolygonModal,
  onGenerateCityPolygon,
  onSavePolygon,
  onShowPublishModal,
  onOpenMarkerManagementModal,
  onOpenDataManagementModal,
  onOpenEditManagementModal,
  onOpenPublishManagementModal,
  mapSettings,
  onMapSettingsChange,
  currentMapId,
  onMapChange,
  maps,
  onMapsChange,
  isUploading = false,
  uploadProgress = { processed: 0, total: 0, currentAddress: '' },
  userId,
  onOpenSubscription
}) => {
  const { signOut, user } = useAuth()
  const { showToast } = useToast()
  const { canCreateMap, currentPlan } = useFeatureAccess()
  const { limit } = useUsageWarning('maps', maps.length)

  // Generate public share URL

  const [showMapSelector, setShowMapSelector] = useState(false)
  const [isCreatingMap, setIsCreatingMap] = useState(false)
  const [newMapName, setNewMapName] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [mapToDelete, setMapToDelete] = useState<MapDocument | null>(null)
  const [isDeletingMap, setIsDeletingMap] = useState(false)
  
  // Map rename state
  const [editingMapId, setEditingMapId] = useState<string | null>(null)
  const [editingMapName, setEditingMapName] = useState('')
  const [isRenamingMap, setIsRenamingMap] = useState(false)
  const editingInputRef = useRef<HTMLInputElement>(null)
  
  // Map sharing state
  const [showSharingModal, setShowSharingModal] = useState(false)
  const [sharingEmail, setSharingEmail] = useState('')
  const [sharingRole, setSharingRole] = useState<'viewer' | 'editor'>('viewer')
  const [isSharing, setIsSharing] = useState(false)
  
  // Transfer ownership state
  const [transferEmail, setTransferEmail] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  
  // Draggable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(320) // Default width in pixels
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Handle drag move
  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = e.clientX - startXRef.current
    const newWidth = Math.max(280, Math.min(600, startWidthRef.current + deltaX)) // Min 280px, Max 600px
    setSidebarWidth(newWidth)
  }

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // Add event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
      return () => {
        document.removeEventListener('mousemove', handleDragMove)
        document.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Load user's maps on component mount
  useEffect(() => {
    const loadMaps = async () => {
      if (user) {
        try {
          const userMaps = await getUserMaps(user.uid)
          onMapsChange(userMaps)
          
          // If no current map is selected and user has maps, select the first one
          if (!currentMapId && userMaps.length > 0) {
            onMapChange(userMaps[0].id!)
          }
        } catch (error) {
          console.error('Error loading maps:', error)
        }
      }
    }
    
    loadMaps()
  }, [user, currentMapId, onMapsChange, onMapChange])

  // Create a new map
  const handleCreateMap = async () => {
    if (!user || !newMapName.trim()) return
    
    // Check if user can create more maps
    if (!canCreateMap(maps.length)) {
      // Message is now shown inline in the UI, no need for toast
      return
    }
    
    setIsCreatingMap(true)
    try {
      // Create map with freemium-compliant default settings
      const freemiumCompliantSettings = ensureFreemiumCompliance(mapSettings, currentPlan)
      
      const mapId = await createMap(user.uid, {
        name: newMapName.trim(),
        description: 'New map',
        settings: freemiumCompliantSettings
      })
      
      // Refresh maps list
      const userMaps = await getUserMaps(user.uid)
      onMapsChange(userMaps)
      
      // Select the new map
      onMapChange(mapId)
      
      // Reset form
      setNewMapName('')
      setShowMapSelector(false)
      
      showToast({
        type: 'success',
        title: 'Success',
        message: 'Map created successfully!'
      })
      console.log('Created new map with empty name rules:', mapId)
    } catch (error) {
      console.error('Error creating map:', error)
      if (error instanceof Error && error.message.includes('Map limit reached')) {
        showToast({
          type: 'error',
          title: 'Map Limit Reached',
          message: error.message
        })
      } else {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to create map. Please try again.'
        })
      }
    } finally {
      setIsCreatingMap(false)
    }
  }

  // Debug maps changes
  useEffect(() => {
    console.log('Maps array changed:', maps.length, 'maps:', maps.map(m => ({ id: m.id, name: m.name })))
  }, [maps])

  // Get current map name
  const getCurrentMapName = () => {
    const currentMap = maps.find(map => map.id === currentMapId)
    console.log('getCurrentMapName called:', { currentMapId, maps: maps.length, currentMap: currentMap?.name })
    return currentMap ? currentMap.name : 'No map selected'
  }

  // Handle map deletion
  const handleDeleteMap = (map: MapDocument, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent map selection
    setMapToDelete(map)
    setShowDeleteDialog(true)
  }

  // Handle map rename
  const handleRenameMap = async (mapId: string, newName: string) => {
    console.log('handleRenameMap called:', { mapId, newName, editingMapName })
    
    if (!newName.trim()) {
      console.log('Skipping rename - empty name')
      setEditingMapId(null)
      setEditingMapName('')
      return
    }

    setIsRenamingMap(true)
    try {
      console.log('Calling updateMap with:', { userId: user!.uid, mapId, name: newName.trim() })
      await updateMap(user!.uid, mapId, { name: newName.trim() }, user!.email)
      console.log('Map renamed successfully')
      
      // Wait a moment for Firestore to propagate the changes
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Manually refresh the maps list to ensure UI updates
      console.log('Manually refreshing maps list...')
      const userMaps = await getUserMaps(user!.uid)
      console.log('Refreshed maps:', userMaps)
      onMapsChange(userMaps)
      
      // Show success toast
      showToast({
        type: 'success',
        title: 'Success',
        message: 'Map renamed successfully!'
      })
      
      setEditingMapId(null)
      setEditingMapName('')
    } catch (error) {
      console.error('Error renaming map:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to rename map. Please try again.'
      })
    } finally {
      setIsRenamingMap(false)
    }
  }

  const startEditingMap = (map: MapDocument, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingMapId(map.id!)
    setEditingMapName(map.name)
  }

  const cancelEditingMap = () => {
    setEditingMapId(null)
    setEditingMapName('')
  }

  // Handle map sharing
  const handleShareMap = async () => {
    if (!currentMapId || !user || !sharingEmail.trim()) return

    setIsSharing(true)
    try {
      await shareMapWithUser(currentMapId, user.uid, sharingEmail.trim(), sharingRole)
      
      // Refresh maps list to show updated sharing data
      const userMaps = await getUserMaps(user.uid)
      onMapsChange(userMaps)
      
      setSharingEmail('')
      setSharingRole('viewer')
      setShowSharingModal(false)
      
      showToast({
        type: 'success',
        title: 'Map Shared',
        message: `Map shared with ${sharingEmail.trim()}`
      })
      console.log('Map shared successfully')
    } catch (error) {
      console.error('Error sharing map:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to share map. Please try again.'
      })
    } finally {
      setIsSharing(false)
    }
  }

  const handleRemoveUser = async (email: string) => {
    if (!currentMapId || !user) return

    try {
      await removeUserFromMap(currentMapId, user.uid, email)
      
      // Refresh maps list to show updated sharing data
      const userMaps = await getUserMaps(user.uid)
      onMapsChange(userMaps)
      
      showToast({
        type: 'success',
        title: 'User Removed',
        message: `${email} removed from map`
      })
      console.log('User removed from map')
    } catch (error) {
      console.error('Error removing user:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to remove user. Please try again.'
      })
    }
  }

  const handleUpdateUserRole = async (email: string, newRole: 'viewer' | 'editor') => {
    if (!currentMapId || !user) return

    try {
      await updateUserRole(currentMapId, user.uid, email, newRole)
      
      // Refresh maps list to show updated sharing data
      const userMaps = await getUserMaps(user.uid)
      onMapsChange(userMaps)
      
      showToast({
        type: 'success',
        title: 'Role Updated',
        message: `${email}'s role updated to ${newRole}`
      })
      console.log('User role updated')
    } catch (error) {
      console.error('Error updating user role:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update user role. Please try again.'
      })
    }
  }

  // Handle transfer ownership
  const handleTransferOwnership = async () => {
    if (!currentMapId || !user || !transferEmail.trim()) return

    if (!window.confirm(`Are you sure you want to transfer ownership of this map to ${transferEmail}? This action cannot be undone.`)) {
      return
    }

    setIsTransferring(true)
    try {
      await transferMapOwnership(currentMapId, user.uid, transferEmail.trim())
      
      // Refresh maps list
      const userMaps = await getUserMaps(user.uid)
      onMapsChange(userMaps)
      
      // If we transferred the current map, select the first available map or clear selection
      if (userMaps.length > 0) {
        onMapChange(userMaps[0].id!)
      } else {
        onMapChange('')
      }
      
      setTransferEmail('')
      setShowSharingModal(false)
      
      showToast({
        type: 'success',
        title: 'Ownership Transferred',
        message: `Map ownership has been successfully transferred to ${transferEmail}.`
      })
    } catch (error) {
      console.error('Error transferring ownership:', error)
      showToast({
        type: 'error',
        title: 'Transfer Failed',
        message: error instanceof Error ? error.message : 'Failed to transfer ownership. Please try again.'
      })
    } finally {
      setIsTransferring(false)
    }
  }

  const confirmDeleteMap = async () => {
    if (!user || !mapToDelete) {
      console.log('Cannot delete map - missing user or mapToDelete:', { user: !!user, mapToDelete: !!mapToDelete })
      return
    }

    console.log('Starting map deletion:', { userId: user.uid, mapId: mapToDelete.id, mapName: mapToDelete.name })
    setIsDeletingMap(true)
    
    try {
      await deleteMap(user.uid, mapToDelete.id!, user.email)
      console.log('Map deletion completed successfully')
      
      // Refresh maps list
      console.log('Refreshing maps list...')
      const userMaps = await getUserMaps(user.uid)
      console.log('Refreshed maps:', userMaps.length, 'maps')
      onMapsChange(userMaps)
      
      // If we deleted the current map, select the first available map or clear selection
      if (mapToDelete.id === currentMapId) {
        console.log('Deleted current map, selecting new map...')
        if (userMaps.length > 0) {
          onMapChange(userMaps[0].id!)
          console.log('Selected new map:', userMaps[0].name)
        } else {
          onMapChange('')
          console.log('No maps left, cleared selection')
        }
      }
      
      setShowDeleteDialog(false)
      setMapToDelete(null)
      
      showToast({
        type: 'success',
        title: 'Success',
        message: 'Map deleted successfully!'
      })
    } catch (error) {
      console.error('Error deleting map:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete map. Please try again.'
      })
    } finally {
      setIsDeletingMap(false)
    }
  }

  // Handle leaving a shared map
  const handleLeaveMap = (map: MapDocument, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent map selection
    setMapToDelete(map)
    setShowDeleteDialog(true)
  }

  const confirmLeaveMap = async () => {
    if (!user || !mapToDelete) {
      console.log('Cannot leave map - missing user or mapToDelete:', { user: !!user, mapToDelete: !!mapToDelete })
      return
    }

    console.log('Starting leave map:', { userId: user.uid, mapId: mapToDelete.id, mapName: mapToDelete.name, ownerId: mapToDelete.userId })
    setIsDeletingMap(true)
    
    try {
      await leaveSharedMap(mapToDelete.id!, mapToDelete.userId, user.email || '')
      console.log('Leave map completed successfully')
      
      // Refresh maps list - need to refresh both user maps and shared maps
      console.log('Refreshing maps list...')
      
      // Get user's own maps
      const userMaps = await getUserMaps(user.uid)
      console.log('User maps:', userMaps.length, 'maps')
      
      // Get shared maps
      const { getSharedMaps } = await import('../firebase/maps')
      const sharedMaps = await getSharedMaps(user.email || '')
      console.log('Shared maps:', sharedMaps.length, 'maps')
      
      // Combine both lists
      const allMaps = [...userMaps, ...sharedMaps]
      console.log('Total maps after refresh:', allMaps.length, 'maps')
      
      onMapsChange(allMaps)
      
      // If we left the current map, select the first available map or clear selection
      if (mapToDelete.id === currentMapId) {
        console.log('Left current map, selecting new map...')
        if (allMaps.length > 0) {
          onMapChange(allMaps[0].id!)
          console.log('Selected new map:', allMaps[0].name)
        } else {
          onMapChange('')
          console.log('No maps left, cleared selection')
        }
      }
      
      setShowDeleteDialog(false)
      setMapToDelete(null)
      
      showToast({
        type: 'success',
        title: 'Success',
        message: 'Left map successfully!'
      })
    } catch (error) {
      console.error('Error leaving map:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to leave map. Please try again.'
      })
    } finally {
      setIsDeletingMap(false)
    }
  }
  const sidebarItems = [
    { id: 'data', label: 'Data', icon: Plus },
    { id: 'manage', label: 'Manage', icon: Eye },
    { id: 'edit', label: 'Edit', icon: Settings },
    { id: 'publish', label: 'Publish', icon: Share2 },
  ]


  return (
    <div 
      className="bg-white shadow-lg flex flex-col relative h-screen overflow-hidden"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Drag Handle */}
      <div
        ref={dragRef}
        onMouseDown={handleDragStart}
        className="absolute top-0 right-0 w-1 h-full bg-gray-300 hover:bg-pinz-500 cursor-col-resize transition-colors z-10"
        title="Drag to resize sidebar"
      >
        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2">
          <GripVertical className="w-3 h-3 text-gray-400" />
        </div>
      </div>
              {/* Header - Reduced padding - Fixed */}
              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <div className="text-center mb-3">
                  <div className="flex items-center justify-center">
                    <img 
                      src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
                      alt="Pinz Logo"
                      className="h-16 w-auto"
                    />
                  </div>
                </div>
                
                {/* Map Usage Warning - REMOVED - Now only shown in create map functionality */}

                {/* Map Selector */}
                <div className="mb-3">
                  <div className="relative">
                    <button
                      onClick={() => setShowMapSelector(!showMapSelector)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Map className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {getCurrentMapName()}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showMapSelector ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showMapSelector && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[60]">
                        <div className="p-2">
                          {/* Create New Map */}
                          <div className="p-2 border-b border-gray-100">
                            {/* Map Limit Message - Only show if user can't create more maps */}
                            {!canCreateMap(maps.length) && (
                              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                                  <p className="text-sm text-blue-800">
                                    You've used all {limit} maps in your current plan. Consider upgrading for more maps.
                                  </p>
                                </div>
                                {onOpenSubscription && (
                                  <div className="mt-2">
                                    <button 
                                      onClick={onOpenSubscription}
                                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                                    >
                                      Learn More
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="New map name..."
                                value={newMapName}
                                onChange={(e) => setNewMapName(e.target.value)}
                                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleCreateMap()}
                                disabled={!canCreateMap(maps.length)}
                              />
                              <button
                                onClick={handleCreateMap}
                                disabled={!newMapName.trim() || isCreatingMap || !canCreateMap(maps.length)}
                                className="px-3 py-1 bg-pinz-600 text-white text-sm rounded hover:bg-pinz-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isCreatingMap ? '...' : 'Create'}
                              </button>
                            </div>
                          </div>
                          
                          {/* Maps List */}
                          <div className="max-h-48 overflow-y-auto">
                            {maps.length === 0 ? (
                              <div className="p-3 text-center text-gray-500 text-sm">
                                No maps yet. Create one above.
                              </div>
                            ) : (
                              maps.map((map) => (
                                <div
                                  key={map.id}
                                  className={`w-full text-left p-2 rounded hover:bg-gray-50 transition-colors ${
                                    map.id === currentMapId ? 'bg-pinz-50 text-pinz-700' : 'text-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    {editingMapId === map.id ? (
                                      // Edit mode
                                      <div className="flex-1 flex items-center gap-2">
                                        <input
                                          ref={editingInputRef}
                                          type="text"
                                          value={editingMapName}
                                          onChange={(e) => setEditingMapName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              handleRenameMap(map.id!, (e.target as HTMLInputElement).value)
                                            } else if (e.key === 'Escape') {
                                              cancelEditingMap()
                                            }
                                          }}
                                          className="flex-1 text-sm font-medium bg-white border border-pinz-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pinz-500"
                                          autoFocus
                                          disabled={isRenamingMap}
                                        />
                                        <button
                                          onClick={() => {
                                            const currentValue = editingInputRef.current?.value || editingMapName
                                            handleRenameMap(map.id!, currentValue)
                                          }}
                                          disabled={isRenamingMap}
                                          className="p-1 text-green-600 hover:text-green-700 transition-colors"
                                          title="Save"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={cancelEditingMap}
                                          disabled={isRenamingMap}
                                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      // Normal mode
                                      <>
                                        <button
                                          onClick={() => {
                                            onMapChange(map.id!)
                                            setShowMapSelector(false)
                                          }}
                                          className="flex-1 text-left"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium truncate">{map.name}</span>
                                            <span className="text-xs text-gray-500">
                                              {map.stats?.markerCount || 0} markers
                                            </span>
                                          </div>
                                        </button>
                                        <div className="flex items-center gap-1 ml-2">
                                          {isMapOwnedByUser(map, user!.uid, user!.email) && (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setShowSharingModal(true)
                                                }}
                                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                                title="Share map"
                                              >
                                                <Share2 className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={(e) => startEditingMap(map, e)}
                                                className="p-1 text-gray-400 hover:text-pinz-600 transition-colors"
                                                title="Rename map"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              const isOwned = isMapOwnedByUser(map, user!.uid, user!.email)
                                              if (isOwned) {
                                                handleDeleteMap(map, e)
                                              } else {
                                                handleLeaveMap(map, e)
                                              }
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            title={isMapOwnedByUser(map, user!.uid, user!.email) ? "Delete map" : "Leave map"}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <UserProfile onSignOut={handleSignOut} />
              </div>

      {/* CSV Progress Bar */}
      {(isUploading || uploadProgress.total > 0) && (
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-700">Markers: {uploadProgress.processed} / {uploadProgress.total}</span>
            <div className="flex items-center gap-2">
              {isUploading && (
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className="text-sm font-medium text-pinz-600 drop-shadow-sm">
                {uploadProgress.total > 0 ? Math.round((uploadProgress.processed / uploadProgress.total) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 rounded-full transition-all duration-500 ease-out animate-glow"
              style={{ 
                width: uploadProgress.total > 0 
                  ? `${(uploadProgress.processed / uploadProgress.total) * 100}%` 
                  : '0%',
                animation: uploadProgress.total > 0 ? 'glow 2s ease-in-out infinite' : 'none'
              }}
            >
              {/* Animated shimmer effect */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40"
                style={{
                  animation: uploadProgress.total > 0 ? 'shimmer 2s ease-in-out infinite' : 'none'
                }}
              ></div>
            </div>
            {/* Glow effect overlay */}
            <div 
              className="absolute top-0 left-0 h-2 bg-pinz-400 rounded-full blur-sm opacity-70 transition-all duration-500 ease-out"
              style={{ 
                width: uploadProgress.total > 0 
                  ? `${(uploadProgress.processed / uploadProgress.total) * 100}%` 
                  : '0%',
                animation: uploadProgress.total > 0 ? 'progressGlow 3s ease-in-out infinite' : 'none'
              }}
            ></div>
          </div>
          
          {/* Processing Details */}
          {uploadProgress.currentAddress && uploadProgress.currentAddress !== 'Complete' && (
            <div className="mt-2 text-xs text-gray-600">
              <div className="flex items-center gap-1 mb-1">
                {uploadProgress.currentAddress.includes('✅ Processed:') ? (
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                ) : (
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                )}
                <span className="font-medium">
                  {uploadProgress.currentAddress.includes('✅ Processed:') ? 'Completed:' : 'Processing:'}
                </span>
              </div>
              <div className="pl-4 space-y-1">
                {uploadProgress.currentAddress.includes('🌍 Geocoding:') ? (
                  <div>
                    <div className="text-gray-700 font-medium">
                      {uploadProgress.currentAddress.replace('🌍 Geocoding: ', '').split(' | ')[0]}
                    </div>
                    <div className="text-gray-500 text-xs">
                      📍 {uploadProgress.currentAddress.replace('🌍 Geocoding: ', '').split(' | ')[1]}
                    </div>
                  </div>
                ) : uploadProgress.currentAddress.includes('✅ Processed:') ? (
                  <div>
                    <div className="text-green-700 font-medium">
                      {uploadProgress.currentAddress.replace('✅ Processed: ', '').split(' | ')[0]}
                    </div>
                    <div className="text-green-600 text-xs">
                      📍 {uploadProgress.currentAddress.replace('✅ Processed: ', '').split(' | ')[1]}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-700 truncate">
                    {uploadProgress.currentAddress}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {uploadProgress.currentAddress === 'Complete' && (
            <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="font-medium">✅ Upload complete! {uploadProgress.processed} markers added to map.</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs - Horizontal layout - Fixed */}
      <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
        <nav className="flex items-center gap-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`sidebar-item flex-1 flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
                  activeTab === item.id 
                    ? 'bg-pinz-50 text-pinz-700 border border-pinz-200' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium truncate w-full text-center">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content based on active tab */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'data' && (
          <DataTabContent
            onShowAddMarkerModal={onShowAddMarkerModal}
            onShowCsvModal={onShowCsvModal}
            onShowPolygonModal={onShowPolygonModal}
            onGenerateCityPolygon={onGenerateCityPolygon}
            onSavePolygon={onSavePolygon}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            onOpenModal={onOpenDataManagementModal}
            currentMarkerCount={(() => {
              // Calculate marker count based on map ownership
              const currentMap = maps.find(m => m.id === currentMapId)
              const isOwnedMap = currentMap && user ? isMapOwnedByUser(currentMap, user.uid, user.email) : true
              
              if (isOwnedMap) {
                // For owned maps: count all markers (current behavior)
                return markers.length
              } else {
                // For shared maps: count 0 markers since all markers belong to the map owner
                return 0
              }
            })()}
          />
        )}

        {activeTab === 'manage' && (
          <ManageTabContent
            markers={markers}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            onToggleMarkerVisibility={onToggleMarkerVisibility}
            onDeleteMarker={onDeleteMarker}
            mapSettings={mapSettings}
            onMapSettingsChange={onMapSettingsChange}
            userId={userId}
            mapId={currentMapId || undefined}
            onOpenModal={onOpenMarkerManagementModal}
            currentMap={maps.find(m => m.id === currentMapId)}
            onOpenSubscription={onOpenSubscription}
          />
        )}

        {activeTab === 'edit' && (
          <EditTabContent
            mapSettings={mapSettings}
            onMapSettingsChange={onMapSettingsChange}
            onOpenModal={onOpenEditManagementModal}
          />
        )}

        {/* Original edit tab content removed - now using EditTabContent component */}
        {false && (
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Map Design</h3>
            
             {/* Map Style */}
             <div className="mb-6">
               <h4 className="text-sm font-medium text-gray-700 mb-3">Map Style</h4>
               <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onMapSettingsChange({...mapSettings, style: 'light'})}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    mapSettings.style === 'light' 
                      ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-2">
                    <div className="w-full h-12 rounded-md bg-white border border-gray-300 relative overflow-hidden shadow-sm">
                      {/* Roads */}
                      <div className="absolute top-2 left-0 w-full h-0.5 bg-gray-200"></div>
                      <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200"></div>
                      <div className="absolute top-4 left-6 w-8 h-0.5 bg-gray-300"></div>
                      {/* Buildings */}
                      <div className="absolute top-1 left-2 w-1.5 h-1.5 bg-gray-300 rounded-sm"></div>
                      <div className="absolute top-3 right-3 w-1 h-1 bg-gray-300 rounded-sm"></div>
                      <div className="absolute bottom-2 left-5 w-1 h-1 bg-gray-300 rounded-sm"></div>
                      {/* Parks */}
                      <div className="absolute bottom-1 left-8 w-2 h-2 bg-green-100 rounded-sm"></div>
                    </div>
                  </div>
                  Light
                </button>
                <button
                  onClick={() => onMapSettingsChange({...mapSettings, style: 'osm'})}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    mapSettings.style === 'osm' 
                      ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-2">
                    <div className="w-full h-12 rounded-md bg-gradient-to-br from-green-50 to-gray-100 border border-gray-300 relative overflow-hidden shadow-sm">
                      {/* Grid pattern */}
                      <div className="absolute inset-0 opacity-30">
                        <div className="absolute top-2 left-0 w-full h-px bg-gray-400"></div>
                        <div className="absolute top-6 left-0 w-full h-px bg-gray-400"></div>
                        <div className="absolute top-4 left-0 w-px h-full bg-gray-400"></div>
                        <div className="absolute top-0 right-8 w-px h-full bg-gray-400"></div>
                      </div>
                      {/* Roads */}
                      <div className="absolute top-3 left-0 w-full h-0.5 bg-orange-200"></div>
                      <div className="absolute bottom-3 left-0 w-full h-0.5 bg-orange-200"></div>
                      <div className="absolute top-0 left-8 w-0.5 h-full bg-orange-200"></div>
                      {/* Buildings */}
                      <div className="absolute top-1 left-2 w-2 h-2 bg-gray-400 rounded-sm"></div>
                      <div className="absolute top-4 right-3 w-1.5 h-1.5 bg-gray-400 rounded-sm"></div>
                      <div className="absolute bottom-2 left-5 w-1.5 h-1.5 bg-gray-400 rounded-sm"></div>
                      {/* Water */}
                      <div className="absolute bottom-1 left-9 w-2 h-2 bg-blue-200 rounded-sm"></div>
                      <div className="absolute top-2 right-1 w-1.5 h-1.5 bg-blue-200 rounded-sm"></div>
                      {/* More Green Parks */}
                      <div className="absolute bottom-2 left-8 w-2 h-2 bg-green-400 rounded-sm"></div>
                      <div className="absolute top-1 left-6 w-1 h-1 bg-green-500 rounded-full"></div>
                      <div className="absolute top-5 right-2 w-1.5 h-1.5 bg-green-300 rounded-sm"></div>
                      <div className="absolute bottom-4 left-3 w-1 h-1 bg-green-400 rounded-sm"></div>
                    </div>
                  </div>
                  Classic
                </button>
                <button
                  onClick={() => onMapSettingsChange({...mapSettings, style: 'voyager'})}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    mapSettings.style === 'voyager' 
                      ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-2">
                    <div className="w-full h-12 rounded-md bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 relative overflow-hidden shadow-sm">
                      {/* Simple classic roads */}
                      <div className="absolute top-2 left-0 w-full h-0.5 bg-slate-400"></div>
                      <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-400"></div>
                      <div className="absolute top-4 left-6 w-8 h-0.5 bg-slate-500"></div>
                      <div className="absolute bottom-2 left-0 w-full h-0.5 bg-blue-300"></div>
                      {/* Buildings */}
                      <div className="absolute top-1 left-2 w-2 h-2 bg-slate-300 rounded-sm"></div>
                      <div className="absolute top-4 right-3 w-1.5 h-1.5 bg-slate-300 rounded-sm"></div>
                      <div className="absolute bottom-3 left-5 w-1.5 h-1.5 bg-slate-300 rounded-sm"></div>
                      {/* Simple water */}
                      <div className="absolute bottom-1 left-9 w-2 h-2 bg-blue-200 rounded-sm"></div>
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-200 rounded-sm"></div>
                      {/* Green areas */}
                      <div className="absolute top-3 left-8 w-1.5 h-1.5 bg-green-200 rounded-sm"></div>
                    </div>
                  </div>
                  Clean
                </button>
                <button
                  onClick={() => onMapSettingsChange({...mapSettings, style: 'dark'})}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    mapSettings.style === 'dark' 
                      ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-2">
                    <div className="w-full h-12 rounded-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 relative overflow-hidden shadow-inner">
                      {/* Dark blue water-like areas */}
                      <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-blue-900 to-transparent"></div>
                      {/* Roads */}
                      <div className="absolute top-2 left-0 w-full h-0.5 bg-gray-700"></div>
                      <div className="absolute bottom-2 left-0 w-full h-0.5 bg-gray-700"></div>
                      {/* Buildings */}
                      <div className="absolute top-3 left-2 w-1.5 h-1.5 bg-gray-600 rounded-sm"></div>
                      <div className="absolute top-5 right-3 w-1 h-1 bg-gray-600 rounded-sm"></div>
                      <div className="absolute bottom-3 left-6 w-1 h-1 bg-gray-600 rounded-sm"></div>
                      {/* Blue accent */}
                      <div className="absolute bottom-1 left-9 w-2 h-2 bg-blue-800 rounded-sm"></div>
                    </div>
                  </div>
                  Dark
                </button>
                 <button
                  onClick={() => onMapSettingsChange({...mapSettings, style: 'satellite'})}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    mapSettings.style === 'satellite' 
                      ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-2">
                    <div className="w-full h-12 rounded-md bg-gradient-to-br from-green-900 via-green-700 to-green-800 border border-green-700 relative overflow-hidden">
                      {/* Earth-like textures */}
                      <div className="absolute inset-0 bg-gradient-to-b from-green-800 to-green-900"></div>
                      <div className="absolute top-2 left-3 w-3 h-2 bg-amber-700 rounded-sm"></div>
                      <div className="absolute bottom-2 right-2 w-2 h-1.5 bg-amber-800 rounded-sm"></div>
                      {/* Water */}
                      <div className="absolute top-0 right-0 w-6 h-4 bg-gradient-to-br from-blue-900 to-blue-800 rounded-bl-full"></div>
                      {/* Terrain variations */}
                      <div className="absolute top-4 left-0 w-full h-1 bg-green-950 opacity-50"></div>
                      <div className="absolute bottom-3 left-0 w-full h-0.5 bg-green-950 opacity-50"></div>
                      {/* Cloud overlay effect */}
                      <div className="absolute top-1 right-3 w-1 h-1 bg-white opacity-60 rounded-full blur-sm"></div>
                      <div className="absolute bottom-1 left-4 w-1 h-1 bg-white opacity-40 rounded-full blur-sm"></div>
                    </div>
                  </div>
                  Satellite
                </button>
                <button
                  onClick={() => onMapSettingsChange({...mapSettings, style: 'topo'})}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    mapSettings.style === 'topo' 
                      ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-2">
                    <div className="w-full h-12 rounded-md bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 relative overflow-hidden shadow-sm">
                      {/* Topographic contour lines */}
                      <div className="absolute top-2 left-0 w-full h-0.5 bg-amber-200"></div>
                      <div className="absolute top-4 left-0 w-full h-0.5 bg-amber-300"></div>
                      <div className="absolute top-6 left-0 w-full h-0.5 bg-amber-200"></div>
                      <div className="absolute bottom-2 left-0 w-full h-0.5 bg-amber-300"></div>
                      <div className="absolute bottom-4 left-6 w-6 h-0.5 bg-amber-400"></div>
                      {/* Terrain features */}
                      <div className="absolute top-1 left-3 w-1.5 h-1.5 bg-green-400 rounded-sm"></div>
                      <div className="absolute bottom-1 right-4 w-2 h-2 bg-blue-300 rounded-sm"></div>
                      <div className="absolute top-5 left-8 w-1 h-1 bg-amber-500 rounded-full"></div>
                    </div>
                  </div>
                  Natural
                </button>
               </div>
             </div>

            {/* Markers Design */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Markers Design</h3>
              
              {/* Marker Shape */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Shape</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'pin'})}
                    className={`p-2 border rounded flex flex-col items-center justify-center gap-1 ${
                      mapSettings.markerShape === 'pin' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Pin"
                  >
                    <MapPin className="w-5 h-5" />
                    <span className="text-xs">Pin</span>
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'circle'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerShape === 'circle' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Circle"
                  >
                    ●
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'square'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerShape === 'square' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Square"
                  >
                    ■
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'diamond'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerShape === 'diamond' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Diamond"
                  >
                    ◆
                  </button>
                </div>
              </div>

              {/* Marker Color */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#000000'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerColor === '#000000' 
                        ? 'border-pinz-600 bg-pinz-50' 
                        : 'border-gray-300 bg-black text-white hover:bg-gray-800'
                    }`}
                  >
                    Black
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#3B82F6'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerColor === '#3B82F6' 
                        ? 'border-pinz-600 bg-pinz-50' 
                        : 'border-gray-300 bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#EF4444'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerColor === '#EF4444' 
                        ? 'border-pinz-600 bg-pinz-50' 
                        : 'border-gray-300 bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Red
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#10B981'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerColor === '#10B981' 
                        ? 'border-pinz-600 bg-pinz-50' 
                        : 'border-gray-300 bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    Green
                  </button>
                </div>
              </div>

              {/* Marker Size */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Size</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'small'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerSize === 'small' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Small
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'medium'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerSize === 'medium' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'large'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerSize === 'large' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Large
                  </button>
                </div>
              </div>

              {/* Marker Border */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Border</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerBorder: 'white'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerBorder === 'white' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    White
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerBorder: 'none'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerBorder === 'none' 
                        ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                        : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Border Width */}
              {mapSettings.markerBorder !== 'none' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Border Width</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 1})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.markerBorderWidth === 1 
                          ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Thin
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 2})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.markerBorderWidth === 2 
                          ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 3})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.markerBorderWidth === 3 
                          ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Thick
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Clustering Settings */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Clustering</h3>
              
              {/* Clustering Toggle */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Enable Clustering</label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, clusteringEnabled: true})}
                    className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${
                      mapSettings.clusteringEnabled 
                        ? 'border-blue-600 bg-blue-600 text-white' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Enabled
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, clusteringEnabled: false})}
                    className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${
                      !mapSettings.clusteringEnabled 
                        ? 'border-red-600 bg-red-600 text-white' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Disabled
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {mapSettings.clusteringEnabled 
                    ? 'Markers will be grouped into clusters when zoomed out' 
                    : 'All markers will be shown individually (no clustering)'}
                </p>
              </div>

              {/* Cluster Radius - Only show when clustering is enabled */}
              {mapSettings.clusteringEnabled && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Cluster Sensitivity</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 30})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.clusterRadius === 30 
                          ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      High
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 50})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.clusterRadius === 50 
                          ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 80})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.clusterRadius === 80 
                          ? 'border-pinz-600 bg-pinz-50 text-pinz-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Low
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Lower values = more clusters, higher values = fewer clusters</p>
                </div>
              )}
            </div>

            {/* Search Bar Settings */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Bar</h3>
              
              {/* Background Color */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Search Panel Background</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={mapSettings.searchBarBackgroundColor}
                    onChange={(e) => onMapSettingsChange({...mapSettings, searchBarBackgroundColor: e.target.value})}
                    className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={mapSettings.searchBarBackgroundColor}
                    onChange={(e) => onMapSettingsChange({...mapSettings, searchBarBackgroundColor: e.target.value})}
                    placeholder="#ffffff"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Match your website's color scheme</p>
              </div>

              {/* Text Color */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Marker List Text Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={mapSettings.searchBarTextColor}
                    onChange={(e) => onMapSettingsChange({...mapSettings, searchBarTextColor: e.target.value})}
                    className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={mapSettings.searchBarTextColor}
                    onChange={(e) => onMapSettingsChange({...mapSettings, searchBarTextColor: e.target.value})}
                    placeholder="#000000"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Color for marker names and addresses in the list</p>
              </div>

              {/* Hover Color */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Hover Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={mapSettings.searchBarHoverColor}
                    onChange={(e) => onMapSettingsChange({...mapSettings, searchBarHoverColor: e.target.value})}
                    className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={mapSettings.searchBarHoverColor}
                    onChange={(e) => onMapSettingsChange({...mapSettings, searchBarHoverColor: e.target.value})}
                    placeholder="#f3f4f6"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Color for hover effects on marker list items</p>
              </div>

              {/* Reset Button */}
              <div className="mb-4">
                <button
                  onClick={() => onMapSettingsChange({
                    ...mapSettings,
                    searchBarBackgroundColor: '#ffffff',
                    searchBarTextColor: '#000000',
                    searchBarHoverColor: '#f3f4f6'
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p>Changes are applied live to your map. Use these controls to customize the appearance of your map.</p>
            </div>
          </div>
        )}

        {activeTab === 'publish' && (
          <PublishTabContent
            onShowPublishModal={onShowPublishModal}
            currentMapId={currentMapId}
            onOpenModal={onOpenPublishManagementModal}
          />
        )}

      </div>

      {/* Delete Map Dialog */}
      <DeleteMapDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={mapToDelete && user ? (isMapOwnedByUser(mapToDelete, user.uid, user.email) ? confirmDeleteMap : confirmLeaveMap) : confirmDeleteMap}
        mapName={mapToDelete?.name || ''}
        markerCount={mapToDelete?.stats?.markerCount || 0}
        isDeleting={isDeletingMap}
        isOwnedMap={mapToDelete && user ? isMapOwnedByUser(mapToDelete, user.uid, user.email) : true}
      />

      {/* Sharing Modal */}
      {showSharingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Share Map</h3>
              <button
                onClick={() => setShowSharingModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={sharingEmail}
                  onChange={(e) => setSharingEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission Level
                </label>
                <select
                  value={sharingRole}
                  onChange={(e) => setSharingRole(e.target.value as 'viewer' | 'editor')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="viewer">Viewer - Can view map only (cannot edit anything)</option>
                  <option value="editor">Editor - Can edit everything they have permission to</option>
                </select>
              </div>

              {/* Current shared users */}
              {currentMapId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shared With
                  </label>
                  {(() => {
                    const currentMap = maps.find(m => m.id === currentMapId)
                    const sharedWith = currentMap?.sharing?.sharedWith || []
                    
                    if (sharedWith.length === 0) {
                      return (
                        <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 text-center">
                          No users shared yet. Add users above to share this map.
                        </div>
                      )
                    }
                    
                    return (
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {sharedWith.map((user: SharedUser, index: number) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm text-gray-900 font-medium truncate" title={user.email}>
                                {user.email}
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {user.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              <select
                                value={user.role}
                                onChange={(e) => handleUpdateUserRole(user.email, e.target.value as 'viewer' | 'editor')}
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                              </select>
                              <button
                                onClick={() => handleRemoveUser(user.email)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Remove user"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Transfer Ownership Section */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Transfer Ownership</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Permanently transfer this map and all its markers to another user. This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={transferEmail}
                    onChange={(e) => setTransferEmail(e.target.value)}
                    placeholder="Enter recipient email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleTransferOwnership}
                    disabled={!transferEmail.trim() || isTransferring}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTransferring ? 'Transferring...' : 'Transfer'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleShareMap}
                  disabled={!sharingEmail.trim() || isSharing}
                  className="flex-1 px-4 py-2 bg-pinz-600 text-white text-sm font-medium rounded-lg hover:bg-pinz-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSharing ? 'Sharing...' : 'Share Map'}
                </button>
                <button
                  onClick={() => setShowSharingModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
