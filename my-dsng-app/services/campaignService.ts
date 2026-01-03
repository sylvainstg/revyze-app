import { db } from "../firebaseConfig";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { logEvent } from "./analyticsService";
import {
  FeedbackCampaign,
  CampaignAttribution,
  FeedbackAnswer,
  CampaignAnalytics,
} from "../types/campaign";

const CAMPAIGNS_COLLECTION = "feedback_campaigns";
const ATTRIBUTION_COLLECTION = "campaign_attribution";

/**
 * Records that a campaign was shown to a user
 */
export const recordCampaignShown = async (
  userId: string,
  campaignId: string,
  variantId?: string,
): Promise<void> => {
  await logEvent(userId, "feedback_campaign_shown", {
    campaignId,
    variantId,
    timestamp: Date.now(),
  });

  // Create attribution record
  await addDoc(collection(db, ATTRIBUTION_COLLECTION), {
    campaignId,
    userId,
    shownAt: serverTimestamp(),
    variantId,
    conversions: [],
    totalValue: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Records a campaign answer
 */
export const recordCampaignAnswer = async (
  userId: string,
  campaignId: string,
  answer: FeedbackAnswer,
): Promise<void> => {
  await logEvent(userId, "feedback_campaign_answered", {
    campaignId,
    variantId: answer.variantId,
    answer: answer.answer,
    timestamp: Date.now(),
  });

  // Update attribution record
  const attrQuery = query(
    collection(db, ATTRIBUTION_COLLECTION),
    where("campaignId", "==", campaignId),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  const attrSnapshot = await getDocs(attrQuery);
  if (!attrSnapshot.empty) {
    const attrDoc = attrSnapshot.docs[0];
    await updateDoc(doc(db, ATTRIBUTION_COLLECTION, attrDoc.id), {
      answeredAt: serverTimestamp(),
      answer: answer.answer,
      updatedAt: serverTimestamp(),
    });
  }
};

/**
 * Records a campaign dismissal
 */
export const recordCampaignDismissed = async (
  userId: string,
  campaignId: string,
  variantId?: string,
): Promise<void> => {
  await logEvent(userId, "feedback_campaign_dismissed", {
    campaignId,
    variantId,
    timestamp: Date.now(),
  });
};

/**
 * Checks if user has seen a campaign recently (frequency cap)
 */
export const checkFrequencyCap = async (
  userId: string,
  frequencyCapDays: number,
): Promise<boolean> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - frequencyCapDays);

  const attrQuery = query(
    collection(db, ATTRIBUTION_COLLECTION),
    where("userId", "==", userId),
    where("shownAt", ">=", Timestamp.fromDate(cutoffDate)),
  );

  const snapshot = await getDocs(attrQuery);
  return snapshot.empty; // true if can show (no recent campaigns)
};

/**
 * Gets active campaigns for a segment
 */
export const getActiveCampaigns = async (
  segmentType: string,
): Promise<FeedbackCampaign[]> => {
  const now = Timestamp.now();

  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    where("status", "==", "active"),
    where("segmentType", "in", [segmentType, "all"]),
    where("activeFrom", "<=", now),
    where("activeUntil", ">=", now),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as FeedbackCampaign,
  );
};

/**
 * Selects an A/B test variant based on weights
 */
export const selectVariant = (
  campaign: FeedbackCampaign,
): { id: string; question: string; choices?: string[] } | null => {
  if (!campaign.variants || campaign.variants.length === 0) {
    return null;
  }

  // Random selection based on weights
  const random = Math.random() * 100;
  let cumulative = 0;

  for (const variant of campaign.variants) {
    cumulative += variant.weight;
    if (random <= cumulative) {
      return {
        id: variant.id,
        question: variant.question,
        choices: variant.choices,
      };
    }
  }

  // Fallback to first variant
  return {
    id: campaign.variants[0].id,
    question: campaign.variants[0].question,
    choices: campaign.variants[0].choices,
  };
};

/**
 * Records a conversion for attribution
 */
export const recordConversion = async (
  userId: string,
  conversionType: string,
  value?: number,
  metadata?: any,
): Promise<void> => {
  // Find recent campaign attributions within attribution window
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const attrQuery = query(
    collection(db, ATTRIBUTION_COLLECTION),
    where("userId", "==", userId),
    where("answeredAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
  );

  const snapshot = await getDocs(attrQuery);

  // Update all matching attribution records
  const updatePromises = snapshot.docs.map(async (attrDoc) => {
    const data = attrDoc.data();
    const conversions = data.conversions || [];

    conversions.push({
      type: conversionType,
      timestamp: serverTimestamp(),
      value: value || 0,
      metadata,
    });

    const totalValue = conversions.reduce(
      (sum: number, conv: any) => sum + (conv.value || 0),
      0,
    );

    await updateDoc(doc(db, ATTRIBUTION_COLLECTION, attrDoc.id), {
      conversions,
      totalValue,
      updatedAt: serverTimestamp(),
    });
  });

  await Promise.all(updatePromises);
};
