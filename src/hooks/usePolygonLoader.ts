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

        // If switching maps (not just tabs), remove old polygon layers
        if (mapIdChanged && lastLoadedMapIdRef.current && lastMapInstanceRef.current !== null) {
          console.log('🔷 Clearing old polygon layers from previous map')
          const previousInstance = lastMapInstanceRef.current
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
              
              // Add click handler for edit button - enable Leaflet.draw editing
              if (layer instanceof L.Polygon && mapInstance && layer !== null) {
                const polygonLayer = layer
                polygonLayer.on('popupopen', () => {
                  // Remove any existing listeners to avoid duplicates
                  const existingBtn = document.querySelector(`.edit-polygon-btn[data-polygon-id="${polygonId}"]`)
                  
                  if (existingBtn) {
                    existingBtn.addEventListener('click', (e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      console.log('🔷 Edit button clicked for polygon:', polygonId)
                      
                      // Close popup
                      polygonLayer.closePopup()
                      
                      // Add to FeatureGroup and trigger edit mode
                      if (drawnItemsRef.current && mapInstance && polygonLayer) {
                        // Ensure layer is in FeatureGroup
                        if (!drawnItemsRef.current.hasLayer(polygonLayer)) {
                          drawnItemsRef.current.addLayer(polygonLayer)
                        }
                        
                        // Trigger Leaflet.draw edit handler directly
                        // Find the edit toolbar button and click it
                        setTimeout(() => {
                          // Use Leaflet.Draw's edit handler directly
                          try {
                            const editHandler = new (L as any).Draw.PolyEdit(mapInstance, polygonLayer, {
                              allowIntersection: false
                            })
                            editHandler.enable()
                            console.log('🔷 Enabled edit handler for polygon')
                          } catch (err) {
                            console.error('Error enabling edit handler:', err)
                          }
                        }, 200)
                      }
                    })
                  }
                })
              }
              
              // Add to FeatureGroup for editing capability (Leaflet.draw requirement)
              if (drawnItemsRef.current && layer && !drawnItemsRef.current.hasLayer(layer)) {
                drawnItemsRef.current.addLayer(layer)
              }
              
              layer.addTo(mapInstance)
              polygonLayersRef.current.set(polygonId, layer)
              console.log('🔷 Rendered polygon:', polygonId)
              
              // Make polygon immediately editable using Leaflet.draw
              if (layer instanceof L.Polygon && mapInstance) {
                // Initialize edit handler for this polygon
                try {
                  const editHandler = new (L as any).Draw.PolyEdit(mapInstance, layer, {
                    allowIntersection: false
                  })
                  
                  // Store the handler on the layer
                  ;(layer as any)._editHandler = editHandler
                  
                  // Enable editing by default
                  editHandler.enable()
                  console.log('🔷 Enabled auto-edit for polygon:', polygonId)
                } catch (err) {
                  console.error('Error enabling auto-edit for polygon:', err)
                }
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
  
  // Debug: log when dependencies change
  useEffect(() => {
    console.log('🔷 usePolygonLoader dependencies changed:', { mapLoaded, mapId, userId, hasInstance: !!mapInstance })
  }, [mapLoaded, mapId, userId, mapInstance])
  
  return polygonLayersRef
}

