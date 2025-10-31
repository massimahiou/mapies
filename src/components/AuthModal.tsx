import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react'
import { createAccount, signIn, sendVerificationEmail, sendPasswordReset } from '../firebase/auth'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthSuccess: () => void
  initialMode?: 'login' | 'signup' // Add prop to specify initial mode
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(initialMode === 'login')
  
  // Update mode when modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      setIsLogin(initialMode === 'login')
      setError('')
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        name: ''
      })
      setShowForgotPassword(false)
    }
  }, [isOpen, initialMode])
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Check if user is already authenticated
  useEffect(() => {
    if (user && isOpen) {
      // User is already logged in, show welcome message briefly then redirect
      setTimeout(() => {
        onAuthSuccess()
      }, 1500)
    }
  }, [user, isOpen, onAuthSuccess])

  // If user is already authenticated, show welcome message
  if (user && isOpen) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-50 to-rose-50 opacity-50"></div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-gray-600 transition-colors bg-white/80 hover:bg-white rounded-full shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10 p-8 text-center">
              {/* Logo */}
              <div className="mb-8">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
                  alt="Pinz Logo"
                  className="h-12 mx-auto mb-4"
                />
              </div>

              {/* Welcome Message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome Back!
                </h2>
                <p className="text-gray-600 mb-6">
                  You're already signed in. Redirecting to your dashboard...
                </p>
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-600"></div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isLogin) {
        // Sign in
        await signIn(formData.email, formData.password)
        console.log('User signed in successfully')
      } else {
        // Register
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match')
          return
        }
        const userCredential = await createAccount(formData.email, formData.password)
        console.log('User created successfully')
        
        // Send verification email after signup
        try {
          await sendVerificationEmail(userCredential.user)
          
          showToast({
            type: 'success',
            title: 'Account Created!',
            message: 'Please check your email to verify your account.'
          })
          
          // Close modal and redirect to verification page (user stays logged in)
          onClose()
          navigate('/verify-email')
          return
        } catch (verificationError) {
          console.error('Error sending verification email:', verificationError)
          // Still redirect to verification page even if email fails
          onClose()
          navigate('/verify-email')
          return
        }
      }
      
      // Close modal and redirect on success (for login)
      onAuthSuccess()
    } catch (err: any) {
      console.error('Authentication error:', err)
      
      // Handle specific Firebase auth errors
      let errorMessage = 'Authentication failed. Please try again.'
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.'
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters long.'
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.'
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please create an account.'
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.'
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    setError('')
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-50 to-rose-50 opacity-50"></div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-gray-600 transition-colors bg-white/80 hover:bg-white rounded-full shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10 p-8">
              {/* Logo */}
              <div className="text-center mb-8">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
                  alt="Pinz Logo"
                  className="h-12 mx-auto mb-4"
                />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-gray-600">
                  {isLogin 
                    ? 'Sign in to continue to your dashboard' 
                    : 'Join thousands of users creating amazing maps'
                  }
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        name="name"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                        required={!isLogin}
                      />
                    </div>
                  </motion.div>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                        required={!isLogin}
                      />
                    </div>
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-6 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      {isLogin ? 'Signing In...' : 'Creating Account...'}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      {isLogin ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </div>
                  )}
                </motion.button>
              </form>

              {/* Forgot Password */}
              {isLogin && !showForgotPassword && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowForgotPassword(true)}
                    className="text-pink-600 hover:text-pink-700 text-sm font-medium transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Forgot Password Form */}
              {showForgotPassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-4"
                >
                  <p className="text-sm text-gray-600">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Email Address"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false)
                        setError('')
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!formData.email) {
                          setError('Please enter your email address')
                          return
                        }
                        setIsSendingReset(true)
                        setError('')
                        try {
                          await sendPasswordReset(formData.email)
                          showToast({
                            type: 'success',
                            title: 'Email Sent!',
                            message: 'Check your inbox for password reset instructions.'
                          })
                          setShowForgotPassword(false)
                        } catch (err: any) {
                          setError(err.message || 'Failed to send reset email')
                        } finally {
                          setIsSendingReset(false)
                        }
                      }}
                      disabled={isSendingReset}
                      className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingReset ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Switch Mode */}
              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                </p>
                <button
                  onClick={switchMode}
                  className="text-pink-600 hover:text-pink-700 font-semibold transition-colors"
                >
                  {isLogin ? 'Create Account' : 'Sign In'}
                </button>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AuthModal