// Unified marker creation utility
// Ensures all map components respect user settings consistently

export interface NameRule {
  id: string
  contains: string
  renameTo: string
}

export interface MapSettings {
  style: string
  markerShape: string
  markerColor: string
  markerSize: string
  markerBorder: string
  markerBorderWidth: number
  // Clustering settings
  clusteringEnabled: boolean
  clusterRadius: number
  // Search bar settings
  searchBarBackgroundColor: string
  searchBarTextColor: string
  searchBarHoverColor: string
  // Name rules settings
  nameRules: NameRule[]
}

export interface MarkerCreationOptions {
  mapSettings: MapSettings
  markerSize?: number // Optional override for specific contexts
  folderIconUrl?: string // Optional folder icon URL
}

// Apply name rules to marker name for display
export const applyNameRules = (originalName: string, nameRules: NameRule[], hasSmartGrouping: boolean = true): string => {
  if (!hasSmartGrouping || !nameRules || !Array.isArray(nameRules)) {
    return originalName
  }
  
  for (const rule of nameRules) {
    if (originalName.toLowerCase().includes(rule.contains.toLowerCase())) {
      return rule.renameTo
    }
  }
  return originalName
}

export interface MarkerHTML {
  html: string
  iconSize: [number, number]
  iconAnchor: [number, number]
}

// Unified size mapping - consistent across all components
const UNIFIED_SIZE_MAP = {
  small: 20,
  medium: 24,
  large: 28
}

// Create marker HTML that respects ALL user settings
export function createMarkerHTML(options: MarkerCreationOptions): MarkerHTML {
  const { mapSettings, markerSize: overrideSize, folderIconUrl } = options
  
  // Use override size if provided, otherwise use user setting
  const markerSize = overrideSize || UNIFIED_SIZE_MAP[mapSettings.markerSize as keyof typeof UNIFIED_SIZE_MAP] || 24
  
  // If folder icon is provided, use it instead of the default marker
  if (folderIconUrl) {
    const iconHtml = `<div style="width: ${markerSize}px; height: ${markerSize}px; background-image: url('${folderIconUrl}'); background-size: contain; background-repeat: no-repeat; background-position: center; cursor: pointer; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></div>`
    return {
      html: iconHtml,
      iconSize: [markerSize, markerSize],
      iconAnchor: [markerSize / 2, markerSize / 2]
    }
  }
  
  // Create border style based on user settings
  const borderStyle = mapSettings.markerBorder !== 'none' 
    ? `border: ${mapSettings.markerBorderWidth}px solid ${mapSettings.markerBorder};` 
    : ''
  
  // Create shape-specific styling
  let shapeStyle = ''
  let iconSize: [number, number] = [markerSize, markerSize]
  let iconAnchor: [number, number] = [markerSize / 2, markerSize / 2]
  
  switch (mapSettings.markerShape) {
    case 'square':
      shapeStyle = ''
      break
    case 'diamond':
      // Diamond requires special handling
      const diamondHtml = `<div style="width: 0; height: 0; border-left: ${markerSize/2}px solid transparent; border-right: ${markerSize/2}px solid transparent; border-bottom: ${markerSize}px solid ${mapSettings.markerColor}; border-top: 0; ${borderStyle} cursor: pointer; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></div>`
      return {
        html: diamondHtml,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize]
      }
    case 'circle':
    default:
      shapeStyle = 'border-radius: 50%;'
      break
  }
  
  // Create unified marker HTML
  const markerHtml = `
    <div style="
      width: ${markerSize}px; 
      height: ${markerSize}px; 
      background-color: ${mapSettings.markerColor}; 
      ${shapeStyle}
      ${borderStyle}
      cursor: pointer;
      transition: transform 0.2s ease;
    " 
    onmouseover="this.style.transform='scale(1.1)'" 
    onmouseout="this.style.transform='scale(1)'">
    </div>
  `
  
  return {
    html: markerHtml,
    iconSize,
    iconAnchor
  }
}

// Helper function to get consistent size mapping
export function getMarkerSize(mapSettings: MapSettings, overrideSize?: number): number {
  return overrideSize || UNIFIED_SIZE_MAP[mapSettings.markerSize as keyof typeof UNIFIED_SIZE_MAP] || 24
}

// Create cluster group options based on user settings
export function createClusterOptions(mapSettings: MapSettings, iconCreateFunction: (cluster: any) => any) {
  // If clustering is disabled, return null to indicate no clustering should be used
  if (!mapSettings.clusteringEnabled) {
    return null
  }
  
  return {
    chunkedLoading: true,
    maxClusterRadius: mapSettings.clusterRadius || 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    animate: true,
    animateAddingMarkers: true,
    disableClusteringAtZoom: 12, // Lower zoom level to show individual markers sooner
    removeOutsideVisibleBounds: true,
    iconCreateFunction
  }
}
