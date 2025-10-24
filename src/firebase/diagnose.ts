// Comprehensive Firebase diagnosis
import { auth } from './config'

export const diagnoseFirebase = async () => {
  console.log('=== FIREBASE DIAGNOSIS ===')
  
  // 1. Check Firebase initialization
  console.log('1. Firebase Auth initialized:', !!auth)
  console.log('   Auth app:', auth.app.name)
  console.log('   Auth config:', auth.app.options)
  
  // 2. Check configuration values
  const config = auth.app.options
  console.log('2. Configuration check:')
  console.log('   API Key present:', !!config.apiKey)
  console.log('   Auth Domain:', config.authDomain)
  console.log('   Project ID:', config.projectId)
  console.log('   Storage Bucket:', config.storageBucket)
  console.log('   Messaging Sender ID:', config.messagingSenderId)
  console.log('   App ID:', config.appId)
  
  // 3. Check current user
  console.log('3. Current user:', auth.currentUser)
  if (auth.currentUser) {
    console.log('   Email:', auth.currentUser.email)
    console.log('   Email verified:', auth.currentUser.emailVerified)
    console.log('   UID:', auth.currentUser.uid)
  }
  
  // 4. Test basic auth functionality
  try {
    console.log('4. Testing basic auth functionality...')
    const testEmail = `diagnostic-${Date.now()}@test.com`
    const testPassword = 'testpassword123'
    
    console.log('   Creating test user...')
    const { createUserWithEmailAndPassword } = await import('firebase/auth')
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword)
    console.log('   ✅ User creation successful')
    console.log('   User email:', userCredential.user.email)
    console.log('   Email verified:', userCredential.user.emailVerified)
    
    // Test email verification
    console.log('   Testing email verification...')
    const { sendEmailVerification } = await import('firebase/auth')
    await sendEmailVerification(userCredential.user)
    console.log('   ✅ Email verification sent successfully')
    
    // Clean up test user
    console.log('   Cleaning up test user...')
    const { deleteUser } = await import('firebase/auth')
    await deleteUser(userCredential.user)
    console.log('   ✅ Test user deleted')
    
    console.log('=== DIAGNOSIS COMPLETE: ALL TESTS PASSED ===')
    return { success: true, message: 'All Firebase tests passed successfully' }
    
  } catch (error: any) {
    console.error('❌ Firebase test failed:', error)
    console.error('   Error code:', error.code)
    console.error('   Error message:', error.message)
    console.error('   Full error:', error)
    
    // Provide specific error guidance
    let guidance = 'Unknown error'
    switch (error.code) {
      case 'auth/email-already-in-use':
        guidance = 'Email already in use - this is expected for testing'
        break
      case 'auth/invalid-email':
        guidance = 'Invalid email format'
        break
      case 'auth/weak-password':
        guidance = 'Password too weak'
        break
      case 'auth/operation-not-allowed':
        guidance = 'Email/password authentication not enabled in Firebase Console'
        break
      case 'auth/unauthorized-domain':
        guidance = 'Domain not authorized - check Firebase Console authorized domains'
        break
      case 'auth/invalid-api-key':
        guidance = 'Invalid API key - check Firebase configuration'
        break
      case 'auth/configuration-not-found':
        guidance = 'Firebase configuration not found - check project setup'
        break
      default:
        guidance = `Check Firebase Console settings for: ${error.code}`
    }
    
    console.log('=== DIAGNOSIS FAILED ===')
    console.log('Guidance:', guidance)
    
    return { success: false, error: error.message, code: error.code, guidance }
  }
}








