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
}

export const usePolygonLoader = ({ mapInstance, mapLoaded, userId, mapId, activeTab }: UsePolygonLoaderProps) => {
  const polygonLayersRef = useRef(new globalThis.Map<string, L.Layer>())
  const lastLoadedMapIdRef = useRef<string>('')
  const lastMapInstanceRef = useRef<L.Map | null>(null)
  const lastActiveTabRef = useRef<string>('')

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

    // ALWAYS reload when instance or tab changes
    if (instanceChanged || tabChanged || mapIdChanged) {
      console.log('🔷 Force reload - clearing polygons')
      polygonLayersRef.current.clear()
    }

    const loadPolygons = async () => {
      try {
        const { getMapPolygons } = await import('../firebase/maps')
        const polygons = await getMapPolygons(userId, mapId)
        console.log('🔷 Loaded polygons:', polygons.length, 'for map:', mapId)

        // If switching maps (not just tabs), remove old polygon layers
        if (mapIdChanged && lastLoadedMapIdRef.current) {
          console.log('🔷 Clearing old polygon layers from previous map')
          const prevInstance = lastMapInstanceRef.current
          if (prevInstance) {
            polygonLayersRef.current.forEach((layer: L.Layer) => {
              if (prevInstance.hasLayer(layer)) {
                prevInstance.removeLayer(layer)
              }
            })
          }
        }

        // Render each polygon
        polygons.forEach((polygon: PolygonDocument) => {
          if (!polygon.visible || !mapInstance) return

          // If instance or tab changed, always render new polygons
          // Skip only if SAME instance/tab and polygon already rendered
          if (!instanceChanged && !tabChanged) {
            const existingLayer = polygonLayersRef.current.get(polygon.id || '')
            if (existingLayer && mapInstance.hasLayer(existingLayer)) {
              console.log('🔷 Polygon already on map:', polygon.id)
              return  // Skip this polygon in forEach
            }
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

            // Add popup and render
            if (layer && mapInstance) {
              layer.bindPopup(`
                <div>
                  <h3>${polygon.name}</h3>
                  ${polygon.description ? `<p>${polygon.description}</p>` : ''}
                </div>
              `)
              
              layer.addTo(mapInstance)
              polygonLayersRef.current.set(polygon.id || '', layer)
              console.log('🔷 Rendered polygon:', polygon.id)
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

    // Only load if we have all required data - load immediately, no delay
    if (mapInstance && userId && mapId) {
      console.log('🔷 Loading polygons immediately')
      loadPolygons()
    }
  }, [mapLoaded, mapId, userId, mapInstance, activeTab])
  
  // Debug: log when dependencies change
  useEffect(() => {
    console.log('🔷 usePolygonLoader dependencies changed:', { mapLoaded, mapId, userId, hasInstance: !!mapInstance })
  }, [mapLoaded, mapId, userId, mapInstance])
  
  return polygonLayersRef
}

