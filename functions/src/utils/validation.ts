import * as crypto from 'crypto';
import { StripeWebhookEvent } from '../types';

export class ValidationUtils {
  /**
   * Verify Stripe webhook signature
   */
  static verifyStripeSignature(
    payload: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    try {
      const elements = signature.split(',');
      const signatureHash = elements.find(el => el.startsWith('v1='))?.split('=')[1];
      const timestamp = elements.find(el => el.startsWith('t='))?.split('=')[1];

      if (!signatureHash || !timestamp) {
        return false;
      }

      // Check timestamp (reject if older than 5 minutes)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (currentTimestamp - parseInt(timestamp) > 300) {
        return false;
      }

      // Create expected signature
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(timestamp + '.' + payload)
        .digest('hex');

      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying Stripe signature:', error);
      return false;
    }
  }

  /**
   * Validate required fields in Stripe event
   */
  static validateStripeEvent(event: StripeWebhookEvent): boolean {
    return !!(
      event.id &&
      event.type &&
      event.data &&
      event.data.object
    );
  }

  /**
   * Extract customer ID from Stripe object
   */
  static extractCustomerId(stripeObject: any): string | null {
    if (stripeObject.customer) {
      return stripeObject.customer;
    }
    if (stripeObject.id && stripeObject.object === 'customer') {
      return stripeObject.id;
    }
    return null;
  }

  /**
   * Extract subscription ID from Stripe object
   */
  static extractSubscriptionId(stripeObject: any): string | null {
    if (stripeObject.id && stripeObject.object === 'subscription') {
      return stripeObject.id;
    }
    if (stripeObject.subscription) {
      return stripeObject.subscription;
    }
    return null;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate subscription status
   */
  static isValidSubscriptionStatus(status: string): boolean {
    const validStatuses = [
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'trialing',
      'unpaid'
    ];
    return validStatuses.includes(status);
  }

  /**
   * Validate subscription tier
   */
  static isValidSubscriptionTier(tier: string): boolean {
    const validTiers = ['free', 'premium', 'pro'];
    return validTiers.includes(tier);
  }
}








