// Utility functions for detecting duplicate addresses

export interface AddressData {
  name: string
  address: string
  lat?: number
  lng?: number
}

export interface DuplicateCheckResult {
  unique: AddressData[]
  duplicates: AddressData[]
  duplicateCount: number
}

/**
 * Check for duplicate addresses based on normalized address comparison
 * @param newAddresses - Array of new addresses to check
 * @param existingAddresses - Array of existing addresses to compare against
 * @returns Object containing unique addresses, duplicates, and count
 */
export const checkForDuplicates = (
  newAddresses: AddressData[],
  existingAddresses: AddressData[]
): DuplicateCheckResult => {
  // Normalize address for comparison (remove extra spaces, convert to lowercase)
  const normalizeAddress = (address: string): string => {
    return address
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s,.-]/g, '') // Remove special characters except basic punctuation
  }

  // Create a set of existing normalized addresses for quick lookup
  const existingNormalized = new Set(
    existingAddresses.map(addr => normalizeAddress(addr.address))
  )

  const unique: AddressData[] = []
  const duplicates: AddressData[] = []

  for (const newAddr of newAddresses) {
    const normalizedNew = normalizeAddress(newAddr.address)
    
    if (existingNormalized.has(normalizedNew)) {
      duplicates.push(newAddr)
    } else {
      unique.push(newAddr)
      // Add to set to avoid duplicates within the new addresses themselves
      existingNormalized.add(normalizedNew)
    }
  }

  return {
    unique,
    duplicates,
    duplicateCount: duplicates.length
  }
}

/**
 * Check for duplicates within a single array (for CSV uploads)
 * @param addresses - Array of addresses to check for internal duplicates
 * @returns Object containing unique addresses, duplicates, and count
 */
export const checkForInternalDuplicates = (addresses: AddressData[]): DuplicateCheckResult => {
  const seen = new Set<string>()
  const unique: AddressData[] = []
  const duplicates: AddressData[] = []

  for (const addr of addresses) {
    const normalized = addr.address
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s,.-]/g, '')

    if (seen.has(normalized)) {
      duplicates.push(addr)
    } else {
      seen.add(normalized)
      unique.push(addr)
    }
  }

  return {
    unique,
    duplicates,
    duplicateCount: duplicates.length
  }
}







