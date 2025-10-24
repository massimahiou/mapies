// Firebase debug utility
import { auth } from './config'

export const debugFirebase = () => {
  console.log('=== Firebase Debug Info ===')
  console.log('Auth instance:', auth)
  console.log('Auth app:', auth.app)
  console.log('Auth config:', auth.app.options)
  console.log('Auth current user:', auth.currentUser)
  console.log('Auth language code:', auth.languageCode)
  console.log('Auth settings:', auth.settings)
  console.log('========================')
}

// Test Firebase connection
export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...')
    const app = auth.app
    console.log('Firebase app initialized:', !!app)
    console.log('Firebase app name:', app.name)
    console.log('Firebase app options:', app.options)
    return true
  } catch (error) {
    console.error('Firebase connection failed:', error)
    return false
  }
}







