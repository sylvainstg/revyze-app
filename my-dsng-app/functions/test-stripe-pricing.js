// Test script to query Stripe pricing for pro_plan and corporate_plan
// Run this in the Firebase Functions environment to see actual Stripe data

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
});

async function testStripePricing() {
    console.log('=== Testing Stripe Pricing ===\n');

    const plans = [
        { id: 'pro_plan', name: 'Pro Plan' },
        { id: 'corporate_plan', name: 'Corporate Plan' }
    ];

    for (const plan of plans) {
        console.log(`\n--- ${plan.name} (${plan.id}) ---`);

        try {
            // Get product
            const product = await stripe.products.retrieve(plan.id, {
                expand: ['default_price']
            });
            console.log('Product Name:', product.name);
            console.log('Product Description:', product.description);
            console.log('Default Price:', product.default_price);

            // Get all prices for this product
            const prices = await stripe.prices.list({
                product: plan.id,
                active: true
            });

            console.log(`\nFound ${prices.data.length} active price(s):`);
            prices.data.forEach((price, index) => {
                console.log(`\nPrice ${index + 1}:`);
                console.log('  ID:', price.id);
                console.log('  Amount:', price.unit_amount, '(cents)');
                console.log('  Amount (dollars):', price.unit_amount ? price.unit_amount / 100 : 0);
                console.log('  Currency:', price.currency);
                console.log('  Recurring:', price.recurring);
                console.log('  Interval:', price.recurring?.interval);
                console.log('  Active:', price.active);
            });

            const monthlyPrice = prices.data.find(p => p.recurring?.interval === 'month');
            const yearlyPrice = prices.data.find(p => p.recurring?.interval === 'year');

            console.log('\n✓ Monthly Price:', monthlyPrice ? `$${monthlyPrice.unit_amount / 100} (${monthlyPrice.id})` : 'NOT FOUND');
            console.log('✓ Yearly Price:', yearlyPrice ? `$${yearlyPrice.unit_amount / 100} (${yearlyPrice.id})` : 'NOT FOUND');

        } catch (error) {
            console.error('ERROR:', error.message);
        }
    }
}

testStripePricing().then(() => {
    console.log('\n=== Test Complete ===');
}).catch(err => {
    console.error('Test failed:', err);
});
