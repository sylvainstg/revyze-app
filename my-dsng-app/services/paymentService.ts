import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

const functions = getFunctions(app);

export const createCheckoutSession = async (priceId: string): Promise<string | null> => {
    try {
        const createStripeCheckout = httpsCallable(functions, 'createStripeCheckout');
        const result = await createStripeCheckout({ priceId });
        const data = result.data as { url: string };
        return data.url;
    } catch (error) {
        console.error("Error creating checkout session:", error);
        return null;
    }
};
