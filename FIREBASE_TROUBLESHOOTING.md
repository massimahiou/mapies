# Firebase Authentication Troubleshooting

## Current Issue
- Email verification not working
- Password reset from Firebase Console not working
- Authentication seems to have configuration issues

## Steps to Fix

### 1. Check Firebase Console Settings

#### Authentication Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your "mapies" project
3. Go to **Authentication** → **Get Started**
4. Enable **Email/Password** provider if not already enabled

#### Authorized Domains
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Make sure these domains are listed:
   - `localhost` (for development)
   - `mapies.firebaseapp.com` (if using Firebase hosting)
   - Your production domain (if deployed)

#### Email Templates
1. Go to **Authentication** → **Templates**
2. Click on **Email address verification**
3. Make sure it's **Enabled**
4. Customize the template if needed

### 2. Check Project Configuration

#### Verify Project ID
- Make sure the project ID in your config matches exactly: `mapies`
- Check that you're using the correct Firebase project

#### Check API Key
- Verify the API key is correct: `AIzaSyAlrag2Mdht3otPYJwer5L0kBawe-4mcpw`
- Make sure it's the Web API key, not the Server API key

### 3. Test Firebase Connection

#### Browser Console
1. Open http://localhost:3001
2. Open browser console (F12)
3. Look for Firebase debug information
4. Check for any error messages

#### Common Errors
- `Firebase: Error (auth/configuration-not-found)`
- `Firebase: Error (auth/invalid-api-key)`
- `Firebase: Error (auth/unauthorized-domain)`

### 4. Alternative Configuration

If the current config doesn't work, try this minimal config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAlrag2Mdht3otPYJwer5L0kBawe-4mcpw",
  authDomain: "mapies.firebaseapp.com",
  projectId: "mapies"
}
```

### 5. Test Steps

1. **Create a new user account**
2. **Check console logs** for Firebase debug info
3. **Try password reset** from Firebase Console
4. **Check email templates** are enabled
5. **Verify authorized domains** include localhost

## Debug Information

The app now includes debug logging. Check the browser console for:
- Firebase initialization status
- Authentication configuration
- Error messages
- User creation attempts

## Next Steps

1. Check Firebase Console settings
2. Test with debug logging enabled
3. Report any console errors
4. Try alternative configuration if needed







