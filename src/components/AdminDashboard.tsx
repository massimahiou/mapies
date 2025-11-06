import React, { useState, useEffect } from 'react'
import { X, Shield, Users, Map, TrendingUp, Search, ExternalLink } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { getAllUsers, getAdminStats, updateUserSubscription, AdminStats } from '../firebase/admin'
import { UserDocument } from '../firebase/users'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'
import { useToast } from '../contexts/ToastContext'
import { getUserMaps, MapDocument } from '../firebase/maps'

interface AdminDashboardProps {
  onClose: () => void
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<UserDocument[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserDocument | null>(null)
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [userMaps, setUserMaps] = useState<Record<string, MapDocument[]>>({})
  const [loadingMaps, setLoadingMaps] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsData, usersData] = await Promise.all([
        getAdminStats(),
        getAllUsers()
      ])
      setStats(statsData)
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading admin data:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load admin data'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePlan = async (userId: string, newPlan: 'freemium' | 'starter' | 'professional' | 'enterprise') => {
    setUpdatingPlan(userId)
    try {
      await updateUserSubscription(userId, newPlan)
      await loadData() // Reload to get updated data
      showToast({
        type: 'success',
        title: 'Success',
        message: 'User subscription updated successfully'
      })
      setSelectedUser(null)
    } catch (error) {
      console.error('Error updating subscription:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update user subscription'
      })
    } finally {
      setUpdatingPlan(null)
    }
  }

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.uid?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleUserExpansion = async (userId: string) => {
    const isExpanded = expandedUsers.has(userId)
    
    if (isExpanded) {
      // Collapse
      setExpandedUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    } else {
      // Expand - load maps if not already loaded
      setExpandedUsers(prev => new Set(prev).add(userId))
      
      if (!userMaps[userId]) {
        setLoadingMaps(prev => new Set(prev).add(userId))
        try {
          const maps = await getUserMaps(userId)
          setUserMaps(prev => ({ ...prev, [userId]: maps }))
        } catch (error) {
          console.error(`Error loading maps for user ${userId}:`, error)
          showToast({
            type: 'error',
            title: 'Error',
            message: 'Failed to load user maps'
          })
        } finally {
          setLoadingMaps(prev => {
            const newSet = new Set(prev)
            newSet.delete(userId)
            return newSet
          })
        }
      }
    }
  }

  const openMapPreview = (mapId: string) => {
    const url = `${window.location.origin}/${mapId}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pinz-600"></div>
          </div>
          <p className="text-center mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-pink-600 to-pink-700 text-white">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Admin Dashboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-pink-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-blue-700">{stats?.users.total || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <Map className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Maps</p>
                  <p className="text-2xl font-bold text-green-700">{stats?.maps.total || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-4 border border-pink-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-pink-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Growth Rate</p>
                  <p className="text-2xl font-bold text-pink-700">
                    {stats?.users.byDate.length && stats.users.byDate.length > 1
                      ? `${((stats.users.byDate[stats.users.byDate.length - 1].count - stats.users.byDate[0].count) / stats.users.byDate[0].count * 100).toFixed(1)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Users Over Time */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Users Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats?.users.byDate || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value: number) => [value, 'Users']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#ec4899" 
                    strokeWidth={2}
                    name="Total Users"
                    dot={{ fill: '#ec4899', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Maps Over Time */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Maps Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats?.maps.byDate || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value: number) => [value, 'Maps']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Total Maps"
                    dot={{ fill: '#10b981', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Users by Plan */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Users by Subscription Plan</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(stats?.users.byPlan || {}).map(([plan, count]) => ({
                plan: SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]?.name || plan,
                count
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plan" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* User Management */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">User Management</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users by email or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const isExpanded = expandedUsers.has(user.uid)
                    const maps = userMaps[user.uid] || []
                    const isLoadingMaps = loadingMaps.has(user.uid)
                    
                    return (
                      <React.Fragment key={user.uid}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleUserExpansion(user.uid)}
                              className={`p-1.5 rounded transition-colors ${
                                isExpanded 
                                  ? 'text-pink-600 bg-pink-50' 
                                  : 'text-gray-400 hover:text-pink-600 hover:bg-pink-50'
                              }`}
                              title={isExpanded ? 'Hide maps' : 'View maps'}
                            >
                              <Map className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{user.email || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-pink-100 text-pink-700">
                              {SUBSCRIPTION_PLANS[user.subscription?.plan || 'freemium']?.name || 'Freemium'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {user.createdAt ? (() => {
                              // Handle Firestore Timestamp or Date
                              let createdAtDate: Date
                              if (user.createdAt instanceof Date) {
                                createdAtDate = user.createdAt
                              } else if (user.createdAt && typeof user.createdAt === 'object' && 'toDate' in user.createdAt) {
                                // Firestore Timestamp
                                createdAtDate = (user.createdAt as any).toDate()
                              } else if (typeof user.createdAt === 'string' || typeof user.createdAt === 'number') {
                                createdAtDate = new Date(user.createdAt)
                              } else {
                                return 'N/A'
                              }
                              return createdAtDate.toLocaleDateString()
                            })() : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="px-3 py-1 text-xs font-medium text-pink-700 bg-pink-50 hover:bg-pink-100 rounded transition-colors"
                            >
                              Change Plan
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="px-4 py-3 bg-gray-50">
                              {isLoadingMaps ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-600"></div>
                                  <span className="ml-2 text-sm text-gray-600">Loading maps...</span>
                                </div>
                              ) : maps.length === 0 ? (
                                <div className="text-sm text-gray-500 text-center py-4">
                                  This user has no maps yet.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-gray-700 mb-2">
                                    Maps ({maps.length}):
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {maps.map((map) => (
                                      <div
                                        key={map.id}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-pink-300 transition-colors"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">{map.name}</p>
                                          <p className="text-xs text-gray-500">
                                            {map.stats?.markerCount || 0} markers
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => openMapPreview(map.id!)}
                                          className="ml-2 p-2 text-pink-600 hover:bg-pink-50 rounded transition-colors flex-shrink-0"
                                          title="Open map in preview"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Change Plan Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Change Plan for {selectedUser.email}
            </h3>
            <div className="space-y-2 mb-4">
              {Object.entries(SUBSCRIPTION_PLANS).map(([planKey, planInfo]) => (
                <button
                  key={planKey}
                  onClick={() => handleUpdatePlan(selectedUser.uid, planKey as any)}
                  disabled={updatingPlan === selectedUser.uid || selectedUser.subscription?.plan === planKey}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedUser.subscription?.plan === planKey
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50'
                  } ${
                    updatingPlan === selectedUser.uid ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{planInfo.name}</p>
                      <p className="text-xs text-gray-600">{planInfo.description}</p>
                    </div>
                    {selectedUser.subscription?.plan === planKey && (
                      <span className="text-xs font-semibold text-pink-700">Current</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard

