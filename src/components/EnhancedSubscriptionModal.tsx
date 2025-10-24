import React, { useState, useEffect } from 'react'
import { X, CheckIcon, StarIcon, Zap, Crown, Building2, CreditCard, Calendar } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getUserDocument, updateSubscriptionPlan, UserDocument } from '../firebase/users'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'
import { stripeService } from '../services/stripe'
import { STRIPE_CONFIG } from '../config/stripe'

interface EnhancedSubscriptionModalProps {
  onClose: () => void
}

const EnhancedSubscriptionModal: React.FC<EnhancedSubscriptionModalProps> = ({ onClose }) => {
  const { user, refreshUserDocument } = useAuth()
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

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

  const handlePlanSelect = async (planId: 'freemium' | 'starter' | 'professional' | 'enterprise') => {
    if (!user) return
    
    // Don't allow downgrading to freemium through this interface
    if (planId === 'freemium') {
      console.warn('Cannot downgrade to freemium through this interface')
      return
    }
    
    console.log('Starting plan selection for:', planId)
    
    try {
      setUpgrading(planId)
      
      // Initialize Stripe
      console.log('Initializing Stripe...')
      await stripeService.initializeStripe(STRIPE_CONFIG.PUBLISHABLE_KEY)
      
      // Create checkout session for the selected plan
      console.log('Creating checkout session for plan:', planId)
      const checkoutData = await stripeService.createCheckoutSessionForPlan(
        planId,
        user.uid,
        user.email || '',
        {
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/dashboard?subscription=cancelled`
        }
      )
      
      console.log('Checkout session created:', checkoutData)
      
      // Redirect to Stripe checkout
      console.log('Redirecting to checkout...')
      await stripeService.redirectToCheckout(checkoutData.url)
      
    } catch (error) {
      console.error('Error upgrading plan:', error)
      // Fallback to local upgrade for testing
      console.log('Falling back to local upgrade...')
      await updateSubscriptionPlan(user.uid, planId)
      
      // Refresh the global user document to update all components
      await refreshUserDocument()
      
      // Also update local state for immediate UI feedback
      await loadUserData()
    } finally {
      setUpgrading(null)
    }
  }

  const handleManageSubscription = async () => {
    if (!user || !userDoc?.subscription?.stripeCustomerId) return
    
    try {
      setUpgrading('manage')
      
      // Create customer portal session
      const portalUrl = await stripeService.createCustomerPortalSession({
        customerId: userDoc.subscription.stripeCustomerId,
        returnUrl: `${window.location.origin}/dashboard`
      })
      
      // Redirect to customer portal
      await stripeService.redirectToCustomerPortal(portalUrl)
      
    } catch (error) {
      console.error('Error opening customer portal:', error)
    } finally {
      setUpgrading(null)
    }
  }

  const currentPlan = userDoc?.subscription?.plan || 'freemium'

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'freemium':
        return <Zap className="h-6 w-6 text-gray-500" />
      case 'starter':
        return <StarIcon className="h-6 w-6 text-blue-500" />
      case 'professional':
        return <Crown className="h-6 w-6 text-purple-500" />
      case 'enterprise':
        return <Building2 className="h-6 w-6 text-yellow-500" />
      default:
        return <Zap className="h-6 w-6 text-gray-500" />
    }
  }

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'freemium':
        return 'border-gray-200 bg-gray-50'
      case 'starter':
        return 'border-blue-200 bg-blue-50'
      case 'professional':
        return 'border-purple-200 bg-purple-50'
      case 'enterprise':
        return 'border-yellow-200 bg-yellow-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
            <span className="ml-3 text-gray-600">Loading subscription data...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
              <p className="text-gray-600 mt-1">Select the perfect plan for your mapping needs</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Current Plan Status */}
        {userDoc && (
          <div className="px-6 py-4 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getPlanIcon(currentPlan)}
                <div>
                  <h3 className="font-semibold text-gray-900">Current Plan: {SUBSCRIPTION_PLANS[currentPlan].name}</h3>
                  <p className="text-sm text-gray-600">{SUBSCRIPTION_PLANS[currentPlan].description}</p>
                </div>
              </div>
              {userDoc.subscription?.stripeCustomerId && (
                <button
                  onClick={handleManageSubscription}
                  disabled={upgrading === 'manage'}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>{upgrading === 'manage' ? 'Loading...' : 'Manage Subscription'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(SUBSCRIPTION_PLANS).map(([planId, plan]) => {
              const isCurrentPlan = planId === currentPlan
              const isUpgrading = upgrading === planId
              const canUpgrade = planId !== 'freemium' && planId !== currentPlan
              
              return (
                <div
                  key={planId}
                  className={`relative rounded-xl border-2 p-6 transition-all duration-200 ${
                    isCurrentPlan 
                      ? 'border-pink-500 bg-pink-50 shadow-lg' 
                      : canUpgrade 
                        ? 'hover:border-pink-300 hover:shadow-md cursor-pointer' 
                        : 'border-gray-200 bg-gray-50'
                  } ${getPlanColor(planId)}`}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-pink-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="text-center mb-6">
                    <div className="flex justify-center mb-3">
                      {getPlanIcon(planId)}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
                    
                    {/* Price */}
                    <div className="mt-4">
                      <span className="text-3xl font-bold text-gray-900">
                        ${plan.price}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-gray-600 text-sm">/month</span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center space-x-2">
                      <CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700">
                        {plan.maxMarkersPerMap.toLocaleString()} markers per map
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700">
                        {plan.maxMaps} map{plan.maxMaps !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700">
                        {plan.maxStorageMB}MB storage
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckIcon className={`h-4 w-4 flex-shrink-0 ${plan.geocoding ? 'text-green-500' : 'text-gray-300'}`} />
                      <span className={`text-sm ${plan.geocoding ? 'text-gray-700' : 'text-gray-400'}`}>
                        Geocoding
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckIcon className={`h-4 w-4 flex-shrink-0 ${plan.smartGrouping ? 'text-green-500' : 'text-gray-300'}`} />
                      <span className={`text-sm ${plan.smartGrouping ? 'text-gray-700' : 'text-gray-400'}`}>
                        Smart Grouping
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckIcon className={`h-4 w-4 flex-shrink-0 ${!plan.watermark ? 'text-green-500' : 'text-gray-300'}`} />
                      <span className={`text-sm ${!plan.watermark ? 'text-gray-700' : 'text-gray-400'}`}>
                        No Watermark
                      </span>
                    </div>
                    {plan.trialDays && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="text-sm text-blue-600 font-medium">
                          {plan.trialDays}-day free trial
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="mt-auto">
                    {isCurrentPlan ? (
                      <div className="w-full py-2 px-4 bg-pink-600 text-white rounded-lg text-center font-medium">
                        Current Plan
                      </div>
                    ) : canUpgrade ? (
                      <button
                        onClick={() => handlePlanSelect(planId as any)}
                        disabled={isUpgrading}
                        className="w-full py-2 px-4 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 font-medium"
                      >
                        {isUpgrading ? 'Processing...' : `Upgrade to ${plan.name}`}
                      </button>
                    ) : (
                      <div className="w-full py-2 px-4 bg-gray-300 text-gray-500 rounded-lg text-center font-medium">
                        Not Available
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <div className="text-center text-sm text-gray-600">
            <p>All plans include 24/7 support and regular updates.</p>
            <p className="mt-1">
              Need help choosing? <button className="text-pink-600 hover:text-pink-700 font-medium">Contact us</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedSubscriptionModal
