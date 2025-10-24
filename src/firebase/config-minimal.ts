import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Minimal Firebase configuration for testing
const firebaseConfig = {
  apiKey: "AIzaSyAlrag2Mdht3otPYJwer5L0kBawe-4mcpw",
  authDomain: "mapies.firebaseapp.com",
  projectId: "mapies"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication
export const auth = getAuth(app)

export default app








