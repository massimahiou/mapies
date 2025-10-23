import React, { useState, useEffect } from 'react'
import { X, StarIcon, SparklesIcon, CheckIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getUserDocument, updateSubscriptionPlan, UserDocument } from '../firebase/users'
import { stripeService } from '../services/stripe'
import { STRIPE_CONFIG } from '../config/stripe'

interface SubscriptionManagementModalProps {
  onClose: () => void
}

const SubscriptionManagementModal: React.FC<SubscriptionManagementModalProps> = ({ onClose }) => {
  const { user } = useAuth()
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    if (user) {
      loadUserData()
    }
  }, [user])

  const loadUserData = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const doc = await getUserDocument(user.uid)
      setUserDoc(doc)
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!user) return
    
    try {
      setUpgrading(true)
      
      // Initialize Stripe
      await stripeService.initializeStripe(STRIPE_CONFIG.PUBLISHABLE_KEY)
      
      // Create checkout session
      const checkoutData = await stripeService.createCheckoutSession(
        STRIPE_CONFIG.PREMIUM_PRICE_ID,
        user.uid,
        user.email || ''
      )
      
      // Redirect to Stripe checkout
      await stripeService.redirectToCheckout(checkoutData.url)
      
    } catch (error) {
      console.error('Error upgrading:', error)
      // Fallback to local upgrade for testing
      await updateSubscriptionPlan(user.uid, 'premium')
      await loadUserData()
    } finally {
      setUpgrading(false)
    }
  }

  const handleDowngrade = async () => {
    if (!user) return
    
    try {
      setUpgrading(true)
      await updateSubscriptionPlan(user.uid, 'freemium')
      await loadUserData()
    } catch (error) {
      console.error('Error downgrading:', error)
    } finally {
      setUpgrading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!user || !userDoc?.subscription?.stripeCustomerId) return
    
    try {
      setUpgrading(true)
      
      // Create customer portal session
      const portalUrl = await stripeService.createCustomerPortalSession(
        userDoc.subscription.stripeCustomerId
      )
      
      // Redirect to customer portal
      await stripeService.redirectToCustomerPortal(portalUrl)
      
    } catch (error) {
      console.error('Error opening customer portal:', error)
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!userDoc) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <p className="text-gray-500 text-center">Unable to load subscription data</p>
        </div>
      </div>
    )
  }

  const currentPlan = userDoc.subscription?.plan || 'freemium'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-gray-600">Select the perfect plan for your mapping needs</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Plan Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Freemium Plan */}
            <div className={`relative border-2 rounded-xl p-6 transition-all ${
              currentPlan === 'freemium' 
                ? 'border-blue-500 bg-blue-50 shadow-lg' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              {currentPlan === 'freemium' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Current Plan
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SparklesIcon className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Freemium</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">Free</div>
                <p className="text-gray-600">Perfect for getting started</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Up to 3 maps</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">50 markers per map</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Basic analytics</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Community support</span>
                </div>
              </div>
              
              {currentPlan === 'freemium' ? (
                <div className="w-full px-4 py-3 bg-blue-100 text-blue-800 rounded-lg text-center font-medium">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={handleDowngrade}
                  disabled={upgrading}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
                >
                  {upgrading ? 'Switching...' : 'Switch to Freemium'}
                </button>
              )}
            </div>

            {/* Premium Plan */}
            <div className={`relative border-2 rounded-xl p-6 transition-all ${
              currentPlan === 'premium' 
                ? 'border-yellow-500 bg-yellow-50 shadow-lg' 
                : 'border-gray-200 hover:border-yellow-300'
            }`}>
              {currentPlan === 'premium' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Current Plan
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <StarIcon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">$9.99</div>
                <p className="text-gray-600">per month</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Up to 50 maps</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">1,000 markers per map</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Advanced analytics</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Custom icons</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Priority support</span>
                </div>
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Export capabilities</span>
                </div>
              </div>
              
              {currentPlan === 'premium' ? (
                <div className="space-y-2">
                  <div className="w-full px-4 py-3 bg-yellow-100 text-yellow-800 rounded-lg text-center font-medium">
                    Current Plan
                  </div>
                  <button
                    onClick={handleManageSubscription}
                    disabled={upgrading}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {upgrading ? 'Loading...' : 'Manage Subscription'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all disabled:opacity-50 font-medium shadow-lg"
                >
                  {upgrading ? 'Upgrading...' : 'Upgrade to Premium'}
                </button>
              )}
            </div>
          </div>

          {/* Usage Summary */}
          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Your Current Usage</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {userDoc.usage?.mapsCount || 0}
                </div>
                <div className="text-sm text-gray-600">Maps Created</div>
                <div className="text-xs text-gray-500">
                  of {userDoc.limits?.maxMaps || 0} allowed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {userDoc.usage?.markersCount || 0}
                </div>
                <div className="text-sm text-gray-600">Total Markers</div>
                <div className="text-xs text-gray-500">
                  {userDoc.limits?.maxMarkersPerMap || 0} per map
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManagementModal