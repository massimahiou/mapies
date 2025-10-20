import React, { useState } from 'react'
import { Settings, Save, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { updateUserProfile, updateUserPreferences } from '../firebase/users'

const UserSettings: React.FC = () => {
  const { user, userDocument, refreshUserDocument } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: userDocument?.profile?.firstName || '',
    lastName: userDocument?.profile?.lastName || '',
    company: userDocument?.profile?.company || '',
    phone: userDocument?.profile?.phone || '',
    theme: userDocument?.preferences?.theme || 'light',
    language: userDocument?.preferences?.language || 'en',
    notifications: userDocument?.preferences?.notifications || true
  })

  const handleSave = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Update profile
      await updateUserProfile(user.uid, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
        phone: formData.phone
      })

      // Update preferences
      await updateUserPreferences(user.uid, {
        theme: formData.theme as 'light' | 'dark',
        language: formData.language,
        notifications: formData.notifications
      })

      await refreshUserDocument()
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating user settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      firstName: userDocument?.profile?.firstName || '',
      lastName: userDocument?.profile?.lastName || '',
      company: userDocument?.profile?.company || '',
      phone: userDocument?.profile?.phone || '',
      theme: userDocument?.preferences?.theme || 'light',
      language: userDocument?.preferences?.language || 'en',
      notifications: userDocument?.preferences?.notifications || true
    })
    setIsEditing(false)
  }

  if (!user || !userDocument) return null

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          User Settings
        </h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Profile Information */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Profile Information</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                disabled={!isEditing}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                disabled={!isEditing}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                disabled={!isEditing}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                disabled={!isEditing}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Preferences</h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Theme</label>
              <select
                value={formData.theme}
                onChange={(e) => setFormData({...formData, theme: e.target.value as 'light' | 'dark'})}
                disabled={!isEditing}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Language</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({...formData, language: e.target.value})}
                disabled={!isEditing}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.notifications}
                onChange={(e) => setFormData({...formData, notifications: e.target.checked as true})}
                disabled={!isEditing}
                className="rounded"
              />
              <label className="text-xs text-gray-600">Email notifications</label>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Account Information</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Email: {user.email}</p>
            <p>Plan: {userDocument.subscription?.plan || 'free'}</p>
            <p>Member since: {userDocument.createdAt ? new Date(userDocument.createdAt).toLocaleDateString() : 'Unknown'}</p>
            <p>Last login: {userDocument.lastLoginAt ? new Date(userDocument.lastLoginAt).toLocaleDateString() : 'Unknown'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserSettings
