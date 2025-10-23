import { loadStripe } from '@stripe/stripe-js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'

type Stripe = Awaited<ReturnType<typeof loadStripe>>

class StripeService {
  private stripe: Stripe | null = null

  async initializeStripe(publishableKey: string): Promise<void> {
    if (!this.stripe) {
      this.stripe = await loadStripe(publishableKey)
    }
  }

  async createCheckoutSession(priceId: string, userId: string, userEmail: string): Promise<{ sessionId: string; url: string }> {
    try {
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession')
      
      const result = await createCheckoutSession({
        priceId,
        userId,
        userEmail
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

  async createCustomerPortalSession(customerId: string): Promise<string> {
    try {
      const createCustomerPortalSession = httpsCallable(functions, 'createCustomerPortalSession')
      
      const result = await createCustomerPortalSession({
        customerId
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