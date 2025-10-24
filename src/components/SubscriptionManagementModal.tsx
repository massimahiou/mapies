import React, { useState, useEffect } from 'react'
import { X, CheckIcon, StarIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getUserDocument, updateSubscriptionPlan, UserDocument } from '../firebase/users'

interface SubscriptionManagementModalProps {
  onClose: () => void
}

// Pricing plans data structure
const PRICING_PLANS = [
  {
    id: 'freemium',
    name: 'Freemium',
    price: 0,
    positions: '0-50',
    perPosition: 0.000,
    features: {
      watermark: true,
      bulkImport: true,
      customization: 'Basic',
      geocoding: false,
      smartGrouping: false,
      maps: 1
    },
    popular: false,
    description: 'Perfect for getting started'
  },
  {
    id: 'premium',
    name: 'Starter',
    price: 14,
    positions: '50-500',
    perPosition: 0.028,
    features: {
      watermark: false,
      bulkImport: true,
      customization: 'Premium',
      geocoding: true,
      smartGrouping: false,
      maps: 3
    },
    popular: false,
    description: 'Great for small businesses'
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 36,
    positions: '501-1500',
    perPosition: 0.024,
    features: {
      watermark: false,
      bulkImport: true,
      customization: 'Premium',
      geocoding: true,
      smartGrouping: true,
      maps: 5
    },
    popular: true,
    description: 'Most popular choice'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 48,
    positions: '1501-3000',
    perPosition: 0.016,
    features: {
      watermark: false,
      bulkImport: true,
      customization: 'Premium',
      geocoding: true,
      smartGrouping: true,
      maps: 10
    },
    popular: false,
    description: 'For large organizations'
  }
]

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

  const handlePlanSelect = async (planId: 'free' | 'pro' | 'enterprise' | 'freemium' | 'premium') => {
    if (!user) return
    
    try {
      setUpgrading(true)
      // Frontend only - no Stripe integration for now
      await updateSubscriptionPlan(user.uid, planId)
      await loadUserData()
    } catch (error) {
      console.error('Error updating plan:', error)
    } finally {
      setUpgrading(false)
    }
  }

  const currentPlan = userDoc?.subscription?.plan || 'freemium'

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pinz-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-gray-600 mt-1">Select the perfect plan for your mapping needs</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative border-2 rounded-xl p-6 transition-all duration-200 hover:shadow-lg ${
                  plan.popular
                    ? 'border-pinz-500 bg-gradient-to-br from-pinz-50 to-pinz-100'
                    : currentPlan === plan.id
                    ? 'border-pinz-300 bg-pinz-50'
                    : 'border-gray-200 bg-white hover:border-pinz-200'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-pinz-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1 shadow-lg">
                      <StarIcon className="w-4 h-4" />
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {currentPlan === plan.id && !plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-pinz-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Current Plan
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className={`text-center mb-6 ${plan.popular ? 'pt-4' : ''}`}>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                  
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  
                  {/* Positions */}
                  <div className="mb-2">
                    <span className="text-lg font-semibold text-pinz-600">{plan.positions}</span>
                    <span className="text-gray-600 ml-1">positions</span>
                  </div>
                  
                  {/* Per Position Cost */}
                  <div className="text-sm text-gray-500">
                    ${plan.perPosition.toFixed(3)} per position
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Watermark</span>
                    {plan.features.watermark ? (
                      <span className="text-red-500 text-sm">Present</span>
                    ) : (
                      <CheckIcon className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Bulk Import</span>
                    <CheckIcon className="w-4 h-4 text-green-500" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Customization</span>
                    <span className={`text-sm font-medium ${
                      plan.features.customization === 'Premium' ? 'text-pinz-600' : 'text-gray-600'
                    }`}>
                      {plan.features.customization}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Geocoding</span>
                    {plan.features.geocoding ? (
                      <CheckIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-red-500 text-sm">Not included</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Smart Grouping</span>
                    {plan.features.smartGrouping ? (
                      <CheckIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-red-500 text-sm">Not included</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Maps</span>
                    <span className="text-sm font-medium text-pinz-600">{plan.features.maps}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handlePlanSelect(plan.id as 'free' | 'pro' | 'enterprise' | 'freemium' | 'premium')}
                  disabled={upgrading || currentPlan === plan.id}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    currentPlan === plan.id
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-pinz-600 text-white hover:bg-pinz-700 shadow-lg hover:shadow-xl'
                      : 'bg-pinz-500 text-white hover:bg-pinz-600'
                  }`}
                >
                  {upgrading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </div>
                  ) : currentPlan === plan.id ? (
                    'Current Plan'
                  ) : plan.price === 0 ? (
                    'Get Started'
                  ) : (
                    'Choose Plan'
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Feature Comparison Table */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Feature Comparison</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Features</th>
                    {PRICING_PLANS.map((plan) => (
                      <th key={plan.id} className="text-center py-3 px-4 font-semibold text-gray-700">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Positions</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center text-pinz-600 font-medium">
                        {plan.positions}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Monthly Price</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center font-bold text-gray-900">
                        ${plan.price}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Per Position Cost</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center text-gray-600">
                        ${plan.perPosition.toFixed(3)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Watermark</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        {plan.features.watermark ? (
                          <span className="text-red-500">Present</span>
                        ) : (
                          <CheckIcon className="w-5 h-5 text-green-500 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Bulk Import</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        <CheckIcon className="w-5 h-5 text-green-500 mx-auto" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Customization</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        <span className={`font-medium ${
                          plan.features.customization === 'Premium' ? 'text-pinz-600' : 'text-gray-600'
                        }`}>
                          {plan.features.customization}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Geocoding</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        {plan.features.geocoding ? (
                          <CheckIcon className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-red-500">Not included</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Smart Grouping</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        {plan.features.smartGrouping ? (
                          <CheckIcon className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-red-500">Not included</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-gray-700">Maps</td>
                    {PRICING_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center font-medium text-pinz-600">
                        {plan.features.maps}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManagementModal