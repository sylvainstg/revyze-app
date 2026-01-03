import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

type SegmentOperator = "<" | "<=" | "==" | ">=" | ">" | "in";

interface SegmentQuery {
  field: string;
  op: SegmentOperator;
  value: any;
}

interface FeedbackCampaign {
  id?: string;
  name: string;
  description: string;
  question: string;
  type: "free_text" | "multiple_choice" | "nps" | "csat";
  choices?: string[];
  status: string;
  anonymous?: boolean;
  activeFrom: admin.firestore.Timestamp;
  activeUntil: admin.firestore.Timestamp;
  frequencyCapDays?: number;
  emailFallbackAfterHours?: number;
  segmentQuery?: SegmentQuery;
  createdAt?: admin.firestore.Timestamp | number;
}

const requireAuth = (context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required",
    );
  }
  return context.auth.uid;
};

const ensureAdmin = async (uid: string) => {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists || !userDoc.data()?.isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin privileges required",
    );
  }
  return userDoc;
};

const matchesSegmentQuery = (
  userData: FirebaseFirestore.DocumentData,
  query?: SegmentQuery,
): boolean => {
  if (!query) return true;
  const userValue = userData[query.field];
  if (query.op === "in") {
    return Array.isArray(query.value) && query.value.includes(userValue);
  }
  switch (query.op) {
    case "<":
      return userValue < query.value;
    case "<=":
      return userValue <= query.value;
    case "==":
      return userValue == query.value; // eslint-disable-line eqeqeq
    case ">=":
      return userValue >= query.value;
    case ">":
      return userValue > query.value;
    default:
      return false;
  }
};

const buildCampaignPayload = (
  doc: FirebaseFirestore.DocumentSnapshot,
): FeedbackCampaign => {
  const data = doc.data() as any;
  return {
    id: doc.id,
    name: data.name,
    description: data.description || "",
    question: data.question,
    type: data.type,
    choices: data.choices,
    status: data.status || "draft",
    anonymous: data.anonymous ?? false,
    activeFrom: data.activeFrom,
    activeUntil: data.activeUntil,
    frequencyCapDays: data.frequencyCapDays ?? 14,
    emailFallbackAfterHours: data.emailFallbackAfterHours ?? 120,
    segmentQuery: data.segmentQuery,
    createdAt: data.createdAt,
  };
};

export const feedbackActive = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User profile missing");
  }

  const userData = userDoc.data() || {};
  const now = admin.firestore.Timestamp.now();
  const forceCampaignId = (data as any)?.forceCampaignId;
  const targetedCampaignId = userData.targetedCampaignId;

  // 1. Priority: Targeted campaign (manual outreach)
  if (targetedCampaignId) {
    const targetedDoc = await db
      .collection("feedback_campaigns")
      .doc(targetedCampaignId)
      .get();
    if (targetedDoc.exists && targetedDoc.data()?.status === "active") {
      const campaign = buildCampaignPayload(targetedDoc);

      // Log analytics for targeted show
      await db
        .collection("feedback_campaigns")
        .doc(targetedCampaignId)
        .update({
          "analytics.impressions": admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      await db.collection("campaign_attribution").add({
        campaignId: targetedCampaignId,
        userId: uid,
        isTargeted: true,
        shownAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { campaign };
    }
  }

  // 2. Special handling for forced campaign (debug mode) - logic moved to top to bypass all filters
  if (forceCampaignId) {
    const forcedDoc = await db
      .collection("feedback_campaigns")
      .doc(forceCampaignId)
      .get();
    if (forcedDoc.exists) {
      return { campaign: buildCampaignPayload(forcedDoc) };
    }
    // If forced ID not found, fall through or return null? Better to return null to avoid confusion.
    return { campaign: null };
  }

  // Enforce frequency cap against user's last request time
  const lastRequested = userData.lastFeedbackRequestedAt?.toDate
    ? userData.lastFeedbackRequestedAt.toDate().getTime()
    : userData.lastFeedbackRequestedAt;

  // Avoid composite index requirement by filtering activeUntil client-side
  const candidateCampaignsSnap = await db
    .collection("feedback_campaigns")
    .where("status", "==", "active")
    .where("activeFrom", "<=", now)
    .orderBy("activeFrom", "desc")
    .limit(10)
    .get();

  const candidateCampaigns = candidateCampaignsSnap.docs.filter((doc) => {
    const data = doc.data() as any;
    return data.activeUntil && data.activeUntil.toMillis
      ? data.activeUntil.toMillis() >= Date.now()
      : true;
  });

  for (const doc of candidateCampaigns) {
    const campaign = buildCampaignPayload(doc);

    // Special segment handling: giving_up_almost
    if (
      campaign.segmentQuery?.field === "segment" &&
      campaign.segmentQuery.value === "giving_up_almost"
    ) {
      const createdAt = userData.createdAt || 0;
      const loginCount = userData.loginCount || 0;
      const plan = userData.plan || "free";
      const lastLogin = userData.lastLogin || 0;
      const lastSessionDuration = userData.lastSessionDuration || 0; // assumed ms
      const totalActions =
        (userData.projectCount || 0) +
        (userData.commentCount || 0) +
        (userData.shareCountGuest || 0) +
        (userData.shareCountPro || 0);

      const isNewish =
        createdAt > 0
          ? Date.now() - createdAt <= 30 * 24 * 60 * 60 * 1000
          : true;
      const hasReturned = loginCount >= 2;
      const isFree = plan === "free";
      const slowReturn =
        lastLogin > 0
          ? Date.now() - lastLogin > 2 * 24 * 60 * 60 * 1000
          : false;
      const shortSession =
        lastSessionDuration > 0 ? lastSessionDuration < 180000 : false; // <3 min
      const someEngagement = totalActions >= 2;

      const qualifies =
        isNewish &&
        isFree &&
        hasReturned &&
        (slowReturn || shortSession) &&
        someEngagement;
      if (!qualifies) continue;
    } else {
      if (!matchesSegmentQuery(userData, campaign.segmentQuery)) {
        continue;
      }
    }

    const capDays = campaign.frequencyCapDays ?? 14;
    if (lastRequested && lastRequested > 0) {
      const cutoff = Date.now() - capDays * 24 * 60 * 60 * 1000;
      if (lastRequested > cutoff) {
        continue;
      }
    }

    // Mark request time before returning
    await userRef.update({
      lastFeedbackRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update campaign analytics: Impressions
    await db
      .collection("feedback_campaigns")
      .doc(campaign.id!)
      .update({
        "analytics.impressions": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    await db.collection("campaign_attribution").add({
      campaignId: campaign.id,
      userId: uid,
      shownAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("user_activity").add({
      userId: uid,
      eventName: "feedback_campaign_shown",
      metadata: { campaignId: campaign.id },
      timestamp: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { campaign };
  }

  return { campaign: null };
});

export const feedbackAnswer = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { campaignId, answer } = data as { campaignId?: string; answer?: any };

  if (!campaignId || typeof answer === "undefined") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "campaignId and answer are required",
    );
  }

  try {
    const campaignDoc = await db
      .collection("feedback_campaigns")
      .doc(campaignId)
      .get();
    if (!campaignDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Campaign not found");
    }

    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data() || {};
    const campaign = buildCampaignPayload(campaignDoc);

    const payload: any = {
      campaignId,
      userId: campaign.anonymous ? null : uid,
      answer,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      segmentData: campaign.anonymous
        ? null
        : {
            plan: userData.plan || "free",
            role: userData.role || null,
            engagementScore: userData.engagementScore ?? null,
          },
    };

    await db.collection("feedback_answers").add(payload);

    // Update campaign analytics: Responses
    // We also need to update responseRate, but that's harder atomically.
    // For now just increment responses. Client or scheduled job can recalc rate.
    // Or we can do a transaction if strict accuracy needed, but increment is fine for now.
    // We will just update 'responses' count.
    await db
      .collection("feedback_campaigns")
      .doc(campaignId)
      .update({
        "analytics.responses": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Update attribution if exists
    const attribution = await db
      .collection("campaign_attribution")
      .where("campaignId", "==", campaignId)
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!attribution.empty) {
      await attribution.docs[0].ref.update({
        answeredAt: admin.firestore.FieldValue.serverTimestamp(),
        answer,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await db.collection("user_activity").add({
      userId: uid,
      eventName: "feedback_campaign_answered",
      metadata: { campaignId, anonymous: !!campaign.anonymous },
      timestamp: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("users").doc(uid).update({
      lastFeedbackRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      targetedCampaignId: admin.firestore.FieldValue.delete(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("feedbackAnswer failed", error);
    const message = error?.message || "Failed to submit feedback";
    if (error?.code === 9 || message.toLowerCase().includes("index")) {
      // Surface Firestore missing-index guidance as a failed-precondition error
      throw new functions.https.HttpsError("failed-precondition", message);
    }
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", message);
  }
});

export const adminListFeedbackCampaigns = functions.https.onCall(
  async (data, context) => {
    const uid = requireAuth(context);
    await ensureAdmin(uid);

    const campaignsSnap = await db.collection("feedback_campaigns").get();
    const results = await Promise.all(
      campaignsSnap.docs.map(async (doc) => {
        const campaign = buildCampaignPayload(doc);
        const answersSnap = await db
          .collection("feedback_answers")
          .where("campaignId", "==", doc.id)
          .get();
        return {
          ...campaign,
          id: doc.id,
          answerCount: answersSnap.size,
        };
      }),
    );

    // Sort in memory by activeFrom (desc)
    results.sort((a, b) => {
      const timeA =
        (a.activeFrom as any)?.toMillis?.() ||
        (a.activeFrom instanceof Date ? a.activeFrom.getTime() : 0);
      const timeB =
        (b.activeFrom as any)?.toMillis?.() ||
        (b.activeFrom instanceof Date ? b.activeFrom.getTime() : 0);
      return timeB - timeA;
    });

    return { campaigns: results };
  },
);

export const adminGetCampaignAnswers = functions.https.onCall(
  async (data, context) => {
    const uid = requireAuth(context);
    await ensureAdmin(uid);

    const { campaignId } = data;
    if (!campaignId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Campaign ID required",
      );
    }

    const answersSnap = await db
      .collection("feedback_answers")
      .where("campaignId", "==", campaignId)
      .limit(100)
      .get();

    // Fetch user details for non-anonymous answers
    const userIds = new Set<string>();
    answersSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.userId) userIds.add(d.userId);
    });

    const userMap: Record<string, { name: string; email: string }> = {};
    if (userIds.size > 0) {
      // Firestore 'in' query limit is 10, so we have to chunk or just fetch individual if many
      // For simplicity in this admin tool, let's fetch individual if < 20, otherwise just rely on partial data?
      // Actually, let's just do a series of gets or multiple 'in' queries.
      // For now, simpler approach: Promise.all fetches (cache helps if repeated)
      const userFetches = Array.from(userIds).map(async (uid) => {
        const uDoc = await db.collection("users").doc(uid).get();
        if (uDoc.exists) {
          const uData = uDoc.data() || {};
          userMap[uid] = {
            name: uData.name || "Unknown",
            email: uData.email || "—",
          };
        }
      });
      await Promise.all(userFetches);
    }

    const answers = answersSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        user: d.userId ? userMap[d.userId] : undefined,
        timestamp: d.timestamp?.toMillis ? d.timestamp.toMillis() : d.timestamp,
      };
    });

    // Sort in memory to avoid composite index requirement
    answers.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return { answers };
  },
);

export const adminCreateFeedbackCampaign = functions.https.onCall(
  async (data, context) => {
    const uid = requireAuth(context);
    await ensureAdmin(uid);

    const campaign = data as FeedbackCampaign;
    if (
      !campaign.name ||
      !campaign.question ||
      !campaign.type ||
      !campaign.activeFrom ||
      !campaign.activeUntil
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields",
      );
    }

    const docRef = await db.collection("feedback_campaigns").add({
      ...campaign,
      status: "active",
      frequencyCapDays: campaign.frequencyCapDays ?? 14,
      emailFallbackAfterHours: campaign.emailFallbackAfterHours ?? 120,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { id: docRef.id };
  },
);

export const adminUpdateFeedbackCampaign = functions.https.onCall(
  async (data, context) => {
    const uid = requireAuth(context);
    await ensureAdmin(uid);

    const { id, ...updates } = data as any;
    if (!id) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Campaign id required",
      );
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("feedback_campaigns").doc(id).update(updates);

    return { success: true };
  },
);

export const sendFeedbackEmailFallbacks = functions.https.onCall(
  async (data, context) => {
    const uid = requireAuth(context);
    await ensureAdmin(uid);

    const now = Date.now();
    const pending: FirebaseFirestore.QuerySnapshot = await db
      .collection("campaign_attribution")
      .where("answeredAt", "==", null)
      .get();

    const tasks = pending.docs.map(async (doc) => {
      const attr = doc.data();
      const campaignId = attr.campaignId;
      const campaignDoc = await db
        .collection("feedback_campaigns")
        .doc(campaignId)
        .get();
      if (!campaignDoc.exists) return;

      const campaign = buildCampaignPayload(campaignDoc);
      const fallbackMs =
        (campaign.emailFallbackAfterHours ?? 120) * 60 * 60 * 1000;
      const shownAt = attr.shownAt?.toDate
        ? attr.shownAt.toDate().getTime()
        : attr.shownAt;
      if (!shownAt || now - shownAt < fallbackMs) return;

      const userDoc = await db.collection("users").doc(attr.userId).get();
      if (!userDoc.exists) return;
      const user = userDoc.data() || {};

      if (!user.email) return;

      const appUrl = functions.config().app?.url || "https://dsng-app.web.app";
      const answerLink = `${appUrl}?feedback=${campaignId}`;

      // Queue email via Firebase Email Extension (mail collection)
      await db.collection("mail").add({
        to: user.email,
        template: {
          name: "feedback-followup",
          data: {
            userName: user.name || "there",
            question: campaign.question,
            campaignName: campaign.name,
            answerLink,
          },
        },
      });

      await doc.ref.update({
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection("user_activity").add({
        userId: attr.userId,
        eventName: "feedback_email_sent",
        metadata: { campaignId },
        timestamp: Date.now(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await Promise.all(tasks);
    return { success: true };
  },
);
