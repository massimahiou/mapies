import { loadStripe } from '@stripe/stripe-js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'

type Stripe = Awaited<ReturnType<typeof loadStripe>>

interface CheckoutSessionOptions {
  priceId: string
  userId: string
  userEmail: string
  successUrl?: string
  cancelUrl?: string
  trialPeriodDays?: number
  couponId?: string
}

interface CustomerPortalOptions {
  customerId: string
  returnUrl?: string
}

class StripeService {
  private stripe: Stripe | null = null

  async initializeStripe(publishableKey: string): Promise<void> {
    if (!this.stripe) {
      this.stripe = await loadStripe(publishableKey)
    }
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<{ sessionId: string; url: string }> {
    try {
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession')
      
      const result = await createCheckoutSession({
        priceId: options.priceId,
        userId: options.userId,
        userEmail: options.userEmail,
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
        trialPeriodDays: options.trialPeriodDays,
        couponId: options.couponId
      })

      const data = result.data as { sessionId: string; url: string }
      return data
    } catch (error) {
      console.error('Error creating checkout session:', error)
      throw error
    }
  }

  async createCheckoutSessionForPlan(
    planId: string, 
    userId: string, 
    userEmail: string,
    options?: {
      successUrl?: string
      cancelUrl?: string
      couponId?: string
    }
  ): Promise<{ sessionId: string; url: string }> {
    console.log('createCheckoutSessionForPlan called with:', { planId, userId, userEmail, options })
    
    const plan = SUBSCRIPTION_PLANS[planId]
    console.log('Plan found:', plan)
    
    // Handle freemium plan - redirect to success page since it's free
    if (planId === 'freemium') {
      console.log('Freemium plan selected - redirecting to success page')
      const successUrl = options?.successUrl || `${window.location.origin}`
      window.location.href = successUrl
      return { sessionId: 'freemium', url: successUrl }
    }
    
    if (!plan || !plan.stripePriceId) {
      console.error('Plan not found or no Stripe price ID:', { planId, plan })
      throw new Error(`Plan ${planId} does not have a Stripe price ID`)
    }

    console.log('Creating checkout session with price ID:', plan.stripePriceId)
    
    return this.createCheckoutSession({
      priceId: plan.stripePriceId,
      userId,
      userEmail,
      successUrl: options?.successUrl,
      cancelUrl: options?.cancelUrl,
      trialPeriodDays: plan.trialDays,
      couponId: options?.couponId
    })
  }

  async redirectToCheckout(checkoutUrl: string): Promise<void> {
    // Redirect directly to the Stripe checkout URL
    window.location.href = checkoutUrl
  }

  async createCustomerPortalSession(options: CustomerPortalOptions): Promise<string> {
    try {
      const createCustomerPortalSession = httpsCallable(functions, 'createCustomerPortalSession')
      
      const result = await createCustomerPortalSession({
        customerId: options.customerId,
        returnUrl: options.returnUrl
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

  // Legacy method for backward compatibility
  async createCheckoutSessionLegacy(priceId: string, userId: string, userEmail: string): Promise<{ sessionId: string; url: string }> {
    return this.createCheckoutSession({
      priceId,
      userId,
      userEmail
    })
  }
}

export const stripeService = new StripeService()