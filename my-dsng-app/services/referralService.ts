import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebaseConfig";
import { ReferralStats, FeatureCost } from "../types";

const functions = getFunctions(app);

/**
 * Get or create a referral code for the current user
 */
export const getUserReferralCode = async (): Promise<string> => {
  try {
    const getUserReferralCodeFn = httpsCallable(
      functions,
      "getUserReferralCode",
    );
    const result = await getUserReferralCodeFn({});
    const data = result.data as { referralCode: string };
    return data.referralCode;
  } catch (error) {
    console.error("Error getting referral code:", error);
    throw error;
  }
};

/**
 * Apply a referral code during signup
 */
export const applyReferralCode = async (
  referralCode: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const applyReferralCodeFn = httpsCallable(
      functions,
      "applyReferralCodeFunction",
    );
    const result = await applyReferralCodeFn({ referralCode });
    return result.data as { success: boolean; message: string };
  } catch (error: any) {
    console.error("Error applying referral code:", error);
    return {
      success: false,
      message: error.message || "Failed to apply referral code",
    };
  }
};

/**
 * Get referral statistics for the current user
 */
export const getReferralStats = async (): Promise<ReferralStats> => {
  try {
    const getReferralStatsFn = httpsCallable(
      functions,
      "getReferralStatsFunction",
    );
    const result = await getReferralStatsFn({});
    return result.data as ReferralStats;
  } catch (error) {
    console.error("Error getting referral stats:", error);
    throw error;
  }
};

/**
 * Redeem tokens for a premium feature
 */
export const redeemTokensForFeature = async (
  featureId: string,
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  try {
    const redeemTokensFn = httpsCallable(functions, "redeemTokens");
    const result = await redeemTokensFn({ featureId });
    return result.data as {
      success: boolean;
      message: string;
      newBalance?: number;
    };
  } catch (error: any) {
    console.error("Error redeeming tokens:", error);
    return {
      success: false,
      message: error.message || "Failed to redeem tokens",
    };
  }
};

/**
 * Get all feature costs (public)
 */
export const getFeatureCosts = async (): Promise<FeatureCost[]> => {
  try {
    const getFeatureCostsFn = httpsCallable(functions, "getFeatureCosts");
    const result = await getFeatureCostsFn({});
    const data = result.data as { features: FeatureCost[] };
    return data.features || [];
  } catch (error) {
    console.error("Error getting feature costs:", error);
    return [];
  }
};

/**
 * Admin: Get all referral data
 */
export const getAdminReferralData = async () => {
  try {
    const getAdminReferralDataFn = httpsCallable(
      functions,
      "getAdminReferralData",
    );
    const result = await getAdminReferralDataFn({});
    return result.data;
  } catch (error) {
    console.error("Error getting admin referral data:", error);
    throw error;
  }
};

/**
 * Admin: Update feature cost
 */
export const updateFeatureCost = async (
  featureId: string,
  featureName: string,
  description: string,
  tokenCost: number,
  enabled: boolean,
): Promise<{ success: boolean; message: string }> => {
  try {
    const updateFeatureCostFn = httpsCallable(functions, "updateFeatureCost");
    const result = await updateFeatureCostFn({
      featureId,
      featureName,
      description,
      tokenCost,
      enabled,
    });
    return result.data as { success: boolean; message: string };
  } catch (error: any) {
    console.error("Error updating feature cost:", error);
    return {
      success: false,
      message: error.message || "Failed to update feature cost",
    };
  }
};
