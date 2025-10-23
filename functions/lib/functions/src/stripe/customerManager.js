"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerManager = void 0;
const stripe_1 = require("stripe");
const admin = require("firebase-admin");
const userOperations_1 = require("../firestore/userOperations");
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
class CustomerManager {
    /**
     * Handle customer created event
     */
    static async handleCustomerCreated(customer) {
        try {
            this.logger.logStripeEvent('customer.created', customer.id);
            // Extract user ID from metadata if available
            const userId = customer.metadata.userId;
            if (!userId) {
                this.logger.warn(`No userId found in customer metadata for ${customer.id}`);
                return;
            }
            // Create user with Stripe customer data
            const userSubscriptionData = {
                stripeCustomerId: customer.id,
                subscriptionStatus: 'free',
                subscriptionTier: 'free'
            };
            await userOperations_1.UserOperations.createUserWithSubscription(userId, customer.id, customer.email || '', userSubscriptionData);
            this.logger.info(`Customer created successfully for user ${userId}`, {
                customerId: customer.id,
                email: customer.email
            });
        }
        catch (error) {
            this.logger.error('Error handling customer created:', error);
            throw error;
        }
    }
    /**
     * Handle customer updated event
     */
    static async handleCustomerUpdated(customer) {
        try {
            this.logger.logStripeEvent('customer.updated', customer.id);
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customer.id);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customer.id}`);
                return;
            }
            // Update user email if it changed
            if (customer.email) {
                await userOperations_1.UserOperations.updateUserSubscription(userId, {
                    email: customer.email
                });
            }
            this.logger.info(`Customer updated successfully for user ${userId}`, {
                customerId: customer.id,
                email: customer.email
            });
        }
        catch (error) {
            this.logger.error('Error handling customer updated:', error);
            throw error;
        }
    }
    /**
     * Handle customer deleted event
     */
    static async handleCustomerDeleted(customer) {
        try {
            this.logger.logStripeEvent('customer.deleted', customer.id);
            const userId = await userOperations_1.UserOperations.getUserByStripeCustomerId(customer.id);
            if (!userId) {
                this.logger.warn(`No user found for customer ${customer.id}`);
                return;
            }
            // Cancel all subscriptions for this customer
            const subscriptions = await this.stripe.subscriptions.list({
                customer: customer.id,
                status: 'active'
            });
            for (const subscription of subscriptions.data) {
                await this.stripe.subscriptions.cancel(subscription.id);
            }
            // Update user to free tier
            const userSubscriptionData = {
                subscriptionStatus: 'canceled',
                subscriptionTier: 'free',
                subscriptionId: undefined,
                subscriptionEndDate: undefined,
                cancelAtPeriodEnd: false,
                canceledAt: admin.firestore.FieldValue.serverTimestamp(),
                nextBillingDate: undefined
            };
            await userOperations_1.UserOperations.updateUserSubscription(userId, userSubscriptionData);
            this.logger.info(`Customer deleted successfully for user ${userId}`, {
                customerId: customer.id
            });
        }
        catch (error) {
            this.logger.error('Error handling customer deleted:', error);
            throw error;
        }
    }
    /**
     * Create Stripe customer for user
     */
    static async createStripeCustomer(userId, email, name) {
        try {
            const customer = await this.stripe.customers.create({
                email,
                name,
                metadata: {
                    userId
                }
            });
            this.logger.info(`Stripe customer created for user ${userId}`, {
                customerId: customer.id,
                email: customer.email
            });
            return {
                id: customer.id,
                object: customer.object,
                email: customer.email,
                name: customer.name,
                metadata: customer.metadata,
                created: customer.created
            };
        }
        catch (error) {
            this.logger.error(`Error creating Stripe customer for user ${userId}:`, error);
            throw error;
        }
    }
    /**
     * Get Stripe customer by ID
     */
    static async getStripeCustomer(customerId) {
        try {
            const customer = await this.stripe.customers.retrieve(customerId);
            if (customer.deleted) {
                return null;
            }
            return customer;
        }
        catch (error) {
            this.logger.error(`Error getting Stripe customer ${customerId}:`, error);
            return null;
        }
    }
    /**
     * Update Stripe customer
     */
    static async updateStripeCustomer(customerId, updateData) {
        try {
            const customer = await this.stripe.customers.update(customerId, updateData);
            this.logger.info(`Stripe customer updated ${customerId}`, updateData);
            return customer;
        }
        catch (error) {
            this.logger.error(`Error updating Stripe customer ${customerId}:`, error);
            throw error;
        }
    }
    /**
     * Delete Stripe customer
     */
    static async deleteStripeCustomer(customerId) {
        try {
            await this.stripe.customers.del(customerId);
            this.logger.info(`Stripe customer deleted ${customerId}`);
        }
        catch (error) {
            this.logger.error(`Error deleting Stripe customer ${customerId}:`, error);
            throw error;
        }
    }
}
exports.CustomerManager = CustomerManager;
CustomerManager.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});
CustomerManager.logger = logger_1.Logger.getInstance();
//# sourceMappingURL=customerManager.js.map