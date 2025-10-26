import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Logger } from './utils/logger';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const logger = Logger.getInstance();

/**
 * TEMPORARY FUNCTION: Fix user limits in Firestore
 * This function will update all users with the correct limits based on their subscription plan
 * 
 * Usage: Call this function once to fix all existing users, then delete it
 */
export const fixUserLimits = functions.https.onRequest(async (req, res) => {
  try {
    logger.info('Starting user limits fix process...');
    
    // Get all users from Firestore
    const usersSnapshot = await admin.firestore().collection('users').get();
    
    if (usersSnapshot.empty) {
      logger.info('No users found in Firestore');
      res.status(200).json({ 
        success: true, 
        message: 'No users found to fix',
        usersProcessed: 0 
      });
      return;
    }

    let usersProcessed = 0;
    let usersFixed = 0;
    const errors: string[] = [];

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        logger.info(`Processing user: ${userId}`);
        
        // Get the correct limits based on their subscription plan
        const plan = userData.subscription?.plan || 'freemium';
        const correctLimits = getCorrectLimitsForPlan(plan);
        
        // Check if user needs fixing
        const needsFixing = checkIfUserNeedsFixing(userData.limits, correctLimits);
        
        if (needsFixing) {
          logger.info(`Fixing limits for user ${userId} (plan: ${plan})`);
          
          // Update user with correct limits
          await userDoc.ref.update({
            limits: correctLimits,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          usersFixed++;
          logger.info(`✅ Fixed limits for user ${userId}`);
        } else {
          logger.info(`User ${userId} already has correct limits`);
        }
        
        usersProcessed++;
        
      } catch (userError) {
        const errorMsg = `Error processing user ${userDoc.id}: ${userError}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    logger.info(`User limits fix completed. Processed: ${usersProcessed}, Fixed: ${usersFixed}`);
    
    res.status(200).json({
      success: true,
      message: 'User limits fix completed',
      usersProcessed,
      usersFixed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    logger.error('Error in fixUserLimits function:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get the correct limits for a subscription plan
 */
function getCorrectLimitsForPlan(plan: string) {
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
  
  return limits[plan as keyof typeof limits] || limits.freemium;
}

/**
 * Check if a user needs fixing by comparing current limits with correct limits
 */
function checkIfUserNeedsFixing(currentLimits: any, correctLimits: any): boolean {
  if (!currentLimits) {
    return true; // User has no limits, needs fixing
  }
  
  // Check each field in correct limits
  for (const [key, value] of Object.entries(correctLimits)) {
    if (currentLimits[key] !== value) {
      logger.info(`User needs fixing: ${key} is ${currentLimits[key]}, should be ${value}`);
      return true;
    }
  }
  
  return false;
}
