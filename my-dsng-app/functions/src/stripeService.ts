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
        unit_amount: 1000, // $10.00
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

export const createPortalSession = async (uid: string) => {
  const userRecord = await admin.auth().getUser(uid);
  const email = userRecord.email;

  const isLive = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  console.log(
    `[Stripe] Creating portal session for ${email}. Mode: ${isLive ? "LIVE" : "TEST"}`,
  );

  if (!email) {
    throw new Error("User does not have an email address.");
  }

  // 1. Try to get customer ID from Firestore
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  let customerId = userDoc.data()?.stripeCustomerId;

  // 2. If not found, search Stripe by email
  if (!customerId) {
    console.log(
      `No stripeCustomerId for user ${uid}, searching by email ${email}...`,
    );
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      // Save it for next time
      await admin.firestore().collection("users").doc(uid).update({
        stripeCustomerId: customerId,
      });
    }
  }

  if (!customerId) {
    throw new Error("No subscription found for this user.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${DOMAIN}/dashboard`,
  });

  return session.url;
};

export const getPaymentHistory = async (uid: string) => {
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  const customerId = userDoc.data()?.stripeCustomerId;

  if (!customerId) {
    return [];
  }

  const charges = await stripe.charges.list({
    customer: customerId,
    limit: 10,
  });

  return charges.data.map((charge) => ({
    id: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    created: charge.created,
    receipt_url: charge.receipt_url,
  }));
};

export const getSubscriptionPlans = async () => {
  const plans = [
    { id: "pro_plan", name: "Pro Plan" },
    { id: "corporate_plan", name: "Corporate Plan" },
  ];

  const result = [];

  for (const plan of plans) {
    try {
      console.log(`[getSubscriptionPlans] Fetching product: ${plan.id}`);

      const product = await stripe.products.retrieve(plan.id, {
        expand: ["default_price"],
      });

      console.log(`[getSubscriptionPlans] Product ${plan.id}:`, {
        name: product.name,
        description: product.description,
      });

      // Get all prices for this product (monthly and yearly)
      const prices = await stripe.prices.list({
        product: plan.id,
        active: true,
      });

      console.log(
        `[getSubscriptionPlans] Found ${prices.data.length} active prices for ${plan.id}`,
      );

      prices.data.forEach((price, index) => {
        console.log(`[getSubscriptionPlans] Price ${index + 1}:`, {
          id: price.id,
          amount: price.unit_amount,
          amountDollars: price.unit_amount ? price.unit_amount / 100 : 0,
          currency: price.currency,
          interval: price.recurring?.interval,
        });
      });

      const monthlyPrice = prices.data.find(
        (p) => p.recurring?.interval === "month",
      );
      const yearlyPrice = prices.data.find(
        (p) => p.recurring?.interval === "year",
      );

      console.log(
        `[getSubscriptionPlans] ${plan.id} - Monthly:`,
        monthlyPrice ? `$${monthlyPrice.unit_amount! / 100}` : "NOT FOUND",
      );
      console.log(
        `[getSubscriptionPlans] ${plan.id} - Yearly:`,
        yearlyPrice ? `$${yearlyPrice.unit_amount! / 100}` : "NOT FOUND",
      );

      const planData = {
        id: plan.id,
        name: product.name,
        description: product.description || "",
        pricing: {
          monthly: monthlyPrice
            ? {
                priceId: monthlyPrice.id,
                amount: monthlyPrice.unit_amount! / 100,
                currency: monthlyPrice.currency,
              }
            : null,
          yearly: yearlyPrice
            ? {
                priceId: yearlyPrice.id,
                amount: yearlyPrice.unit_amount! / 100,
                currency: yearlyPrice.currency,
              }
            : null,
        },
      };

      console.log(
        `[getSubscriptionPlans] Returning data for ${plan.id}:`,
        JSON.stringify(planData, null, 2),
      );
      result.push(planData);
    } catch (error) {
      console.error(
        `[getSubscriptionPlans] Error fetching plan ${plan.id}:`,
        error,
      );
    }
  }

  console.log(
    `[getSubscriptionPlans] Final result:`,
    JSON.stringify(result, null, 2),
  );
  return result;
};
