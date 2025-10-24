# Mapies Stripe Webhook Functions

This directory contains Firebase Cloud Functions for handling Stripe webhooks and subscription management for the Mapies application.

## 🚀 Features

- **Comprehensive Webhook Handling**: Processes all Stripe events including subscriptions, payments, and customer updates
- **Subscription Management**: Handles subscription creation, updates, cancellations, and renewals
- **Customer Management**: Manages Stripe customer lifecycle events
- **Payment Processing**: Tracks successful and failed payments
- **Idempotency**: Prevents duplicate processing of webhook events
- **Error Handling**: Comprehensive error handling with detailed logging
- **Security**: Webhook signature verification for secure event processing

## 📁 Project Structure

```
functions/
├── src/
│   ├── index.ts                    # Main function entry point
│   ├── config.ts                   # Environment configuration
│   ├── types.ts                    # TypeScript type definitions
│   ├── stripe/
│   │   ├── subscriptionManager.ts  # Subscription operations
│   │   └── customerManager.ts      # Customer operations
│   ├── firestore/
│   │   ├── userOperations.ts      # User data operations
│   │   └── subscriptionOperations.ts # Subscription data operations
│   └── utils/
│       ├── logger.ts               # Logging utilities
│       └── validation.ts           # Input validation
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Environment Variables

Set the following environment variables in your Firebase Functions configuration:

```bash
firebase functions:config:set stripe.secret_key="sk_test_..."
firebase functions:config:set stripe.webhook_secret="whsec_..."
firebase functions:config:set stripe.price_id_premium="price_..."
firebase functions:config:set stripe.price_id_pro="price_..."
```

### 3. Build and Deploy

```bash
npm run build
npm run deploy
```

## 📡 Webhook Events Handled

### Customer Events
- `customer.created` - New customer created
- `customer.updated` - Customer information updated
- `customer.deleted` - Customer deleted

### Subscription Events
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription canceled

### Payment Events
- `invoice.payment_succeeded` - Payment completed successfully
- `invoice.payment_failed` - Payment failed
- `payment_intent.payment_failed` - Payment intent failed

## 🗄️ Firestore Data Structure

### Users Collection
```typescript
users/{userId} {
  stripeCustomerId: string
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'free'
  subscriptionId?: string
  subscriptionTier: 'free' | 'premium' | 'pro'
  subscriptionStartDate?: Timestamp
  subscriptionEndDate?: Timestamp
  lastPaymentDate?: Timestamp
  nextBillingDate?: Timestamp
  cancelAtPeriodEnd?: boolean
  canceledAt?: Timestamp
  email?: string
}
```

### Subscriptions Collection
```typescript
subscriptions/{subscriptionId} {
  userId: string
  stripeSubscriptionId: string
  status: string
  currentPeriodStart: Timestamp
  currentPeriodEnd: Timestamp
  cancelAtPeriodEnd: boolean
  canceledAt?: Timestamp
  endedAt?: Timestamp
  metadata: object
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## 🔒 Security

- **Webhook Signature Verification**: All webhooks are verified using Stripe's signature verification
- **Idempotency**: Events are tracked to prevent duplicate processing
- **Error Handling**: Comprehensive error handling with detailed logging
- **Input Validation**: All inputs are validated before processing

## 📊 Monitoring

The functions include comprehensive logging for:
- Webhook processing times
- Success/failure rates
- Event type distribution
- User subscription metrics
- Error tracking

## 🧪 Testing

### Local Testing with Stripe CLI

1. Install Stripe CLI
2. Login to your Stripe account
3. Forward events to local function:

```bash
stripe listen --forward-to localhost:5001/mapies/us-central1/handleMapiesStripeWebhooks
```

### Testing Webhook Events

```bash
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.updated
```

## 🚀 Deployment

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:handleMapiesStripeWebhooks
```

## 📝 API Endpoints

- `POST /handleMapiesStripeWebhooks` - Main webhook endpoint
- `GET /webhookStatus` - Health check endpoint

## 🔧 Configuration

### Stripe Price IDs

Configure your Stripe price IDs in the environment variables:
- `STRIPE_PRICE_ID_PREMIUM` - Premium subscription price ID
- `STRIPE_PRICE_ID_PRO` - Pro subscription price ID

### Subscription Tiers

The system supports three subscription tiers:
- **Free**: Default tier for new users
- **Premium**: Basic paid tier
- **Pro**: Advanced paid tier

## 🐛 Troubleshooting

### Common Issues

1. **Webhook Signature Verification Failed**
   - Check that `STRIPE_WEBHOOK_SECRET` is correctly set
   - Ensure webhook endpoint URL matches exactly

2. **Environment Variables Missing**
   - Verify all required environment variables are set
   - Check Firebase Functions configuration

3. **Firestore Permission Errors**
   - Ensure Firebase Admin SDK is properly initialized
   - Check Firestore security rules

### Logs

View function logs:
```bash
firebase functions:log
```

## 📈 Performance

- Functions are optimized for cold start performance
- Idempotency prevents duplicate processing
- Efficient Firestore operations with minimal reads/writes
- Comprehensive error handling prevents function failures

## 🔄 Maintenance

- Monitor webhook processing success rates
- Review error logs regularly
- Update Stripe API version as needed
- Test webhook events after any changes







