
export interface RenameResult {
  originalName: string
  renamedName: string
  confidence: number
  method: 'mapbox' | 'pattern' | 'business_detection' | 'fallback'
  source: string
}




// Main rename function - VERY CONSERVATIVE, ONLY OBVIOUS CODES
export async function renameBusinessMarker(
  originalName: string, 
  _address: string, 
  _lat?: number, 
  _lng?: number
): Promise<RenameResult> {
  // ONLY rename obvious Quebec business codes, never proper business names
  const quebecBusinessCodes: Record<string, string> = {
    'UPX': 'Uniprix',
    'FM': 'Familiprix', 
    'JC': 'Jean Coutu',
    'PHX': 'Pharmaprix',
    'BRU': 'Brunet'
  }
  
  // Check for Quebec business codes ONLY
  const normalizedName = originalName.toUpperCase().trim()
  for (const [code, businessName] of Object.entries(quebecBusinessCodes)) {
    // Only match if it's clearly a code (starts with code or is just the code)
    if (normalizedName === code || normalizedName.startsWith(code + ' ')) {
      return {
        originalName,
        renamedName: businessName,
        confidence: 95,
        method: 'pattern',
        source: `Quebec business code: ${code}`
      }
    }
  }
  
  // NEVER rename proper business names - return original
  return {
    originalName,
    renamedName: originalName,
    confidence: 0,
    method: 'fallback',
    source: 'Not a Quebec business code'
  }
}

// Batch rename function for multiple markers
export async function renameBusinessMarkers(
  markers: Array<{ name: string; address: string; lat: number; lng: number }>
): Promise<RenameResult[]> {
  const results: RenameResult[] = []
  
  // Process markers with a small delay to avoid rate limiting
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]
    
    // Add delay between requests (except for the first one)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    try {
      const result = await renameBusinessMarker(marker.name, marker.address, marker.lat, marker.lng)
      results.push(result)
    } catch (error) {
      console.error(`Failed to rename marker ${marker.name}:`, error)
      results.push({
        originalName: marker.name,
        renamedName: marker.name,
        confidence: 0,
        method: 'fallback',
        source: 'Error during processing'
      })
    }
  }
  
  return results
}
