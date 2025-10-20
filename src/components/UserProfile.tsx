import React from 'react'
import { User, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface UserProfileProps {
  onSignOut: () => void
}

const UserProfile: React.FC<UserProfileProps> = ({ onSignOut }) => {
  const { user, userDocument } = useAuth()

  if (!user) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user.email}
          </p>
          <div className="flex items-center gap-2">
            {userDocument && (
              <div className="flex items-center gap-1 text-blue-600">
                <span className="text-xs">•</span>
                <span className="text-xs capitalize">{userDocument.subscription?.plan || 'free'}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default UserProfile
