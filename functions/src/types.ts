// Stripe webhook event types
export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
  type: string;
}

// Subscription related types
export interface StripeSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  ended_at: number | null;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        nickname: string | null;
        unit_amount: number | null;
        currency: string;
      };
    }>;
  };
  metadata: Record<string, string>;
}

// Customer related types
export interface StripeCustomer {
  id: string;
  object: 'customer';
  email: string | null;
  name: string | null;
  metadata: Record<string, string>;
  created: number;
}

// Invoice related types
export interface StripeInvoice {
  id: string;
  object: 'invoice';
  customer: string;
  subscription: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amount_paid: number;
  amount_due: number;
  currency: string;
  created: number;
  due_date: number | null;
  paid: boolean;
  payment_intent: string | null;
  metadata: Record<string, string>;
}

// Payment Intent related types
export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  customer: string | null;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

// Webhook processing result
export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  eventType: string;
  userId?: string;
  subscriptionId?: string;
  error?: string;
  processingTime: number;
}

// User subscription data structure
export interface UserSubscriptionData {
  stripeCustomerId: string;
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'free';
  subscriptionId?: string;
  subscriptionTier: 'free' | 'premium' | 'pro';
  subscriptionStartDate?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  subscriptionEndDate?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  lastPaymentDate?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  nextBillingDate?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  email?: string;
}

// Subscription document structure
export interface SubscriptionDocument {
  userId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodStart: FirebaseFirestore.Timestamp;
  currentPeriodEnd: FirebaseFirestore.Timestamp;
  cancelAtPeriodEnd: boolean;
  canceledAt?: FirebaseFirestore.Timestamp;
  endedAt?: FirebaseFirestore.Timestamp;
  metadata: Record<string, string>;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}
