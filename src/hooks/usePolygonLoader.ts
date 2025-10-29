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

export const usePolygonLoader = ({ mapInstance, mapLoaded, userId, mapId, activeTab, onPolygonEdit }: UsePolygonLoaderProps) => {
  const polygonLayersRef = useRef(new globalThis.Map<string, L.Layer>())
  const lastLoadedMapIdRef = useRef<string>('')
  const lastMapInstanceRef = useRef<L.Map | null>(null)
  const lastActiveTabRef = useRef<string>('')
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const vertexMarkersRef = useRef(new globalThis.Map<string, L.Marker[]>()) // polygonId -> array of vertex markers
  const editModeEnabledRef = useRef(false)

  useEffect(() => {
    if (!mapLoaded || !mapInstance || !userId || !mapId) {
      console.log('🔷 Polygon loader conditions:', { mapLoaded, hasInstance: !!mapInstance, userId, mapId })
      return
    }

    // Check if the map instance changed (map was recreated)
    const instanceChanged = lastMapInstanceRef.current !== mapInstance
    const mapIdChanged = lastLoadedMapIdRef.current !== mapId
    const tabChanged = lastActiveTabRef.current !== activeTab
    
    console.log('🔷 Polygon loader check:', { 
      instanceChanged, 
      mapIdChanged,
      tabChanged,
      lastTab: lastActiveTabRef.current,
      currentTab: activeTab,
      lastMapInstance: !!lastMapInstanceRef.current,
      currentInstance: !!mapInstance,
      hasPolygons: polygonLayersRef.current.size > 0
    })

    // ALWAYS reload if instance changed (tab switch recreated map) or tab changed
    if (instanceChanged || tabChanged) {
      console.log('🔷 Force reload - instance or tab changed')
      polygonLayersRef.current.clear()
    }

    const loadPolygons = async () => {
      try {
        const { getMapPolygons } = await import('../firebase/maps')
        const polygons = await getMapPolygons(userId, mapId)
        console.log('🔷 Loaded polygons:', polygons.length, 'for map:', mapId)

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
          console.log('🔷 Clearing old polygon layers from previous map')
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

        // Render each polygon
        polygons.forEach((polygon: PolygonDocument) => {
          if (!polygon.visible || !mapInstance) return

          // Check if already rendered on current map instance
          const existingLayer = polygonLayersRef.current.get(polygon.id || '')
          if (existingLayer && mapInstance.hasLayer(existingLayer)) {
            console.log('🔷 Polygon already on map:', polygon.id)
            return
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
              const polygonId = polygon.id || ''
              ;(layer as any).polygonId = polygonId
              
              const popupContent = `
                <div class="text-sm">
                  <h3 class="font-semibold mb-1">${polygon.name}</h3>
                  ${polygon.description ? `<p class="text-gray-600">${polygon.description}</p>` : ''}
                  <button class="edit-polygon-btn mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600" data-polygon-id="${polygonId}">
                    ✏️ Edit Shape
                  </button>
                  <p class="text-xs text-gray-400 mt-1">Drag vertices to adjust</p>
                </div>
              `
              
              layer.bindPopup(popupContent)
              
              // Add to FeatureGroup for editing capability (Leaflet.draw requirement)
              if (drawnItemsRef.current && layer && !drawnItemsRef.current.hasLayer(layer)) {
                drawnItemsRef.current.addLayer(layer)
              }
              
              layer.addTo(mapInstance)
              polygonLayersRef.current.set(polygonId, layer)
              console.log('🔷 Rendered polygon:', polygonId)
              
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
                  console.log('🔷 Right-click on polygon, enabling edit mode')
                  
                  try {
                    // Use Leaflet.draw's edit handler
                    const editHandler = new (L as any).Draw.PolyEdit(mapInstance, layer, {
                      allowIntersection: false
                    })
                    ;(layer as any)._editHandler = editHandler
                    editHandler.enable()
                    
                    console.log('🔷 Edit handler enabled for polygon:', polygonId)
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
        console.log('🔷 Rendered', polygons.filter(p => p.visible).length, 'polygons on map')
      } catch (error) {
        console.error('Error loading polygons:', error)
      }
    }

    // Only load if we have all required data
    if (mapInstance && userId && mapId) {
      // Add a small delay when instance changes to ensure map is fully initialized
      if (instanceChanged) {
        console.log('🔷 Delaying polygon load to ensure map is ready')
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
      
      console.log('🔷 Edit mode toggled:', enabled)
      
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
      }
    }
    
    window.addEventListener('polygonEditModeToggle', handleEditModeToggle as EventListener)
    return () => {
      window.removeEventListener('polygonEditModeToggle', handleEditModeToggle as EventListener)
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
      // Create pink circular marker
      const pinkIcon = L.divIcon({
        className: 'pink-vertex-marker',
        html: `<div style="width: 12px; height: 12px; background-color: #ff1493; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
      
      const marker = L.marker(latlng, {
        icon: pinkIcon,
        draggable: true,
        zIndexOffset: 1000
      }).addTo(map)
      
      // Make marker draggable and update polygon on drag
      marker.on('drag', () => {
        // Get current polygon coordinates
        const currentLatlngs = polygon.getLatLngs()[0] as L.LatLng[]
        const newLatlng = marker.getLatLng()
        
        // Update the vertex at this index
        const updatedLatlngs = [...currentLatlngs]
        updatedLatlngs[index] = newLatlng
        
        // Update polygon shape
        polygon.setLatLngs([updatedLatlngs])
      })
      
      // Save polygon when drag ends
      marker.on('dragend', () => {
        const finalLatlngs = polygon.getLatLngs()[0] as L.LatLng[]
        const coordinates = finalLatlngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }))
        
        if (polygonId && onPolygonEdit) {
          onPolygonEdit(polygonId, coordinates)
        }
        
        // Update all vertex markers to reflect new positions (ensures they're synced)
        finalLatlngs.forEach((ll: L.LatLng, idx: number) => {
          if (vertexMarkers[idx] && idx !== index) {
            vertexMarkers[idx].setLatLng(ll)
          }
        })
      })
      
      vertexMarkers.push(marker)
    })
    
    vertexMarkersRef.current.set(polygonId, vertexMarkers)
    console.log('🔷 Created', vertexMarkers.length, 'pink vertex markers for polygon:', polygonId)
  }
  
  // Function to hide all vertex markers
  const hideAllVertexMarkers = (map: L.Map) => {
    vertexMarkersRef.current.forEach((markers) => {
      markers.forEach(marker => map.removeLayer(marker))
    })
    vertexMarkersRef.current.clear()
    console.log('🔷 Removed all vertex markers')
  }
  
  // Debug: log when dependencies change
  useEffect(() => {
    console.log('🔷 usePolygonLoader dependencies changed:', { mapLoaded, mapId, userId, hasInstance: !!mapInstance })
  }, [mapLoaded, mapId, userId, mapInstance])
  
  return polygonLayersRef
}

