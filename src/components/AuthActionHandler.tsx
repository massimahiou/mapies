import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

/**
 * Handler for Firebase's default action URL: /__/auth/action
 * This route parses the mode and oobCode from Firebase's action links
 * and redirects to the appropriate handler page.
 */
const AuthActionHandler: React.FC = () => {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const mode = searchParams.get('mode')
    const oobCode = searchParams.get('oobCode')
    const continueUrl = searchParams.get('continueUrl')

    // Immediately redirect based on mode to avoid Firebase's default page
    // Use window.location to ensure it works even if React Router hasn't loaded
    if (mode && oobCode) {
      if (mode === 'verifyEmail') {
        // Redirect to verify-email page with all parameters
        const params = new URLSearchParams()
        params.set('mode', 'verifyEmail')
        params.set('oobCode', oobCode)
        if (continueUrl) params.set('continueUrl', continueUrl)
        window.location.href = `/verify-email?${params.toString()}`
      } else if (mode === 'resetPassword') {
        // Redirect to reset-password page with all parameters
        const params = new URLSearchParams()
        params.set('mode', 'resetPassword')
        params.set('oobCode', oobCode)
        if (continueUrl) params.set('continueUrl', continueUrl)
        window.location.href = `/reset-password?${params.toString()}`
      } else {
        // Unknown mode, redirect to dashboard
        window.location.href = '/auth'
      }
    } else if (continueUrl) {
      // If Firebase provides a continueUrl, use it
      try {
        const url = new URL(continueUrl)
        window.location.href = url.pathname + url.search
      } catch {
        window.location.href = '/auth'
      }
    } else {
      // No parameters, redirect to dashboard
      window.location.href = '/auth'
    }
  }, [searchParams])

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 flex items-center justify-center p-4">
      <motion.div
        className="bg-white rounded-2xl shadow-xl p-8 text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Processing...</h2>
        <p className="text-gray-600">Redirecting to the correct page...</p>
      </motion.div>
    </div>
  )
}

export default AuthActionHandler

