import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();



/**
 * Triggered when a campaign is shown to a user.
 * Schedules an email follow-up if the user doesn't answer within the specified time.
 */
export const onCampaignShown = functions
  .region("us-central1")
  .firestore.document("user_activity/{activityId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    console.log(`[onCampaignShown] Triggered for activity ${context.params.activityId}, event: ${data?.eventName}`);

    // Only process campaign_shown events
    if (data?.eventName !== "feedback_campaign_shown") {
      return null;
    }

    const { userId, metadata } = data;
    const campaignId = metadata?.campaignId;
    const variantId = metadata?.variantId;

    console.log(`[onCampaignShown] Processing campaign ${campaignId} for user ${userId}`);

    try {
      // Get campaign details
      const campaignDoc = await db
        .collection("feedback_campaigns")
        .doc(campaignId)
        .get();

      if (!campaignDoc.exists) {
        console.error(`Campaign ${campaignId} not found`);
        return null;
      }

      const campaign = campaignDoc.data();
      const emailFollowUpHours = campaign?.emailFollowUpHours || 120; // Default 5 days

      // Get user details
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        console.error(`User ${userId} not found`);
        return null;
      }

      const user = userDoc.data();

      // Schedule email check using Cloud Tasks
      // For now, we'll use a simple setTimeout approach (works for short delays)
      // For production, use Cloud Tasks for reliability
      const delayMs = emailFollowUpHours * 60 * 60 * 1000;

      // Store a scheduled email record
      await db.collection("scheduled_emails").add({
        userId,
        campaignId,
        variantId,
        userEmail: user?.email,
        userName: user?.name,
        scheduledFor: admin.firestore.Timestamp.fromMillis(
          Date.now() + delayMs,
        ),
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `Scheduled email follow-up for user ${userId}, campaign ${campaignId} in ${emailFollowUpHours} hours`,
      );
      return null;
    } catch (error) {
      console.error("Error scheduling email follow-up:", error);
      return null;
    }
  });

/**
 * Scheduled function to process pending email follow-ups.
 * Runs every hour to check for emails that need to be sent.
 */
export const processEmailFollowUps = functions
  .region("us-central1")
  .pubsub.schedule("every 1 hours")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    try {
      // Find pending emails that are due
      const pendingEmails = await db
        .collection("scheduled_emails")
        .where("status", "==", "pending")
        .where("scheduledFor", "<=", now)
        .limit(100) // Process in batches
        .get();

      console.log(`Found ${pendingEmails.size} pending emails to process`);

      const promises = pendingEmails.docs.map(async (emailDoc) => {
        const emailData = emailDoc.data();
        const { userId, campaignId, variantId, userEmail, userName } =
          emailData;

        try {
          // Check if user has answered the campaign
          const attributionQuery = await db
            .collection("campaign_attribution")
            .where("userId", "==", userId)
            .where("campaignId", "==", campaignId)
            .limit(1)
            .get();

          if (attributionQuery.empty) {
            console.log(
              `No attribution found for user ${userId}, campaign ${campaignId}`,
            );
            await emailDoc.ref.update({
              status: "skipped",
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }

          const attribution = attributionQuery.docs[0].data();

          // If already answered, skip
          if (attribution.answeredAt) {
            console.log(
              `User ${userId} already answered campaign ${campaignId}`,
            );
            await emailDoc.ref.update({
              status: "skipped",
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }

          // Get campaign details
          const campaignDoc = await db
            .collection("feedback_campaigns")
            .doc(campaignId)
            .get();
          if (!campaignDoc.exists) {
            await emailDoc.ref.update({
              status: "error",
              error: "Campaign not found",
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }

          const campaign = campaignDoc.data();
          const question =
            variantId && campaign?.variants
              ? campaign.variants.find((v: any) => v.id === variantId)?.question
              : campaign?.question;

          // Create email document for Firebase Email Extension
          await db.collection("mail").add({
            to: userEmail,
            template: {
              name: "feedback-followup",
              data: {
                userName: userName || "there",
                question: question,
                campaignName: campaign?.name,
                answerLink: `${functions.config().app?.url || "https://dsng-app.web.app"}?feedback=${campaignId}`,
                unsubscribeLink: `${functions.config().app?.url || "https://dsng-app.web.app"}/unsubscribe`,
              },
            },
          });

          // Mark as sent
          await emailDoc.ref.update({
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Log the email event
          await db.collection("user_activity").add({
            userId,
            eventName: "feedback_email_sent",
            metadata: { campaignId, variantId },
            timestamp: Date.now(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(
            `Sent follow-up email to ${userEmail} for campaign ${campaignId}`,
          );
        } catch (error) {
          console.error(`Error processing email for user ${userId}:`, error);
          await emailDoc.ref.update({
            status: "error",
            error: String(error),
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });

      await Promise.all(promises);
      console.log("Email follow-up processing complete");
      return null;
    } catch (error) {
      console.error("Error in processEmailFollowUps:", error);
      return null;
    }
  });
