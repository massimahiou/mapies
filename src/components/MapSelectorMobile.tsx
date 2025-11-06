import React, { useState, useRef, useEffect } from 'react'
import { Map, ChevronDown, Edit2, Check, X, Trash2, AlertTriangle } from 'lucide-react'
import { MapDocument } from '../firebase/maps'
import { createMap, getUserMaps, updateMap, deleteMap } from '../firebase/maps'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import { useUsageWarning } from '../hooks/useFeatureAccess'
import { ensureFreemiumCompliance } from '../utils/freemiumDefaults'
import { isAdmin } from '../utils/admin'
import { getUserDocument } from '../firebase/users'

interface MapSelectorMobileProps {
  maps: MapDocument[]
  currentMapId: string | null
  onMapChange: (mapId: string) => void
  onMapsChange: (maps: MapDocument[]) => void
  userId: string
  onOpenSubscription?: () => void
}

const MapSelectorMobile: React.FC<MapSelectorMobileProps> = ({
  maps,
  currentMapId,
  onMapChange,
  onMapsChange,
  userId: _userId,
  onOpenSubscription
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { canCreateMap, currentPlan } = useFeatureAccess()
  const { limit } = useUsageWarning('maps', maps.length)
  const userIsAdmin = user?.email ? isAdmin(user.email) : false
  
  // Store owner emails for admin view
  const [ownerEmails, setOwnerEmails] = useState<Record<string, string>>({})

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


  // Get current map name
  const getCurrentMapName = () => {
    const currentMap = maps.find(map => map.id === currentMapId)
    return currentMap ? currentMap.name : 'No map selected'
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

  // Load owner emails for admin view
  useEffect(() => {
    if (!userIsAdmin || maps.length === 0) return

    const loadOwnerEmails = async () => {
      setOwnerEmails(prev => {
        const emails: Record<string, string> = { ...prev }
        const userIdsToFetch = new Set<string>()
        
        // Collect unique user IDs from maps that we don't have yet
        maps.forEach(map => {
          if (map.userId && !emails[map.userId]) {
            userIdsToFetch.add(map.userId)
          }
        })

        // Fetch emails for new user IDs
        Promise.all(Array.from(userIdsToFetch).map(async (userId) => {
          try {
            const userDoc = await getUserDocument(userId)
            if (userDoc?.email) {
              emails[userId] = userDoc.email
            } else {
              emails[userId] = 'Unknown'
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error)
            emails[userId] = 'Unknown'
          }
        })).then(() => {
          setOwnerEmails(emails)
        })

        return prev // Return previous state immediately
      })
    }

    loadOwnerEmails()
  }, [maps, userIsAdmin])

  // Create a new map
  const handleCreateMap = async () => {
    if (!user || !newMapName.trim()) return
    
    // Check if user can create more maps
    if (!canCreateMap(maps.length)) {
      return
    }
    
    setIsCreatingMap(true)
    try {
      // Create map with freemium-compliant default settings
      const freemiumCompliantSettings = ensureFreemiumCompliance({}, currentPlan)
      
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

  // Handle map deletion
  const handleDeleteMap = (map: MapDocument, e: React.MouseEvent) => {
    e.stopPropagation()
    setMapToDelete(map)
    setShowDeleteDialog(true)
  }

  // Handle map rename
  const handleRenameMap = async (mapId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingMapId(null)
      setEditingMapName('')
      return
    }

    setIsRenamingMap(true)
    try {
      await updateMap(user!.uid, mapId, { name: newName.trim() }, user!.email)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const userMaps = await getUserMaps(user!.uid)
      onMapsChange(userMaps)
      
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


  // Confirm delete
  const confirmDeleteMap = async () => {
    if (!mapToDelete || !user) return

    setIsDeletingMap(true)
    try {
      await deleteMap(user.uid, mapToDelete.id!, user.email)
      
      // Refresh maps list
      const userMaps = await getUserMaps(user.uid)
      onMapsChange(userMaps)
      
      // If we deleted the current map, select the first available map or clear selection
      if (mapToDelete.id === currentMapId) {
        if (userMaps.length > 0) {
          onMapChange(userMaps[0].id!)
        } else {
          onMapChange('')
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

  // Focus editing input when editing starts
  useEffect(() => {
    if (editingMapId && editingInputRef.current) {
      editingInputRef.current.focus()
      editingInputRef.current.select()
    }
  }, [editingMapId])

  return (
    <div className="space-y-3">
      {/* Map Selector Button */}
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
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] max-h-[70vh] overflow-y-auto">
            <div className="p-2">
              {/* Create New Map */}
              <div className="p-2 border-b border-gray-100">
                {/* Map Limit Message */}
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
              <div className="max-h-64 overflow-y-auto">
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
                              className="p-1 text-green-600 hover:text-green-700"
                              disabled={isRenamingMap}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditingMap}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              disabled={isRenamingMap}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          // View mode
                          <>
                            <button
                              onClick={() => {
                                onMapChange(map.id!)
                                setShowMapSelector(false)
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium truncate">{map.name}</span>
                                {userIsAdmin && map.userId && (
                                  <span className="text-xs text-gray-400 italic truncate">
                                    Owner: {ownerEmails[map.userId] || 'Loading...'}
                                  </span>
                                )}
                              </div>
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => startEditingMap(map, e)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Rename map"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteMap(map, e)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Delete map"
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && mapToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Map</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to delete <strong>"{mapToDelete.name}"</strong>?
                </p>
                <p className="text-sm text-gray-600">
                  This will permanently delete the map and all its markers.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setMapToDelete(null)
                  }}
                  disabled={isDeletingMap}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteMap}
                  disabled={isDeletingMap}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeletingMap ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Map'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapSelectorMobile

