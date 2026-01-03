import { useState, useEffect } from "react";
import { User } from "../types";
import {
  FeedbackCampaign,
  RemoteConfigCampaign,
  FeedbackAnswer,
} from "../types/campaign";
import {
  getActiveCampaigns,
  selectVariant,
  checkFrequencyCap,
  recordCampaignShown,
  recordCampaignAnswer,
  recordCampaignDismissed,
} from "../services/campaignService";

const DISMISS_STORAGE_KEY = "revyze_dismissed_campaigns";
const DISMISS_DURATION_DAYS = 14;

interface UseFeedbackCampaignResult {
  campaign: RemoteConfigCampaign | null;
  loading: boolean;
  submitAnswer: (answer: FeedbackAnswer) => Promise<void>;
  dismiss: () => void;
}

export const useFeedbackCampaign = (
  currentUser: User | null,
): UseFeedbackCampaignResult => {
  const [campaign, setCampaign] = useState<RemoteConfigCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    fetchActiveCampaign();
  }, [currentUser]);

  const fetchActiveCampaign = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Check if user dismissed any campaigns recently
      const dismissed = getDismissedCampaigns();
      const now = Date.now();

      // Determine user segment
      const segment = getUserSegment(currentUser);

      // Get active campaigns for this segment
      const campaigns = await getActiveCampaigns(segment);

      if (campaigns.length === 0) {
        setCampaign(null);
        return;
      }

      // Find first non-dismissed campaign that passes frequency cap
      for (const camp of campaigns) {
        // Check if dismissed recently
        const dismissedAt = dismissed[camp.id];
        if (
          dismissedAt &&
          now - dismissedAt < DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000
        ) {
          continue;
        }

        // Check frequency cap
        const canShow = await checkFrequencyCap(
          currentUser.id,
          camp.frequencyCapDays,
        );
        if (!canShow) {
          continue;
        }

        // Select A/B variant if applicable
        const variant = selectVariant(camp);

        // Build campaign object for display
        const displayCampaign: RemoteConfigCampaign = {
          id: camp.id,
          question: variant ? variant.question : camp.question,
          type: camp.type,
          choices: variant ? variant.choices : camp.choices,
          variant: variant
            ? {
                id: variant.id,
                question: variant.question,
                choices: variant.choices,
              }
            : undefined,
        };

        setCampaign(displayCampaign);
        setActiveCampaignId(camp.id);

        // Record impression
        await recordCampaignShown(currentUser.id, camp.id, variant?.id);

        break;
      }
    } catch (error) {
      console.error("Error fetching campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: FeedbackAnswer) => {
    if (!currentUser || !activeCampaignId) return;

    try {
      await recordCampaignAnswer(currentUser.id, activeCampaignId, answer);
      setCampaign(null);
      setActiveCampaignId(null);
    } catch (error) {
      console.error("Error submitting answer:", error);
      throw error;
    }
  };

  const dismiss = () => {
    if (!activeCampaignId) return;

    // Record dismissal
    if (currentUser) {
      recordCampaignDismissed(
        currentUser.id,
        activeCampaignId,
        campaign?.variant?.id,
      );
    }

    // Store dismissal in localStorage
    const dismissed = getDismissedCampaigns();
    dismissed[activeCampaignId] = Date.now();
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissed));

    setCampaign(null);
    setActiveCampaignId(null);
  };

  return {
    campaign,
    loading,
    submitAnswer,
    dismiss,
  };
};

// Helper: Get dismissed campaigns from localStorage
const getDismissedCampaigns = (): Record<string, number> => {
  try {
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Helper: Determine user segment based on engagement data
const getUserSegment = (user: User): string => {
  const engagementScore = user.engagementScore || 0;
  const plan = user.plan || "free";
  const lastActive = user.lastLogin ? new Date(user.lastLogin).getTime() : 0;
  const daysSinceActive = (Date.now() - lastActive) / (1000 * 60 * 60 * 24);
  const projectCount = user.projectCount || 0;
  const accountAge = user.createdAt
    ? (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  // Power users: High engagement + Pro plan
  if (engagementScore >= 70 && (plan === "pro" || plan === "business")) {
    return "power_users";
  }

  // At-risk pros: Pro plan but low engagement or inactive
  if (
    (plan === "pro" || plan === "business") &&
    (daysSinceActive > 30 || engagementScore < 40)
  ) {
    return "at_risk_pros";
  }

  // Returning inactive users: Just logged in, but previous login was > 30 days ago
  const previousActive = user.previousLogin
    ? new Date(user.previousLogin).getTime()
    : 0;
  const daysSincePreviousActive =
    (Date.now() - previousActive) / (1000 * 60 * 60 * 24);

  // We check if lastActive is very recent (e.g. < 1 hour) to confirm they are "currently" active
  // AND that their previous session was a long time ago.
  if (daysSinceActive < 1 && daysSincePreviousActive > 30) {
    return "returning_inactive_users";
  }

  // New users: Created account within 7 days and no projects
  if (accountAge <= 7 && projectCount === 0) {
    return "new_users";
  }

  return "all";
};
