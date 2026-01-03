import * as admin from "firebase-admin";

// Type definitions (duplicated from main types.ts since functions can't import from parent)
interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referralCode: string;
  status: "pending" | "converted" | "expired";
  createdAt: number;
  convertedAt?: number;
  rewardAmount?: number;
  expiresAt: number;
}

interface RewardTransaction {
  id: string;
  userId: string;
  type: "earned" | "redeemed" | "expired";
  amount: number;
  description: string;
  timestamp: number;
  relatedReferralId?: string;
  relatedFeatureId?: string;
}

interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  pendingReferrals: number;
  convertedReferrals: number;
  expiredReferrals: number;
  tokenBalance: number;
  lifetimeEarnings: number;
  recentTransactions: RewardTransaction[];
}

// Referral Constants
export const REFERRAL_CONSTANTS = {
  TOKENS_PER_REFERRAL: 100,
  REFERRAL_EXPIRATION_DAYS: 90,
  MINIMUM_REDEMPTION: 50,
};

/**
 * Generate a unique 8-character referral code
 */
export const generateUniqueReferralCode = async (): Promise<string> => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding similar-looking characters
  let code = "";
  let isUnique = false;

  while (!isUnique) {
    code = "";
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existingUser = await admin
      .firestore()
      .collection("users")
      .where("referralCode", "==", code)
      .limit(1)
      .get();

    isUnique = existingUser.empty;
  }

  return code;
};

/**
 * Get or create a referral code for a user
 */
export const getOrCreateReferralCode = async (
  userId: string,
): Promise<string> => {
  const userRef = admin.firestore().collection("users").doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  if (userData?.referralCode) {
    return userData.referralCode;
  }

  // Generate new code
  const newCode = await generateUniqueReferralCode();
  await userRef.update({
    referralCode: newCode,
    tokenBalance: userData?.tokenBalance || 0,
    totalReferrals: userData?.totalReferrals || 0,
  });

  return newCode;
};

/**
 * Apply a referral code when a user signs up
 */
export const applyReferralCode = async (
  newUserId: string,
  referralCode: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Find the referrer by code
    const referrerQuery = await admin
      .firestore()
      .collection("users")
      .where("referralCode", "==", referralCode.toUpperCase())
      .limit(1)
      .get();

    if (referrerQuery.empty) {
      return { success: false, message: "Invalid referral code" };
    }

    const referrerId = referrerQuery.docs[0].id;

    // Don't allow self-referral
    if (referrerId === newUserId) {
      return { success: false, message: "Cannot use your own referral code" };
    }

    // Create referral record
    const expiresAt =
      Date.now() +
      REFERRAL_CONSTANTS.REFERRAL_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
    const referralData: Omit<Referral, "id"> = {
      referrerId,
      referredUserId: newUserId,
      referralCode: referralCode.toUpperCase(),
      status: "pending",
      createdAt: Date.now(),
      expiresAt,
    };

    const referralRef = await admin
      .firestore()
      .collection("referrals")
      .add(referralData);

    // Update new user with referredBy
    await admin.firestore().collection("users").doc(newUserId).update({
      referredBy: referrerId,
    });

    console.log(
      `Referral created: ${referralRef.id} - ${referrerId} referred ${newUserId}`,
    );
    return { success: true, message: "Referral code applied successfully" };
  } catch (error) {
    console.error("Error applying referral code:", error);
    return { success: false, message: "Failed to apply referral code" };
  }
};

/**
 * Process referral conversion when referred user subscribes
 */
export const processReferralConversion = async (
  convertedUserId: string,
): Promise<void> => {
  try {
    // Find pending referral for this user
    const referralQuery = await admin
      .firestore()
      .collection("referrals")
      .where("referredUserId", "==", convertedUserId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (referralQuery.empty) {
      console.log(`No pending referral found for user ${convertedUserId}`);
      return;
    }

    const referralDoc = referralQuery.docs[0];
    const referralData = referralDoc.data() as Referral;

    // Check if expired
    if (Date.now() > referralData.expiresAt) {
      await referralDoc.ref.update({ status: "expired" });
      console.log(`Referral ${referralDoc.id} expired`);
      return;
    }

    const tokensAwarded = REFERRAL_CONSTANTS.TOKENS_PER_REFERRAL;

    // Update referral status
    await referralDoc.ref.update({
      status: "converted",
      convertedAt: Date.now(),
      rewardAmount: tokensAwarded,
    });

    // Award tokens to referrer
    const referrerRef = admin
      .firestore()
      .collection("users")
      .doc(referralData.referrerId);
    const referrerDoc = await referrerRef.get();
    const referrerData = referrerDoc.data();

    const newBalance = (referrerData?.tokenBalance || 0) + tokensAwarded;
    const newTotalReferrals = (referrerData?.totalReferrals || 0) + 1;

    await referrerRef.update({
      tokenBalance: newBalance,
      totalReferrals: newTotalReferrals,
    });

    // Create transaction record
    const transaction: Omit<RewardTransaction, "id"> = {
      userId: referralData.referrerId,
      type: "earned",
      amount: tokensAwarded,
      description: `Referral reward for user conversion`,
      timestamp: Date.now(),
      relatedReferralId: referralDoc.id,
    };

    await admin.firestore().collection("transactions").add(transaction);

    console.log(
      `Referral converted: ${referralDoc.id} - Awarded ${tokensAwarded} tokens to ${referralData.referrerId}`,
    );
  } catch (error) {
    console.error("Error processing referral conversion:", error);
    throw error;
  }
};

/**
 * Get referral statistics for a user
 */
export const getUserReferralStats = async (
  userId: string,
): Promise<ReferralStats> => {
  try {
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();
    const userData = userDoc.data();

    // Get all referrals
    const referralsQuery = await admin
      .firestore()
      .collection("referrals")
      .where("referrerId", "==", userId)
      .get();

    const referrals = referralsQuery.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Referral,
    );

    const pending = referrals.filter((r) => r.status === "pending").length;
    const converted = referrals.filter((r) => r.status === "converted").length;
    const expired = referrals.filter((r) => r.status === "expired").length;

    // Get recent transactions
    const transactionsQuery = await admin
      .firestore()
      .collection("transactions")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    const transactions = transactionsQuery.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as RewardTransaction,
    );

    // Calculate lifetime earnings
    const lifetimeEarnings = transactions
      .filter((t) => t.type === "earned")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      referralCode: userData?.referralCode || "",
      totalReferrals: referrals.length,
      pendingReferrals: pending,
      convertedReferrals: converted,
      expiredReferrals: expired,
      tokenBalance: userData?.tokenBalance || 0,
      lifetimeEarnings,
      recentTransactions: transactions,
    };
  } catch (error) {
    console.error("Error getting referral stats:", error);
    throw error;
  }
};

/**
 * Redeem tokens for a feature
 */
export const redeemTokensForFeature = async (
  userId: string,
  featureId: string,
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  try {
    // Get feature cost
    const featureDoc = await admin
      .firestore()
      .collection("featureCosts")
      .doc(featureId)
      .get();

    if (!featureDoc.exists) {
      return { success: false, message: "Feature not found" };
    }

    const featureData = featureDoc.data();
    if (!featureData?.enabled) {
      return {
        success: false,
        message: "Feature is not available for redemption",
      };
    }

    const cost = featureData.tokenCost;

    // Get user balance
    const userRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const currentBalance = userData?.tokenBalance || 0;

    if (currentBalance < cost) {
      return {
        success: false,
        message: `Insufficient tokens. Need ${cost}, have ${currentBalance}`,
      };
    }

    // Deduct tokens
    const newBalance = currentBalance - cost;
    await userRef.update({ tokenBalance: newBalance });

    // Create transaction record
    const transaction: Omit<RewardTransaction, "id"> = {
      userId,
      type: "redeemed",
      amount: -cost,
      description: `Redeemed for ${featureData.featureName}`,
      timestamp: Date.now(),
      relatedFeatureId: featureId,
    };

    await admin.firestore().collection("transactions").add(transaction);

    console.log(`User ${userId} redeemed ${cost} tokens for ${featureId}`);
    return {
      success: true,
      message: "Tokens redeemed successfully",
      newBalance,
    };
  } catch (error) {
    console.error("Error redeeming tokens:", error);
    return { success: false, message: "Failed to redeem tokens" };
  }
};

/**
 * Expire old pending referrals (to be run periodically)
 */
export const expireOldReferrals = async (): Promise<number> => {
  try {
    const now = Date.now();
    const expiredQuery = await admin
      .firestore()
      .collection("referrals")
      .where("status", "==", "pending")
      .where("expiresAt", "<=", now)
      .get();

    const batch = admin.firestore().batch();
    expiredQuery.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "expired" });
    });

    await batch.commit();
    console.log(`Expired ${expiredQuery.size} old referrals`);
    return expiredQuery.size;
  } catch (error) {
    console.error("Error expiring old referrals:", error);
    return 0;
  }
};

/**
 * Get referrer information by referral code (for landing page personalization)
 */
export const getReferrerInfo = async (
  referralCode: string,
): Promise<{ success: boolean; referrerName?: string; message?: string }> => {
  try {
    const referrerQuery = await admin
      .firestore()
      .collection("users")
      .where("referralCode", "==", referralCode.toUpperCase())
      .limit(1)
      .get();

    if (referrerQuery.empty) {
      return { success: false, message: "Invalid referral code" };
    }

    const referrerData = referrerQuery.docs[0].data();
    return {
      success: true,
      referrerName: referrerData.name || "Someone",
    };
  } catch (error) {
    console.error("Error getting referrer info:", error);
    return { success: false, message: "Failed to get referrer information" };
  }
};
