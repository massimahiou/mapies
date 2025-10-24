import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'
import { getFunctions } from 'firebase/functions'

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAlrag2Mdht3otPYJwer5L0kBawe-4mcpw",
  authDomain: "mapies.firebaseapp.com",
  projectId: "mapies",
  storageBucket: "mapies.firebasestorage.app",
  messagingSenderId: "1038828565237",
  appId: "1:1038828565237:web:02eb294eb51a5b8961cbbc",
  measurementId: "G-581G81292V"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app)

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app)

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

// Initialize Firebase Functions and get a reference to the service
export const functions = getFunctions(app)

export default app
