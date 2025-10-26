#!/usr/bin/env node

/**
 * TEMPORARY SCRIPT: Fix user limits in Firestore
 * This script will update all users with the correct limits based on their subscription plan
 * 
 * Usage: node fixUserLimits.js
 * 
 * Make sure to set your Firebase credentials first:
 * export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/firebase-adminsdk.json"
 */

const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(process.cwd(), 'config', 'mapies-firebase-adminsdk-fbsvc-40548c12ec.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'mapies'
});

const db = admin.firestore();

/**
 * Get the correct limits for a subscription plan
 */
function getCorrectLimitsForPlan(plan) {
  const limits = {
    freemium: {
      maxMaps: 1,
      maxMarkersPerMap: 50,
      maxTotalMarkers: 50,
      customIcons: false,
      advancedAnalytics: false,
      prioritySupport: false,
      geocoding: false,
      bulkImport: true,
      smartGrouping: false,
      watermark: true,
      customizationLevel: 'basic'
    },
    starter: {
      maxMaps: 10,
      maxMarkersPerMap: 200,
      maxTotalMarkers: 200,
      customIcons: true,
      advancedAnalytics: false,
      prioritySupport: false,
      geocoding: true,
      bulkImport: true,
      smartGrouping: false,
      watermark: true,
      customizationLevel: 'premium'
    },
    professional: {
      maxMaps: 50,
      maxMarkersPerMap: 1000,
      maxTotalMarkers: 1000,
      customIcons: true,
      advancedAnalytics: true,
      prioritySupport: true,
      geocoding: true,
      bulkImport: true,
      smartGrouping: true,
      watermark: false,
      customizationLevel: 'premium'
    },
    enterprise: {
      maxMaps: -1, // unlimited
      maxMarkersPerMap: -1, // unlimited
      maxTotalMarkers: -1, // unlimited
      customIcons: true,
      advancedAnalytics: true,
      prioritySupport: true,
      geocoding: true,
      bulkImport: true,
      smartGrouping: true,
      watermark: false,
      customizationLevel: 'premium'
    }
  };
  
  return limits[plan] || limits.freemium;
}

/**
 * Check if a user needs fixing by comparing current limits with correct limits
 */
function checkIfUserNeedsFixing(currentLimits, correctLimits) {
  if (!currentLimits) {
    return true; // User has no limits, needs fixing
  }
  
  // Check each field in correct limits
  for (const [key, value] of Object.entries(correctLimits)) {
    if (currentLimits[key] !== value) {
      console.log(`  ❌ ${key}: ${currentLimits[key]} → ${value}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Main function to fix all users
 */
async function fixAllUsers() {
  try {
    console.log('🔧 Starting user limits fix process...');
    
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('ℹ️  No users found in Firestore');
      return;
    }

    let usersProcessed = 0;
    let usersFixed = 0;
    const errors = [];

    console.log(`📊 Found ${usersSnapshot.size} users to process`);

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const email = userData.email || 'unknown';
        
        console.log(`\n👤 Processing user: ${email} (${userId})`);
        
        // Get the correct limits based on their subscription plan
        const plan = userData.subscription?.plan || 'freemium';
        const correctLimits = getCorrectLimitsForPlan(plan);
        
        console.log(`📋 Plan: ${plan}`);
        
        // Check if user needs fixing
        const needsFixing = checkIfUserNeedsFixing(userData.limits, correctLimits);
        
        if (needsFixing) {
          console.log(`🔧 Fixing limits for ${email}...`);
          
          // Update user with correct limits
          await userDoc.ref.update({
            limits: correctLimits,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          usersFixed++;
          console.log(`✅ Fixed limits for ${email}`);
        } else {
          console.log(`✅ ${email} already has correct limits`);
        }
        
        usersProcessed++;
        
      } catch (userError) {
        const errorMsg = `Error processing user ${userDoc.id}: ${userError}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`\n🎉 User limits fix completed!`);
    console.log(`📊 Processed: ${usersProcessed} users`);
    console.log(`🔧 Fixed: ${usersFixed} users`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(error => console.log(`  - ${error}`));
    }

  } catch (error) {
    console.error('💥 Error in fixAllUsers:', error);
  }
}

// Run the script
fixAllUsers()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
