import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { sendVerificationEmail, verifyEmail } from '../firebase/auth'
import { useSearchParams, useNavigate } from 'react-router-dom'

const VerifyEmail: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error'>('idle')
  const [error, setError] = useState('')
  const actionCode = searchParams.get('oobCode')
  const mode = searchParams.get('mode')

  useEffect(() => {
    // If we have an action code, verify the email
    if (actionCode && mode === 'verifyEmail') {
      handleVerifyEmail()
    }
  }, [actionCode, mode])

  const handleSendVerification = async () => {
    if (!user) {
      setError('You must be logged in to verify your email')
      setStatus('error')
      return
    }

    if (user.emailVerified) {
      setStatus('verified')
      return
    }

    setStatus('sending')
    setError('')
    
    try {
      await sendVerificationEmail(user)
      setStatus('sent')
    } catch (err: any) {
      setError(err.message || 'Failed to send verification email')
      setStatus('error')
    }
  }

  const handleVerifyEmail = async () => {
    if (!actionCode) return

    setStatus('verifying')
    setError('')

    try {
      // Verify the email first (this works even if user is not logged in)
      await verifyEmail(actionCode)
      
      // Reload user if logged in to get updated emailVerified status
      if (user) {
        await user.reload()
      }
      
      setStatus('verified')
      
      // After verification, redirect to dashboard immediately
      // User can sign in there if not already logged in
      // Use window.location for a hard redirect to ensure it works
      setTimeout(() => {
        window.location.href = '/auth'
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to verify email')
      setStatus('error')
    }
  }

  const handleCheckVerification = async () => {
    if (!user) {
      setError('You must be logged in to verify your email')
      setStatus('error')
      return
    }

    setStatus('verifying')
    setError('')

    try {
      // Reload user to check latest verification status
      await user.reload()
      
      if (user.emailVerified) {
        setStatus('verified')
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          window.location.href = '/auth'
        }, 1500)
      } else {
        setStatus('idle')
        setError('Email not verified yet. Please click the verification link in your email.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check verification status')
      setStatus('error')
    }
  }

  // If we're verifying from action link
  if (actionCode && mode === 'verifyEmail') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {status === 'verifying' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Email...</h2>
              <p className="text-gray-600">Please wait while we verify your email address.</p>
            </div>
          )}

          {status === 'verified' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
              <p className="text-gray-600 mb-6">Your email has been successfully verified. Redirecting to dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
              <p className="text-gray-600 mb-4">{error || 'The verification link is invalid or has expired.'}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  // Regular verification request page
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 flex items-center justify-center p-4">
      <motion.div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-pink-600" />
          </div>
          
          {status === 'idle' && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Verify Your Email</h2>
                <p className="text-gray-600 text-lg">
                  {user ? (
                    <>
                      We've sent a verification email to <strong className="text-pink-600">{user.email}</strong>. 
                      Please check your inbox and click the verification link.
                    </>
                  ) : (
                    "We've sent a verification email. Please check your inbox and click the verification link."
                  )}
                </p>
              </div>
              
              {user && !user.emailVerified && (
                <div className="space-y-3">
                  <button
                    onClick={handleSendVerification}
                    className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Mail className="w-5 h-5" />
                    Resend Verification Email
                  </button>
                  <button
                    onClick={handleCheckVerification}
                    className="w-full px-6 py-3 bg-white border-2 border-pink-600 text-pink-600 rounded-lg hover:bg-pink-50 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    I Verified My Email
                  </button>
                </div>
              )}
              
              {user && user.emailVerified && (
                <button
                  onClick={() => window.location.href = '/auth'}
                  className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
                >
                  Go to Dashboard
                </button>
              )}
              
              {!user && (
                <button
                  onClick={() => navigate('/auth')}
                  className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
                >
                  Go to Dashboard
                </button>
              )}
            </>
          )}

          {status === 'sending' && (
            <>
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sending...</h2>
              <p className="text-gray-600">Please wait while we send the verification email.</p>
            </>
          )}

          {status === 'sent' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Sent!</h2>
              <p className="text-gray-600 mb-6">
                We've sent a verification email to <strong>{user?.email}</strong>. 
                Please check your inbox and click the verification link.
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleSendVerification}
                  className="w-full px-6 py-3 text-pink-600 border-2 border-pink-600 rounded-lg hover:bg-pink-50 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Resend Email
                </button>
                <button
                  onClick={handleCheckVerification}
                  className="w-full px-6 py-3 bg-white border-2 border-pink-600 text-pink-600 rounded-lg hover:bg-pink-50 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  I Verified My Email
                </button>
              </div>
            </>
          )}

          {status === 'verified' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
              <p className="text-gray-600 mb-6">Your email has been successfully verified. Redirecting to dashboard...</p>
              <button
                onClick={() => navigate('/auth')}
                className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
              >
                Go to Dashboard
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={handleSendVerification}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default VerifyEmail

