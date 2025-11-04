import { useEffect, useRef } from 'react'
import * as L from 'leaflet'

interface PolygonDocument {
  id?: string
  name: string
  description?: string
  type: 'polygon' | 'rectangle' | 'circle'
  coordinates?: Array<{lat: number, lng: number}>
  center?: { lat: number, lng: number }
  radius?: number
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeWeight: number
  strokeOpacity: number
  visible: boolean
}

interface UsePolygonLoaderProps {
  mapInstance: L.Map | null
  mapLoaded: boolean
  userId: string
  mapId: string
  activeTab?: string
  onPolygonEdit?: (polygonId: string, coordinates: Array<{lat: number, lng: number}>) => void
}

// Export function to save all unsaved polygons
export const saveAllUnsavedPolygons = (
  mapInstance: L.Map | null,
  _vertexMarkersRef: React.MutableRefObject<globalThis.Map<string, L.Marker[]>>, // Keep for future use
  polygonLayersRef: React.MutableRefObject<globalThis.Map<string, L.Layer>>,
  unsavedPolygonsRef: React.MutableRefObject<Set<string>>,
  onPolygonEdit?: (polygonId: string, coordinates: Array<{lat: number, lng: number}>) => void
): number => {
  if (!mapInstance || !onPolygonEdit) return 0
  
  let savedCount = 0
  
  unsavedPolygonsRef.current.forEach((polygonId) => {
    const layer = polygonLayersRef.current.get(polygonId)
    if (layer instanceof L.Polygon) {
      const latlngs = layer.getLatLngs()[0] as L.LatLng[]
      const coordinates = latlngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }))
      onPolygonEdit(polygonId, coordinates)
      savedCount++
    }
  })
  
  // Clear unsaved changes
  unsavedPolygonsRef.current.clear()
  window.dispatchEvent(new CustomEvent('polygonUnsavedChanges', { 
    detail: { 
      hasUnsaved: false,
      polygonCount: 0 
    } 
  }))
  
  return savedCount
}

export const usePolygonLoader = ({ mapInstance, mapLoaded, userId, mapId, activeTab, onPolygonEdit }: UsePolygonLoaderProps) => {
  const polygonLayersRef = useRef(new globalThis.Map<string, L.Layer>())
  const lastLoadedMapIdRef = useRef<string>('')
  const lastMapInstanceRef = useRef<L.Map | null>(null)
  const lastActiveTabRef = useRef<string>('')
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const vertexMarkersRef = useRef(new globalThis.Map<string, L.Marker[]>()) // polygonId -> array of vertex markers
  const editModeEnabledRef = useRef(false)
  const selectedVerticesRef = useRef(new Set<L.Marker>()) // Set of selected vertex markers
  const dragOffsetRef = useRef<L.LatLng | null>(null) // Offset when dragging multiple vertices
  const boxSelectRectRef = useRef<L.Rectangle | null>(null) // Rectangle for box selection
  const boxSelectStartRef = useRef<L.LatLng | null>(null) // Start position for box selection
  const isBoxSelectingRef = useRef(false) // Whether currently box selecting
  const boxSelectModeEnabledRef = useRef(false) // Whether box select mode is enabled
  const unsavedPolygonsRef = useRef(new Set<string>()) // Track polygons with unsaved changes

  useEffect(() => {
    if (!mapLoaded || !mapInstance || !userId || !mapId) {
      return
    }

    // Check if the map instance changed (map was recreated)
    const instanceChanged = lastMapInstanceRef.current !== mapInstance
    const mapIdChanged = lastLoadedMapIdRef.current !== mapId
    const tabChanged = lastActiveTabRef.current !== activeTab
    

    // Remove existing layers from map before reloading
    // Only reload if instance changed (map recreated) - not just tab changes
    if (instanceChanged && lastMapInstanceRef.current) {
      const previousInstance = lastMapInstanceRef.current
      
      // Remove all polygon layers from previous instance
      polygonLayersRef.current.forEach((layer: L.Layer) => {
        if (previousInstance.hasLayer(layer)) {
          previousInstance.removeLayer(layer)
        }
      })
      
      // Remove vertex markers
      vertexMarkersRef.current.forEach((markers) => {
        markers.forEach(marker => previousInstance.removeLayer(marker))
      })
      vertexMarkersRef.current.clear()
      
      // Clear the refs
      polygonLayersRef.current.clear()
    }
    
    // If tab changed but instance is the same, polygons should persist
    // Don't reload - just skip (polygons are already on the map)
    if (tabChanged && !instanceChanged) {
      lastActiveTabRef.current = activeTab || ''
      return
    }

    const loadPolygons = async () => {
      try {
        const { getMapPolygons } = await import('../firebase/maps')
        const polygons = await getMapPolygons(userId, mapId)

        // Initialize FeatureGroup for editable polygons if it doesn't exist
        if (!drawnItemsRef.current && mapInstance) {
          drawnItemsRef.current = new L.FeatureGroup()
          mapInstance.addLayer(drawnItemsRef.current!)
          
          // Listen for edit events to save changes
          mapInstance.on('draw:edited', (e: any) => {
            const layers = e.layers as L.FeatureGroup
            layers.eachLayer((layer: L.Layer) => {
              if (layer instanceof L.Polygon) {
                const polygonId = (layer as any).polygonId
                const latlngs = layer.getLatLngs()[0] as L.LatLng[]
                const coordinates = latlngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }))
                
                if (polygonId && onPolygonEdit) {
                  onPolygonEdit(polygonId, coordinates)
                }
              }
            })
          })
        }

        // If switching maps (not just tabs), remove old polygon layers and vertex markers
        if (mapIdChanged && lastLoadedMapIdRef.current && lastMapInstanceRef.current !== null) {
          const previousInstance = lastMapInstanceRef.current
          
          // Remove vertex markers for old polygons
          vertexMarkersRef.current.forEach((markers) => {
            markers.forEach(marker => previousInstance.removeLayer(marker))
          })
          vertexMarkersRef.current.clear()
          
          // Remove polygon layers
          polygonLayersRef.current.forEach((layer: L.Layer) => {
            if (previousInstance.hasLayer(layer)) {
              previousInstance.removeLayer(layer)
            }
          })
        }

        // First, remove any existing layers that are on the map but not in our ref
        // This handles the case where layers weren't properly cleaned up
        const currentLayersOnMap: L.Layer[] = []
        mapInstance.eachLayer((layer: L.Layer) => {
          if ((layer instanceof L.Polygon || layer instanceof L.Circle) && (layer as any).polygonId) {
            const polygonId = (layer as any).polygonId
            if (!polygonLayersRef.current.has(polygonId)) {
              // Layer exists on map but not in our ref - remove it
              mapInstance.removeLayer(layer)
            } else {
              currentLayersOnMap.push(layer)
            }
          }
        })

        // Render each polygon
        polygons.forEach((polygon: PolygonDocument) => {
          if (!polygon.visible || !mapInstance) return

          const polygonId = polygon.id || ''
          
          // Check if already rendered on current map instance
          const existingLayer = polygonLayersRef.current.get(polygonId)
          if (existingLayer && mapInstance.hasLayer(existingLayer)) {
            return
          }
          
          // If we have an existing layer in ref but it's not on the map, remove from ref
          if (existingLayer && !mapInstance.hasLayer(existingLayer)) {
            polygonLayersRef.current.delete(polygonId)
          }

          let layer: L.Layer | null = null

          try {
            if (polygon.type === 'circle' && polygon.center && polygon.radius) {
              // Render circle
              layer = L.circle([polygon.center.lat, polygon.center.lng], {
                radius: polygon.radius,
                fillColor: polygon.fillColor,
                fillOpacity: polygon.fillOpacity,
                color: polygon.strokeColor,
                weight: polygon.strokeWeight,
                opacity: polygon.strokeOpacity
              })
            } else if (polygon.coordinates && polygon.coordinates.length > 0) {
              // Render polygon or rectangle
              const latlngs: L.LatLngExpression[] = polygon.coordinates.map((coord: {lat: number, lng: number}) => [coord.lat, coord.lng] as L.LatLngExpression)
              layer = L.polygon(latlngs, {
                fillColor: polygon.fillColor,
                fillOpacity: polygon.fillOpacity,
                color: polygon.strokeColor,
                weight: polygon.strokeWeight,
                opacity: polygon.strokeOpacity
              })
            }

            // Add popup with edit button and render
            if (layer && mapInstance) {
              // Double-check this polygon isn't already on the map
              const checkId = polygon.id || ''
              if (polygonLayersRef.current.has(checkId)) {
                const existing = polygonLayersRef.current.get(checkId)
                if (existing && mapInstance.hasLayer(existing)) {
                  return // Skip this polygon
                }
              }
              
              const polygonId = checkId
              ;(layer as any).polygonId = polygonId
              
              const popupContent = `
                <div class="text-sm">
                  <h3 class="font-semibold mb-1">${polygon.name}</h3>
                  ${polygon.description ? `<p class="text-gray-600">${polygon.description}</p>` : ''}
                  <p class="text-xs text-gray-400 mt-1">Use Edit Mode to modify vertices</p>
                </div>
              `
              
              layer.bindPopup(popupContent)
              
              // Add to FeatureGroup for editing capability (Leaflet.draw requirement)
              if (drawnItemsRef.current && layer && !drawnItemsRef.current.hasLayer(layer)) {
                drawnItemsRef.current.addLayer(layer)
              }
              
              layer.addTo(mapInstance)
              polygonLayersRef.current.set(polygonId, layer)
              
              // If edit mode is already enabled, show vertex markers for this new polygon
              const polygonLayer = layer instanceof L.Polygon ? layer : null
              if (editModeEnabledRef.current && polygonLayer) {
                // Use setTimeout to ensure polygon is fully rendered
                setTimeout(() => {
                  if (mapInstance.hasLayer(polygonLayer)) {
                    showVertexMarkers(mapInstance, polygonLayer, polygonId)
                  }
                }, 50)
              }
              
              // Add right-click handler for editing (Leaflet.draw standard)
              if (polygonLayer && mapInstance) {
                // Right-click to enter edit mode (Leaflet.draw convention)
                polygonLayer.on('contextmenu', (e: L.LeafletMouseEvent) => {
                  e.originalEvent.preventDefault()
                  
                  try {
                    // Use Leaflet.draw's edit handler
                    const editHandler = new (L as any).Draw.PolyEdit(mapInstance, layer, {
                      allowIntersection: false
                    })
                    ;(layer as any)._editHandler = editHandler
                    editHandler.enable()
                    
                  } catch (err) {
                    console.error('Error enabling edit mode:', err)
                  }
                })
              }
            }
          } catch (polygonError) {
            console.error('Error rendering polygon:', polygon.id, polygonError)
          }
        })

        lastLoadedMapIdRef.current = mapId
        lastMapInstanceRef.current = mapInstance
        lastActiveTabRef.current = activeTab || ''
      } catch (error) {
        console.error('Error loading polygons:', error)
      }
    }

    // Only load if we have all required data
    if (mapInstance && userId && mapId) {
      // Add a small delay when instance changes to ensure map is fully initialized
      if (instanceChanged) {
        setTimeout(() => loadPolygons(), 100)
      } else {
        loadPolygons()
      }
    }
  }, [mapLoaded, mapId, userId, mapInstance, activeTab])
  
  // Listen for edit mode toggle
  useEffect(() => {
    const handleEditModeToggle = (e: CustomEvent) => {
      const enabled = e.detail.enabled
      editModeEnabledRef.current = enabled
      
      if (!mapInstance || !mapLoaded) return
      
      
      if (enabled) {
        // Show pink vertex dots for all polygons
        polygonLayersRef.current.forEach((layer, polygonId) => {
          if (layer instanceof L.Polygon) {
            showVertexMarkers(mapInstance, layer, polygonId || '')
          }
        })
      } else {
        // Hide all vertex markers
        hideAllVertexMarkers(mapInstance)
        // Clear selection rectangle
        if (boxSelectRectRef.current) {
          mapInstance.removeLayer(boxSelectRectRef.current)
          boxSelectRectRef.current = null
        }
        boxSelectModeEnabledRef.current = false
      }
    }
    
    window.addEventListener('polygonEditModeToggle', handleEditModeToggle as EventListener)
    return () => {
      window.removeEventListener('polygonEditModeToggle', handleEditModeToggle as EventListener)
    }
  }, [mapInstance, mapLoaded])
  
  // Listen for box select mode toggle
  useEffect(() => {
    const handleBoxSelectModeToggle = (e: CustomEvent) => {
      const enabled = e.detail.enabled
      boxSelectModeEnabledRef.current = enabled
      
      // Clear any existing selection rectangle
      if (!enabled && mapInstance && boxSelectRectRef.current) {
        mapInstance.removeLayer(boxSelectRectRef.current)
        boxSelectRectRef.current = null
        isBoxSelectingRef.current = false
      }
    }
    
    window.addEventListener('boxSelectModeToggle', handleBoxSelectModeToggle as EventListener)
    return () => {
      window.removeEventListener('boxSelectModeToggle', handleBoxSelectModeToggle as EventListener)
    }
  }, [mapInstance])
  
  // Listen for real-time polygon style updates
  useEffect(() => {
    if (!mapInstance || !mapLoaded) return
    
    const handleStyleUpdate = (e: CustomEvent) => {
      const { polygonId, fillColor, fillOpacity, strokeColor, strokeWeight, strokeOpacity } = e.detail
      
      const layer = polygonLayersRef.current.get(polygonId)
      if (!layer) return
      
      // Update polygon styling in real-time
      if (layer instanceof L.Polygon) {
        layer.setStyle({
          fillColor,
          fillOpacity,
          color: strokeColor,
          weight: strokeWeight,
          opacity: strokeOpacity
        })
      } else if (layer instanceof L.Circle) {
        layer.setStyle({
          fillColor,
          fillOpacity,
          color: strokeColor,
          weight: strokeWeight,
          opacity: strokeOpacity
        })
      }
    }
    
    window.addEventListener('polygonStyleUpdate', handleStyleUpdate as EventListener)
    return () => {
      window.removeEventListener('polygonStyleUpdate', handleStyleUpdate as EventListener)
    }
  }, [mapInstance, mapLoaded])
  
  // Box selection handler - works when box select mode is enabled
  useEffect(() => {
    if (!mapInstance || !mapLoaded) return
    
    let startPoint: L.LatLng | null = null
    
    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      // Only work if box select mode is enabled and edit mode is enabled
      if (!boxSelectModeEnabledRef.current || !editModeEnabledRef.current) {
        return
      }
      
      
      // Check if click was on a vertex marker - if so, don't start box selection
      const target = e.originalEvent.target as HTMLElement
      if (target.closest('.pink-vertex-marker')) {
        return // Allow vertex dragging instead
      }
      
      // Stop event from triggering other handlers
      e.originalEvent.stopPropagation()
      e.originalEvent.preventDefault()
      
      startPoint = e.latlng
      boxSelectStartRef.current = e.latlng
      isBoxSelectingRef.current = true
      
      
      // Create selection rectangle
      if (boxSelectRectRef.current) {
        mapInstance.removeLayer(boxSelectRectRef.current)
      }
      
      boxSelectRectRef.current = L.rectangle([[e.latlng.lat, e.latlng.lng], [e.latlng.lat, e.latlng.lng]], {
        color: '#0066ff',
        weight: 2,
        fillColor: '#0066ff',
        fillOpacity: 0.2,
        dashArray: '5, 5'
      }).addTo(mapInstance)
      
    }
    
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isBoxSelectingRef.current || !startPoint || !boxSelectRectRef.current) return
      
      // Stop event propagation during box selection
      e.originalEvent.stopPropagation()
      e.originalEvent.preventDefault()
      
      // Update rectangle bounds
      const bounds = L.latLngBounds([startPoint, e.latlng])
      boxSelectRectRef.current.setBounds(bounds)
    }
    
    const handleMouseUp = (e: L.LeafletMouseEvent) => {
      if (!isBoxSelectingRef.current || !startPoint || !boxSelectRectRef.current) {
        isBoxSelectingRef.current = false
        return
      }
      
      // Stop event propagation
      e.originalEvent.stopPropagation()
      e.originalEvent.preventDefault()
      
      
      isBoxSelectingRef.current = false
      
      // Get bounds of selection rectangle
      const bounds = boxSelectRectRef.current.getBounds()
      
      // Select all vertices within the rectangle
      const createIcon = (isSelected: boolean) => {
        const color = isSelected ? '#0066ff' : '#ff1493'
        const size = isSelected ? 14 : 12
        return L.divIcon({
          className: 'pink-vertex-marker',
          html: `<div style="width: ${size}px; height: ${size}px; background-color: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer; transition: all 0.2s;"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        })
      }
      
      let selectedCount = 0
      vertexMarkersRef.current.forEach((markers) => {
        markers.forEach((marker) => {
          if (bounds.contains(marker.getLatLng())) {
            if (!selectedVerticesRef.current.has(marker)) {
              selectedVerticesRef.current.add(marker)
              marker.setIcon(createIcon(true))
              selectedCount++
            }
          }
        })
      })
      
      // Remove selection rectangle
      mapInstance.removeLayer(boxSelectRectRef.current!)
      boxSelectRectRef.current = null
      startPoint = null
      
    }
    
    // Listen directly on map container for capture phase to intercept before Leaflet
    const container = mapInstance.getContainer()
    
    const directMouseDown = (e: MouseEvent) => {
      if (e.shiftKey && editModeEnabledRef.current) {
        // Check if click was on a vertex marker
        const target = e.target as HTMLElement
        if (!target.closest('.pink-vertex-marker')) {
          e.stopPropagation()
          e.stopImmediatePropagation()
          // Don't prevent default here, let our Leaflet handler deal with it
        }
      }
    }
    
    // Use Leaflet events as well
    mapInstance.on('mousedown', handleMouseDown)
    mapInstance.on('mousemove', handleMouseMove)
    mapInstance.on('mouseup', handleMouseUp)
    
    // Also listen on container with capture phase
    container.addEventListener('mousedown', directMouseDown, true)
    
    return () => {
      mapInstance.off('mousedown', handleMouseDown)
      mapInstance.off('mousemove', handleMouseMove)
      mapInstance.off('mouseup', handleMouseUp)
      
      container.removeEventListener('mousedown', directMouseDown, true)
      
      // Cleanup rectangle if exists
      if (boxSelectRectRef.current && mapInstance.hasLayer(boxSelectRectRef.current)) {
        mapInstance.removeLayer(boxSelectRectRef.current)
        boxSelectRectRef.current = null
      }
    }
  }, [mapInstance, mapLoaded])
  
  // Function to show pink vertex markers for a polygon (must be defined inside hook to access refs)
  const showVertexMarkers = (map: L.Map, polygon: L.Polygon, polygonId: string) => {
    if (!onPolygonEdit) {
      console.warn('🔷 onPolygonEdit callback not available, skipping vertex markers')
      return
    }
    // Remove existing vertex markers if any
    const existingMarkers = vertexMarkersRef.current.get(polygonId)
    if (existingMarkers) {
      existingMarkers.forEach(marker => map.removeLayer(marker))
    }
    
    // Get all vertices from the polygon
    const latlngs = polygon.getLatLngs()[0] as L.LatLng[]
    const vertexMarkers: L.Marker[] = []
    
    latlngs.forEach((latlng: L.LatLng, index: number) => {
      // Create pink circular marker (selected state will be blue)
      const createIcon = (isSelected: boolean) => {
        const color = isSelected ? '#0066ff' : '#ff1493'
        const size = isSelected ? 14 : 12
        return L.divIcon({
          className: 'pink-vertex-marker',
          html: `<div style="width: ${size}px; height: ${size}px; background-color: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer; transition: all 0.2s;"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        })
      }
      
      const marker = L.marker(latlng, {
        icon: createIcon(false),
        draggable: true,
        zIndexOffset: 1000
      }).addTo(map)
      
      // Store index on marker for reference
      ;(marker as any).vertexIndex = index
      ;(marker as any).polygonId = polygonId
      ;(marker as any).polygon = polygon
      
      // Click to select/deselect (with Shift for multi-select)
      marker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation()
        
        if (e.originalEvent.shiftKey || e.originalEvent.metaKey || e.originalEvent.ctrlKey) {
          // Multi-select: toggle this marker
          if (selectedVerticesRef.current.has(marker)) {
            selectedVerticesRef.current.delete(marker)
            marker.setIcon(createIcon(false))
          } else {
            selectedVerticesRef.current.add(marker)
            marker.setIcon(createIcon(true))
          }
        } else {
          // Single select: clear others and select this one
          selectedVerticesRef.current.forEach((m) => {
            if (m !== marker) {
              m.setIcon(L.divIcon({
                className: 'pink-vertex-marker',
                html: `<div style="width: 12px; height: 12px; background-color: #ff1493; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
              }))
            }
          })
          selectedVerticesRef.current.clear()
          selectedVerticesRef.current.add(marker)
          marker.setIcon(createIcon(true))
        }
        
      })
      
      // Store original position when drag starts
      let startPosition: L.LatLng | null = null
      marker.on('dragstart', () => {
        startPosition = marker.getLatLng()
        
        // If this marker is selected, drag all selected markers together
        if (selectedVerticesRef.current.has(marker) && selectedVerticesRef.current.size > 1) {
          // Calculate offset for all selected markers
          const allSelected = Array.from(selectedVerticesRef.current)
          const allStartPositions = new Map<L.Marker, L.LatLng>()
          allSelected.forEach((m) => {
            allStartPositions.set(m, m.getLatLng())
          })
          
          // When dragging, update all selected markers
          marker.on('drag', () => {
            const currentPos = marker.getLatLng()
            const offsetLat = currentPos.lat - startPosition!.lat
            const offsetLng = currentPos.lng - startPosition!.lng
            
            allSelected.forEach((m) => {
              if (m !== marker) {
                const origPos = allStartPositions.get(m)!
                m.setLatLng(L.latLng(origPos.lat + offsetLat, origPos.lng + offsetLng))
              }
            })
          }, { once: false })
        }
      })
      
      // Make marker draggable and update polygon on drag
      marker.on('drag', () => {
        // Get current polygon coordinates
        const currentLatlngs = polygon.getLatLngs()[0] as L.LatLng[]
        const newLatlng = marker.getLatLng()
        
        // Update the vertex at this index
        const updatedLatlngs = [...currentLatlngs]
        updatedLatlngs[index] = newLatlng
        
        // Also update any other selected vertices that are being dragged together
        if (selectedVerticesRef.current.has(marker) && selectedVerticesRef.current.size > 1) {
          selectedVerticesRef.current.forEach((m) => {
            if (m !== marker && (m as any).polygonId === polygonId) {
              const otherIndex = (m as any).vertexIndex
              const otherPos = m.getLatLng()
              updatedLatlngs[otherIndex] = otherPos
            }
          })
        }
        
        // Update polygon shape
        polygon.setLatLngs([updatedLatlngs])
      })
      
      // Track unsaved changes when drag ends (don't auto-save)
      marker.on('dragend', () => {
        const finalLatlngs = polygon.getLatLngs()[0] as L.LatLng[]
        
        // Mark polygon as having unsaved changes
        if (polygonId) {
          unsavedPolygonsRef.current.add(polygonId)
          // Notify that there are unsaved changes
          window.dispatchEvent(new CustomEvent('polygonUnsavedChanges', { 
            detail: { 
              hasUnsaved: true,
              polygonCount: unsavedPolygonsRef.current.size 
            } 
          }))
        }
        
        // Update all vertex markers to reflect new positions (ensures they're synced)
        finalLatlngs.forEach((ll: L.LatLng, idx: number) => {
          if (vertexMarkers[idx] && idx !== index) {
            vertexMarkers[idx].setLatLng(ll)
          }
        })
        
        dragOffsetRef.current = null
      })
      
      vertexMarkers.push(marker)
    })
    
    vertexMarkersRef.current.set(polygonId, vertexMarkers)
  }
  
  // Function to hide all vertex markers
  const hideAllVertexMarkers = (map: L.Map) => {
    vertexMarkersRef.current.forEach((markers) => {
      markers.forEach(marker => map.removeLayer(marker))
    })
    vertexMarkersRef.current.clear()
  }
  
  // Debug: log when dependencies change
  useEffect(() => {
  }, [mapLoaded, mapId, userId, mapInstance])
  
  return { 
    polygonLayersRef,
    unsavedPolygonsRef,
    saveAllUnsavedPolygons: () => saveAllUnsavedPolygons(
      mapInstance, 
      vertexMarkersRef, 
      polygonLayersRef, 
      unsavedPolygonsRef, 
      onPolygonEdit
    )
  }
}

