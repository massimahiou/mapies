import React, { useState } from 'react'
import { StarIcon, SparklesIcon, CreditCard, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { updateSubscriptionPlan } from '../firebase/users'
import { stripeService } from '../services/stripe'
import { STRIPE_CONFIG } from '../config/stripe'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

interface SubscriptionPlansProps {
  onOpenSubscription?: () => void
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ onOpenSubscription }) => {
  const { user, userDocument, refreshUserDocument } = useAuth()
  const [upgrading, setUpgrading] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) // Collapsed by default to save space

  if (!user || !userDocument) return null

  const currentPlan: 'freemium' | 'starter' | 'professional' | 'enterprise' = userDocument.subscription?.plan || 'freemium'
  const planInfo = SUBSCRIPTION_PLANS[currentPlan] || SUBSCRIPTION_PLANS.freemium
  const subscription = userDocument.subscription
  
  // Format subscription end date
  const formatSubscriptionEndDate = (date: Date | undefined) => {
    if (!date) return null
    
    // Handle Firestore Timestamp objects
    let dateToFormat: Date
    if (date && typeof date === 'object' && 'toDate' in date) {
      dateToFormat = (date as any).toDate()
    } else if (date instanceof Date) {
      dateToFormat = date
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateToFormat = new Date(date)
    } else {
      return null
    }
    
    // Check if the date is valid
    if (isNaN(dateToFormat.getTime())) {
      console.warn('Invalid date provided to formatSubscriptionEndDate:', date)
      return null
    }
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(dateToFormat)
  }
  
  const subscriptionEndDate = subscription?.subscriptionEndDate || subscription?.nextBillingDate
  
  // Determine if user can upgrade
  const canUpgrade = currentPlan !== 'enterprise'
  const nextPlan = currentPlan === 'freemium' ? 'starter' : 
                   currentPlan === 'starter' ? 'professional' : 
                   currentPlan === 'professional' ? 'enterprise' : null
  const nextPlanInfo = nextPlan ? SUBSCRIPTION_PLANS[nextPlan] : null

  const handleQuickUpgrade = async () => {
    if (!user || !nextPlan) return
    
    try {
      setUpgrading(true)
      
      // Initialize Stripe
      await stripeService.initializeStripe(STRIPE_CONFIG.PUBLISHABLE_KEY)
      
      // Create dynamic success and cancel URLs
      const baseUrl = window.location.origin
      const successUrl = `${baseUrl}/auth?subscription=success`
      const cancelUrl = `${baseUrl}/auth?subscription=cancelled`
      
      // Create checkout session for the next plan
      const checkoutData = await stripeService.createCheckoutSessionForPlan(
        nextPlan,
        user.uid,
        user.email || '',
        successUrl,
        cancelUrl
      )
      
      // Redirect to Stripe checkout
      await stripeService.redirectToCheckout(checkoutData.url)
      
    } catch (error) {
      console.error('Error upgrading:', error)
      // Fallback to local upgrade for testing
      await updateSubscriptionPlan(user.uid, nextPlan)
      // Refresh the global user document
      await refreshUserDocument()
    } finally {
      setUpgrading(false)
    }
  }


  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-3 hover:bg-blue-50/50 rounded-lg transition-colors"
      >
        <div className="flex items-center space-x-2">
          {currentPlan === 'enterprise' ? (
            <StarIcon className="h-4 w-4 text-yellow-600" />
          ) : currentPlan === 'freemium' ? (
            <SparklesIcon className="h-4 w-4 text-gray-600" />
          ) : (
            <StarIcon className="h-4 w-4 text-blue-600" />
          )}
          <span className="text-sm font-semibold text-gray-900">{planInfo.name}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            currentPlan === 'enterprise' 
              ? 'bg-yellow-100 text-yellow-800' 
              : currentPlan === 'freemium'
              ? 'bg-gray-100 text-gray-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {currentPlan === 'freemium' ? 'Free' : planInfo.name}
          </span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Subscription End Date */}
          {currentPlan !== 'freemium' && subscriptionEndDate && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Calendar className="h-3 w-3" />
              <span>
                {subscription?.cancelAtPeriodEnd ? 'Expires' : 'Renews'} on {formatSubscriptionEndDate(subscriptionEndDate)}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {canUpgrade && nextPlanInfo ? (
              <button
                onClick={handleQuickUpgrade}
                disabled={upgrading}
                className="flex-1 px-3 py-1.5 bg-pinz-600 text-white rounded-lg hover:bg-pinz-700 transition-all disabled:opacity-50 text-xs font-medium"
              >
                {upgrading ? 'Upgrading...' : `Upgrade to ${nextPlanInfo.name}`}
              </button>
            ) : (
              <div className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium text-center">
                {planInfo.name} Plan
              </div>
            )}
            
            {onOpenSubscription && (
              <button
                onClick={onOpenSubscription}
                className="px-2.5 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
                title="View subscription details"
              >
                <CreditCard className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SubscriptionPlans
