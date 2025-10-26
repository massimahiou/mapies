import React, { useState, useCallback, useEffect } from 'react'
import { X, Download, FileText, ArrowRight, MapPin, Info, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { debugUserLimits } from '../utils/featureAccess'
import { useAuth } from '../contexts/AuthContext'

interface CsvUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onFileProcess: (file: File, columnMapping: ColumnMapping) => void
  isUploading: boolean
  uploadError: string
  uploadProgress: { processed: number; total: number; currentAddress: string }
  currentMarkerCount?: number
}

interface ColumnMapping {
  name: string | null
  address: string | null
  lat: string | null
  lng: string | null
}

interface CsvPreview {
  headers: string[]
  sampleRows: any[]
  totalRows: number
}

const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  onFileProcess,
  isUploading,
  uploadError,
  uploadProgress,
  currentMarkerCount = 0
}) => {
  const { userDocument } = useAuth()
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: null,
    address: null,
    lat: null,
    lng: null
  })

  console.log('🔍 CsvUploadModal rendering, isOpen:', isOpen)
  console.log('🔍 CsvUploadModal props:', { isOpen, isUploading, uploadError, uploadProgress })
  console.log('🔍 CsvUploadModal component stack:', new Error().stack)

  // Debug user limits
  debugUserLimits(userDocument)
  
   // Check if user can add more markers using limits field
   const maxMarkersPerMap = userDocument?.limits?.maxMarkersPerMap || 0
   const canAddMoreMarkers = currentMarkerCount < maxMarkersPerMap
   
   // Check specific feature access using limits field
   const canUseGeocoding = userDocument?.limits?.geocoding === true

  // 🔍 DEBUG: Log detailed user document info for CSV modal
  console.log('🔍 CsvUploadModal Debug - User Document Details:')
  console.log('  - userDocument:', userDocument)
  console.log('  - userDocument.limits:', userDocument?.limits)
  console.log('  - userDocument.limits.geocoding:', userDocument?.limits?.geocoding)
  console.log('  - userDocument.subscription:', userDocument?.subscription)
  console.log('  - userDocument.subscription.plan:', userDocument?.subscription?.plan)
  console.log('  - canUseGeocoding:', canUseGeocoding)
  console.log('  - canAddMoreMarkers:', canAddMoreMarkers)

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setSelectedFile(file)
      parseCsvPreview(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false,
    disabled: !canAddMoreMarkers
  })

  // Parse CSV to preview headers and sample data
  const parseCsvPreview = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      preview: 5, // Only parse first 5 rows for preview
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        const sampleRows = results.data.slice(0, 3) // Show first 3 rows
        
        setCsvPreview({
          headers,
          sampleRows,
          totalRows: results.data.length
        })
        
        // Auto-detect columns
        const detectedMapping = autoDetectColumns(headers)
        setColumnMapping(detectedMapping)
        
        setStep('mapping')
      },
      error: (error) => {
        console.error('CSV parsing error:', error)
        setCsvPreview(null)
      }
    })
  }, [])

  // Auto-detect column mappings
  const autoDetectColumns = (headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {
      name: null,
      address: null,
      lat: null,
      lng: null
    }
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase()
      
      // Name detection
      if (lowerHeader.includes('name') || lowerHeader.includes('business') || lowerHeader.includes('title')) {
        mapping.name = header
      }
      // Address detection
      else if (lowerHeader.includes('address') || lowerHeader.includes('adresse') || lowerHeader.includes('location')) {
        mapping.address = header
      }
      // Latitude detection
      else if (lowerHeader.includes('lat') || lowerHeader.includes('latitude') || lowerHeader.includes('y')) {
        mapping.lat = header
      }
      // Longitude detection
      else if (lowerHeader.includes('lng') || lowerHeader.includes('lng') || lowerHeader.includes('longitude') || lowerHeader.includes('x')) {
        mapping.lng = header
      }
    })
    
    return mapping
  }

  // Download sample CSV based on plan
  const downloadSampleCsv = () => {
    let sampleData: string[][]
    
    if (canUseGeocoding) {
      // Premium users get sample with addresses
      sampleData = [
        ['name', 'address', 'latitude', 'longitude'],
        ['Coffee Shop', '123 Main St, Montreal, QC', '45.5017', '-73.5673'],
        ['Restaurant', '456 Oak Ave, Toronto, ON', '43.6532', '-79.3832'],
        ['Store', '789 Pine St, Vancouver, BC', '49.2827', '-123.1207'],
        ['', ''],
        ['nom', 'adresse', 'latitude', 'longitude'],
        ['Chez Massi', '5830 Terr. Beauséjour, Saint-Hubert, QC J3Y 6C2', '45.5017', '-73.5673'],
        ['Chez Tristan', '5620 Av. des Plaines, Montréal, QC H1T 2X1', '45.5017', '-73.5673']
      ]
    } else {
      // Freemium users get sample with coordinates only
      sampleData = [
        ['name', 'latitude', 'longitude'],
        ['Coffee Shop', '45.5017', '-73.5673'],
        ['Restaurant', '43.6532', '-79.3832'],
        ['Store', '49.2827', '-123.1207'],
        ['', ''],
        ['nom', 'latitude', 'longitude'],
        ['Chez Massi', '45.5017', '-73.5673'],
        ['Chez Tristan', '45.5017', '-73.5673']
      ]
    }
    
    const csvContent = sampleData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = canUseGeocoding ? 'sample-markers-with-addresses.csv' : 'sample-markers-coordinates-only.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Handle column mapping change
  const handleColumnMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === '' ? null : value
    }))
  }

  // Enhanced validation logic
  const validateMapping = (): { isValid: boolean; message?: string; missingFields?: string[] } => {
    const hasName = !!columnMapping.name
    const hasAddress = !!columnMapping.address
    const hasCoordinates = !!(columnMapping.lat && columnMapping.lng)
    
    // Basic validation: need name
    if (!hasName) {
      return { isValid: false, message: 'Business name is required', missingFields: ['name'] }
    }
    
    // Plan-specific validation
    if (canUseGeocoding) {
      // Premium users: need either address or coordinates
      if (!hasAddress && !hasCoordinates) {
        return { isValid: false, message: 'Provide either address or coordinates', missingFields: ['address', 'coordinates'] }
      }
    } else {
      // Users without geocoding: MUST have coordinates
      if (!hasCoordinates) {
        return { isValid: false, message: 'Coordinates are required when geocoding is not available', missingFields: ['coordinates'] }
      }
    }
    
    return { isValid: true }
  }

  // Get validation result
  const validation = validateMapping()
  
  // Check if freemium user needs coordinates
  const needsCoordinates = !canUseGeocoding && !columnMapping.lat && !columnMapping.lng

  // Handle file processing
  const handleProcessFile = () => {
    if (selectedFile && validation.isValid) {
      onFileProcess(selectedFile, columnMapping)
      setStep('preview')
    }
  }

  // Reset modal state
  const handleClose = useCallback(() => {
    setStep('upload')
    setSelectedFile(null)
    setCsvPreview(null)
    setColumnMapping({ name: null, address: null, lat: null, lng: null })
    onClose()
  }, [onClose])

  // Auto-close modal when upload is complete
  useEffect(() => {
    if (isUploading && uploadProgress.processed === uploadProgress.total && uploadProgress.total > 0) {
      setTimeout(() => {
        handleClose()
      }, 2000) // Close after 2 seconds
    }
  }, [isUploading, uploadProgress, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">CSV Import</h2>
              <div className="flex items-center gap-2 mt-1">
                 <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                   userDocument?.subscription?.plan === 'freemium' 
                     ? 'bg-gray-100 text-gray-700' 
                     : 'bg-green-100 text-green-700'
                 }`}>
                   {userDocument?.subscription?.plan?.charAt(0).toUpperCase()}{userDocument?.subscription?.plan?.slice(1)} Plan
                 </span>
                {canUseGeocoding ? (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Address geocoding enabled
                  </span>
                ) : (
                  <span className="text-xs text-orange-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Coordinates only
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Debug Information */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
              🔍 Debug: Geocoding Access Status
            </summary>
            <div className="mt-2 space-y-1 text-gray-700">
              <div><strong>User Document:</strong> {userDocument ? '✅ Loaded' : '❌ Not loaded'}</div>
              <div><strong>User Limits:</strong> {userDocument?.limits ? '✅ Present' : '❌ Missing'}</div>
              <div><strong>Geocoding Access:</strong> {canUseGeocoding ? '✅ Enabled' : '❌ Disabled'}</div>
              <div><strong>Limits.geocoding:</strong> {String(userDocument?.limits?.geocoding)}</div>
              <div><strong>Subscription Plan:</strong> {userDocument?.subscription?.plan || 'Not set'}</div>
              <div><strong>Max Markers:</strong> {userDocument?.limits?.maxMarkersPerMap || 'Not set'}</div>
              <div><strong>Current Markers:</strong> {currentMarkerCount}</div>
              <div><strong>Can Add More:</strong> {canAddMoreMarkers ? '✅ Yes' : '❌ No'}</div>
            </div>
          </details>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: File Upload */}
          {step === 'upload' && (
            <>
              {/* Plan-specific messaging */}
              <div className={`mb-6 p-4 rounded-lg border ${
                canUseGeocoding 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-start gap-3">
                  <Info className={`w-5 h-5 mt-0.5 ${
                    canUseGeocoding ? 'text-green-600' : 'text-blue-600'
                  }`} />
                  <div>
                    <h3 className={`font-medium ${
                      canUseGeocoding ? 'text-green-800' : 'text-blue-800'
                    }`}>
                      {canUseGeocoding ? 'Upload with Addresses' : 'Upload with Coordinates'}
                    </h3>
                    <p className={`text-sm mt-1 ${
                      canUseGeocoding ? 'text-green-700' : 'text-blue-700'
                    }`}>
                      {canUseGeocoding 
                        ? 'Upload CSV files with addresses - they will be automatically geocoded. You can also include coordinates for more precise results.'
                        : 'Upload CSV files with latitude and longitude coordinates. Address geocoding is not available in your current plan.'
                      }
                    </p>
                  </div>
                </div>
              </div>


              {/* Marker Limit Warning */}
              {!canAddMoreMarkers && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-red-600" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 font-medium">
                        Marker Limit Reached
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        You've used all {currentMarkerCount} markers in your current plan. Consider upgrading for more capacity.
                      </p>
                    </div>
                    <button 
                      onClick={() => {/* TODO: Open upgrade modal */}}
                      className="text-xs text-red-600 hover:text-red-700 underline font-medium"
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              )}

              {/* File Drop Zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-300 hover:border-gray-400'
                } ${!canAddMoreMarkers ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input {...getInputProps()} />
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                {isDragActive ? (
                  <p className="text-primary-600 text-lg">Drop the CSV file here...</p>
                ) : (
                  <div>
                    <p className="text-gray-600 mb-2 text-lg">Drag & drop your CSV file here</p>
                    <p className="text-sm text-gray-500">or click to browse</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={downloadSampleCsv}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && csvPreview && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Your Columns</h3>
                <p className="text-sm text-gray-600 mb-4">
                  We've auto-detected some mappings. Adjust as needed:
                </p>
                
                {/* CSV Preview */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    CSV Preview ({csvPreview.totalRows} rows):
                  </div>
                  <div className="text-xs font-mono text-gray-600 overflow-x-auto">
                    <div className="font-semibold text-gray-800 bg-gray-100 p-2 rounded">
                      {csvPreview.headers.join(' | ')}
                    </div>
                    {csvPreview.sampleRows.map((row, index) => (
                      <div key={index} className="text-gray-500 p-2 border-b border-gray-200 last:border-b-0">
                        {Object.values(row).slice(0, 4).join(' | ')}...
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column Mapping */}
                <div className="space-y-4">
                  {/* Business Name Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={columnMapping.name || ''}
                      onChange={(e) => handleColumnMappingChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select column...</option>
                      {csvPreview.headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  {/* Address Field - Only for users with geocoding access */}
                  {canUseGeocoding && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address {!columnMapping.lat && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        value={columnMapping.address || ''}
                        onChange={(e) => handleColumnMappingChange('address', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select column...</option>
                        {csvPreview.headers.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Required if you don't have latitude/longitude columns
                      </p>
                    </div>
                  )}

                  {/* Latitude Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Latitude {!canUseGeocoding && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={columnMapping.lat || ''}
                      onChange={(e) => handleColumnMappingChange('lat', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select column...</option>
                      {csvPreview.headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {!canUseGeocoding && (
                      <p className="text-xs text-orange-600 mt-1">
                        Required for freemium plan
                      </p>
                    )}
                  </div>

                  {/* Longitude Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Longitude {!canUseGeocoding && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={columnMapping.lng || ''}
                      onChange={(e) => handleColumnMappingChange('lng', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select column...</option>
                      {csvPreview.headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {!canUseGeocoding && (
                      <p className="text-xs text-orange-600 mt-1">
                        Required for freemium plan
                      </p>
                    )}
                  </div>
                </div>

                {/* Validation Messages */}
                {!validation.isValid && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-sm text-red-800 font-medium">
                          {validation.message}
                        </p>
                        {validation.missingFields?.includes('coordinates') && (
                          <p className="text-xs text-red-700 mt-1">
                            Latitude and longitude columns are required when geocoding is not available.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {validation.isValid && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm text-green-800 font-medium">
                          Ready to process!
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          {canUseGeocoding 
                            ? 'Addresses will be geocoded automatically. Invalid coordinates will be skipped.'
                            : 'Using provided coordinates - invalid coordinates will be skipped with clear error messages.'
                          }
                        </p>
                        {!canUseGeocoding && (
                          <p className="text-xs text-orange-600 mt-1">
                            ⚠️ Coordinates must be numeric only: latitude (-90 to 90), longitude (-180 to 180). Addresses in coordinate columns will be skipped.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Upgrade Prompt for Freemium */}
                {needsCoordinates && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Info className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm text-blue-800 font-medium">
                          🚀 Unlock Address Geocoding
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          With an upgraded plan, you can upload CSV files with addresses only - no coordinates needed!
                        </p>
                      </div>
                      <button 
                        onClick={() => {/* TODO: Open upgrade modal */}}
                        className="text-xs text-blue-600 hover:text-blue-700 underline font-medium"
                      >
                        Learn More
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handleProcessFile}
                  disabled={!validation.isValid}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowRight className="w-4 h-4" />
                  Process CSV
                </button>
              </div>
            </>
          )}

          {/* Step 3: Processing */}
          {step === 'preview' && (
            <>
              <div className="text-center">
                <div className="mb-4">
                  {isUploading ? (
                    <Clock className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
                  ) : uploadError ? (
                    <XCircle className="w-12 h-12 text-red-600 mx-auto" />
                  ) : (
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {isUploading ? 'Processing CSV...' : uploadError ? 'Processing Failed' : 'Processing Complete!'}
                </h3>
                
                {isUploading && (
                  <div className="mt-4">
                    <div className="bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(uploadProgress.processed / uploadProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600">
                      {uploadProgress.processed} of {uploadProgress.total} markers processed
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {uploadProgress.currentAddress}
                    </p>
                  </div>
                )}
                
                {uploadError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{uploadError}</p>
                  </div>
                )}
                
                {!isUploading && !uploadError && (
                  <p className="text-sm text-gray-600">
                    Your markers have been successfully imported!
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CsvUploadModal