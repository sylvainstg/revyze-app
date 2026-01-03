import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebaseConfig";

const functions = getFunctions(app);

export const createCheckoutSession = async (
  priceId: string,
): Promise<string | null> => {
  try {
    const createStripeCheckout = httpsCallable(
      functions,
      "createStripeCheckout",
    );
    const result = await createStripeCheckout({ priceId });
    const data = result.data as { url: string };
    return data.url;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return null;
  }
};

export const createPortalSession = async (): Promise<string | null> => {
  try {
    const createStripePortalSession = httpsCallable(
      functions,
      "createStripePortalSession",
    );
    const result = await createStripePortalSession();
    const data = result.data as { url: string };
    return data.url;
  } catch (error) {
    console.error("Error creating portal session:", error);
    return null;
  }
};
export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  receipt_url: string;
}

export const fetchUserPaymentHistory = async (
  uid: string,
): Promise<PaymentRecord[]> => {
  try {
    const getUserPaymentHistory = httpsCallable(
      functions,
      "getUserPaymentHistory",
    );
    const result = await getUserPaymentHistory({ uid });
    const data = result.data as { history: PaymentRecord[] };
    return data.history;
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return [];
  }
};
