import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Price IDs for our products
const PRICE_IDS = {
  proMonthly: "price_1SWoHQ4ZFY3PZLJjOuUNl3qr",
  proYearly: "price_1SWoKB4ZFY3PZLJjR43nwg9K",
  corpMonthly: "price_1SWoHR4ZFY3PZLJjLo5N9MXB",
  corpYearly: "price_1SWoLJ4ZFY3PZLJjY7Wx9Wwx",
};

export const getPricing = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    // Fetch all prices in parallel
    const [proMonthly, proYearly, corpMonthly, corpYearly] = await Promise.all([
      stripe.prices.retrieve(PRICE_IDS.proMonthly),
      stripe.prices.retrieve(PRICE_IDS.proYearly),
      stripe.prices.retrieve(PRICE_IDS.corpMonthly),
      stripe.prices.retrieve(PRICE_IDS.corpYearly),
    ]);

    // Format response
    const pricing = {
      pro: {
        monthly: {
          id: proMonthly.id,
          amount: proMonthly.unit_amount! / 100,
          currency: proMonthly.currency,
        },
        yearly: {
          id: proYearly.id,
          amount: proYearly.unit_amount! / 100,
          currency: proYearly.currency,
        },
      },
      corporate: {
        monthly: {
          id: corpMonthly.id,
          amount: corpMonthly.unit_amount! / 100,
          currency: corpMonthly.currency,
        },
        yearly: {
          id: corpYearly.id,
          amount: corpYearly.unit_amount! / 100,
          currency: corpYearly.currency,
        },
      },
    };

    res.json(pricing);
  } catch (error: any) {
    console.error("Error fetching pricing from Stripe:", error);
    res.status(500).json({ error: "Failed to fetch pricing" });
  }
});
