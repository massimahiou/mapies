/**
 * Utility functions for validating coordinates and geocoding permissions
 */

export interface CoordinateValidationResult {
  isValid: boolean
  lat?: number
  lng?: number
  error?: string
}

/**
 * Validates if a coordinate string is a valid latitude/longitude
 * Rejects addresses and non-numeric strings
 */
export const validateCoordinate = (value: string | number): CoordinateValidationResult => {
  // If it's already a number, validate it
  if (typeof value === 'number') {
    if (isNaN(value)) {
      return {
        isValid: false,
        error: 'Invalid number format'
      }
    }
    return {
      isValid: true,
      lat: value
    }
  }
  
  const str = value.toString().trim()
  
  // Check if the string contains non-numeric characters (indicating it's an address)
  // Allow only numbers, decimal points, minus signs, and spaces
  const numericPattern = /^-?\d*\.?\d+$/
  if (!numericPattern.test(str)) {
    return {
      isValid: false,
      error: 'Address detected instead of coordinate. Please provide numeric coordinates only.'
    }
  }
  
  const num = parseFloat(str)
  
  if (isNaN(num)) {
    return {
      isValid: false,
      error: 'Invalid number format'
    }
  }
  
  return {
    isValid: true,
    lat: num
  }
}

/**
 * Validates latitude range (-90 to 90)
 */
export const validateLatitude = (lat: string | number): CoordinateValidationResult => {
  const result = validateCoordinate(lat)
  
  if (!result.isValid) {
    return result
  }
  
  const latitude = result.lat!
  
  if (latitude < -90 || latitude > 90) {
    return {
      isValid: false,
      error: `Latitude must be between -90 and 90, got ${latitude}`
    }
  }
  
  return {
    isValid: true,
    lat: latitude
  }
}

/**
 * Validates longitude range (-180 to 180)
 */
export const validateLongitude = (lng: string | number): CoordinateValidationResult => {
  const result = validateCoordinate(lng)
  
  if (!result.isValid) {
    return result
  }
  
  const longitude = result.lat! // Using lat field for consistency
  
  if (longitude < -180 || longitude > 180) {
    return {
      isValid: false,
      error: `Longitude must be between -180 and 180, got ${longitude}`
    }
  }
  
  return {
    isValid: true,
    lng: longitude
  }
}

/**
 * Validates both latitude and longitude together
 */
export const validateCoordinates = (lat: string | number, lng: string | number): CoordinateValidationResult => {
  const latResult = validateLatitude(lat)
  if (!latResult.isValid) {
    return latResult
  }
  
  const lngResult = validateLongitude(lng)
  if (!lngResult.isValid) {
    return lngResult
  }
  
  return {
    isValid: true,
    lat: latResult.lat,
    lng: lngResult.lng
  }
}

/**
 * Checks if a user has geocoding permissions
 */
export const checkGeocodingPermission = (hasGeocoding: boolean, hasCoordinates: boolean): boolean => {
  // If user has geocoding access, they can always proceed
  if (hasGeocoding) {
    return true
  }
  
  // If user doesn't have geocoding access, they must provide coordinates
  return hasCoordinates
}

/**
 * Logs security violations for monitoring
 */
export const logSecurityViolation = (userId: string, violation: string, details: any) => {
  console.warn(`🚨 SECURITY VIOLATION - User: ${userId}, Violation: ${violation}`, details)
  
  // In production, you might want to send this to a monitoring service
  // Example: sendToMonitoringService({ userId, violation, details, timestamp: new Date() })
}
