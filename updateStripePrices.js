const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function updateStripePrices() {
  try {
    console.log('🔄 Starting Stripe price updates...');

    // Price updates to match UI
    const priceUpdates = [
      {
        priceId: 'price_1SLn1lQ5zKkScSt26QWJ1kfz', // Starter
        newAmount: 1400, // $14.00 in cents
        planName: 'Starter'
      },
      {
        priceId: 'price_1SLn1mQ5zKkScSt2ptUM9Lr0', // Professional  
        newAmount: 3600, // $36.00 in cents
        planName: 'Professional'
      },
      {
        priceId: 'price_1SLn1mQ5zKkScSt2qKv1dRDs', // Enterprise
        newAmount: 4800, // $48.00 in cents
        planName: 'Enterprise'
      }
    ];

    for (const update of priceUpdates) {
      try {
        console.log(`\n📝 Updating ${update.planName} price...`);
        
        // Get current price details
        const currentPrice = await stripe.prices.retrieve(update.priceId);
        console.log(`   Current: $${(currentPrice.unit_amount / 100).toFixed(2)} CAD`);
        
        // Create new price with updated amount
        const newPrice = await stripe.prices.create({
          currency: 'cad',
          unit_amount: update.newAmount,
          recurring: {
            interval: 'month',
          },
          product: currentPrice.product,
          nickname: `${update.planName} - Updated Price`,
        });
        
        console.log(`   ✅ New: $${(update.newAmount / 100).toFixed(2)} CAD`);
        console.log(`   📋 New Price ID: ${newPrice.id}`);
        
        // Archive the old price
        await stripe.prices.update(update.priceId, {
          active: false,
        });
        
        console.log(`   🗄️ Archived old price: ${update.priceId}`);
        
      } catch (error) {
        console.error(`   ❌ Error updating ${update.planName}:`, error.message);
      }
    }

    console.log('\n🎉 Stripe price updates completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your app config with the new price IDs');
    console.log('2. Redeploy your application');
    console.log('3. Test the new pricing');

  } catch (error) {
    console.error('❌ Error updating Stripe prices:', error);
  }
}

// Run the update
updateStripePrices();

