/**
 * Utility functions for formatting addresses
 */

/**
 * Shortens a detailed address to a more concise format
 * Removes redundant administrative levels and keeps essential information
 */
export function shortenAddress(address: string): string {
  if (!address) return ''
  
  // Split by comma to analyze parts
  const parts = address.split(',').map(part => part.trim())
  
  if (parts.length <= 3) {
    // Already short enough
    return address
  }
  
  // Common patterns to remove or simplify
  const patternsToRemove = [
    // Remove administrative levels
    /Agglomération de (.+)/i,
    /(.+) \(région administrative\)/i,
    /(.+) \(province\)/i,
    /(.+) \(state\)/i,
    /(.+) \(county\)/i,
    /(.+) \(municipality\)/i,
    
    // Remove redundant country info
    /Canada$/i,
    /United States$/i,
    /USA$/i,
    
    // Remove postal codes at the end
    /\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i, // Canadian postal code
    /\s+\d{5}(-\d{4})?$/i, // US ZIP code
  ]
  
  // Clean up each part
  let cleanedParts = parts.map(part => {
    let cleaned = part
    
    // Apply removal patterns
    patternsToRemove.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '$1').trim()
    })
    
    return cleaned
  }).filter(part => part.length > 0)
  
  // Remove duplicates (case-insensitive)
  const uniqueParts: string[] = []
  const seen = new Set<string>()
  
  for (const part of cleanedParts) {
    const lowerPart = part.toLowerCase()
    if (!seen.has(lowerPart)) {
      seen.add(lowerPart)
      uniqueParts.push(part)
    }
  }
  
  // If we still have too many parts, keep only the first few
  if (uniqueParts.length > 4) {
    // Keep: street, city, province/state, country (if not Canada/US)
    const result = uniqueParts.slice(0, 3)
    
    // Add country only if it's not Canada or US
    const lastPart = uniqueParts[uniqueParts.length - 1]
    if (lastPart && !/canada|united states|usa/i.test(lastPart)) {
      result.push(lastPart)
    }
    
    return result.join(', ')
  }
  
  return uniqueParts.join(', ')
}

/**
 * Formats an address for display in marker popups
 * Uses a more aggressive shortening for popups
 */
export function formatAddressForPopup(address: string): string {
  if (!address) return ''
  
  const shortened = shortenAddress(address)
  
  // For popups, be even more aggressive
  const parts = shortened.split(',').map(part => part.trim())
  
  if (parts.length <= 2) {
    return shortened
  }
  
  // For popups, typically show: street + city, province
  // Or: street + city if province is obvious (like QC for Montreal)
  if (parts.length >= 3) {
    const street = parts[0]
    const city = parts[1]
    const province = parts[2]
    
    // If it's Quebec and city is Montreal, we can skip province
    if (/montréal|montreal/i.test(city) && /qc|québec|quebec/i.test(province)) {
      return `${street}, ${city}`
    }
    
    // Otherwise show street, city, province
    return `${street}, ${city}, ${province}`
  }
  
  return shortened
}

/**
 * Formats an address for display in sidebar lists
 * Uses moderate shortening for lists
 */
export function formatAddressForList(address: string): string {
  if (!address) return ''
  
  const shortened = shortenAddress(address)
  
  // For lists, show a bit more detail than popups but less than full
  const parts = shortened.split(',').map(part => part.trim())
  
  if (parts.length <= 3) {
    return shortened
  }
  
  // For lists, show: street + city + province
  return parts.slice(0, 3).join(', ')
}
