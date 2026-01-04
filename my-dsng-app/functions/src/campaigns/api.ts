import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const db = admin.firestore();

/**
 * Create a new feedback campaign
 * POST /api/campaigns
 */
/**
 * Create a new feedback campaign
 * Callable Function
 */
export const createCampaign = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const userId = context.auth.uid;

  try {
    // Check if user is admin
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const campaignData = data;

    // Validate required fields
    if (!campaignData.name || !campaignData.question || !campaignData.type) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: name, question, type",
      );
    }

    // Create campaign
    const campaign = {
      ...campaignData,
      status: campaignData.status || "draft",
      frequencyCapDays: campaignData.frequencyCapDays || 14,
      emailFollowUpHours: campaignData.emailFollowUpHours || 120,
      attributionWindowDays: campaignData.attributionWindowDays || 30,
      dataRetentionDays: campaignData.dataRetentionDays || 365, // Default 1 year
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("feedback_campaigns").add(campaign);

    return {
      id: docRef.id,
      ...campaign,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * List all campaigns with analytics
 * Callable Function
 */
export const listCampaigns = functions.https.onCall(async (data, context) => {
  console.log(`[DEPLOY_VERIFY_99] listCampaigns triggered at: ${new Date().toISOString()}`);
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const userId = context.auth.uid;

  try {
    // Check if user is admin
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    // Get all campaigns
    const campaignsSnapshot = await db
      .collection("feedback_campaigns")
      .orderBy("createdAt", "desc")
      .get();

    const campaigns = await Promise.all(
      campaignsSnapshot.docs.map(async (doc) => {
        const campaignData = doc.data();
        const campaignId = doc.id;

        // Get analytics for this campaign
        console.log(`[listCampaigns] Processing campaign: ${campaignId}`);
        const analytics = await getCampaignAnalytics(campaignId);

        return {
          id: campaignId,
          ...campaignData,
          analytics,
        };
      }),
    );

    return { campaigns };
  } catch (error: any) {
    console.error("Error listing campaigns:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Update a campaign
 * Callable Function
 */
export const updateCampaign = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const userId = context.auth.uid;

  try {
    // Check if user is admin
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const campaignId = data.id;
    if (!campaignId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Campaign ID required",
      );
    }

    const updates = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.createdAt;
    delete updates.createdBy;

    await db.collection("feedback_campaigns").doc(campaignId).update(updates);

    return {
      id: campaignId,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("Error updating campaign:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Get campaign analytics
 * Callable Function
 */
export const getCampaignAnalyticsEndpoint = functions.https.onCall(
  async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    const userId = context.auth.uid;

    try {
      // Check if user is admin
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists || !userDoc.data()?.isAdmin) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Admin access required",
        );
      }

      const campaignId = data.id;
      if (!campaignId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Campaign ID required",
        );
      }

      const analytics = await getCampaignAnalytics(campaignId);
      return analytics;
    } catch (error: any) {
      console.error("Error getting campaign analytics:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  },
);

/**
 * Get segment statistics (count and sample users)
 * Callable Function
 */
export const getSegmentStats = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const userId = context.auth.uid;

  try {
    // Check if user is admin
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const segmentType = data.segmentType;
    const limitParam = Math.min(Math.max(data.limit || 25, 1), 200);
    if (!segmentType) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Segment type required",
      );
    }

    let query: admin.firestore.Query = db.collection("users");
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Apply filters based on segment type
    // Note: Replicating logic from useFeedbackCampaign.ts
    if (segmentType === "power_users") {
      // High engagement + Pro/Business plan
      query = query
        .where("engagementScore", ">=", 70)
        .where("plan", "in", ["pro", "business"]);
    } else if (segmentType === "at_risk_pros") {
      // Pro/Business plan AND (inactive > 30 days OR low engagement)
      // Complex OR condition, so we fetch all pros and filter in memory
      // This is acceptable for reasonable dataset sizes. For large datasets, we'd need a dedicated "at_risk" flag updated by a scheduled job.
      query = query.where("plan", "in", ["pro", "business"]);
    } else if (segmentType === "new_users") {
      // Created <= 7 days ago AND projectCount == 0
      // Note: createdAt is stored as a number (timestamp) in User interface
      query = query
        .where("createdAt", ">=", sevenDaysAgo)
        .where("projectCount", "==", 0);
    } else if (segmentType === "giving_up_almost") {
      // Lightweight filter; most logic applied post-query
      query = query.where("plan", "==", "free");
    } else if (segmentType === "all") {
      // No filter
    } else {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Unknown segment type",
      );
    }

    const snapshot = await query.get();
    let users = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as any,
    );

    // Post-filtering for complex conditions
    if (segmentType === "at_risk_pros") {
      users = users.filter((user) => {
        const lastLogin = user.lastLogin || 0;
        const daysSinceActive = (now - lastLogin) / (1000 * 60 * 60 * 24);
        const engagementScore = user.engagementScore || 0;
        return daysSinceActive > 30 || engagementScore < 40;
      });
    } else if (segmentType === "returning_inactive_users") {
      users = users.filter((user) => {
        const lastLogin = user.lastLogin || 0;
        const previousLogin = user.previousLogin || 0; // Assuming previousLogin is also a timestamp
        const daysSinceLastLogin = (now - lastLogin) / (1000 * 60 * 60 * 24);
        const daysSincePreviousLogin =
          (now - previousLogin) / (1000 * 60 * 60 * 24);

        // User logged in recently (within 1 day) AND their previous login was more than 30 days ago
        return daysSinceLastLogin < 1 && daysSincePreviousLogin > 30;
      });
    } else if (segmentType === "giving_up_almost") {
      users = users.filter((user) => {
        const createdAt = user.createdAt || 0;
        const loginCount = user.loginCount || 0;
        const lastLogin = user.lastLogin || 0;
        const lastSessionDuration = user.lastSessionDuration || 0;
        const totalActions =
          (user.projectCount || 0) +
          (user.commentCount || 0) +
          (user.shareCountGuest || 0) +
          (user.shareCountPro || 0);

        const isNewish =
          createdAt > 0 ? now - createdAt <= 30 * 24 * 60 * 60 * 1000 : true;
        const hasReturned = loginCount >= 2;
        const slowReturn =
          lastLogin > 0 ? now - lastLogin > 2 * 24 * 60 * 60 * 1000 : false;
        const shortSession =
          lastSessionDuration > 0 ? lastSessionDuration < 180000 : false; // <3m
        const someEngagement = totalActions >= 2;

        return (
          isNewish &&
          hasReturned &&
          (slowReturn || shortSession) &&
          someEngagement
        );
      });
    }

    const totalCount = users.length;
    const sampleUsers = users.slice(0, limitParam).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      engagementScore: user.engagementScore,
      lastLogin: user.lastLogin,
    }));

    return {
      segmentType,
      totalCount,
      sampleUsers,
    };
  } catch (error: any) {
    console.error("Error getting segment stats:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Get campaign history for a specific user
 * Callable Function
 */
export const getUserCampaignHistory = functions.https.onCall(
  async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    const adminUserId = context.auth.uid;

    try {
      // Check if requesting user is admin
      const adminUserDoc = await db.collection("users").doc(adminUserId).get();
      if (!adminUserDoc.exists || !adminUserDoc.data()?.isAdmin) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Admin access required",
        );
      }

      const targetUserId = data.userId;
      if (!targetUserId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Target User ID required",
        );
      }

      // Get all attributions for this user
      const attributionsSnapshot = await db
        .collection("campaign_attribution")
        .where("userId", "==", targetUserId)
        .orderBy("createdAt", "desc")
        .get();

      // Fetch campaign details for each attribution to display names
      const history = await Promise.all(
        attributionsSnapshot.docs.map(async (doc) => {
          const attrData = doc.data();
          const campaignDoc = await db
            .collection("feedback_campaigns")
            .doc(attrData.campaignId)
            .get();
          const campaignData = campaignDoc.exists
            ? campaignDoc.data()
            : { name: "Unknown Campaign", type: "unknown" };

          return {
            id: doc.id,
            campaignId: attrData.campaignId,
            campaignName: campaignData?.name,
            campaignType: campaignData?.type,
            shownAt: attrData.shownAt?.toDate().toISOString(),
            answeredAt: attrData.answeredAt?.toDate().toISOString(),
            dismissedAt: attrData.dismissedAt?.toDate().toISOString(),
            answer: attrData.answer,
            variantId: attrData.variantId,
          };
        }),
      );

      return { history };
    } catch (error: any) {
      console.error("Error getting user campaign history:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  },
);

// Temporary function to initialize sample campaign
export const initSampleCampaign = functions.https.onRequest(
  async (req, res) => {
    // Simple security check
    if (req.query.key !== "init_secret_123") {
      res.status(403).send("Unauthorized");
      return;
    }

    const campaignData = {
      name: "NPS Survey - Power Users",
      description: "Measure satisfaction among our most engaged users",
      question: "How likely are you to recommend Revyze to a colleague?",
      type: "nps",
      segmentType: "power_users",
      status: "active",
      activeFrom: admin.firestore.Timestamp.now(),
      activeUntil: admin.firestore.Timestamp.fromMillis(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ), // 30 days
      frequencyCapDays: 14,
      emailFollowUpHours: 120,
      attributionWindowDays: 30,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: "system_init",
      updatedAt: admin.firestore.Timestamp.now(),
    };

    try {
      const docRef = await db
        .collection("feedback_campaigns")
        .add(campaignData);
      res.json({ success: true, campaignId: docRef.id });
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Temporary function to list all campaigns
export const listSampleCampaigns = functions.https.onRequest(
  async (req, res) => {
    // Simple security check
    if (req.query.key !== "init_secret_123") {
      res.status(403).send("Unauthorized");
      return;
    }

    try {
      const snapshot = await db.collection("feedback_campaigns").get();
      const campaigns = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json({ count: campaigns.length, campaigns });
    } catch (error: any) {
      console.error("Error listing campaigns:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Temporary function to list admin users
export const listSampleAdmins = functions.https.onRequest(async (req, res) => {
  // Simple security check
  if (req.query.key !== "init_secret_123") {
    res.status(403).send("Unauthorized");
    return;
  }

  try {
    const snapshot = await db
      .collection("users")
      .where("isAdmin", "==", true)
      .get();
    const admins = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json({ count: admins.length, admins });
  } catch (error: any) {
    console.error("Error listing admins:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to calculate campaign analytics
 */
async function getCampaignAnalytics(campaignId: string) {
  // Get all attribution records for this campaign (impressions)
  const attributions = await db
    .collection("campaign_attribution")
    .where("campaignId", "==", campaignId)
    .get();

  // Get responses from feedback_answers (canonical source of truth)
  const answersSnapshot = await db
    .collection("feedback_answers")
    .where("campaignId", "==", campaignId)
    .get();

  // DEBUG: Let's see what's actually in that collection
  const allAnswers = await db.collection("feedback_answers").get();
  const uniqueIdsInDb = [...new Set(allAnswers.docs.map(d => d.data().campaignId))];
  console.log(`[getCampaignAnalytics] Checking ID: "${campaignId}"`);
  console.log(`[getCampaignAnalytics] Unique IDs in feedback_answers: ${JSON.stringify(uniqueIdsInDb)}`);
  console.log(`[getCampaignAnalytics] Match found for "${campaignId}": ${uniqueIdsInDb.includes(campaignId)}`);
  console.log(`[getCampaignAnalytics] Query size: ${answersSnapshot.size}`);

  const impressions = attributions.size;
  const responses = answersSnapshot.size;
  const responseRate = impressions > 0 ? (responses / impressions) * 100 : 0;

  // Get email metrics
  const emailsSent = await db
    .collection("user_activity")
    .where("eventName", "==", "feedback_email_sent")
    .where("metadata.campaignId", "==", campaignId)
    .get();

  const emailsClicked = await db
    .collection("user_activity")
    .where("eventName", "==", "feedback_email_clicked")
    .where("metadata.campaignId", "==", campaignId)
    .get();

  // Calculate attribution metrics
  let totalConversions = 0;
  let totalAttributedValue = 0;
  const variantPerformance: Record<string, any> = {};

  attributions.docs.forEach((doc) => {
    const data = doc.data();

    // Count conversions
    if (data.conversions && data.conversions.length > 0) {
      totalConversions += data.conversions.length;
      totalAttributedValue += data.totalValue || 0;
    }

    // Track variant performance
    if (data.variantId) {
      if (!variantPerformance[data.variantId]) {
        variantPerformance[data.variantId] = {
          variantId: data.variantId,
          impressions: 0,
          responses: 0,
          totalValue: 0,
        };
      }
      variantPerformance[data.variantId].impressions++;
      if (data.answeredAt) {
        variantPerformance[data.variantId].responses++;
      }
      variantPerformance[data.variantId].totalValue += data.totalValue || 0;
    }
  });

  // Calculate variant response rates and average values
  const variantPerformanceArray = Object.values(variantPerformance).map(
    (variant: any) => ({
      ...variant,
      responseRate:
        variant.impressions > 0
          ? (variant.responses / variant.impressions) * 100
          : 0,
      averageValue:
        variant.responses > 0 ? variant.totalValue / variant.responses : 0,
    }),
  );

  return {
    campaignId,
    impressions,
    responses,
    responseRate: Math.round(responseRate * 100) / 100,
    dismissals: impressions - responses,
    emailsSent: emailsSent.size,
    emailsClicked: emailsClicked.size,
    emailClickRate:
      emailsSent.size > 0
        ? Math.round((emailsClicked.size / emailsSent.size) * 10000) / 100
        : 0,
    totalConversions,
    totalAttributedValue,
    averageValuePerResponse:
      responses > 0
        ? Math.round((totalAttributedValue / responses) * 100) / 100
        : 0,
    variantPerformance:
      variantPerformanceArray.length > 0 ? variantPerformanceArray : undefined,
    updatedAt: new Date().toISOString(),
  };
}
