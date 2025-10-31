import React, { useState } from 'react'
import { User, LogOut, CreditCard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import SubscriptionManagementModal from './SubscriptionManagementModal'
import SubscriptionPlans from './SubscriptionPlans'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

interface UserProfileProps {
  onSignOut: () => void
}

const UserProfile: React.FC<UserProfileProps> = ({ onSignOut }) => {
  const { user, userDocument } = useAuth()
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)

  if (!user) return null

  const currentPlan = userDocument?.subscription?.plan || 'freemium'
  const planInfo = SUBSCRIPTION_PLANS[currentPlan] || SUBSCRIPTION_PLANS.freemium

  return (
    <div className="space-y-2">
      {/* Compact Account Section - Single line */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
        <div className="w-6 h-6 bg-pinz-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-xs font-medium text-gray-900 truncate" title={user.email || ''}>
            {user.email || 'Unknown'}
          </p>
          {userDocument && (
            <p className="text-xs text-pinz-600 truncate">
              {planInfo.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setShowSubscriptionModal(true)}
            className="p-1 text-gray-400 hover:text-pinz-600 transition-colors"
            title="View subscription plans"
          >
            <CreditCard className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onSignOut}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subscription Plans - Collapsible */}
      <SubscriptionPlans onOpenSubscription={() => setShowSubscriptionModal(true)} />

      {/* Subscription Management Modal */}
      {showSubscriptionModal && (
        <SubscriptionManagementModal onClose={() => setShowSubscriptionModal(false)} />
      )}
    </div>
  )
}

export default UserProfile
