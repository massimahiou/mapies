import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { addMarkerToMap, getMapMarkers } from '../firebase/maps'
import { checkForDuplicates, AddressData } from '../utils/duplicateDetection'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import TagSelector from './TagSelector'

interface Marker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  visible: boolean
  type: 'pharmacy' | 'grocery' | 'retail' | 'other'
  tags?: string[]
}

interface AddMarkerModalProps {
  isOpen: boolean
  onClose: () => void
  onMarkersAdded: (markers: Marker[]) => void
  isUploading: boolean
  currentProcessingAddress: string
  processingProgress: { current: number; total: number }
  currentMapId: string | null
  userId: string | null
  onShowDuplicateNotification: (duplicateCount: number, totalProcessed: number) => void
}

interface MarkerRow {
  id: string
  name: string
  address: string
  showAutocomplete?: boolean
  autocompleteResults?: any[]
  isSearching?: boolean
}

const AddMarkerModal: React.FC<AddMarkerModalProps> = ({
  isOpen,
  onClose,
  onMarkersAdded,
  isUploading,
  currentProcessingAddress,
  processingProgress,
  currentMapId,
  userId,
  onShowDuplicateNotification
}) => {
  console.log('AddMarkerModal rendering, isOpen:', isOpen)
  const { hasSmartGrouping, canAddMarkers } = useFeatureAccess()
  const [markerRows, setMarkerRows] = useState<MarkerRow[]>([
    { id: '1', name: '', address: '' }
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])

  // Load available tags from map settings
  useEffect(() => {
    const loadTags = async () => {
      if (!userId || !currentMapId) return
      try {
        const { getUserMaps } = await import('../firebase/maps')
        const userMaps = await getUserMaps(userId)
        const currentMap = userMaps.find(m => m.id === currentMapId)
        if (currentMap?.settings?.tags) {
          setAvailableTags(currentMap.settings.tags)
        }
      } catch (error) {
        console.error('Error loading tags:', error)
      }
    }
    if (isOpen) {
      loadTags()
    }
  }, [userId, currentMapId, isOpen])

  // Geocoding function using OpenStreetMap Nominatim
  // Note: Marker-by-marker geocoding is allowed for all users (including freemium)
  const geocodeAddress = async (address: string): Promise<{lat: number, lng: number} | null> => {
    try {
      // Marker-by-marker geocoding is always allowed (even for freemium users)
      // Only bulk geocoding (CSV upload) requires a paid plan
      console.log('Using Nominatim for geocoding:', address)
      
      // Try multiple address variations
      const addressVariations = [
        address, // Original address
        address.replace(/,\s*QC\s+\w+\s+\w+/, ', QC'), // Remove postal code
        address.replace(/,\s*QC.*/, ', QC'), // Remove everything after QC
        address.split(',')[0] + ', Saint-Hubert, QC', // Just street + city + province
        address.split(',')[0] + ', QC' // Just street + province
      ]
      
      for (const variation of addressVariations) {
        console.log('Trying address variation:', variation)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(variation)}&limit=1&countrycodes=ca`)
        const data = await response.json()
        
        console.log('Nominatim response for variation:', variation, data)
        
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          }
        }
        
        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      return null
    } catch (error) {
      console.error('Geocoding error:', error)
      return null
    }
  }

  // Address autocomplete search
  const searchAddressAutocomplete = async (query: string, rowId: string) => {
    if (!query.trim()) {
      updateRow(rowId, 'address', query)
      setMarkerRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, showAutocomplete: false, autocompleteResults: [], isSearching: false }
          : row
      ))
      return
    }

    setMarkerRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, isSearching: true, showAutocomplete: true }
        : row
    ))

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=ca&addressdetails=1`)
      const data = await response.json()
      
      setMarkerRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, autocompleteResults: data, isSearching: false }
          : row
      ))
    } catch (error) {
      console.error('Autocomplete search error:', error)
      setMarkerRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, autocompleteResults: [], isSearching: false }
          : row
      ))
    }
  }

  // Handle autocomplete selection
  const handleAutocompleteSelect = (rowId: string, result: any) => {
    const fullAddress = result.display_name
    updateRow(rowId, 'address', fullAddress)
    setMarkerRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, showAutocomplete: false, autocompleteResults: [] }
        : row
    ))
  }

  const addRow = () => {
    const newId = (markerRows.length + 1).toString()
    setMarkerRows([...markerRows, { id: newId, name: '', address: '' }])
  }

  const removeRow = (id: string) => {
    if (markerRows.length > 1) {
      setMarkerRows(markerRows.filter(row => row.id !== id))
    }
  }

  const updateRow = (id: string, field: 'name' | 'address', value: string) => {
    setMarkerRows(markerRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Debounced search for address autocomplete
  useEffect(() => {
    const timeouts: { [key: string]: NodeJS.Timeout } = {}
    
    markerRows.forEach(row => {
      if (row.address && row.address.length > 2) {
        // Clear existing timeout
        if (timeouts[row.id]) {
          clearTimeout(timeouts[row.id])
        }
        
        // Set new timeout
        timeouts[row.id] = setTimeout(() => {
          searchAddressAutocomplete(row.address, row.id)
        }, 500)
      }
    })

    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout))
    }
  }, [markerRows.map(row => row.address).join(',')])

  const processMarkers = async () => {
    if (isProcessing) {
      console.log('🚫 Process markers called while already processing, ignoring')
      return
    }
    
    setIsProcessing(true)
    
    try {
      const validRows = markerRows.filter(row => row.name.trim() && row.address.trim())
      
      if (validRows.length === 0) {
        alert('Please add at least one marker with both name and address.')
        return
      }

      if (!currentMapId || !userId) {
        alert('Please select a map first.')
        return
      }

      // Marker-by-marker geocoding is allowed for all users (including freemium)
      // Only bulk geocoding (CSV upload) requires a paid plan

      // Prepare address data for duplicate checking
      const addressData: AddressData[] = validRows.map(row => ({
        name: row.name.trim(),
        address: row.address.trim()
      }))

      // Get existing markers from the current map for comparison
      let existingMarkers: AddressData[] = []
      try {
        const currentMapMarkers = await getMapMarkers(userId, currentMapId)
        existingMarkers = currentMapMarkers.map(marker => ({
          name: marker.name,
          address: marker.address,
          lat: marker.lat,
          lng: marker.lng
        }))
      } catch (error) {
        console.error('Error loading existing markers:', error)
      }

      // Check marker limits before processing
      if (!canAddMarkers(existingMarkers.length)) {
        alert(`Cannot add more markers. You've used all ${existingMarkers.length} markers in your current plan. Consider upgrading for more markers.`)
        return
      }

      // Check for duplicates
      const duplicateCheck = checkForDuplicates(addressData, existingMarkers)
      console.log(`Found ${duplicateCheck.duplicateCount} duplicates`)

      const newMarkers: Marker[] = []

      // Process only unique addresses
      for (let i = 0; i < duplicateCheck.unique.length; i++) {
        const addressData = duplicateCheck.unique[i]
        
        // Add delay between requests to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        console.log(`Processing: ${addressData.name} - ${addressData.address}`)
        
        // Geocode the address
        const coordinates = await geocodeAddress(addressData.address)
        
        if (coordinates) {
          console.log(`✅ Successfully geocoded ${addressData.name}:`, coordinates)
          
          // Add marker to Firebase
          try {
            const markerId = await addMarkerToMap(userId, currentMapId, {
              name: addressData.name,
              address: addressData.address,
              lat: coordinates.lat,
              lng: coordinates.lng,
              type: 'other',
              visible: true,
              tags: selectedTags.length > 0 ? selectedTags : undefined
            }, hasSmartGrouping)
            
            // Also add to local state for immediate UI update
            const marker: Marker = {
              id: markerId,
              name: addressData.name,
              address: addressData.address,
              lat: coordinates.lat,
              lng: coordinates.lng,
              visible: true,
              type: 'other',
              tags: selectedTags.length > 0 ? selectedTags : undefined
            }
            newMarkers.push(marker)
          } catch (error) {
            console.error('Error adding marker to Firebase:', error)
            // Still add to local state even if Firebase fails
            const marker: Marker = {
              id: `marker-${Date.now()}-${Math.random()}`,
              name: addressData.name,
              address: addressData.address,
              lat: coordinates.lat,
              lng: coordinates.lng,
              visible: true,
              type: 'other'
            }
            newMarkers.push(marker)
          }
        } else {
          console.log(`❌ Failed to geocode: ${addressData.name} - ${addressData.address}`)
        }
      }

      if (newMarkers.length > 0) {
        onMarkersAdded(newMarkers)
        onClose()
        // Reset form
        setMarkerRows([{ id: '1', name: '', address: '' }])
      } else if (duplicateCheck.duplicateCount > 0) {
        // All addresses were duplicates, just close modal and show notification
        onClose()
        // Reset form
        setMarkerRows([{ id: '1', name: '', address: '' }])
      } else {
        // No addresses could be geocoded (invalid addresses)
        alert('No markers could be geocoded. Please check your addresses.')
      }

      // Show duplicate notification
      onShowDuplicateNotification(duplicateCheck.duplicateCount, validRows.length)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Markers</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Note: Marker-by-marker geocoding is allowed for all users */}
        {/* Only bulk geocoding (CSV upload) requires a paid plan */}

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Add markers manually by entering their name and address. We'll automatically geocode the addresses.
          </p>
        </div>

        {/* Marker Rows */}
        <div className="space-y-3 mb-4">
          {markerRows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Marker name"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
                />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type a postcode or address..."
                    value={row.address}
                    onChange={(e) => updateRow(row.id, 'address', e.target.value)}
                    onFocus={() => setMarkerRows(prev => prev.map(r => 
                      r.id === row.id ? { ...r, showAutocomplete: true } : r
                    ))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {row.isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  
                  {/* Autocomplete Dropdown */}
                  {row.showAutocomplete && row.autocompleteResults && row.autocompleteResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {row.autocompleteResults.map((result, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAutocompleteSelect(row.id, result)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {result.display_name.split(',')[0]}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {result.display_name.split(',').slice(1, 3).join(',').trim()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {markerRows.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="p-2 hover:bg-red-100 rounded transition-colors"
                  title="Remove marker"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Row Button */}
        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors mb-4"
        >
          <Plus className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Add another marker</span>
        </button>

        {/* Tag Selector */}
        {availableTags.length > 0 && (
          <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
            <TagSelector
              availableTags={availableTags}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              disabled={isProcessing || isUploading}
            />
          </div>
        )}

        {/* Loading State */}
        {isUploading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-600">Processing addresses...</p>
              <p className="text-xs text-blue-500">{processingProgress.current}/{processingProgress.total}</p>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
              ></div>
            </div>
            {currentProcessingAddress && (
              <p className="text-xs text-blue-500 mt-2 truncate">
                Currently processing: {currentProcessingAddress}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={processMarkers}
            disabled={isUploading || isProcessing}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading || isProcessing ? 'Processing...' : 'Add Markers'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddMarkerModal
