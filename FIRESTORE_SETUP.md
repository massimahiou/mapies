# Firestore Security Rules Setup

## Current Issue
- Error: "Missing or insufficient permissions"
- Users cannot read/write their own documents in Firestore

## Solution: Set up Firestore Security Rules

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your "mapies" project
3. Go to **Firestore Database** → **Rules**

### Step 2: Update Security Rules
Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own markers
    match /markers/{markerId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Users can read and write their own map settings
    match /mapSettings/{settingsId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### Step 3: Publish Rules
1. Click **"Publish"** button
2. Confirm the changes

### Step 4: Test
1. Go back to your app: http://localhost:3001
2. Create a new account or sign in
3. Check browser console - the permission error should be gone

## What These Rules Do

### User Documents (`/users/{userId}`)
- Users can only read/write their own user document
- Requires authentication (`request.auth != null`)
- User ID must match the document ID (`request.auth.uid == userId`)

### Markers (`/markers/{markerId}`)
- Users can only access markers they created
- Checks `userId` field in the document
- Allows creating new markers with proper user ID

### Map Settings (`/mapSettings/{settingsId}`)
- Users can only access their own map settings
- Checks `userId` field in the document
- Allows creating new settings with proper user ID

## Alternative: Temporary Open Rules (Development Only)

If you want to test quickly, you can temporarily use open rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**⚠️ WARNING: Only use this for development! Never use open rules in production.**

## Verification

After updating the rules, you should see:
- ✅ User documents created successfully
- ✅ No permission errors in console
- ✅ User profile shows subscription plan
- ✅ Markers can be saved to Firestore

## Next Steps

Once rules are set up:
1. Test user registration
2. Test user document creation
3. Test marker saving
4. Test map settings saving







