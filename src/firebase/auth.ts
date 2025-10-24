import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  UserCredential
} from 'firebase/auth'
import { auth } from './config'
import { createUserDocument, updateLastLogin, getUserDocument } from './users'

// Create account with email and password
export const createAccount = async (email: string, password: string): Promise<UserCredential> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    console.log('User created successfully:', userCredential.user.email)
    console.log('Email verified:', userCredential.user.emailVerified)
    
    // Create user document in Firestore
    try {
      await createUserDocument(userCredential.user)
      console.log('User document created in Firestore')
    } catch (docError) {
      console.error('Error creating user document:', docError)
      // Don't throw error - user is still created in Auth
    }
    
    return userCredential
  } catch (error: any) {
    console.error('Error creating account:', error)
    throw new Error(error.message)
  }
}

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<UserCredential> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    console.log('User signed in successfully:', userCredential.user.email)
    
    // Update last login time in Firestore
    try {
      await updateLastLogin(userCredential.user.uid)
      console.log('Last login time updated')
    } catch (loginError) {
      console.warn('Could not update last login time:', loginError)
    }
    
    return userCredential
  } catch (error: any) {
    console.error('Error signing in:', error)
    throw new Error(error.message)
  }
}

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser
}

// Get user document data
export const getCurrentUserDocument = async (): Promise<any> => {
  const user = auth.currentUser
  if (!user) return null
  
  try {
    return await getUserDocument(user.uid)
  } catch (error) {
    console.error('Error getting user document:', error)
    return null
  }
}

