import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'

// Lazy load Stripe.js only when needed to avoid loading it in public/embed routes
type Stripe = Awaited<ReturnType<typeof import('@stripe/stripe-js').loadStripe>>

class StripeService {
  private stripe: Stripe | null = null

  async initializeStripe(publishableKey: string): Promise<void> {
    if (!this.stripe) {
      // Dynamically import Stripe.js only when actually needed
      const { loadStripe } = await import('@stripe/stripe-js')
      this.stripe = await loadStripe(publishableKey)
    }
  }

  async createCheckoutSession(
    priceId: string, 
    userId: string, 
    userEmail: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ sessionId: string; url: string }> {
    try {
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession')
      
      const result = await createCheckoutSession({
        priceId,
        userId,
        userEmail,
        successUrl,
        cancelUrl
      })

      const data = result.data as { sessionId: string; url: string }
      return data
    } catch (error) {
      console.error('Error creating checkout session:', error)
      throw error
    }
  }

  async redirectToCheckout(checkoutUrl: string): Promise<void> {
    // Redirect directly to the Stripe checkout URL
    window.location.href = checkoutUrl
  }

  async createCheckoutSessionForPlan(
    planId: string,
    userId: string,
    userEmail: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ sessionId: string; url: string }> {
    try {
      // Get the price ID for the plan
      const { SUBSCRIPTION_PLANS } = await import('../config/subscriptionPlans')
      const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]
      
      if (!plan?.stripePriceId) {
        throw new Error(`No price ID found for plan: ${planId}`)
      }
      
      return this.createCheckoutSession(plan.stripePriceId, userId, userEmail, successUrl, cancelUrl)
    } catch (error) {
      console.error('Error creating checkout session for plan:', error)
      throw error
    }
  }

  async createCustomerPortalSession(params: { customerId: string; returnUrl?: string }): Promise<string> {
    try {
      const createCustomerPortalSession = httpsCallable(functions, 'createCustomerPortalSession')
      
      const result = await createCustomerPortalSession({
        customerId: params.customerId,
        returnUrl: params.returnUrl
      })

      const data = result.data as { url: string }
      return data.url
    } catch (error) {
      console.error('Error creating customer portal session:', error)
      throw error
    }
  }

  async redirectToCustomerPortal(portalUrl: string): Promise<void> {
    // Redirect to the customer portal
    window.location.href = portalUrl
  }
}

export const stripeService = new StripeService()