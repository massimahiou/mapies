// import * as L from 'leaflet' // Not currently used
import { MAPBOX_CONFIG } from '../config/mapbox'

export interface BoundaryResult {
  success: boolean
  type: 'city' | 'postal_code'
  name: string
  coordinates: Array<{lat: number, lng: number}>
  error?: string
}

// Generate polygon using Mapbox Boundaries API (preferred method)
export const generatePolygonWithMapbox = async (
  input: string,
  type: 'city' | 'postal_code'
): Promise<BoundaryResult> => {
  try {
    console.log(`🗺️ Using Mapbox to search for ${type}:`, input)
    
    const token = MAPBOX_CONFIG.ACCESS_TOKEN
    const searchQuery = type === 'city' 
      ? input 
      : input.replace(/\s+/g, '') // Remove space from postal code for Mapbox
    
    // Step 1: Geocode to find the location and get boundary ID
    const geocodeUrl = `${MAPBOX_CONFIG.GEOCODING_API_URL}/${encodeURIComponent(searchQuery)}.json?access_token=${token}&country=ca&limit=1`
    
    console.log('🔍 Step 1: Geocoding with Mapbox...')
    const geocodeResponse = await fetch(geocodeUrl)
    
    if (!geocodeResponse.ok) {
      throw new Error(`Mapbox Geocoding failed: ${geocodeResponse.status}`)
    }
    
    const geocodeData = await geocodeResponse.json()
    console.log('📍 Geocode results:', geocodeData)
    
    if (!geocodeData.features || geocodeData.features.length === 0) {
      return {
        success: false,
        type,
        name: input,
        coordinates: [],
        error: 'Location not found'
      }
    }
    
    const feature = geocodeData.features[0]
    const placeName = feature.place_name
    const coordinates = feature.geometry.coordinates // [lng, lat]
    
    console.log('✅ Found location:', placeName)
    console.log('📍 Coordinates:', coordinates)
    
    // Check if this feature has a boundary (admin boundaries)
    let boundaryId = null
    
    // Look for boundary metadata in feature properties
    const props = feature.properties
    if (props && (props.wikidata || props.maki === 'border' || props.category === 'administrative')) {
      // Try to use the OSM ID or other identifier
      boundaryId = props.osm_id || props.mapbox_id
    }
    
    // If no boundary ID, check for admin hierarchy
    const context = feature.context || []
    for (const ctx of context) {
      if (ctx.short_code && (ctx.id.includes('place') || ctx.id.includes('postcode'))) {
        boundaryId = ctx.id
        break
      }
    }
    
    console.log('🗺️ Boundary ID:', boundaryId)
    
    // Step 2: Get boundary polygon if available
    if (boundaryId && boundaryId.includes('place') || boundaryId && boundaryId.includes('postcode')) {
      try {
        const boundaryUrl = `https://api.mapbox.com/v4/${boundaryId}.json?access_token=${token}`
        console.log('🔍 Step 2: Fetching boundary polygon...')
        
        const boundaryResponse = await fetch(boundaryUrl)
        
        if (boundaryResponse.ok) {
          const boundaryData = await boundaryResponse.json()
          console.log('✅ Got boundary data')
          
          // Extract coordinates from boundary geometry
          if (boundaryData && boundaryData.geometry && boundaryData.geometry.coordinates) {
            const coords: Array<{lat: number, lng: number}> = []
            
            // Handle different geometry types
            const geom = boundaryData.geometry
            if (geom.type === 'Polygon' && Array.isArray(geom.coordinates[0])) {
              geom.coordinates[0].forEach((point: [number, number]) => {
                coords.push({ lat: point[1], lng: point[0] })
              })
            } else if (geom.type === 'MultiPolygon') {
              // Take first polygon
              geom.coordinates[0][0].forEach((point: [number, number]) => {
                coords.push({ lat: point[1], lng: point[0] })
              })
            }
            
            if (coords.length > 0) {
              console.log('✅ Extracted', coords.length, 'coordinates from boundary')
              return {
                success: true,
                type,
                name: placeName,
                coordinates: coords
              }
            }
          }
        }
      } catch (boundaryError) {
        console.warn('⚠️ Could not fetch boundary, using point with radius:', boundaryError)
      }
    }
    
    // Step 3: Fallback - create circular boundary around point
    console.log('ℹ️ No boundary found, creating circular area')
    const [lng, lat] = coordinates
    const coords = generateCirclePoints(lat, lng, type === 'postal_code' ? 1000 : 5000)
    
    return {
      success: true,
      type,
      name: placeName,
      coordinates: coords
    }
    
  } catch (error) {
    console.error('❌ Error with Mapbox:', error)
    return {
      success: false,
      type,
      name: input,
      coordinates: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Fetch city or postal code boundaries from OpenStreetMap Overpass API
export const generatePolygonFromLocation = async (
  input: string,
  type: 'city' | 'postal_code'
): Promise<BoundaryResult> => {
  try {
    console.log(`🔍 Fetching boundaries for ${type}: ${input}`)
    
    if (type === 'postal_code') {
      return await fetchPostalCodeBoundary(input)
    } else {
      return await fetchCityBoundary(input)
    }
  } catch (error) {
    console.error('Error generating polygon:', error)
    return {
      success: false,
      type,
      name: input,
      coordinates: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Fetch postal code boundary using Nominatim
const fetchPostalCodeBoundary = async (postalCode: string): Promise<BoundaryResult> => {
  try {
    // First, geocode the postal code to get location
    const searchUrl = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&countrycodes=ca&format=json&limit=1`
    
    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) {
      throw new Error('Failed to search postal code')
    }
    
    const searchData = await searchResponse.json()
    if (searchData.length === 0) {
      return {
        success: false,
        type: 'postal_code',
        name: postalCode,
        coordinates: [],
        error: 'Postal code not found'
      }
    }
    
    const { lat, lon, display_name } = searchData[0]
    
    // Use Overpass API to get postal code boundary
    const overpassUrl = 'https://overpass-api.de/api/interpreter'
    const query = `
      [out:json];
      (
        relation["postal_code"="${postalCode}"]["place"="postcode"];
        way["postal_code"="${postalCode}"]["place"="postcode"];
        relation["boundary"="postal_code"]["ref"="${postalCode}"];
      );
      out geom;
    `
    
    const overpassResponse = await fetch(overpassUrl, {
      method: 'POST',
      body: query
    })
    
    if (!overpassResponse.ok) {
      // If Overpass fails, create a small circle around the location
      return {
        success: true,
        type: 'postal_code',
        name: display_name,
        coordinates: generateCirclePoints(parseFloat(lat), parseFloat(lon), 2000) // 2km radius
      }
    }
    
    const overpassData = await overpassResponse.json()
    const coordinates = extractCoordinatesFromOverpass(overpassData)
    
    if (coordinates.length > 0) {
      return {
        success: true,
        type: 'postal_code',
        name: display_name,
        coordinates
      }
    }
    
    // Fallback: create circle
    return {
      success: true,
      type: 'postal_code',
      name: display_name,
      coordinates: generateCirclePoints(parseFloat(lat), parseFloat(lon), 2000)
    }
    
  } catch (error) {
    console.error('Error fetching postal code boundary:', error)
    throw error
  }
}

// Fetch city boundary using Nominatim
const fetchCityBoundary = async (cityName: string): Promise<BoundaryResult> => {
  try {
    // Search for the city
    const searchUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&countrycodes=ca&format=json&limit=1`
    
    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) {
      throw new Error('Failed to search city')
    }
    
    const searchData = await searchResponse.json()
    if (searchData.length === 0) {
      return {
        success: false,
        type: 'city',
        name: cityName,
        coordinates: [],
        error: 'City not found'
      }
    }
    
    const { place_id, display_name } = searchData[0]
    
    // Get detailed information including boundary
    // Note: Using Overpass API instead of Nominatim details endpoint
    // const detailsUrl = `https://nominatim.openstreetmap.org/details?osmtype=R&osmid=${place_id}&format=json`
    // const detailsResponse = await fetch(detailsUrl)
    
    // Get boundary using Overpass API
    const overpassUrl = 'https://overpass-api.de/api/interpreter'
    const query = `
      [out:json];
      relation(id:${place_id});
      out geom;
    `
    
    const overpassResponse = await fetch(overpassUrl, {
      method: 'POST',
      body: query
    })
    
    if (!overpassResponse.ok) {
      throw new Error('Failed to get boundary from Overpass')
    }
    
    const overpassData = await overpassResponse.json()
    const coordinates = extractCoordinatesFromOverpass(overpassData)
    
    if (coordinates.length > 0) {
      return {
        success: true,
        type: 'city',
        name: display_name,
        coordinates
      }
    }
    
    // Fallback: create approximate city bounds as circle
    const { lat, lon } = searchData[0]
    return {
      success: true,
      type: 'city',
      name: display_name,
      coordinates: generateCirclePoints(parseFloat(lat), parseFloat(lon), 10000) // 10km radius
    }
    
  } catch (error) {
    console.error('Error fetching city boundary:', error)
    throw error
  }
}

// Extract coordinates from Overpass API response
const extractCoordinatesFromOverpass = (data: any): Array<{lat: number, lng: number}> => {
  const coordinates: Array<{lat: number, lng: number}> = []
  
  if (data.elements && data.elements.length > 0) {
    const element = data.elements[0]
    
    if (element.geometry) {
      // Geometry format: [[lat, lng], [lat, lng], ...]
      element.geometry.forEach((point: any) => {
        if (point.lat && point.lon) {
          coordinates.push({ lat: point.lat, lng: point.lon })
        }
      })
    }
  }
  
  return coordinates
}

// Generate circle points for fallback boundaries
const generateCirclePoints = (centerLat: number, centerLng: number, radiusMeters: number): Array<{lat: number, lng: number}> => {
  const points: Array<{lat: number, lng: number}> = []
  const numPoints = 32 // Number of points to create a smooth circle
  
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI
    const latOffset = (radiusMeters / 111000) * Math.cos(angle) // ~111km per degree latitude
    const lngOffset = (radiusMeters / 111000) * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180)
    
    points.push({
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset
    })
  }
  
  return points
}

// Optimized simplified version - tries Mapbox first, falls back to Nominatim
export const generateSimplifiedPolygon = async (
  input: string,
  type: 'city' | 'postal_code'
): Promise<BoundaryResult> => {
  try {
    console.log(`🔍 Searching for ${type}:`, input)
    
    // Try Mapbox first
    try {
      console.log('🗺️ Attempting with Mapbox first...')
      const mapboxResult = await generatePolygonWithMapbox(input, type)
      if (mapboxResult.success) {
        console.log('✅ Mapbox succeeded')
        return mapboxResult
      }
      console.log('⚠️ Mapbox failed, trying Nominatim fallback')
    } catch (mapboxError) {
      console.warn('⚠️ Mapbox error, trying Nominatim:', mapboxError)
    }
    
    // Fallback to Nominatim
    console.log('🔍 Falling back to Nominatim...')
    
    let searchQuery = ''
    let url = ''
    let result: any = null
    
    if (type === 'postal_code') {
      // For postal codes, try multiple search strategies
      const cleanPostalCode = input.trim().toUpperCase().replace(/\s+/g, ' ')
      
      // Strategy 1: Try with format "A1A 1A1" (Canadian standard)
      searchQuery = `postalcode=${encodeURIComponent(cleanPostalCode)}&countrycodes=ca`
      url = `https://nominatim.openstreetmap.org/search?${searchQuery}&format=json&limit=5&polygon_geojson=1&addressdetails=1`
      
      console.log('🔍 Try 1: Searching with formatted postal code')
      let response = await fetch(url, {
        headers: {
          'User-Agent': 'Pinz Map App - pinz.app'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Nominatim error: ${response.status}`)
      }
      
      let data = await response.json()
      
      // If no results, try without country filter
      if (data.length === 0) {
        console.log('🔍 Try 2: Searching without country filter')
        url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleanPostalCode)}&format=json&limit=5&polygon_geojson=1&addressdetails=1`
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Pinz Map App - pinz.app'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Nominatim error: ${response.status}`)
        }
        
        data = await response.json()
      }
      
      // If still no results, try alternative format without space
      if (data.length === 0 && cleanPostalCode.includes(' ')) {
        const noSpaceCode = cleanPostalCode.replace(/\s+/g, '')
        console.log('🔍 Try 3: Searching without space:', noSpaceCode)
        url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(noSpaceCode)}&format=json&limit=5&polygon_geojson=1&addressdetails=1`
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Pinz Map App - pinz.app'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Nominatim error: ${response.status}`)
        }
        
        data = await response.json()
      }
      
      if (data.length === 0) {
        console.log('❌ No results found for postal code')
        return {
          success: false,
          type,
          name: input,
          coordinates: [],
          error: 'Postal code not found'
        }
      }
      
      // Pick the best result (prefer results that have the postal code in the returned address)
      if (!data || data.length === 0) {
        throw new Error('No data returned from Nominatim')
      }
      
      result = data[0]
      console.log('✅ Found', data.length, 'potential matches')
      
      if (!result) {
        throw new Error('First result is null/undefined')
      }
      
      // If multiple results, prefer one that matches the postal code closely
      const exactMatch = data.find((item: any) => 
        item && item.display_name?.toUpperCase().includes(cleanPostalCode.replace(/\s+/g, ''))
      )
      if (exactMatch) {
        result = exactMatch
        console.log('✅ Using exact match')
      } else {
        console.log('ℹ️ Using first result:', result?.display_name || 'Unknown')
      }
      
    } else {
      // For cities, use standard search
      searchQuery = `city=${encodeURIComponent(input)}&countrycodes=ca`
      url = `https://nominatim.openstreetmap.org/search?${searchQuery}&format=json&limit=1&polygon_geojson=1&addressdetails=1`
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Pinz Map App - pinz.app'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Nominatim error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.length === 0) {
        console.log('❌ City not found')
        return {
          success: false,
          type,
          name: input,
          coordinates: [],
          error: 'Location not found'
        }
      }
      
      result = data[0]
    }
    
    if (!result) {
      console.error('❌ Result is null after processing')
      return {
        success: false,
        type,
        name: input,
        coordinates: [],
        error: 'Invalid data received from Nominatim'
      }
    }
    
    console.log('📋 Result:', {
      name: result.display_name,
      hasGeojson: !!result.geojson,
      bbox: result.boundingbox
    })
    
    const coordinates: Array<{lat: number, lng: number}> = []
    
    // Extract coordinates from GeoJSON polygon
    if (result.geojson && result.geojson.coordinates) {
      console.log('✅ Using GeoJSON polygon')
      console.log('GeoJSON type:', result.geojson.type)
      console.log('GeoJSON coords structure:', result.geojson.coordinates)
      
      try {
        // Handle different GeoJSON geometries
        const coords = result.geojson.coordinates
        
        // For Polygon: coordinates is [[[lng, lat], ...]] - first element is outer ring
        if (result.geojson.type === 'Polygon' && Array.isArray(coords[0])) {
          const firstRing = coords[0]
          if (Array.isArray(firstRing) && firstRing.length > 0 && Array.isArray(firstRing[0])) {
            firstRing.forEach((point: any) => {
              if (Array.isArray(point) && point.length >= 2) {
                coordinates.push({ lat: point[1], lng: point[0] })
              }
            })
          }
        }
        // For MultiPolygon: coordinates is [[[[lng, lat], ...]]] - first polygon, first ring
        else if (result.geojson.type === 'MultiPolygon' && Array.isArray(coords[0])) {
          const firstPolygon = coords[0]
          if (Array.isArray(firstPolygon) && Array.isArray(firstPolygon[0])) {
            const firstRing = firstPolygon[0]
            if (Array.isArray(firstRing) && Array.isArray(firstRing[0])) {
              firstRing.forEach((point: any) => {
                if (Array.isArray(point) && point.length >= 2) {
                  coordinates.push({ lat: point[1], lng: point[0] })
                }
              })
            }
          }
        }
        // Fallback: try to extract as simple array
        else if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
          coords[0].forEach((point: any) => {
            if (Array.isArray(point) && point.length >= 2) {
              coordinates.push({ lat: point[1], lng: point[0] })
            }
          })
        }
        
        console.log('✅ Extracted', coordinates.length, 'coordinates from GeoJSON')
      } catch (error) {
        console.warn('⚠️ Error parsing GeoJSON, using bounding box fallback:', error)
        // Will fall through to bounding box below
      }
    }
    
    // Use bounding box as fallback if no coordinates extracted
    if (coordinates.length === 0) {
      // Use bounding box as fallback
      console.log('⚠️ Using bounding box fallback (rectangular area)')
      const bbox = result.boundingbox || []
      if (bbox.length === 4) {
        const [minLat, maxLat, minLon, maxLon] = bbox
        const bounds = {
          minLat: parseFloat(minLat),
          maxLat: parseFloat(maxLat),
          minLon: parseFloat(minLon),
          maxLon: parseFloat(maxLon)
        }
        
        // Create a rectangle from bounding box
        coordinates.push(
          { lat: bounds.minLat, lng: bounds.minLon },
          { lat: bounds.maxLat, lng: bounds.minLon },
          { lat: bounds.maxLat, lng: bounds.maxLon },
          { lat: bounds.minLat, lng: bounds.maxLon },
          { lat: bounds.minLat, lng: bounds.minLon } // close polygon
        )
        
        console.log('📍 Bounding box area created')
      }
    }
    
    console.log('✅ Generated', coordinates.length, 'coordinates for:', result.display_name)
    
    return {
      success: true,
      type,
      name: result.display_name,
      coordinates
    }
    
  } catch (error) {
    console.error('❌ Error generating simplified polygon:', error)
    return {
      success: false,
      type,
      name: input,
      coordinates: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

