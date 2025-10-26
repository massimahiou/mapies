"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendedUpgrade = exports.canPerformAction = exports.getPlanLimits = exports.SUBSCRIPTION_PLANS = void 0;
exports.SUBSCRIPTION_PLANS = {
    freemium: {
        limits: {
            maxMarkersPerMap: 50,
            maxTotalMarkers: 50,
            maxMaps: 1,
            maxStorageMB: 10
        },
        features: {
            watermark: true,
            bulkImport: false,
            geocoding: false,
            smartGrouping: false,
            customIcons: false,
            advancedAnalytics: false,
            prioritySupport: false // No priority support
        },
        customizationLevel: 'basic',
        price: 0,
        name: 'Freemium',
        description: 'Perfect for getting started',
        stripePriceId: 'price_1SLn4xQ5zKkScSt2aMRLmPCq'
    },
    starter: {
        limits: {
            maxMarkersPerMap: 500,
            maxTotalMarkers: 500,
            maxMaps: 3,
            maxStorageMB: 100
        },
        features: {
            watermark: false,
            bulkImport: true,
            geocoding: true,
            smartGrouping: false,
            customIcons: true,
            advancedAnalytics: false,
            prioritySupport: false // No priority support
        },
        customizationLevel: 'premium',
        price: 14,
        name: 'Starter',
        description: 'Great for small businesses',
        stripePriceId: 'price_1SLn1lQ5zKkScSt26QWJ1kfz',
        trialDays: 14
    },
    professional: {
        limits: {
            maxMarkersPerMap: 1500,
            maxTotalMarkers: 1500,
            maxMaps: 5,
            maxStorageMB: 500
        },
        features: {
            watermark: false,
            bulkImport: true,
            geocoding: true,
            smartGrouping: true,
            customIcons: true,
            advancedAnalytics: true,
            prioritySupport: true // Has priority support
        },
        customizationLevel: 'premium',
        price: 36,
        name: 'Professional',
        description: 'Most popular choice',
        popular: true,
        stripePriceId: 'price_1SLn1mQ5zKkScSt2ptUM9Lr0',
        trialDays: 14
    },
    enterprise: {
        limits: {
            maxMarkersPerMap: 3000,
            maxTotalMarkers: 3000,
            maxMaps: 10,
            maxStorageMB: 2000
        },
        features: {
            watermark: false,
            bulkImport: true,
            geocoding: true,
            smartGrouping: true,
            customIcons: true,
            advancedAnalytics: true,
            prioritySupport: true // Has priority support
        },
        customizationLevel: 'premium',
        price: 48,
        name: 'Enterprise',
        description: 'For large organizations',
        stripePriceId: 'price_1SLn1mQ5zKkScSt2qKv1dRDs',
        trialDays: 14
    }
};
// Helper function to get plan limits
const getPlanLimits = (planId) => {
    return exports.SUBSCRIPTION_PLANS[planId] || exports.SUBSCRIPTION_PLANS.freemium;
};
exports.getPlanLimits = getPlanLimits;
// Helper function to check if user can perform action
const canPerformAction = (planId, action, currentUsage) => {
    switch (action) {
        case 'limits':
            return true; // Always allowed, but UI will show different options
        case 'features':
            return true; // Always allowed, but UI will show different options
        case 'customizationLevel':
            return true; // Always allowed, but UI will show different options
        default:
            return true;
    }
};
exports.canPerformAction = canPerformAction;
// Helper function to get recommended upgrade plan
const getRecommendedUpgrade = (currentPlan, feature) => {
    const planOrder = ['freemium', 'starter', 'professional', 'enterprise'];
    const currentIndex = planOrder.indexOf(currentPlan);
    // Find the first plan that supports the feature
    for (let i = currentIndex + 1; i < planOrder.length; i++) {
        const plan = exports.SUBSCRIPTION_PLANS[planOrder[i]];
        if (plan.features[feature]) {
            return planOrder[i];
        }
    }
    return 'enterprise'; // Fallback to highest plan
};
exports.getRecommendedUpgrade = getRecommendedUpgrade;
//# sourceMappingURL=subscriptionPlans.js.map