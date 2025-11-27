import Stripe from "stripe";
import * as admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
});

const DOMAIN = process.env.STRIPE_DOMAIN || "https://dsng-app.web.app";

export const initializeStripeProducts = async () => {
    const products = [
        {
            name: "Pro Plan",
            id: "pro_plan",
            description: "Unlimited projects and collaborators",
            metadata: { role: "pro" },
            default_price_data: {
                currency: "usd",
                unit_amount: 1500, // $15.00
                recurring: { interval: "month" as Stripe.Price.Recurring.Interval },
            },
        },
        {
            name: "Corporate Plan",
            id: "corporate_plan",
            description: "Advanced features and priority support",
            metadata: { role: "business" },
            default_price_data: {
                currency: "usd",
                unit_amount: 5000, // $50.00
                recurring: { interval: "month" as Stripe.Price.Recurring.Interval },
            },
        },
    ];

    for (const product of products) {
        try {
            await stripe.products.retrieve(product.id);
            console.log(`Product ${product.name} already exists.`);
        } catch (error) {
            console.log(`Creating product ${product.name}...`);
            await stripe.products.create({
                id: product.id,
                name: product.name,
                description: product.description,
                metadata: product.metadata,
                default_price_data: product.default_price_data,
            });
        }
    }
};

export const createCheckoutSession = async (uid: string, priceId: string) => {
    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email;

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        customer_email: email,
        metadata: {
            firebaseUID: uid,
        },
        success_url: `${DOMAIN}/dashboard?success=true`,
        cancel_url: `${DOMAIN}/pricing?canceled=true`,
    });

    return session.url;
};
