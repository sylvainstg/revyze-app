import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createCheckoutSession, initializeStripeProducts } from "./stripeService";
import { getPDF } from "./pdfProxy";
import Stripe from "stripe";

admin.initializeApp();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export const createStripeCheckout = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    const priceId = data.priceId;
    const url = await createCheckoutSession(context.auth.uid, priceId);
    return { url };
});

export const initStripe = functions.https.onRequest(async (req, res) => {
    await initializeStripeProducts();
    res.send("Stripe products initialized.");
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig as string, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    switch (event.type) {
        case "checkout.session.completed":
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.metadata && session.metadata.firebaseUID) {
                const uid = session.metadata.firebaseUID;
                console.log(`Processing checkout session for user: ${uid}`);

                // Retrieve the subscription to get the plan details if needed, 
                // or just rely on the price ID from the line items if we had them.
                // For simplicity, we'll assume the plan based on the price or just mark as 'pro' for now.
                // Ideally we map price ID to role.

                // We need to know which plan they bought. 
                // In a real app, we'd look up the price ID.
                // For this MVP, let's fetch the line items or subscription.

                try {
                    await admin.firestore().collection("users").doc(uid).update({
                        plan: "pro", // Defaulting to pro for now, logic should be more robust
                        subscriptionStatus: "active"
                    });
                    console.log(`Successfully updated user ${uid} to plan: pro`);
                } catch (error) {
                    console.error(`Failed to update user ${uid}:`, error);
                }
            } else {
                console.warn("Checkout session missing firebaseUID metadata");
            }
            break;
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`Subscription status: ${subscription.status}`);
            // Handle subscription changes (cancellation, etc.)
            // We need to find the user by customer ID or metadata
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }


    res.json({ received: true });
});

// Export PDF proxy function
export { getPDF };

// Export Email service
export * from "./emailService";
export * from "./pricingService";
