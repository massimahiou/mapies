import React, { useState, useEffect } from 'react'
import { Eye, Share2, Plus, Upload, Trash2, MapPin, Settings, ChevronDown, Map, Globe, Copy, Check } from 'lucide-react'
import UserProfile from './UserProfile'
import { useAuth } from '../contexts/AuthContext'
import { getUserMaps, createMap, deleteMap, MapDocument, NameRule } from '../firebase/maps'
import DeleteMapDialog from './DeleteMapDialog'
import ManageTabContent from './sidebar/ManageTabContent'

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
  onShowPublishModal: () => void
  mapSettings: any
  onMapSettingsChange: (settings: any) => void
  currentMapId: string | null
  onMapChange: (mapId: string) => void
  maps: MapDocument[]
  onMapsChange: (maps: MapDocument[]) => void
  isUploading?: boolean
  uploadProgress?: { processed: number; total: number; currentAddress: string }
  userId: string
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
  onShowPublishModal,
  mapSettings,
  onMapSettingsChange,
  currentMapId,
  onMapChange,
  maps,
  onMapsChange,
  isUploading = false,
  uploadProgress = { processed: 0, total: 0, currentAddress: '' },
  userId
}) => {
  const [publicCopied, setPublicCopied] = useState(false)
  const { signOut, user } = useAuth()

  // Generate public share URL
  const generatePublicUrl = () => {
    if (!currentMapId) {
      return 'Please select a map to generate public URL'
    }
    const url = `${window.location.origin}/${currentMapId}`
    console.log('Generated public URL:', url, 'for mapId:', currentMapId)
    return url
  }

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(generatePublicUrl()).then(() => {
      setPublicCopied(true)
      setTimeout(() => setPublicCopied(false), 2000)
    })
  }
  const [showMapSelector, setShowMapSelector] = useState(false)
  const [isCreatingMap, setIsCreatingMap] = useState(false)
  const [newMapName, setNewMapName] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [mapToDelete, setMapToDelete] = useState<MapDocument | null>(null)
  const [isDeletingMap, setIsDeletingMap] = useState(false)
  const [nameRules, setNameRules] = useState<NameRule[]>([])

  const handleNameRulesChange = async (rules: NameRule[]) => {
    setNameRules(rules)
    
    // Save to Firestore if we have a current map
    if (currentMapId && user) {
      try {
        const { updateMap } = await import('../firebase/maps')
        await updateMap(user.uid, currentMapId, {
          settings: {
            ...mapSettings,
            nameRules: rules
          }
        })
      } catch (error) {
        console.error('Error saving name rules:', error)
      }
    }
  }

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

  // Load name rules when map changes
  useEffect(() => {
    const loadNameRules = async () => {
      if (currentMapId && user) {
        try {
          const { getMap } = await import('../firebase/maps')
          const mapDoc = await getMap(user.uid, currentMapId)
          if (mapDoc?.settings?.nameRules) {
            setNameRules(mapDoc.settings.nameRules)
          } else {
            setNameRules([])
          }
        } catch (error) {
          console.error('Error loading name rules:', error)
          setNameRules([])
        }
      } else {
        setNameRules([])
      }
    }
    
    loadNameRules()
  }, [currentMapId, user])

  // Create a new map
  const handleCreateMap = async () => {
    if (!user || !newMapName.trim()) return
    
    setIsCreatingMap(true)
    try {
      const mapId = await createMap(user.uid, {
        name: newMapName.trim(),
        description: 'New map',
        settings: mapSettings
      })
      
      // Refresh maps list
      const userMaps = await getUserMaps(user.uid)
      onMapsChange(userMaps)
      
      // Select the new map
      onMapChange(mapId)
      
      // Reset form
      setNewMapName('')
      setShowMapSelector(false)
      
      console.log('Created new map with settings:', mapId, mapSettings)
    } catch (error) {
      console.error('Error creating map:', error)
    } finally {
      setIsCreatingMap(false)
    }
  }

  // Get current map name
  const getCurrentMapName = () => {
    const currentMap = maps.find(map => map.id === currentMapId)
    return currentMap ? currentMap.name : 'No map selected'
  }

  // Handle map deletion
  const handleDeleteMap = (map: MapDocument, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent map selection
    setMapToDelete(map)
    setShowDeleteDialog(true)
  }

  const confirmDeleteMap = async () => {
    if (!user || !mapToDelete) return

    setIsDeletingMap(true)
    try {
      await deleteMap(user.uid, mapToDelete.id!)
      
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
    } catch (error) {
      console.error('Error deleting map:', error)
      alert('Failed to delete map. Please try again.')
    } finally {
      setIsDeletingMap(false)
    }
  }
  const sidebarItems = [
    { id: 'data', label: 'Data', icon: Plus },
    { id: 'manage', label: 'Manage', icon: Eye },
    { id: 'edit', label: 'Edit', icon: Settings },
    { id: 'publish', label: 'Publish', icon: Share2 }
  ]


  return (
    <div className="w-80 bg-white shadow-lg flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <MapPin className="w-8 h-8 text-blue-600" />
                    <h1 className="text-4xl font-bold text-gray-900">MAPIES</h1>
                  </div>
                </div>
                
                {/* Map Selector */}
                <div className="mb-4">
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
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="p-2">
                          {/* Create New Map */}
                          <div className="p-2 border-b border-gray-100">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="New map name..."
                                value={newMapName}
                                onChange={(e) => setNewMapName(e.target.value)}
                                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleCreateMap()}
                              />
                              <button
                                onClick={handleCreateMap}
                                disabled={!newMapName.trim() || isCreatingMap}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    map.id === currentMapId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
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
                                    <button
                                      onClick={(e) => handleDeleteMap(map, e)}
                                      className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                                      title="Delete map"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
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

      {/* Navigation Tabs */}
      <div className="p-4 border-b border-gray-200">
        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`sidebar-item w-full text-left ${
                  activeTab === item.id ? 'active' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content based on active tab */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'data' && (
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Data</h3>
                   <div className="space-y-3">
                     <button
                       onClick={() => {
                         console.log('Add marker button clicked')
                         onShowAddMarkerModal()
                       }}
                       className="btn-primary w-full flex items-center gap-2"
                     >
                       <Plus className="w-4 h-4" />
                       Add a marker
                     </button>
                     <button
                       onClick={() => {
                         console.log('Import CSV button clicked')
                         onShowCsvModal()
                       }}
                       className="btn-secondary w-full flex items-center gap-2"
                     >
                       <Upload className="w-4 h-4" />
                       Import a Spreadsheet
                     </button>
                     
                     {/* Upload Progress Bar */}
                     {isUploading && (
                       <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                         <div className="flex items-center justify-between mb-2">
                           <p className="text-sm text-blue-600">Processing markers...</p>
                           <p className="text-xs text-blue-500">
                             {uploadProgress.total > 0 ? `${uploadProgress.processed}/${uploadProgress.total} markers loaded` : 'Preparing...'}
                           </p>
                         </div>
                         <div className="w-full bg-blue-200 rounded-full h-2">
                           <div 
                             className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                             style={{ 
                               width: uploadProgress.total > 0 
                                 ? `${(uploadProgress.processed / uploadProgress.total) * 100}%` 
                                 : '0%' 
                             }}
                           ></div>
                         </div>
                         {uploadProgress.currentAddress && uploadProgress.currentAddress !== 'Complete' && (
                           <p className="text-xs text-blue-500 mt-2 truncate">
                             Currently processing: {uploadProgress.currentAddress}
                           </p>
                         )}
                         {uploadProgress.currentAddress === 'Complete' && (
                           <p className="text-xs text-green-600 mt-2 font-medium">
                             ✅ Upload complete! {uploadProgress.processed} markers added to map.
                           </p>
                         )}
                       </div>
                     )}
                   </div>
            <div className="mt-6 text-sm text-gray-600">
              <p>Add markers manually or import them from a CSV file with name and address columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <ManageTabContent
            markers={markers}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            onToggleMarkerVisibility={onToggleMarkerVisibility}
            onDeleteMarker={onDeleteMarker}
            nameRules={nameRules}
            onNameRulesChange={handleNameRulesChange}
            userId={userId}
            mapId={currentMapId || undefined}
          />
        )}

        {activeTab === 'edit' && (
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Map Design</h3>
            
             {/* Map Style */}
             <div className="mb-6">
               <h4 className="text-sm font-medium text-gray-700 mb-3">Map Style</h4>
               <div className="grid grid-cols-2 gap-3">
                 <button
                   onClick={() => onMapSettingsChange({...mapSettings, style: 'light'})}
                   className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                     mapSettings.style === 'light' 
                       ? 'border-blue-600 bg-blue-50 text-blue-700' 
                       : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                   }`}
                 >
                   <div className="mb-2">
                     <div className="w-full h-12 rounded-md bg-gradient-to-br from-blue-100 to-green-100 border border-gray-200 relative overflow-hidden">
                       <div className="absolute inset-0 bg-white opacity-60"></div>
                       <div className="absolute top-1 left-1 w-2 h-2 bg-gray-300 rounded-sm"></div>
                       <div className="absolute top-2 left-4 w-1 h-1 bg-gray-400 rounded-full"></div>
                       <div className="absolute top-3 left-6 w-1 h-1 bg-gray-400 rounded-full"></div>
                       <div className="absolute top-4 left-2 w-1 h-1 bg-gray-400 rounded-full"></div>
                       <div className="absolute bottom-1 right-1 w-3 h-3 bg-blue-200 rounded-sm"></div>
                     </div>
                   </div>
                   Light
                 </button>
                 <button
                   onClick={() => onMapSettingsChange({...mapSettings, style: 'dark'})}
                   className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                     mapSettings.style === 'dark' 
                       ? 'border-blue-600 bg-blue-50 text-blue-700' 
                       : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                   }`}
                 >
                   <div className="mb-2">
                     <div className="w-full h-12 rounded-md bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-200 relative overflow-hidden">
                       <div className="absolute top-1 left-1 w-2 h-2 bg-gray-600 rounded-sm"></div>
                       <div className="absolute top-2 left-4 w-1 h-1 bg-gray-500 rounded-full"></div>
                       <div className="absolute top-3 left-6 w-1 h-1 bg-gray-500 rounded-full"></div>
                       <div className="absolute top-4 left-2 w-1 h-1 bg-gray-500 rounded-full"></div>
                       <div className="absolute bottom-1 right-1 w-3 h-3 bg-gray-700 rounded-sm"></div>
                     </div>
                   </div>
                   Dark
                 </button>
                 <button
                   onClick={() => onMapSettingsChange({...mapSettings, style: 'toner'})}
                   className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                     mapSettings.style === 'toner' 
                       ? 'border-blue-600 bg-blue-50 text-blue-700' 
                       : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                   }`}
                 >
                   <div className="mb-2">
                     <div className="w-full h-12 rounded-md bg-white border border-gray-200 relative overflow-hidden">
                       <div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-sm"></div>
                       <div className="absolute top-2 left-4 w-1 h-1 bg-gray-800 rounded-full"></div>
                       <div className="absolute top-3 left-6 w-1 h-1 bg-gray-800 rounded-full"></div>
                       <div className="absolute top-4 left-2 w-1 h-1 bg-gray-800 rounded-full"></div>
                       <div className="absolute bottom-1 right-1 w-3 h-3 bg-gray-200 rounded-sm"></div>
                       <div className="absolute top-0 left-0 w-full h-full">
                         <div className="w-full h-px bg-gray-300 absolute top-2"></div>
                         <div className="w-full h-px bg-gray-300 absolute top-4"></div>
                         <div className="w-full h-px bg-gray-300 absolute top-6"></div>
                         <div className="w-full h-px bg-gray-300 absolute top-8"></div>
                       </div>
                     </div>
                   </div>
                   Toner
                 </button>
                 <button
                   onClick={() => onMapSettingsChange({...mapSettings, style: 'satellite'})}
                   className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                     mapSettings.style === 'satellite' 
                       ? 'border-blue-600 bg-blue-50 text-blue-700' 
                       : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                   }`}
                 >
                   <div className="mb-2">
                     <div className="w-full h-12 rounded-md bg-gradient-to-br from-green-400 via-green-500 to-green-600 border border-gray-200 relative overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-br from-green-300 to-green-700 opacity-80"></div>
                       <div className="absolute top-1 left-1 w-2 h-2 bg-gray-600 rounded-sm"></div>
                       <div className="absolute top-2 left-4 w-1 h-1 bg-gray-700 rounded-full"></div>
                       <div className="absolute top-3 left-6 w-1 h-1 bg-gray-700 rounded-full"></div>
                       <div className="absolute top-4 left-2 w-1 h-1 bg-gray-700 rounded-full"></div>
                       <div className="absolute bottom-1 right-1 w-3 h-3 bg-blue-400 rounded-sm"></div>
                       <div className="absolute top-0 left-0 w-full h-full">
                         <div className="absolute top-1 left-2 w-1 h-1 bg-green-200 rounded-full"></div>
                         <div className="absolute top-2 right-2 w-1 h-1 bg-green-200 rounded-full"></div>
                         <div className="absolute bottom-2 left-3 w-1 h-1 bg-green-200 rounded-full"></div>
                       </div>
                     </div>
                   </div>
                   Satellite
                 </button>
               </div>
             </div>

            {/* Markers Design */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Markers Design</h3>
              
              {/* Marker Shape */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Shape</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'circle'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerShape === 'circle' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ●
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'square'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerShape === 'square' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ■
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerShape: 'diamond'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerShape === 'diamond' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
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
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-gray-300 bg-black text-white hover:bg-gray-800'
                    }`}
                  >
                    Black
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#3B82F6'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerColor === '#3B82F6' 
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-gray-300 bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#EF4444'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerColor === '#EF4444' 
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-gray-300 bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Red
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerColor: '#10B981'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerColor === '#10B981' 
                        ? 'border-blue-600 bg-blue-50' 
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
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Small
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'medium'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerSize === 'medium' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerSize: 'large'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerSize === 'large' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
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
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    White
                  </button>
                  <button
                    onClick={() => onMapSettingsChange({...mapSettings, markerBorder: 'none'})}
                    className={`p-2 border rounded text-xs ${
                      mapSettings.markerBorder === 'none' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
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
                          ? 'border-blue-600 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Thin
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 2})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.markerBorderWidth === 2 
                          ? 'border-blue-600 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, markerBorderWidth: 3})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.markerBorderWidth === 3 
                          ? 'border-blue-600 bg-blue-50 text-blue-700' 
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
                          ? 'border-blue-600 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      High
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 50})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.clusterRadius === 50 
                          ? 'border-blue-600 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => onMapSettingsChange({...mapSettings, clusterRadius: 80})}
                      className={`p-2 border rounded text-xs ${
                        mapSettings.clusterRadius === 80 
                          ? 'border-blue-600 bg-blue-50 text-blue-700' 
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
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Publish Map</h3>
            <div className="space-y-3">
              {/* Public Share Button */}
              <button 
                onClick={copyPublicUrl}
                className="w-full flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {publicCopied ? <Check className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                {publicCopied ? 'Copied!' : 'Share Public Link'}
              </button>
              
              {/* Embed Code Button */}
              <button 
                onClick={() => {
                  console.log('Publish button clicked')
                  onShowPublishModal()
                }}
                className="btn-primary w-full flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Generate Embed Code
              </button>
            </div>
            <div className="mt-6 text-sm text-gray-600">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-green-600" />
                  <span>Share a simple link that anyone can view</span>
                </div>
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-blue-600" />
                  <span>Generate embed code for websites</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                {markers.filter(m => m.visible).length} markers will be included
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Map Dialog */}
      <DeleteMapDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDeleteMap}
        mapName={mapToDelete?.name || ''}
        markerCount={mapToDelete?.stats?.markerCount || 0}
        isDeleting={isDeletingMap}
      />
    </div>
  )
}

export default Sidebar
