import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Eye, EyeOff, Trash2, X, Settings, ChevronDown, ChevronRight, ChevronUp, Folder, Edit2, Check, Upload, Unlink, Maximize2, Info, Square } from 'lucide-react'
import { applyNameRules } from '../../utils/markerUtils'
import { createMarkerGroup, updateMarkerGroup, deleteMarkerGroup, getMarkerGroupByName, uploadFolderIconBase64, updateMarkerGroupIcon, removeMarkerGroupIcon } from '../../firebase/firestore'
import { useToast } from '../../contexts/ToastContext'
import { getUserMaps, getMapPolygons, deleteMapPolygon, updateMapPolygon, PolygonDocument } from '../../firebase/maps'
import PolygonEditModal from '../PolygonEditModal'
import { useUsageWarning } from '../../hooks/useFeatureAccess'
import { useSharedMapFeatureAccess } from '../../hooks/useSharedMapFeatureAccess'
import DeleteMarkerDialog from '../DeleteMarkerDialog'
import LimitationInfoModal from '../LimitationInfoModal'

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
  order?: number // Display order for markers
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
  mapSettings: any
  onMapSettingsChange: (settings: any) => void
  userId: string
  mapId: string | undefined
  onOpenModal?: () => void
  currentMap?: any // Add current map data to determine ownership
  onOpenSubscription?: () => void
}

const ManageTabContent: React.FC<ManageTabContentProps> = ({
  markers,
  searchTerm,
  onSearchChange,
  onToggleMarkerVisibility,
  onDeleteMarker,
  mapSettings,
  onMapSettingsChange,
  userId,
  mapId,
  onOpenModal,
  currentMap,
  onOpenSubscription
}) => {
  const { showToast } = useToast()
  const { showWarning, showError, limit, currentCount } = useUsageWarning('markers', markers.length)
  const { hasSmartGrouping, customizationLevel } = useSharedMapFeatureAccess(currentMap)
  const [showRules, setShowRules] = useState(false)
  const [newRule, setNewRule] = useState({ contains: '', renameTo: '' })
  const [groupFolders, setGroupFolders] = useState<Record<string, boolean>>({})
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  // const [userDoc] = useState<UserDocument | null>(null)
  const [customGroups, setCustomGroups] = useState<Record<string, string[]>>({})
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingMarker, setEditingMarker] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [editingMarkerName, setEditingMarkerName] = useState('')
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>({})
  const [isUngrouping, setIsUngrouping] = useState(false)
  const [markerToDelete, setMarkerToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingMarker, setIsDeletingMarker] = useState(false)
  const [showLimitationModal, setShowLimitationModal] = useState<{ type: 'marker-usage' | 'name-rules' } | null>(null)
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<string>>(new Set())

  // Transfer rules state
  const [sourceMapRules, setSourceMapRules] = useState<NameRule[]>([])
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set())
  const [availableMaps, setAvailableMaps] = useState<any[]>([])
  const [selectedSourceMap, setSelectedSourceMap] = useState('')

  // Polygon state
  const [polygons, setPolygons] = useState<PolygonDocument[]>([])
  const [loadingPolygons, setLoadingPolygons] = useState(false)
  const [polygonEditMode, setPolygonEditMode] = useState(false)
  const [boxSelectMode, setBoxSelectMode] = useState(false)
  const [hasUnsavedPolygonChanges, setHasUnsavedPolygonChanges] = useState(false)
  const [unsavedPolygonCount, setUnsavedPolygonCount] = useState(0)
  const [editingPolygon, setEditingPolygon] = useState<PolygonDocument | null>(null)
  const [showPolygonEditModal, setShowPolygonEditModal] = useState(false)

  // Load user document for usage limits
  // useEffect(() => {
  //   const loadUserDoc = async () => {
  //     if (userId) {
  //       try {
  //         const user = await getUserDocument(userId)
  //         setUserDoc(user)
  //         
  //         // Show warning if approaching limits
  //         if (user && markers.length >= (user.limits?.maxMarkersPerMap || 50) * 0.9) {
  //           setShowUsageWarning(true)
  //         }
  //       } catch (error) {
  //         console.error('Error loading user document:', error)
  //       }
  //     }
  //   }
  //   
  //   loadUserDoc()
  // }, [userId, markers.length])

  const getDisplayName = (originalName: string): string => {
    if (hasSmartGrouping && mapSettings.nameRules && mapSettings.nameRules.length > 0) {
      return applyNameRules(originalName, mapSettings.nameRules, hasSmartGrouping)
    }
    return originalName
  }

  // Group rules by their renameTo value for smarter display
  const groupedRules = (mapSettings.nameRules || []).reduce((groups: Record<string, NameRule[]>, rule: NameRule) => {
    const key = rule.renameTo
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(rule)
    return groups
  }, {} as Record<string, NameRule[]>)

  const addRule = () => {
    if (!newRule.contains.trim() || !newRule.renameTo.trim()) return

    const rule: NameRule = {
      id: Date.now().toString(),
      contains: newRule.contains.trim(),
      renameTo: newRule.renameTo.trim()
    }

    onMapSettingsChange({
      ...mapSettings,
      nameRules: [...(mapSettings.nameRules || []), rule]
    })

    setNewRule({ contains: '', renameTo: '' })
  }

  const removeRule = (ruleId: string) => {
    onMapSettingsChange({
      ...mapSettings,
      nameRules: (mapSettings.nameRules || []).filter((rule: NameRule) => rule.id !== ruleId)
    })
  }

  // Load available maps for rule transfer
  const loadAvailableMaps = async () => {
    if (!userId) return
    
    try {
      const userMaps = await getUserMaps(userId)
      const otherMaps = userMaps.filter(map => map.id !== mapId)
      setAvailableMaps(otherMaps)
    } catch (error) {
      console.error('Error loading available maps:', error)
    }
  }

  // Load rules from selected source map
  const loadSourceMapRules = async (sourceMapId: string) => {
    if (!userId) return
    
    try {
      const userMaps = await getUserMaps(userId)
      const sourceMap = userMaps.find(map => map.id === sourceMapId)
      
      if (sourceMap && sourceMap.settings?.nameRules) {
        setSourceMapRules(sourceMap.settings.nameRules)
      } else {
        setSourceMapRules([])
      }
    } catch (error) {
      console.error('Error loading source map rules:', error)
    }
  }

  const handleSourceMapChange = (mapId: string) => {
    setSelectedSourceMap(mapId)
    if (mapId) {
      loadSourceMapRules(mapId)
    } else {
      setSourceMapRules([])
    }
    setSelectedRules(new Set())
  }

  const toggleRuleSelection = (ruleId: string) => {
    const newSelected = new Set(selectedRules)
    if (newSelected.has(ruleId)) {
      newSelected.delete(ruleId)
    } else {
      newSelected.add(ruleId)
    }
    setSelectedRules(newSelected)
  }

  const selectAllRules = () => {
    setSelectedRules(new Set(sourceMapRules.map(rule => rule.id)))
  }

  const selectNoRules = () => {
    setSelectedRules(new Set())
  }

  const transferNameRules = async () => {
    if (!selectedSourceMap || selectedRules.size === 0) return

    try {
      const rulesToTransfer = sourceMapRules.filter(rule => selectedRules.has(rule.id))
      const mergedRules = [...(mapSettings.nameRules || []), ...rulesToTransfer]

      onMapSettingsChange({
        ...mapSettings,
        nameRules: mergedRules
      })

      setSelectedSourceMap('')
      setSourceMapRules([])
      setSelectedRules(new Set())
    } catch (error) {
      console.error('Error transferring name rules:', error)
    }
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
          const renamedName = applyNameRules(marker.name, mapSettings.nameRules || [], hasSmartGrouping)
          return renamedName === groupName
        })
        
        if (matchingMarkers.length > 0) {
          // Check if group already exists
          // For shared maps, use the map owner's ID
        const markerOwnerId = currentMap?.userId || userId
        const existingGroup = await getMarkerGroupByName(markerOwnerId, groupName, mapId || undefined)
          
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
              mapId: mapId || undefined
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
        // For shared maps, use the map owner's ID
        const markerOwnerId = currentMap?.userId || userId
        const existingGroup = await getMarkerGroupByName(markerOwnerId, groupName, mapId || undefined)
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
        
        // For shared maps, use the map owner's ID to load marker groups
        // For owned maps, use the current user's ID
        const markerOwnerId = currentMap?.userId || userId
        
        console.log('Loading marker groups for map:', mapId, 'owner:', markerOwnerId, 'current user:', userId)
        const groups = await getUserMarkerGroups(markerOwnerId, mapId || undefined)
        
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
  }, [userId, mapId, markers, mapSettings.nameRules, currentMap])

  // Load available maps when showRules becomes true
  useEffect(() => {
    if (showRules) {
      loadAvailableMaps()
    }
  }, [showRules])

  // Local marker order state (for display reordering) - moved up for use in grouping
  const [markerOrder, setMarkerOrder] = useState<Record<string, number>>({})
  const [movingMarkerId, setMovingMarkerId] = useState<string | null>(null)

  // Get markers in current order (defined early so it can be used in grouping)
  const getOrderedMarkers = (markerList: Marker[]): Marker[] => {
    return [...markerList].sort((a, b) => {
      const orderA = markerOrder[a.id] ?? 0
      const orderB = markerOrder[b.id] ?? 0
      return orderA - orderB
    })
  }

  // Sort filtered markers by order FIRST, then group them
  const orderedFilteredMarkers = getOrderedMarkers(filteredMarkers)
  
  // Group markers by their renamed names and custom groups (using ordered markers)
  const groupedMarkers = orderedFilteredMarkers.reduce((acc, marker) => {
    const renamedName = applyNameRules(marker.name, mapSettings.nameRules || [], hasSmartGrouping)
    
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

  // Helper function to check if marker is in a group
  const isMarkerInGroup = (markerId: string): boolean => {
    return Object.values(customGroups).some(markerIds => markerIds.includes(markerId))
  }

  // Ungroup marker function
  const handleUngroupMarker = async (marker: Marker) => {
    console.log('🔄 Starting ungroup operation for marker:', marker.id)
    
    // Find which group this marker belongs to
    const markerGroup = Object.entries(customGroups).find(([_, markerIds]) => 
      markerIds.includes(marker.id)
    )
    
    if (!markerGroup) {
      console.warn('Marker not found in any group:', marker.id)
      showToast({
        type: 'warning',
        title: 'Cannot Ungroup',
        message: 'This marker is not currently in a group'
      })
      return
    }

    const [groupName] = markerGroup
    console.log('📁 Found marker in group:', groupName)
    
    setIsUngrouping(true)
    
    try {
      // Validate that the group exists in Firestore
      const existingGroup = await getMarkerGroupByName(userId, groupName, mapId || undefined)
      
      if (!existingGroup) {
        console.error('Group not found in Firestore:', groupName)
        showToast({
          type: 'error',
          title: 'Ungroup Failed',
          message: 'Group not found in database'
        })
        return
      }

      // Verify the marker is actually in the group
      if (!existingGroup.markerIds.includes(marker.id)) {
        console.error('Marker not found in Firestore group:', marker.id, groupName)
        showToast({
          type: 'error',
          title: 'Ungroup Failed',
          message: 'Marker not found in group'
        })
        return
      }

      console.log('✅ Validated group and marker, proceeding with ungroup')
      
      const updatedMarkerIds = existingGroup.markerIds.filter(id => id !== marker.id)
      
      if (updatedMarkerIds.length === 0) {
        // Delete group if no markers left
        console.log('🗑️ Deleting empty group:', groupName)
        await deleteMarkerGroup(existingGroup.id)
        
        // Update local state
        setGroupFolders(prev => {
          const newState = { ...prev }
          delete newState[groupName]
          return newState
        })
        
        setCustomGroups(prev => {
          const newState = { ...prev }
          delete newState[groupName]
          return newState
        })
        
        setFolderIcons(prev => {
          const newState = { ...prev }
          delete newState[groupName]
          return newState
        })
        
        console.log('✅ Group deleted successfully')
        showToast({
          type: 'success',
          title: 'Ungrouped Successfully',
          message: `Marker removed from "${groupName}" group (group deleted)`
        })
      } else {
        // Update group with remaining markers
        console.log('📝 Updating group with remaining markers:', updatedMarkerIds.length)
        await updateMarkerGroup(existingGroup.id, {
          markerIds: updatedMarkerIds
        })
        
        // Update local state
        setCustomGroups(prev => {
          const newState = { ...prev }
          if (newState[groupName]) {
            newState[groupName] = newState[groupName].filter(id => id !== marker.id)
          }
          return newState
        })
        
        console.log('✅ Group updated successfully')
        showToast({
          type: 'success',
          title: 'Ungrouped Successfully',
          message: `Marker removed from "${groupName}" group`
        })
      }
      
    } catch (error) {
      console.error('❌ Error during ungroup operation:', error)
      showToast({
        type: 'error',
        title: 'Ungroup Failed',
        message: `Failed to remove marker from group: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsUngrouping(false)
      console.log('🏁 Ungroup operation completed')
    }
  }

  // Initialize marker order on mount and when markers change
  useEffect(() => {
    // Only update if markers array actually changed (by ID or count)
    const currentMarkerIds = new Set(markers.map(m => m.id))
    const existingMarkerIds = new Set(Object.keys(markerOrder))
    
    // Check if markers changed
    const markersChanged = 
      currentMarkerIds.size !== existingMarkerIds.size ||
      Array.from(currentMarkerIds).some(id => !existingMarkerIds.has(id)) ||
      markers.some(m => {
        const existingOrder = markerOrder[m.id]
        const firestoreOrder = m.order
        // Update if Firestore order differs from local order
        return firestoreOrder !== undefined && firestoreOrder !== existingOrder
      })
    
    if (!markersChanged && Object.keys(markerOrder).length > 0) {
      return // No need to update
    }
    
    const order: Record<string, number> = {}
    // Use order from Firestore if available, otherwise preserve existing or assign sequential
    markers.forEach((marker, index) => {
      if (marker.order !== undefined && marker.order !== null && marker.order > 0) {
        // Use Firestore order (source of truth)
        order[marker.id] = marker.order
      } else if (markerOrder[marker.id] !== undefined && markerOrder[marker.id] > 0) {
        // Preserve existing local order if Firestore doesn't have it yet
        order[marker.id] = markerOrder[marker.id]
      } else {
        // Assign sequential order starting from 1
        order[marker.id] = index + 1
      }
    })
    
    setMarkerOrder(order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]) // Update when markers change (markerOrder intentionally excluded to avoid circular dependency)

  // Move marker up/down handlers - REBUILT FROM SCRATCH
  // Simple, clean, and works consistently for all markers
  const moveMarkerUp = async (markerId: string, groupName?: string) => {
    // Determine which list to use: folder markers or all filtered markers
    let markersToOrder: Marker[]
    if (groupName && groupFolders[groupName] && groupedMarkers[groupName]) {
      // Marker is in a folder - work within that folder
      markersToOrder = getOrderedMarkers(groupedMarkers[groupName])
    } else {
      // Standalone marker - work across all filtered markers
      markersToOrder = getOrderedMarkers(filteredMarkers)
    }
    
    const currentIndex = markersToOrder.findIndex(m => m.id === markerId)
    if (currentIndex <= 0) return // Can't move up if already first
    
    const aboveMarkerId = markersToOrder[currentIndex - 1].id
    const currentOrder = markerOrder[markerId]
    const aboveOrder = markerOrder[aboveMarkerId]
    
    // Validate orders exist
    if (!currentOrder || !aboveOrder) {
      console.warn('Marker order not initialized:', { markerId, currentOrder, aboveOrder })
      return
    }
    
    // Set visual feedback
    setMovingMarkerId(markerId)
    
    // Update local state immediately (swap orders)
    setMarkerOrder(prev => ({
      ...prev,
      [markerId]: aboveOrder,
      [aboveMarkerId]: currentOrder
    }))
    
    // Save to Firestore
    try {
      const markerOwnerId = currentMap?.userId || userId
      const { updateMapMarker } = await import('../../firebase/maps')
      
      await Promise.all([
        updateMapMarker(markerOwnerId, mapId || '', markerId, { order: aboveOrder }),
        updateMapMarker(markerOwnerId, mapId || '', aboveMarkerId, { order: currentOrder })
      ])
      
      setTimeout(() => {
        setMovingMarkerId(null)
      }, 500)
    } catch (error) {
      console.error('Error updating marker order:', error)
      // Revert on error
      setMarkerOrder(prev => ({
        ...prev,
        [markerId]: currentOrder,
        [aboveMarkerId]: aboveOrder
      }))
      setMovingMarkerId(null)
      showToast({
        type: 'error',
        title: 'Move Failed',
        message: 'Failed to save marker order'
      })
    }
  }

  const moveMarkerDown = async (markerId: string, groupName?: string) => {
    // Determine which list to use: folder markers or all filtered markers
    let markersToOrder: Marker[]
    if (groupName && groupFolders[groupName] && groupedMarkers[groupName]) {
      // Marker is in a folder - work within that folder
      markersToOrder = getOrderedMarkers(groupedMarkers[groupName])
    } else {
      // Standalone marker - work across all filtered markers
      markersToOrder = getOrderedMarkers(filteredMarkers)
    }
    
    const currentIndex = markersToOrder.findIndex(m => m.id === markerId)
    if (currentIndex >= markersToOrder.length - 1) return // Can't move down if already last
    
    const belowMarkerId = markersToOrder[currentIndex + 1].id
    const currentOrder = markerOrder[markerId]
    const belowOrder = markerOrder[belowMarkerId]
    
    // Validate orders exist
    if (!currentOrder || !belowOrder) {
      console.warn('Marker order not initialized:', { markerId, currentOrder, belowOrder })
      return
    }
    
    // Set visual feedback
    setMovingMarkerId(markerId)
    
    // Update local state immediately (swap orders)
    setMarkerOrder(prev => ({
      ...prev,
      [markerId]: belowOrder,
      [belowMarkerId]: currentOrder
    }))
    
    // Save to Firestore
    try {
      const markerOwnerId = currentMap?.userId || userId
      const { updateMapMarker } = await import('../../firebase/maps')
      
      await Promise.all([
        updateMapMarker(markerOwnerId, mapId || '', markerId, { order: belowOrder }),
        updateMapMarker(markerOwnerId, mapId || '', belowMarkerId, { order: currentOrder })
      ])
      
      setTimeout(() => {
        setMovingMarkerId(null)
      }, 500)
    } catch (error) {
      console.error('Error updating marker order:', error)
      // Revert on error
      setMarkerOrder(prev => ({
        ...prev,
        [markerId]: currentOrder,
        [belowMarkerId]: belowOrder
      }))
      setMovingMarkerId(null)
      showToast({
        type: 'error',
        title: 'Move Failed',
        message: 'Failed to save marker order'
      })
    }
  }

  // Selection handlers
  const toggleMarkerSelection = (markerId: string) => {
    setSelectedMarkerIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(markerId)) {
        newSet.delete(markerId)
      } else {
        newSet.add(markerId)
      }
      return newSet
    })
  }

  const clearSelection = () => {
    setSelectedMarkerIds(new Set())
  }

  // Group selected markers
  const groupSelectedMarkers = async () => {
    if (selectedMarkerIds.size < 2) {
      showToast({
        type: 'warning',
        title: 'Selection Required',
        message: 'Please select at least 2 markers to group'
      })
      return
    }

    const selectedMarkers = filteredMarkers.filter(m => selectedMarkerIds.has(m.id))
    if (selectedMarkers.length < 2) return

    // Use the first marker's renamed name as the group name
    const groupName = applyNameRules(selectedMarkers[0].name, mapSettings.nameRules || [], hasSmartGrouping)
    const markerIds = selectedMarkers.map(m => m.id)
      
      try {
        // For shared maps, use the map owner's ID
        const markerOwnerId = currentMap?.userId || userId
      const existingGroup = await getMarkerGroupByName(markerOwnerId, groupName, mapId)
        
        if (existingGroup) {
        // Add all selected markers to existing group
        const newMarkerIds = [...new Set([...existingGroup.markerIds, ...markerIds])]
            await updateMarkerGroup(existingGroup.id, {
          markerIds: newMarkerIds
            })
            
            // Update local state
            setCustomGroups(prev => ({
              ...prev,
          [groupName]: newMarkerIds
            }))
            
            showToast({
              type: 'success',
              title: 'Grouped Successfully',
          message: `Added ${selectedMarkers.length} marker(s) to "${groupName}" group`
        })
        } else {
          // Create new group
          await createMarkerGroup({
          groupName,
          markerIds,
            userId,
            mapId: mapId || undefined
          })
          
          // Update local state
          setCustomGroups(prev => ({
            ...prev,
          [groupName]: markerIds
          }))
          
          // Enable folder
          setGroupFolders(prev => ({
            ...prev,
          [groupName]: true
          }))
          
          showToast({
            type: 'success',
            title: 'Group Created',
          message: `Created "${groupName}" group with ${selectedMarkers.length} markers`
          })
        }
        
      // Clear selection after grouping
      clearSelection()
      } catch (error) {
      console.error('Error grouping markers:', error)
        showToast({
          type: 'error',
          title: 'Group Failed',
          message: `Failed to group markers: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }
    

  // Icon handling functions
  const handleIconChange = async (groupName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !mapId) return

    // Check if user has premium customization access
    if (customizationLevel !== 'premium') {
      showToast({ 
        type: 'error', 
        title: 'Premium Feature', 
        message: 'Custom logos are available with premium customization plans.' 
      })
      return
    }

    try {
      const base64 = await uploadFolderIconBase64(file)
      const existingGroup = await getMarkerGroupByName(userId, groupName, mapId || undefined)
      
      if (existingGroup) {
        await updateMarkerGroupIcon(existingGroup.id, base64)
        
        setFolderIcons(prev => ({
          ...prev,
          [groupName]: base64
        }))
        
        showToast({ type: 'success', title: 'Success', message: 'Folder icon updated successfully!' })
      }
    } catch (error) {
      console.error('Error updating folder icon:', error)
      showToast({ type: 'error', title: 'Error', message: 'Failed to update folder icon' })
    }
  }

  const handleDeleteIcon = async (groupName: string) => {
    if (!userId || !mapId) return

    try {
      const existingGroup = await getMarkerGroupByName(userId, groupName, mapId || undefined)
      
      if (existingGroup) {
        await removeMarkerGroupIcon(existingGroup.id)
        
        setFolderIcons(prev => {
          const newState = { ...prev }
          delete newState[groupName]
          return newState
        })
        
        showToast({ type: 'success', title: 'Success', message: 'Folder icon removed successfully!' })
      }
    } catch (error) {
      console.error('Error removing folder icon:', error)
      showToast({ type: 'error', title: 'Error', message: 'Failed to remove folder icon' })
    }
  }

  // Group editing functions
  const startEditingGroup = (groupName: string) => {
    setEditingGroup(groupName)
    setEditingGroupName(groupName)
  }

  const saveGroupRename = async () => {
    if (!editingGroup || !editingGroupName.trim() || !userId || !mapId) return

    try {
        // For shared maps, use the map owner's ID
        const markerOwnerId = currentMap?.userId || userId
        const existingGroup = await getMarkerGroupByName(markerOwnerId, editingGroup, mapId)
      if (existingGroup) {
        // Update the group name in Firestore
        await updateMarkerGroup(existingGroup.id, {
          groupName: editingGroupName.trim()
        })
        
        // Update local state
        const markerIds = customGroups[editingGroup] || []
        setCustomGroups(prev => {
          const newState = { ...prev }
          delete newState[editingGroup]
          newState[editingGroupName.trim()] = markerIds
          return newState
        })
        
        // Update folder states
        setGroupFolders(prev => {
          const newState = { ...prev }
          const isEnabled = newState[editingGroup]
          delete newState[editingGroup]
          newState[editingGroupName.trim()] = isEnabled
          return newState
        })
        
        // Update expanded state
        setExpandedFolders(prev => {
          const newState = { ...prev }
          const isExpanded = newState[editingGroup]
          delete newState[editingGroup]
          newState[editingGroupName.trim()] = isExpanded
          return newState
        })
        
        // Update folder icons
        setFolderIcons(prev => {
          const newState = { ...prev }
          const icon = newState[editingGroup]
          delete newState[editingGroup]
          if (icon) {
            newState[editingGroupName.trim()] = icon
          }
          return newState
        })
        
        console.log('Group renamed successfully:', editingGroup, '->', editingGroupName.trim())
      } else {
        console.log('No existing group found to rename')
      }

      // Update local state
      const newCustomGroups = { ...customGroups }
      if (newCustomGroups[editingGroup]) {
        newCustomGroups[editingGroupName.trim()] = newCustomGroups[editingGroup]
        delete newCustomGroups[editingGroup]
        setCustomGroups(newCustomGroups)
      }

      cancelEdit()
    } catch (error) {
      console.error('Error renaming group:', error)
    }
  }

  const handleDeleteFolder = async (groupName: string) => {
    if (!userId || !mapId) return

    try {
        // For shared maps, use the map owner's ID
        const markerOwnerId = currentMap?.userId || userId
        const existingGroup = await getMarkerGroupByName(markerOwnerId, groupName, mapId)
      if (existingGroup) {
        await deleteMarkerGroup(existingGroup.id)
      }
      
      // Update local state
      setCustomGroups(prev => {
        const newState = { ...prev }
        delete newState[groupName]
        return newState
      })
      
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
      
      setFolderIcons(prev => {
        const newState = { ...prev }
        delete newState[groupName]
        return newState
      })
      
      console.log('Folder deleted:', groupName)
    } catch (error) {
      console.error('Error deleting folder:', error)
    }
  }

  // Marker editing functions
  const startEditingMarker = (markerId: string, markerName: string) => {
    setEditingMarker(markerId)
    setEditingMarkerName(markerName)
  }

  const saveMarkerRename = async (markerId: string) => {
    if (!editingMarkerName.trim()) return

    try {
      // Update marker name in Firestore
      const { updateMapMarker } = await import('../../firebase/maps')
      
      // For shared maps, use the map owner's ID
      const markerOwnerId = currentMap?.userId || userId
      
      await updateMapMarker(markerOwnerId, mapId || '', markerId, {
        name: editingMarkerName.trim()
      })
      
      console.log('Marker renamed successfully:', markerId, '->', editingMarkerName.trim())
      cancelEdit()
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


  // Listen for unsaved polygon changes
  useEffect(() => {
    const handleUnsavedChanges = (e: CustomEvent) => {
      setHasUnsavedPolygonChanges(e.detail.hasUnsaved)
      setUnsavedPolygonCount(e.detail.polygonCount)
    }
    
    window.addEventListener('polygonUnsavedChanges', handleUnsavedChanges as EventListener)
    return () => {
      window.removeEventListener('polygonUnsavedChanges', handleUnsavedChanges as EventListener)
    }
  }, [])

  // Fetch polygons
  useEffect(() => {
    const loadPolygons = async () => {
      if (!mapId || !userId) return
      
      setLoadingPolygons(true)
      try {
        // For shared maps, use the map owner's ID
        const polygonOwnerId = currentMap?.userId || userId
        const loadedPolygons = await getMapPolygons(polygonOwnerId, mapId)
        setPolygons(loadedPolygons)
      } catch (error) {
        console.error('Error loading polygons:', error)
      } finally {
        setLoadingPolygons(false)
      }
    }

    loadPolygons()
  }, [mapId, userId, currentMap])
  
  // Handle saving all polygon changes
  const handleSaveAllPolygons = () => {
    window.dispatchEvent(new CustomEvent('saveAllPolygons'))
    showToast({
      type: 'success',
      title: 'Saved',
      message: `Saved ${unsavedPolygonCount} polygon(s) to Firestore`
    })
    setHasUnsavedPolygonChanges(false)
    setUnsavedPolygonCount(0)
  }
  
  // Handle opening polygon edit modal
  const handleEditPolygon = (polygon: PolygonDocument) => {
    setEditingPolygon(polygon)
    setShowPolygonEditModal(true)
  }
  
  // Handle saving polygon edit
  const handlePolygonEditSave = async () => {
    // Reload polygons to reflect changes
    if (mapId && userId) {
      try {
        const polygonOwnerId = currentMap?.userId || userId
        const loadedPolygons = await getMapPolygons(polygonOwnerId, mapId)
        setPolygons(loadedPolygons)
        showToast({
          type: 'success',
          title: 'Success',
          message: 'Polygon updated successfully'
        })
      } catch (error) {
        console.error('Error reloading polygons:', error)
      }
    }
  }

  // Toggle polygon visibility
  const handleTogglePolygonVisibility = async (polygonId: string, currentVisibility: boolean) => {
    if (!mapId || !userId) return
    
    try {
      const polygonOwnerId = currentMap?.userId || userId
      await updateMapPolygon(polygonOwnerId, mapId, polygonId, {
        visible: !currentVisibility
      })
      
      setPolygons(prev => prev.map(p => 
        p.id === polygonId ? { ...p, visible: !currentVisibility } : p
      ))
      
      showToast({ type: 'success', title: 'Success', message: 'Polygon visibility updated' })
    } catch (error) {
      console.error('Error toggling polygon visibility:', error)
      showToast({ type: 'error', title: 'Error', message: 'Failed to update polygon visibility' })
    }
  }

  // Delete polygon
  const handleDeletePolygon = async (polygonId: string) => {
    if (!mapId || !userId) return
    if (!confirm('Are you sure you want to delete this polygon?')) return
    
    try {
      const polygonOwnerId = currentMap?.userId || userId
      await deleteMapPolygon(polygonOwnerId, mapId, polygonId)
      
      setPolygons(prev => prev.filter(p => p.id !== polygonId))
      
      showToast({ type: 'success', title: 'Success', message: 'Polygon deleted successfully' })
    } catch (error) {
      console.error('Error deleting polygon:', error)
      showToast({ type: 'error', title: 'Error', message: 'Failed to delete polygon' })
    }
  }

  return (
    <div className="p-4">
      {/* Header with Modal Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Manage Markers</h2>
          {/* Compact Info Icon for Usage Warning */}
      {(showWarning || showError) && (
            <button
              onClick={() => setShowLimitationModal({ type: 'marker-usage' })}
              className={`p-1 rounded-full transition-colors ${
          showError 
                  ? 'text-red-500 hover:bg-red-50' 
                  : 'text-yellow-500 hover:bg-yellow-50'
              }`}
              title={showError 
                ? `You've used all ${limit} markers. Click for more info.`
                : `You're using ${currentCount} of ${limit} markers. Click for more info.`
              }
            >
              <Info className="w-4 h-4" />
              </button>
          )}
        </div>
        {onOpenModal && (
          <button
            onClick={onOpenModal}
            className="hidden sm:flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Open in full screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Name Rules Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Name Rules</h3>
            {/* Compact Info Icon for Name Rules Limitation */}
            {!hasSmartGrouping && (
              <button
                onClick={() => setShowLimitationModal({ type: 'name-rules' })}
                className="p-1 text-yellow-500 hover:bg-yellow-50 rounded-full transition-colors"
                title="Name rules available with upgrade. Click for more info."
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => hasSmartGrouping ? setShowRules(!showRules) : null}
            disabled={!hasSmartGrouping}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              hasSmartGrouping 
                ? 'bg-pinz-600 text-white hover:bg-pinz-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={!hasSmartGrouping ? 'Name rules require Professional plan or higher' : 'Manage name rules'}
          >
            <Settings className="w-4 h-4" />
            Manage
          </button>
        </div>

        {showRules && hasSmartGrouping && (
          <div className="space-y-4">
            {/* Main Rules Management */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-600" />
                  Manage Name Rules
                </h4>
              </div>

              <div className="p-4 space-y-4">
              {/* Add New Rule */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Add New Rule</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contains</label>
                    <input
                      type="text"
                      placeholder="e.g., Starbucks"
                      value={newRule.contains}
                      onChange={(e) => setNewRule({ ...newRule, contains: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rename To</label>
                    <input
                      type="text"
                      placeholder="e.g., Coffee Shop"
                      value={newRule.renameTo}
                      onChange={(e) => setNewRule({ ...newRule, renameTo: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  onClick={addRule}
                  disabled={!newRule.contains.trim() || !newRule.renameTo.trim()}
                  className="w-full px-4 py-2 bg-pinz-600 text-white text-sm font-medium rounded-lg hover:bg-pinz-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Add Rule
                </button>
              </div>

              {/* Existing Rules */}
              {Object.keys(groupedRules).length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Current Rules</h5>
                  <div className="space-y-2">
                    {(Object.entries(groupedRules) as [string, NameRule[]][]).map(([renameTo, rules]) => (
                      <div key={renameTo} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800">"{renameTo}"</span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                              {rules.length} rule{rules.length > 1 ? 's' : ''}
                            </span>
                            {groupFolders[renameTo] && (
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Folder className="w-3 h-3" />
                                Foldered
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleGroupFolder(renameTo)}
                              className={`p-1 rounded transition-colors ${
                                groupFolders[renameTo] 
                                  ? 'text-green-600 hover:bg-green-100' 
                                  : 'text-gray-400 hover:bg-blue-100'
                              }`}
                              title={groupFolders[renameTo] ? 'Disable folder grouping' : 'Enable folder grouping'}
                            >
                              <Folder className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => rules.forEach(rule => removeRule(rule.id))}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                              title={`Remove all ${rules.length} rule${rules.length > 1 ? 's' : ''} for "${renameTo}"`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          {rules.map((rule) => (
                            <div key={rule.id} className="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-gray-200">
                              <span className="text-sm text-gray-700">"{rule.contains}"</span>
                              <button
                                onClick={() => removeRule(rule.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
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

              {Object.keys(groupedRules).length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No name rules yet</p>
                  <p className="text-xs text-gray-400">Add rules to automatically rename markers</p>
                </div>
              )}
              </div>
            </div>

            {/* Transfer Rules Section - Always Visible */}
            <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3 border-b border-emerald-200">
                <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  Copy Rules from Another Map
                </h4>
                <p className="text-xs text-emerald-700 mt-1">Select rules from your other maps to copy here</p>
              </div>

              <div className="p-4 space-y-4">
                {/* Source Map Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Choose Source Map</label>
                  <select
                    value={selectedSourceMap}
                    onChange={(e) => handleSourceMapChange(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Select a map to copy rules from...</option>
                    {availableMaps.map((map) => (
                      <option key={map.id} value={map.id}>
                        {map.name} ({map.settings?.nameRules?.length || 0} rules)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rule Selection */}
                {sourceMapRules.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">
                        Select Rules to Copy
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={selectAllRules}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                        >
                          All
                        </button>
                        <span className="text-xs text-gray-400">•</span>
                        <button
                          onClick={selectNoRules}
                          className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-40 overflow-y-auto">
                      <div className="space-y-2">
                        {sourceMapRules.map((rule) => (
                          <div key={rule.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedRules.has(rule.id)}
                              onChange={() => toggleRuleSelection(rule.id)}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                            <div className="flex-1 text-sm">
                              <span className="font-medium text-gray-800">"{rule.contains}"</span>
                              <span className="text-gray-400 mx-2">→</span>
                              <span className="font-medium text-emerald-700">"{rule.renameTo}"</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600 text-center">
                      {selectedRules.size} of {sourceMapRules.length} rules selected
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={transferNameRules}
                    disabled={!selectedSourceMap || selectedRules.size === 0}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Copy Selected Rules ({selectedRules.size})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSourceMap('')
                      setSourceMapRules([])
                      setSelectedRules(new Set())
                    }}
                    className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                </div>

                {availableMaps.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <Settings className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No other maps available</p>
                    <p className="text-xs text-gray-400">Create more maps to copy rules between them</p>
                  </div>
                )}
              </div>
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">
          {filteredMarkers.length} markers
        </h3>
          {selectedMarkerIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{selectedMarkerIds.size} selected</span>
              <button
                onClick={groupSelectedMarkers}
                className="px-3 py-1 text-xs bg-pinz-600 text-white rounded-lg hover:bg-pinz-700 transition-colors flex items-center gap-1"
              >
                <Folder className="w-3 h-3" />
                Group
              </button>
              <button
                onClick={clearSelection}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        {selectedMarkerIds.size === 0 && (
          <p className="text-xs text-gray-500">
            💡 Select markers and click Group to create folders
          </p>
        )}
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

            {Object.entries(groupedMarkers).map(([groupName, groupMarkersRaw]) => {
              // Sort markers in group by order
              const groupMarkers = getOrderedMarkers(groupMarkersRaw)
              const isFolderEnabled = groupFolders[groupName]
              const isExpanded = expandedFolders[groupName]
              
              if (isFolderEnabled && groupMarkers.length >= 1) {
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
                        <div className="flex-1 min-w-0 overflow-hidden">
                          {editingGroup === groupName ? (
                            <div className="flex items-center gap-1 w-full">
                              <input
                                type="text"
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                className="flex-1 text-sm font-medium text-gray-900 bg-white border border-pinz-300 rounded px-2 py-1 focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500"
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
                              <p className="text-sm font-medium text-gray-900 truncate" title={groupName}>
                                {groupName}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                         {groupMarkers.length} marker{groupMarkers.length !== 1 ? 's' : ''}
                       </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                                className={`p-1 rounded transition-colors flex-shrink-0 ${
                                  customizationLevel === 'premium'
                                    ? 'text-gray-400 hover:text-green-600 hover:bg-green-100 cursor-pointer'
                                    : 'text-gray-300 cursor-not-allowed'
                                }`}
                                title={customizationLevel === 'premium' ? 'Upload folder icon' : 'Premium customization required'}
                              >
                                <Upload className="w-3 h-3" />
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteFolder(groupName)
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                            title="Delete folder"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Folder Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-200">
                        {groupMarkers.map((marker) => (
                          <motion.div
                            key={marker.id}
                            layout
                            initial={false}
                            animate={{
                              backgroundColor: movingMarkerId === marker.id ? 'rgba(244, 114, 182, 0.1)' : 'white',
                              borderColor: movingMarkerId === marker.id ? 'rgb(236, 72, 153)' : 'transparent',
                              scale: movingMarkerId === marker.id ? 1.02 : 1,
                            }}
                            transition={{
                              layout: { duration: 0.3, ease: 'easeInOut' },
                              backgroundColor: { duration: 0.2 },
                              borderColor: { duration: 0.2 },
                              scale: { duration: 0.2 },
                            }}
                            className={`flex items-center gap-3 p-3 pl-8 bg-white hover:bg-gray-50 ${
                              movingMarkerId === marker.id ? 'border-2 border-pinz-500' : 'border-2 border-transparent'
                            }`}
                          >
                            <button
                              onClick={() => toggleMarkerSelection(marker.id)}
                              className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded transition-colors"
                              title="Select marker"
                            >
                              {selectedMarkerIds.has(marker.id) ? (
                                <Check className="w-4 h-4 text-pinz-600" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  moveMarkerUp(marker.id, groupName)
                                }}
                                disabled={getOrderedMarkers(groupMarkers).findIndex(m => m.id === marker.id) <= 0}
                                className="p-0.5 text-gray-400 hover:text-pinz-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors z-10 relative"
                                title="Move up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  moveMarkerDown(marker.id, groupName)
                                }}
                                disabled={getOrderedMarkers(groupMarkers).findIndex(m => m.id === marker.id) >= groupMarkers.length - 1}
                                className="p-0.5 text-gray-400 hover:text-pinz-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors z-10 relative"
                                title="Move down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              {editingMarker === marker.id ? (
                                <div className="flex items-center gap-1 w-full min-w-0">
                                  <input
                                    type="text"
                                    value={editingMarkerName}
                                    onChange={(e) => setEditingMarkerName(e.target.value)}
                                    className="flex-1 min-w-0 text-sm font-medium text-gray-900 bg-white border border-pinz-300 rounded px-2 py-1 focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500 max-w-full"
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
                                  {isMarkerInGroup(marker.id) && (
                                    <button
                                      onClick={() => handleUngroupMarker(marker)}
                                      disabled={isUngrouping}
                                      className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-100 rounded transition-colors"
                                      title="Remove from group"
                                    >
                                      <Unlink className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setMarkerToDelete({ id: marker.id, name: marker.name })}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                                    title="Delete marker"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              } else {
                // Show as individual markers (not in folder)
                return groupMarkers.map((marker) => (
                  <motion.div
                    key={marker.id} 
                    layout
                    initial={false}
                    animate={{
                      backgroundColor: movingMarkerId === marker.id ? 'rgba(244, 114, 182, 0.1)' : 'white',
                      borderColor: movingMarkerId === marker.id ? 'rgb(236, 72, 153)' : 'rgb(229, 231, 235)',
                      scale: movingMarkerId === marker.id ? 1.02 : 1,
                    }}
                    transition={{
                      layout: { duration: 0.3, ease: 'easeInOut' },
                      backgroundColor: { duration: 0.2 },
                      borderColor: { duration: 0.2 },
                      scale: { duration: 0.2 },
                    }}
                    className={`bg-white rounded-lg border-2 p-3 hover:bg-gray-50 ${
                      selectedMarkerIds.has(marker.id) ? 'ring-2 ring-pinz-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMarkerSelection(marker.id)
                          }}
                          className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded transition-colors"
                          title="Select marker"
                        >
                          {selectedMarkerIds.has(marker.id) ? (
                            <Check className="w-4 h-4 text-pinz-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              moveMarkerUp(marker.id, groupName)
                            }}
                            disabled={getOrderedMarkers(groupMarkers).findIndex(m => m.id === marker.id) <= 0}
                            className="p-0.5 text-gray-400 hover:text-pinz-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors z-10 relative"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              moveMarkerDown(marker.id, groupName)
                            }}
                            disabled={getOrderedMarkers(groupMarkers).findIndex(m => m.id === marker.id) >= groupMarkers.length - 1}
                            className="p-0.5 text-gray-400 hover:text-pinz-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors z-10 relative"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          {editingMarker === marker.id ? (
                            <div className="flex items-center gap-1 w-full min-w-0">
                              <input
                                type="text"
                                value={editingMarkerName}
                                onChange={(e) => setEditingMarkerName(e.target.value)}
                                className="flex-1 min-w-0 text-sm font-medium text-gray-900 bg-white border border-pinz-300 rounded px-2 py-1 focus:ring-2 focus:ring-pinz-500 focus:border-pinz-500 max-w-full"
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
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <EyeOff className="w-3 h-3" />
                                )}
                              </button>
                              {isMarkerInGroup(marker.id) && (
                                <button
                                  onClick={() => handleUngroupMarker(marker)}
                                  disabled={isUngrouping}
                                  className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-100 rounded transition-colors"
                                  title="Remove from group"
                                >
                                  <Unlink className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => setMarkerToDelete({ id: marker.id, name: marker.name })}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Delete marker"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              }
            })}
          </>
        )}
      </div>

      {/* Polygons Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {polygons.length} {polygons.length === 1 ? 'region' : 'regions'}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {polygonEditMode && (
              <div className="text-xs text-gray-600">
                <span className="hidden sm:inline">Click Box Select, then drag to select vertices</span>
              </div>
            )}
            {hasUnsavedPolygonChanges && (
              <button
                onClick={handleSaveAllPolygons}
                className="px-3 py-1 text-xs rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1"
                title={`Save ${unsavedPolygonCount} polygon(s) to Firestore`}
              >
                💾 Save {unsavedPolygonCount > 0 ? `(${unsavedPolygonCount})` : ''}
              </button>
            )}
            <button
              onClick={() => {
                const newMode = !polygonEditMode
                setPolygonEditMode(newMode)
                setBoxSelectMode(false) // Turn off box select when toggling edit mode
                // Emit custom event to inform Map component
                window.dispatchEvent(new CustomEvent('polygonEditModeToggle', { detail: { enabled: newMode } }))
                window.dispatchEvent(new CustomEvent('boxSelectModeToggle', { detail: { enabled: false } }))
                showToast({ 
                  type: 'info', 
                  title: newMode ? 'Edit Mode ON' : 'Edit Mode OFF', 
                  message: newMode 
                    ? 'Enable Box Select mode, then drag to select vertices. Then drag to move them together.' 
                    : 'Map dragging enabled.' 
                })
              }}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                polygonEditMode
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={polygonEditMode ? 'Disable edit mode' : 'Enable edit mode'}
            >
              {polygonEditMode ? '✏️ Edit ON' : '✏️ Edit OFF'}
            </button>
            {polygonEditMode && (
              <button
                onClick={() => {
                  const newBoxMode = !boxSelectMode
                  setBoxSelectMode(newBoxMode)
                  window.dispatchEvent(new CustomEvent('boxSelectModeToggle', { detail: { enabled: newBoxMode } }))
                  showToast({ 
                    type: 'info', 
                    title: newBoxMode ? 'Box Select ON' : 'Box Select OFF', 
                    message: newBoxMode 
                      ? 'Click and drag on the map to select multiple vertices' 
                      : 'Click and drag to move individual vertices.' 
                  })
                }}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  boxSelectMode
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={boxSelectMode ? 'Disable box select mode' : 'Enable box select mode'}
              >
                {boxSelectMode ? '📦 Box Select ON' : '📦 Box Select OFF'}
              </button>
            )}
          </div>
        </div>
        
        {loadingPolygons ? (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">Loading regions...</p>
          </div>
        ) : polygons.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">No regions added yet</p>
            <p className="text-xs mt-1">Add regions using the Data tab</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {polygons.map((polygon) => (
              <div
                key={polygon.id}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {polygon.name || 'Unnamed Region'}
                  </p>
                  {polygon.description && (
                    <p className="text-xs text-gray-500 truncate">
                      {polygon.description}
                    </p>
                  )}
                  {polygon.type && (
                    <p className="text-xs text-gray-400">
                      Type: {polygon.type}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditPolygon(polygon)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="Edit region properties"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTogglePolygonVisibility(polygon.id || '', polygon.visible)}
                    className={`p-1 rounded transition-colors ${
                      polygon.visible
                        ? 'text-green-600 hover:bg-green-100'
                        : 'text-gray-400 hover:bg-gray-200'
                    }`}
                    title={polygon.visible ? 'Hide region' : 'Show region'}
                  >
                    {polygon.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeletePolygon(polygon.id || '')}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Delete region"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Polygon Edit Modal */}
      <PolygonEditModal
        isOpen={showPolygonEditModal}
        onClose={() => {
          setShowPolygonEditModal(false)
          setEditingPolygon(null)
        }}
        polygon={editingPolygon}
        userId={userId}
        mapId={mapId || ''}
        currentMap={currentMap}
        onSave={handlePolygonEditSave}
      />

      {/* Delete Marker Confirmation Modal */}
      <DeleteMarkerDialog
        isOpen={!!markerToDelete}
        onClose={() => setMarkerToDelete(null)}
        onConfirm={async () => {
          if (!markerToDelete) return
          setIsDeletingMarker(true)
          try {
            // Call the delete function - it's async in App.tsx
            onDeleteMarker(markerToDelete.id)
            setMarkerToDelete(null)
            showToast({ type: 'success', title: 'Success', message: 'Marker deleted successfully' })
          } catch (error) {
            console.error('Error deleting marker:', error)
            showToast({ type: 'error', title: 'Error', message: 'Failed to delete marker' })
          } finally {
            setIsDeletingMarker(false)
          }
        }}
        markerName={markerToDelete?.name || ''}
        isDeleting={isDeletingMarker}
      />

      {/* Limitation Info Modal */}
      <LimitationInfoModal
        isOpen={!!showLimitationModal}
        onClose={() => setShowLimitationModal(null)}
        type={showLimitationModal?.type || 'marker-usage'}
        currentCount={currentCount}
        limit={limit}
        isError={showError}
        onOpenSubscription={onOpenSubscription}
      />
    </div>
  )
}

export default ManageTabContent