import { useEffect } from 'react'

interface UseBeforeUnloadOptions {
  isUploading: boolean
  onShowWarning?: () => void
}

export const useBeforeUnload = ({ isUploading, onShowWarning }: UseBeforeUnloadOptions) => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault()
        e.returnValue = 'Upload in progress. Are you sure you want to leave? Your upload will be cancelled.'
        return 'Upload in progress. Are you sure you want to leave? Your upload will be cancelled.'
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      if (isUploading) {
        e.preventDefault()
        // Push the current state back to prevent navigation
        window.history.pushState(null, '', window.location.href)
        // Show warning toast
        if (onShowWarning) {
          onShowWarning()
        }
      }
    }

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isUploading, onShowWarning])
}
