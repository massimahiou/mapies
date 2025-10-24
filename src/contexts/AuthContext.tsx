import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from 'firebase/auth'
import { onAuthStateChange } from '../firebase/auth'
import { getUserDocument, UserDocument } from '../firebase/users'

interface AuthContextType {
  user: User | null
  userDocument: UserDocument | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUserDocument: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userDocument, setUserDocument] = useState<UserDocument | null>(null)
  const [loading, setLoading] = useState(true)

  // Load user document when user changes
  const loadUserDocument = async (user: User | null) => {
    if (user) {
      try {
        const doc = await getUserDocument(user.uid)
        setUserDocument(doc)
      } catch (error) {
        console.error('Error loading user document:', error)
        setUserDocument(null)
      }
    } else {
      setUserDocument(null)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user)
      await loadUserDocument(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const refreshUserDocument = async () => {
    if (user) {
      await loadUserDocument(user)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { signIn: firebaseSignIn } = await import('../firebase/auth')
    await firebaseSignIn(email, password)
  }

  const signUp = async (email: string, password: string) => {
    const { createAccount } = await import('../firebase/auth')
    await createAccount(email, password)
  }

  const signOut = async () => {
    const { signOutUser } = await import('../firebase/auth')
    await signOutUser()
  }

  const value = {
    user,
    userDocument,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUserDocument
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
