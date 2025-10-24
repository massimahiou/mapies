import React, { useState, useCallback, useEffect } from 'react'
import { X, Download, FileText, ArrowRight } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'

interface CsvUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onFileProcess: (file: File, columnMapping: ColumnMapping) => void
  isUploading: boolean
  uploadError: string
  uploadProgress: { processed: number; total: number; currentAddress: string }
}

interface ColumnMapping {
  name: string | null
  address: string | null
  lat: string | null
  lng: string | null
}

interface CsvPreview {
  headers: string[]
  sampleRows: any[][]
  totalRows: number
}

const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  onFileProcess,
  isUploading,
  uploadError,
  uploadProgress
}) => {
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
    multiple: false
  })

  // Parse CSV to preview headers and sample data
  const parseCsvPreview = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 5, // Only parse first 5 rows for preview
      complete: (results) => {
        const headers = results.meta.fields || []
        const sampleRows = results.data.slice(0, 3) as any[][]
        const totalRows = results.meta.cursor || 0
        
        setCsvPreview({
          headers,
          sampleRows,
          totalRows
        })
        
        // Auto-detect column mappings
        const autoMapping = autoDetectColumns(headers)
        setColumnMapping(autoMapping)
        
        setStep('mapping')
      },
      error: (error) => {
        console.error('CSV parsing error:', error)
      }
    })
  }

  // Auto-detect column mappings based on common patterns
  const autoDetectColumns = (headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = { name: null, address: null, lat: null, lng: null }
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim()
      
      // Name detection
      if (!mapping.name && (
        lowerHeader.includes('name') || 
        lowerHeader.includes('nom') ||
        lowerHeader.includes('business') ||
        lowerHeader.includes('company') ||
        lowerHeader.includes('store')
      )) {
        mapping.name = header
      }
      
      // Address detection
      if (!mapping.address && (
        lowerHeader.includes('address') || 
        lowerHeader.includes('adresse') ||
        lowerHeader.includes('location') ||
        lowerHeader.includes('street') ||
        lowerHeader.includes('rue')
      )) {
        mapping.address = header
      }
      
      // Latitude detection
      if (!mapping.lat && (
        lowerHeader.includes('lat') || 
        lowerHeader.includes('latitude') ||
        lowerHeader.includes('y') ||
        lowerHeader.includes('coord')
      )) {
        mapping.lat = header
      }
      
      // Longitude detection
      if (!mapping.lng && (
        lowerHeader.includes('lng') || 
        lowerHeader.includes('lon') ||
        lowerHeader.includes('longitude') ||
        lowerHeader.includes('x') ||
        lowerHeader.includes('coord')
      )) {
        mapping.lng = header
      }
    })
    
    return mapping
  }

  // Download sample CSV
  const downloadSampleCsv = () => {
    const sampleData = [
      ['name', 'address', 'lat', 'lng'],
      ['Coffee Shop', '123 Main St, Montreal, QC', '45.5017', '-73.5673'],
      ['Restaurant', '456 Oak Ave, Toronto, ON', '43.6532', '-79.3832'],
      ['Store', '789 Pine St, Vancouver, BC', '49.2827', '-123.1207'],
      ['', ''],
      ['nom', 'adresse', 'latitude', 'longitude'],
      ['Chez Massi', '5830 Terr. Beauséjour, Saint-Hubert, QC J3Y 6C2', '45.5017', '-73.5673'],
      ['Chez Tristan', '5620 Av. des Plaines, Montréal, QC H1T 2X1', '45.5017', '-73.5673']
    ]
    
    const csvContent = sampleData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-markers.csv'
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

  // Validate mapping before proceeding
  const validateMapping = (): boolean => {
    return !!(columnMapping.name && (columnMapping.address || (columnMapping.lat && columnMapping.lng)))
  }

  // Handle file processing
  const handleProcessFile = () => {
    if (selectedFile && validateMapping()) {
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
    if (uploadProgress.currentAddress === 'Complete' && !isUploading) {
      const timer = setTimeout(() => {
        handleClose()
      }, 2000) // Close after 2 seconds
      
      return () => clearTimeout(timer)
    }
  }, [uploadProgress.currentAddress, isUploading, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {step === 'upload' && 'Upload CSV File'}
            {step === 'mapping' && 'Map CSV Columns'}
            {step === 'preview' && 'Processing CSV'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <>
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">CSV Format Options:</h4>
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                <div className="font-mono text-gray-600">
                  <div className="font-semibold">Option 1: With coordinates (no geocoding needed)</div>
                  <div>name, address, lat, lng</div>
                  <div className="text-gray-400">Coffee Shop, 123 Main St, Montreal, QC, 45.5017, -73.5673</div>
                </div>
                <div className="font-mono text-gray-600">
                  <div className="font-semibold">Option 2: Address only (will geocode)</div>
                  <div>name, address (or nom, adresse)</div>
                  <div className="text-gray-400">Coffee Shop, 123 Main St, Montreal, QC</div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Upload a CSV file with flexible column names. We'll help you map them to our required fields.
              </p>
            </div>

            {/* File Drop Zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              {isDragActive ? (
                <p className="text-primary-600">Drop the CSV file here...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-1">Drag & drop your CSV file here</p>
                  <p className="text-sm text-gray-500">or click to browse</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
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
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Map your CSV columns to our required fields. We've auto-detected some mappings:
              </p>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">CSV Preview ({csvPreview.totalRows} rows):</div>
                <div className="text-xs font-mono text-gray-600">
                  <div className="font-semibold">{csvPreview.headers.join(' | ')}</div>
                  {csvPreview.sampleRows.map((row, index) => (
                    <div key={index} className="text-gray-500">
                      {Object.values(row).slice(0, 4).join(' | ')}...
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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

                {/* Address Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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

                {/* Latitude Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude {!columnMapping.address && <span className="text-red-500">*</span>}
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
                </div>

                {/* Longitude Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude {!columnMapping.address && <span className="text-red-500">*</span>}
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
                </div>
              </div>

              {!validateMapping() && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    Please map at least the Business Name field and either Address or both Latitude/Longitude fields.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 btn-secondary"
              >
                Back
              </button>
              <button
                onClick={handleProcessFile}
                disabled={!validateMapping()}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
                Process CSV
              </button>
            </div>
          </>
        )}

        {/* Step 3: Processing Complete */}
        {step === 'preview' && (
          <>
            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{uploadError}</p>
              </div>
            )}

            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Your Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your data is being processed. Please do not close the page until it finishes.
              </p>
              <button
                onClick={handleClose}
                className="btn-primary"
              >
                Understood!
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CsvUploadModal
