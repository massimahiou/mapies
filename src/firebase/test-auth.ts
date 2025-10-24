// Test Firebase Authentication setup
import { auth } from './config'
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'

export const testEmailVerification = async () => {
  try {
    console.log('=== Testing Email Verification ===')
    
    // Test creating a user
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'testpassword123'
    
    console.log('Creating test user:', testEmail)
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword)
    console.log('User created successfully:', userCredential.user.email)
    console.log('Email verified:', userCredential.user.emailVerified)
    
    // Test sending verification email
    console.log('Sending verification email...')
    await sendEmailVerification(userCredential.user)
    console.log('Verification email sent successfully!')
    
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    console.error('Email verification test failed:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    return { success: false, error: error.message }
  }
}

// Test Firebase connection
export const testFirebaseAuth = () => {
  console.log('=== Firebase Auth Test ===')
  console.log('Auth instance:', auth)
  console.log('Auth app name:', auth.app.name)
  console.log('Auth config:', auth.app.options)
  console.log('Current user:', auth.currentUser)
  console.log('========================')
}







