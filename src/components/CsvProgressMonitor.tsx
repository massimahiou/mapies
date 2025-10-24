import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

interface CsvUploadJob {
  id: string
  userId: string
  mapId: string
  fileName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: {
    total: number
    processed: number
    geocodingFailures: number
    duplicates: number
    skipped: number
    currentStep: string
    stepProgress: number
    stepTotal: number
  }
  columnMapping: {
    name: string | null
    address: string | null
    lat: string | null
    lng: string | null
  }
  results: {
    markersAdded: number
    errors: string[]
    processingTime: number
  }
  createdAt: any
  updatedAt: any
}

interface CsvProgressMonitorProps {
  jobId: string
  onComplete?: (results: CsvUploadJob['results']) => void
  onError?: (error: string) => void
  onClose?: () => void
}

const CsvProgressMonitor: React.FC<CsvProgressMonitorProps> = ({
  jobId,
  onComplete,
  onError,
  onClose
}) => {
  const [job, setJob] = useState<CsvUploadJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    setIsLoading(true)
    setError(null)

    // Subscribe to job updates
    const jobRef = doc(db, 'csvUploadJobs', jobId)
    const unsubscribe = onSnapshot(jobRef, (doc) => {
      if (doc.exists()) {
        const jobData = { id: doc.id, ...doc.data() } as CsvUploadJob
        setJob(jobData)
        setIsLoading(false)

        // Handle completion
        if (jobData.status === 'completed') {
          onComplete?.(jobData.results)
        } else if (jobData.status === 'failed') {
          const errorMessage = jobData.results.errors.join(', ') || 'Processing failed'
          setError(errorMessage)
          onError?.(errorMessage)
        }
      } else {
        setError('Job not found')
        setIsLoading(false)
      }
    }, (error) => {
      console.error('Error listening to job updates:', error)
      setError('Failed to load job progress')
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [jobId, onComplete, onError])

  const getStatusIcon = () => {
    if (!job) return <Clock className="w-5 h-5 text-gray-400" />
    
    switch (job.status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusText = () => {
    if (!job) return 'Loading...'
    
    switch (job.status) {
      case 'pending':
        return 'Waiting to start...'
      case 'processing':
        return 'Processing CSV...'
      case 'completed':
        return 'Completed successfully!'
      case 'failed':
        return 'Processing failed'
      default:
        return 'Unknown status'
    }
  }

  const getProgressPercentage = () => {
    if (!job || job.progress.total === 0) return 0
    return Math.round((job.progress.processed / job.progress.total) * 100)
  }

  const getStepProgressPercentage = () => {
    if (!job || job.progress.stepTotal === 0) return 0
    return Math.round((job.progress.stepProgress / job.progress.stepTotal) * 100)
  }

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Loading Progress</h3>
          <p className="text-sm text-blue-700">Connecting to processing service...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-xl">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Progress</h3>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl">
        <div className="text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Job Found</h3>
          <p className="text-sm text-gray-600">The processing job could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-blue-900">{getStatusText()}</h3>
            <p className="text-sm text-blue-700">{job.fileName}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5 text-blue-600" />
          </button>
        )}
      </div>

      {/* Overall Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-blue-700 mb-1">
          <span>Overall Progress</span>
          <span>{job.progress.processed} / {job.progress.total} ({getProgressPercentage()}%)</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>
        </div>
      </div>

      {/* Current Step Progress */}
      {job.progress.stepTotal > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-blue-700 mb-1">
            <span>{job.progress.currentStep}</span>
            <span>{job.progress.stepProgress} / {job.progress.stepTotal} ({getStepProgressPercentage()}%)</span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${getStepProgressPercentage()}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-600 font-medium mb-1">Markers Added</div>
          <div className="text-lg font-semibold text-blue-900">{job.results.markersAdded}</div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-600 font-medium mb-1">Geocoding Failures</div>
          <div className="text-lg font-semibold text-blue-900">{job.progress.geocodingFailures}</div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-600 font-medium mb-1">Skipped Rows</div>
          <div className="text-lg font-semibold text-blue-900">{job.progress.skipped}</div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-600 font-medium mb-1">Processing Time</div>
          <div className="text-lg font-semibold text-blue-900">{formatTime(job.results.processingTime)}</div>
        </div>
      </div>

      {/* Error Messages */}
      {job.results.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium text-red-800 mb-2">Errors:</div>
          <ul className="text-xs text-red-700 space-y-1">
            {job.results.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Status-specific content */}
      {job.status === 'completed' && (
        <div className="text-center">
          <div className="text-sm text-green-700 mb-3">
            ✅ Successfully processed {job.results.markersAdded} markers from {job.fileName}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      )}

      {job.status === 'failed' && (
        <div className="text-center">
          <div className="text-sm text-red-700 mb-3">
            ❌ Processing failed. Please try again or contact support.
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      )}

      {job.status === 'processing' && (
        <div className="text-center">
          <div className="text-sm text-blue-700 mb-3">
            🔄 Processing in progress... You can safely close this window and return later.
          </div>
          <div className="text-xs text-blue-600">
            The processing will continue in the background.
          </div>
        </div>
      )}
    </div>
  )
}

export default CsvProgressMonitor







