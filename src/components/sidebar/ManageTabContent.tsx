import React, { useState, useEffect } from 'react'
import { Search, Eye, EyeOff, Trash2, Plus, X, Settings, ChevronDown, ChevronRight, Folder, GripVertical, Edit2, Check, Upload } from 'lucide-react'
import { applyNameRules } from '../../utils/markerUtils'
import { createMarkerGroup, updateMarkerGroup, deleteMarkerGroup, getMarkerGroupByName, uploadFolderIconBase64, updateMarkerGroupIcon, removeMarkerGroupIcon } from '../../firebase/firestore'
import { useToast } from '../../contexts/ToastContext'

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
}

interface NameRule {
  id: string
  contains: string
  renameTo: string
}

interface ManageTabContentProps {
  markers: Marker[]
  searchTerm: string
  onSearchChange: (term: string) => void
  onToggleMarkerVisibility: (id: string) => void
  onDeleteMarker: (id: string) => void
  nameRules: NameRule[]
  onNameRulesChange: (rules: NameRule[]) => void
  userId: string
  mapId?: string
}

const ManageTabContent: React.FC<ManageTabContentProps> = ({
  markers,
  searchTerm,
  onSearchChange,
  onToggleMarkerVisibility,
  onDeleteMarker,
  nameRules,
  onNameRulesChange,
  userId,
  mapId
}) => {
  const { showToast } = useToast()
  const [showRules, setShowRules] = useState(false)
  const [newRule, setNewRule] = useState({ contains: '', renameTo: '' })
  const [groupFolders, setGroupFolders] = useState<Record<string, boolean>>({})
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [draggedMarker, setDraggedMarker] = useState<Marker | null>(null)
  const [dragOverMarker, setDragOverMarker] = useState<Marker | null>(null)
  const [dragOverArea, setDragOverArea] = useState<string | null>(null) // 'folder' or 'ungrouped'
  const [customGroups, setCustomGroups] = useState<Record<string, string[]>>({})
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingMarker, setEditingMarker] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [editingMarkerName, setEditingMarkerName] = useState('')
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>({})
  const [uploadingIcon, setUploadingIcon] = useState<string | null>(null)

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'pharmacy': return '🏥'
      case 'grocery': return '🛒'
      case 'retail': return '🏪'
      default: return '•'
    }
  }

  // Apply name rules to get display name
  const getDisplayName = (originalName: string): string => {
    for (const rule of nameRules) {
      if (originalName.toUpperCase().includes(rule.contains.toUpperCase())) {
        return rule.renameTo
      }
    }
    return originalName
  }

  // Group rules by their renameTo value for smarter display
  const groupedRules = nameRules.reduce((groups, rule) => {
    const key = rule.renameTo
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(rule)
    return groups
  }, {} as Record<string, NameRule[]>)

  const addRule = () => {
    if (newRule.contains.trim() && newRule.renameTo.trim()) {
      const rule: NameRule = {
        id: Date.now().toString(),
        contains: newRule.contains.trim(),
        renameTo: newRule.renameTo.trim()
      }
      onNameRulesChange([...nameRules, rule])
      setNewRule({ contains: '', renameTo: '' })
    }
  }

  const removeRule = (ruleId: string) => {
    onNameRulesChange(nameRules.filter(rule => rule.id !== ruleId))
  }

  const toggleGroupFolder = async (groupName: string) => {
    const isCurrentlyEnabled = groupFolders[groupName] || false
    const newState = !isCurrentlyEnabled
    
    setGroupFolders(prev => ({
      ...prev,
      [groupName]: newState
    }))
    
    try {
      if (newState) {
        // Create folder - find all markers that match this group
        const matchingMarkers = markers.filter(marker => {
          const renamedName = applyNameRules(marker.name, nameRules)
          return renamedName === groupName
        })
        
        if (matchingMarkers.length > 0) {
          // Check if group already exists
          const existingGroup = await getMarkerGroupByName(userId, groupName, mapId)
          
          if (existingGroup) {
            // Update existing group with current marker IDs
            await updateMarkerGroup(existingGroup.id, {
              markerIds: matchingMarkers.map(m => m.id)
            })
          } else {
            // Create new group
            await createMarkerGroup({
              groupName,
              markerIds: matchingMarkers.map(m => m.id),
              userId,
              mapId
            })
          }
          
          // Enable the folder
          setGroupFolders(prev => ({
            ...prev,
            [groupName]: true
          }))
          
          console.log('Created folder via toggle:', groupName, 'with', matchingMarkers.length, 'markers')
        }
      } else {
        // Remove folder - delete the group from Firestore
        const existingGroup = await getMarkerGroupByName(userId, groupName, mapId)
        if (existingGroup) {
          await deleteMarkerGroup(existingGroup.id)
        }
        
        console.log('Removed folder:', groupName)
      }
    } catch (error) {
      console.error('Error toggling group folder:', error)
    }
  }

  const filteredMarkers = markers.filter(marker =>
    marker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    marker.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Load existing marker groups on component mount and when dependencies change
  useEffect(() => {
    const loadMarkerGroups = async () => {
      try {
        const { getUserMarkerGroups } = await import('../../firebase/firestore')
        const groups = await getUserMarkerGroups(userId, mapId)
        
        // Set folder states based on existing groups
        const folderStates: Record<string, boolean> = {}
        const customGroupStates: Record<string, string[]> = {}
        const iconStates: Record<string, string> = {}
        groups.forEach(group => {
          folderStates[group.groupName] = true
          customGroupStates[group.groupName] = group.markerIds
          if (group.iconUrl) {
            iconStates[group.groupName] = group.iconUrl
          }
        })
        setGroupFolders(folderStates)
        setCustomGroups(customGroupStates)
        setFolderIcons(iconStates)
        
        // Also set expanded state for folders that should be expanded by default
        const expandedStates: Record<string, boolean> = {}
        groups.forEach(group => {
          expandedStates[group.groupName] = true // Auto-expand folders on load
        })
        setExpandedFolders(expandedStates)
        
        console.log('Loaded marker groups:', groups.length, 'folders restored')
      } catch (error) {
        console.error('Error loading marker groups:', error)
      }
    }
    
    if (userId && markers.length > 0) {
      loadMarkerGroups()
    }
  }, [userId, mapId, markers, nameRules])

  // Group markers by their renamed names and custom groups
  const groupedMarkers = filteredMarkers.reduce((acc, marker) => {
    const renamedName = applyNameRules(marker.name, nameRules)
    
    // Check if this marker is part of a custom group
    const customGroupName = Object.keys(customGroups).find(groupName => {
      return customGroups[groupName].includes(marker.id)
    })
    
    const groupName = customGroupName || renamedName
    if (!acc[groupName]) {
      acc[groupName] = []
    }
    acc[groupName].push(marker)
    return acc
  }, {} as Record<string, Marker[]>)

  const toggleFolderExpansion = (groupName: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }))
  }

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, marker: Marker) => {
    setDraggedMarker(marker)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', marker.id)
  }

  const handleDragOver = (e: React.DragEvent, targetMarker?: Marker, targetArea?: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (targetMarker) {
      setDragOverMarker(targetMarker)
    }
    if (targetArea) {
      setDragOverArea(targetArea)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverMarker(null)
    setDragOverArea(null)
  }

  const handleDrop = async (e: React.DragEvent, targetMarker?: Marker, targetArea?: string) => {
    e.preventDefault()
    
    if (!draggedMarker) {
      setDraggedMarker(null)
      setDragOverMarker(null)
      setDragOverArea(null)
      return
    }

    if (targetArea === 'ungrouped') {
      // Dragging to ungrouped area - remove from any folder
      const markerGroup = Object.entries(customGroups).find(([_, markerIds]) => 
        markerIds.includes(draggedMarker.id)
      )
      
      if (markerGroup) {
        const [groupName] = markerGroup
        await handleDragOutOfFolder(draggedMarker.id, groupName)
      }
    } else if (targetMarker && draggedMarker.id !== targetMarker.id) {
      // Original drag-to-folder logic
      const targetName = applyNameRules(targetMarker.name, nameRules)
      const groupName = targetName
      
      try {
        const customGroupMarkers = [draggedMarker, targetMarker]
        const existingGroup = await getMarkerGroupByName(userId, groupName, mapId)
        
        if (existingGroup) {
          const allMarkerIds = [...new Set([...existingGroup.markerIds, draggedMarker.id, targetMarker.id])]
          await updateMarkerGroup(existingGroup.id, { markerIds: allMarkerIds })
        } else {
          await createMarkerGroup({ groupName, markerIds: [draggedMarker.id, targetMarker.id], userId, mapId })
        }
        
        setGroupFolders(prev => ({ ...prev, [groupName]: true }))
        setExpandedFolders(prev => ({ ...prev, [groupName]: true }))
        setCustomGroups(prev => ({ ...prev, [groupName]: [draggedMarker.id, targetMarker.id] }))
        
        showToast({
          type: 'success',
          title: 'Folder Created',
          message: `Created "${groupName}" folder with ${customGroupMarkers.length} markers`,
          duration: 3000
        })
      } catch (error) {
        console.error('Error creating folder:', error)
        showToast({
          type: 'error',
          title: 'Folder Creation Failed',
          message: 'Failed to create folder. Please try again.',
          duration: 4000
        })
      }
    }
    
    setDraggedMarker(null)
    setDragOverMarker(null)
    setDragOverArea(null)
  }

  const handleDragEnd = () => {
    setDraggedMarker(null)
    setDragOverMarker(null)
    setDragOverArea(null)
  }

  const handleDragOutOfFolder = async (markerId: string, groupName: string) => {
    try {
      // Find the existing group
      const existingGroup = await getMarkerGroupByName(userId, groupName, mapId)
      if (existingGroup) {
        // Remove marker from group
        const updatedMarkerIds = existingGroup.markerIds.filter(id => id !== markerId)
        
        if (updatedMarkerIds.length === 0) {
          // If no markers left, delete the group
          await deleteMarkerGroup(existingGroup.id)
          setGroupFolders(prev => {
            const newState = { ...prev }
            delete newState[groupName]
            return newState
          })
          setExpandedFolders(prev => {
            const newState = { ...prev }
            delete newState[groupName]
            return newState
          })
        } else {
          // Update group with remaining markers
          await updateMarkerGroup(existingGroup.id, { markerIds: updatedMarkerIds })
        }
      }

      // Update local state
      setCustomGroups(prev => {
        const newState = { ...prev }
        if (newState[groupName]) {
          newState[groupName] = newState[groupName].filter(id => id !== markerId)
          if (newState[groupName].length === 0) {
            delete newState[groupName]
          }
        }
        return newState
      })

      showToast({
        type: 'success',
        title: 'Marker Ungrouped',
        message: `Marker removed from "${groupName}" folder`,
        duration: 3000
      })
    } catch (error) {
      console.error('Error removing marker from group:', error)
      showToast({
        type: 'error',
        title: 'Ungroup Failed',
        message: 'Failed to remove marker from folder. Please try again.',
        duration: 4000
      })
    }
  }

  const startEditingGroup = (groupName: string) => {
    setEditingGroup(groupName)
    setEditingGroupName(groupName)
  }

  const startEditingMarker = (markerId: string, currentName: string) => {
    setEditingMarker(markerId)
    setEditingMarkerName(currentName)
  }

  const saveGroupRename = async () => {
    if (!editingGroup || !editingGroupName.trim()) return

    console.log('Saving group rename:', {
      oldGroupName: editingGroup,
      newGroupName: editingGroupName.trim(),
      userId,
      mapId
    })

    try {
      // Update the group name in Firestore
      const existingGroup = await getMarkerGroupByName(userId, editingGroup, mapId)
      if (existingGroup) {
        await updateMarkerGroup(existingGroup.id, {
          groupName: editingGroupName.trim()
        })
        console.log('Group rename successful')
      } else {
        console.log('No existing group found to rename')
      }

      // Update local state
      const newCustomGroups = { ...customGroups }
      const markerIds = newCustomGroups[editingGroup]
      delete newCustomGroups[editingGroup]
      newCustomGroups[editingGroupName.trim()] = markerIds
      setCustomGroups(newCustomGroups)

      const newGroupFolders = { ...groupFolders }
      const folderState = newGroupFolders[editingGroup]
      delete newGroupFolders[editingGroup]
      newGroupFolders[editingGroupName.trim()] = folderState
      setGroupFolders(newGroupFolders)

      const newExpandedFolders = { ...expandedFolders }
      const expandedState = newExpandedFolders[editingGroup]
      delete newExpandedFolders[editingGroup]
      newExpandedFolders[editingGroupName.trim()] = expandedState
      setExpandedFolders(newExpandedFolders)

      setEditingGroup(null)
      setEditingGroupName('')
    } catch (error) {
      console.error('Error renaming group:', error)
    }
  }

  const saveMarkerRename = async (markerId: string) => {
    if (!editingMarkerName.trim()) return

    console.log('Saving marker rename:', {
      markerId,
      newName: editingMarkerName.trim(),
      userId,
      mapId
    })

    try {
      // Update marker name in Firestore
      const { updateMapMarker } = await import('../../firebase/maps')
      await updateMapMarker(userId, mapId || '', markerId, { name: editingMarkerName.trim() })
      
      console.log('Marker rename successful')

      setEditingMarker(null)
      setEditingMarkerName('')
    } catch (error) {
      console.error('Error renaming marker:', error)
    }
  }

  const cancelEdit = () => {
    setEditingGroup(null)
    setEditingMarker(null)
    setEditingGroupName('')
    setEditingMarkerName('')
  }

  const handleIconUpload = async (groupName: string, file: File) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast({
        type: 'error',
        title: 'Invalid File Type',
        message: 'Please select an image file (PNG, JPG, etc.)',
        duration: 4000
      })
      return
    }

    // Validate file size (max 1MB for base64)
    if (file.size > 1024 * 1024) {
      showToast({
        type: 'error',
        title: 'File Too Large',
        message: 'File size must be less than 1MB for optimal performance',
        duration: 4000
      })
      return
    }

    setUploadingIcon(groupName)

    try {
      // Upload icon as base64 (works without Firebase Storage)
      const iconUrl = await uploadFolderIconBase64(file)
      
      // Update marker group with icon URL
      const existingGroup = await getMarkerGroupByName(userId, groupName, mapId)
      if (existingGroup) {
        await updateMarkerGroupIcon(existingGroup.id, iconUrl)
      }

      // Update local state
      setFolderIcons(prev => ({
        ...prev,
        [groupName]: iconUrl
      }))

      showToast({
        type: 'success',
        title: 'Icon Uploaded',
        message: `Custom icon added to "${groupName}" folder`,
        duration: 3000
      })
    } catch (error) {
      console.error('Error uploading icon:', error)
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload icon. Please try again.',
        duration: 4000
      })
    } finally {
      setUploadingIcon(null)
    }
  }

  const handleIconChange = (groupName: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleIconUpload(groupName, file)
    }
  }

  const handleDeleteIcon = async (groupName: string) => {
    try {
      // Find the existing group
      const existingGroup = await getMarkerGroupByName(userId, groupName, mapId)
      if (existingGroup) {
        // Remove icon from Firestore
        await removeMarkerGroupIcon(existingGroup.id)
      }

      // Update local state
      setFolderIcons(prev => {
        const newState = { ...prev }
        delete newState[groupName]
        return newState
      })

      showToast({
        type: 'success',
        title: 'Icon Removed',
        message: `Icon removed from "${groupName}" folder`,
        duration: 3000
      })
    } catch (error) {
      console.error('Error deleting icon:', error)
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        message: 'Failed to remove icon. Please try again.',
        duration: 4000
      })
    }
  }

  return (
    <div className="p-4">
      {/* Name Rules Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Name Rules
          </h3>
          <button
            onClick={() => setShowRules(!showRules)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {showRules ? 'Hide' : 'Manage'}
          </button>
        </div>
        
        {showRules && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-4 border border-gray-200 shadow-sm">
            {/* Add New Rule */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Add New Rule
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Contains..."
                    value={newRule.contains}
                    onChange={(e) => setNewRule({ ...newRule, contains: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Rename to..."
                    value={newRule.renameTo}
                    onChange={(e) => setNewRule({ ...newRule, renameTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  onClick={addRule}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
              </div>
            </div>
            
            {/* Existing Rules - Grouped Display with Individual Toggles */}
            <div className="space-y-2">
              {Object.entries(groupedRules).map(([renameTo, rules]) => (
                <div key={renameTo} className="bg-white rounded-lg border border-gray-200 p-3">
                  {/* Header with rename target, folder toggle, and delete all button */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">"{renameTo}"</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {rules.length} rule{rules.length > 1 ? 's' : ''}
                      </span>
                      {/* Individual Folder Toggle */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-600">Folder</span>
                        <button
                          onClick={() => toggleGroupFolder(renameTo)}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                            groupFolders[renameTo] ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                              groupFolders[renameTo] ? 'translate-x-3.5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => rules.forEach(rule => removeRule(rule.id))}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title={`Remove all ${rules.length} rule${rules.length > 1 ? 's' : ''} for "${renameTo}"`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Individual contains values with individual delete buttons */}
                  <div className="space-y-1">
                    {rules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                        <span className="text-sm text-gray-700">"{rule.contains}"</span>
                        <button
                          onClick={() => removeRule(rule.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title={`Remove "${rule.contains}" rule`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search markers..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          {filteredMarkers.length} markers
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          💡 Drag markers onto each other to create folders
        </p>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredMarkers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">
              {searchTerm ? 'No markers found' : 'No markers added yet'}
            </p>
            {!searchTerm && (
              <p className="text-xs mt-1">Add markers using the Data tab</p>
            )}
          </div>
        ) : (
          <>
            {/* Drop zone for ungrouped markers */}
            <div
              className={`p-4 border-2 border-dashed rounded-lg transition-colors ${
                dragOverArea === 'ungrouped' 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={(e) => handleDragOver(e, undefined, 'ungrouped')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, undefined, 'ungrouped')}
            >
              <div className="text-center text-sm text-gray-600">
                <p className="font-medium">Drop markers here to ungroup them</p>
                <p className="text-xs text-gray-500 mt-1">
                  Drag markers from folders to this area to remove them from groups
                </p>
              </div>
            </div>

            {Object.entries(groupedMarkers).map(([groupName, groupMarkers]) => {
              const isFolderEnabled = groupFolders[groupName]
              const isExpanded = expandedFolders[groupName]
              
              if (isFolderEnabled && groupMarkers.length > 1) {
              // Show as folder
              return (
                <div key={groupName} className="bg-gray-50 rounded-lg border border-gray-200">
                  {/* Folder Header */}
                  <div className="flex items-center gap-3 p-3 hover:bg-gray-100 transition-colors">
                    <div 
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggleFolderExpansion(groupName)}
                    >
                      {folderIcons[groupName] ? (
                        <img 
                          src={folderIcons[groupName]} 
                          alt={groupName}
                          className="w-4 h-4 object-contain flex-shrink-0"
                        />
                      ) : (
                        <Folder className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {editingGroup === groupName ? (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="text"
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              className="flex-1 text-sm font-medium text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveGroupRename()
                                if (e.key === 'Escape') cancelEdit()
                              }}
                            />
                            <button
                              onClick={saveGroupRename}
                              className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors flex-shrink-0"
                              title="Save"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-gray-400 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {groupName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {groupMarkers.length} marker{groupMarkers.length > 1 ? 's' : ''}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full whitespace-nowrap">
                          {groupMarkers.filter(m => m.visible).length}/{groupMarkers.length} visible
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    {editingGroup !== groupName && (
                      <>
                        {folderIcons[groupName] ? (
                          // Show X (delete) button when icon exists
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteIcon(groupName)
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                            title="Remove folder icon"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        ) : (
                          // Show upload button when no icon
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleIconChange(groupName, e)}
                              className="hidden"
                              id={`icon-upload-${groupName}`}
                            />
                            <label
                              htmlFor={`icon-upload-${groupName}`}
                              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded transition-colors flex-shrink-0 cursor-pointer"
                              title="Upload folder icon"
                            >
                              {uploadingIcon === groupName ? (
                                <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                            </label>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditingGroup(groupName)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
                          title="Rename folder"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Folder Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      {groupMarkers.map((marker) => (
                        <div
                          key={marker.id}
                          className={`flex items-center gap-3 p-3 pl-8 bg-white hover:bg-gray-50 transition-colors ${
                            dragOverMarker?.id === marker.id ? 'bg-blue-100 border-2 border-blue-300 border-dashed' : ''
                          } ${draggedMarker?.id === marker.id ? 'opacity-50' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, marker)}
                          onDragOver={(e) => handleDragOver(e, marker)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, marker)}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                          <span className="text-lg">{getMarkerIcon(marker.type)}</span>
                          <div className="flex-1 min-w-0">
                            {editingMarker === marker.id ? (
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  type="text"
                                  value={editingMarkerName}
                                  onChange={(e) => setEditingMarkerName(e.target.value)}
                                  className="flex-1 text-sm font-medium text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveMarkerRename(marker.id)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                                <button
                                  onClick={() => saveMarkerRename(marker.id)}
                                  className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors flex-shrink-0"
                                  title="Save"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 text-gray-400 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {getDisplayName(marker.name)}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {marker.address}
                                </p>
                                {getDisplayName(marker.name) !== marker.name && (
                                  <p className="text-xs text-gray-400 truncate italic">
                                    Original: {marker.name}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {editingMarker !== marker.id && (
                              <>
                                <button
                                  onClick={() => startEditingMarker(marker.id, marker.name)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                  title="Rename marker"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => onToggleMarkerVisibility(marker.id)}
                                  className={`p-1 rounded transition-colors ${
                                    marker.visible
                                      ? 'text-green-600 hover:bg-green-100'
                                      : 'text-gray-400 hover:bg-gray-200'
                                  }`}
                                  title={marker.visible ? 'Hide marker' : 'Show marker'}
                                >
                                  {marker.visible ? (
                                    <Eye className="w-4 h-4" />
                                  ) : (
                                    <EyeOff className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => onDeleteMarker(marker.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                                  title="Delete marker"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            } else {
              // Show individual markers
              return groupMarkers.map((marker) => (
            <div
              key={marker.id}
                  className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${
                    dragOverMarker?.id === marker.id ? 'bg-blue-100 border-2 border-blue-300 border-dashed' : ''
                  } ${draggedMarker?.id === marker.id ? 'opacity-50' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, marker)}
                  onDragOver={(e) => handleDragOver(e, marker)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, marker)}
                  onDragEnd={handleDragEnd}
                >
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
              <span className="text-lg">{getMarkerIcon(marker.type)}</span>
              <div className="flex-1 min-w-0">
                    {editingMarker === marker.id ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={editingMarkerName}
                          onChange={(e) => setEditingMarkerName(e.target.value)}
                          className="flex-1 text-sm font-medium text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveMarkerRename(marker.id)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                        <button
                          onClick={() => saveMarkerRename(marker.id)}
                          className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors flex-shrink-0"
                          title="Save"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-gray-400 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                <p className="text-sm font-medium text-gray-900 truncate">
                          {getDisplayName(marker.name)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {marker.address}
                </p>
                        {getDisplayName(marker.name) !== marker.name && (
                          <p className="text-xs text-gray-400 truncate italic">
                            Original: {marker.name}
                          </p>
                        )}
                      </>
                    )}
              </div>
              <div className="flex items-center gap-1">
                    {editingMarker !== marker.id && (
                      <>
                        <button
                          onClick={() => startEditingMarker(marker.id, marker.name)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          title="Rename marker"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                <button
                  onClick={() => onToggleMarkerVisibility(marker.id)}
                  className={`p-1 rounded transition-colors ${
                    marker.visible
                      ? 'text-green-600 hover:bg-green-100'
                      : 'text-gray-400 hover:bg-gray-200'
                  }`}
                  title={marker.visible ? 'Hide marker' : 'Show marker'}
                >
                  {marker.visible ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onDeleteMarker(marker.id)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                  title="Delete marker"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                      </>
                    )}
              </div>
            </div>
          ))
            }
          }).flat()}
          </>
        )}
      </div>
    </div>
  )
}

export default ManageTabContent

