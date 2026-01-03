import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";
import { RemoteConfigCampaign } from "../types/campaign";

interface ActiveFeedbackResponse {
  campaign: RemoteConfigCampaign | null;
}

export const getActiveFeedback = async (
  forceCampaignId?: string,
): Promise<RemoteConfigCampaign | null> => {
  const callable = httpsCallable<any, ActiveFeedbackResponse>(
    functions,
    "feedbackActive",
  );
  const result = await callable({ forceCampaignId });
  return result.data.campaign || null;
};

export const submitFeedbackAnswer = async (
  campaignId: string,
  answer: any,
): Promise<void> => {
  const callable = httpsCallable(functions, "feedbackAnswer");
  await callable({ campaignId, answer });
};

// Admin helpers
export const listFeedbackCampaigns = async () => {
  const callable = httpsCallable(functions, "adminListFeedbackCampaigns");
  const res = await callable({});
  return res.data;
};

export const createFeedbackCampaign = async (payload: any) => {
  const callable = httpsCallable(functions, "adminCreateFeedbackCampaign");
  const res = await callable(payload);
  return res.data;
};

export const updateFeedbackCampaign = async (id: string, updates: any) => {
  const callable = httpsCallable(functions, "adminUpdateFeedbackCampaign");
  const res = await callable({ id, ...updates });
  return res.data;
};

export const sendFeedbackEmailFallbacks = async () => {
  const callable = httpsCallable(functions, "sendFeedbackEmailFallbacks");
  const res = await callable({});
  return res.data;
};

export const getFeedbackAnswers = async (campaignId: string) => {
  const callable = httpsCallable(functions, "adminGetCampaignAnswers");
  const res = await callable({ campaignId });
  return res.data as { answers: any[] };
};
