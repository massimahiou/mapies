import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { confirmPasswordResetAction, verifyPasswordResetCodeAction } from '../firebase/auth'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [status, setStatus] = useState<'verifying' | 'ready' | 'resetting' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const actionCode = searchParams.get('oobCode')
  const mode = searchParams.get('mode')

  useEffect(() => {
    // Verify the action code and get email
    if (actionCode && mode === 'resetPassword') {
      verifyCode()
    } else {
      setError('Invalid reset link')
      setStatus('error')
    }
  }, [actionCode, mode])

  const verifyCode = async () => {
    if (!actionCode) return

    try {
      const verifiedEmail = await verifyPasswordResetCodeAction(actionCode)
      setEmail(verifiedEmail)
      setStatus('ready')
    } catch (err: any) {
      setError(err.message || 'The reset link is invalid or has expired.')
      setStatus('error')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!actionCode) {
      setError('Invalid reset code')
      return
    }

    setStatus('resetting')
    setError('')

    try {
      await confirmPasswordResetAction(actionCode, formData.password)
      setStatus('success')
      
      showToast({
        type: 'success',
        title: 'Password Reset',
        message: 'Your password has been successfully reset!'
      })

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
      setStatus('error')
    }
  }

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
            {status === 'verifying' || status === 'resetting' ? (
              <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
            ) : status === 'success' ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : status === 'error' ? (
              <AlertCircle className="w-8 h-8 text-red-600" />
            ) : (
              <Lock className="w-8 h-8 text-pink-600" />
            )}
          </div>

          {status === 'verifying' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Reset Link...</h2>
              <p className="text-gray-600">Please wait while we verify your reset link.</p>
            </>
          )}

          {status === 'ready' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Your Password</h2>
              <p className="text-gray-600 mb-6">
                Enter your new password for <strong>{email}</strong>
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent pr-10"
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent pr-10"
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
                >
                  Reset Password
                </button>
              </form>
            </>
          )}

          {status === 'resetting' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Resetting Password...</h2>
              <p className="text-gray-600">Please wait while we update your password.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successfully!</h2>
              <p className="text-gray-600 mb-6">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Failed</h2>
              <p className="text-gray-600 mb-6">{error || 'The reset link is invalid or has expired.'}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPassword

