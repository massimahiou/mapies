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
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div className="w-8 h-8 bg-pinz-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user.email}
          </p>
          <div className="flex items-center gap-2">
            {userDocument && (
              <div className="flex items-center gap-1 text-pinz-600">
                <span className="text-xs">•</span>
                <span className="text-xs">{planInfo.name}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSubscriptionModal(true)}
            className="p-1 text-gray-400 hover:text-pinz-600 transition-colors"
            title="View subscription plans"
          >
            <CreditCard className="w-4 h-4" />
          </button>
          <button
            onClick={onSignOut}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subscription Plans */}
      <SubscriptionPlans onOpenSubscription={() => setShowSubscriptionModal(true)} />

      {/* Subscription Management Modal */}
      {showSubscriptionModal && (
        <SubscriptionManagementModal onClose={() => setShowSubscriptionModal(false)} />
      )}
    </div>
  )
}

export default UserProfile
