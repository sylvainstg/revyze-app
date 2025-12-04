import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

const functions = getFunctions(app);

export interface StripePricing {
    priceId: string;
    amount: number;
    currency: string;
}

export interface StripePlanPricing {
    id: string;
    name: string;
    description: string;
    pricing: {
        monthly: StripePricing | null;
        yearly: StripePricing | null;
    };
}

/**
 * Fetches pricing information from Stripe via Cloud Function
 */
export const fetchStripePricing = async (): Promise<StripePlanPricing[]> => {
    try {
        const getSubscriptionPlans = httpsCallable(functions, 'getSubscriptionPlansFunction');
        const result = await getSubscriptionPlans();
        const data = result.data as { plans: StripePlanPricing[] };
        return data.plans;
    } catch (error) {
        console.error('Error fetching Stripe pricing:', error);
        throw error;
    }
};

/**
 * Enriches plan metadata with Stripe pricing data
 */
export const enrichPlansWithPricing = (planMetadata: any, stripePricing: StripePlanPricing[]) => {
    const enrichedPlans: any = { ...planMetadata };

    // Add free plan pricing (always $0)
    if (enrichedPlans.free) {
        enrichedPlans.free.price = {
            monthly: '$0.00',
            yearly: '$0.00'
        };
        enrichedPlans.free.priceIds = {
            monthly: null,
            yearly: null
        };
    }

    // Enrich pro and business plans with Stripe data
    stripePricing.forEach(stripePlan => {
        let planKey: string | null = null;

        if (stripePlan.id === 'pro_plan') {
            planKey = 'pro';
        } else if (stripePlan.id === 'corporate_plan') {
            planKey = 'business';
        }

        if (planKey && enrichedPlans[planKey]) {
            enrichedPlans[planKey].price = {
                monthly: stripePlan.pricing.monthly
                    ? `$${stripePlan.pricing.monthly.amount.toFixed(2)}`
                    : '$0.00',
                yearly: stripePlan.pricing.yearly
                    ? `$${stripePlan.pricing.yearly.amount.toFixed(2)}`
                    : '$0.00'
            };
            enrichedPlans[planKey].priceIds = {
                monthly: stripePlan.pricing.monthly?.priceId || null,
                yearly: stripePlan.pricing.yearly?.priceId || null
            };
        }
    });

    return enrichedPlans;
};
