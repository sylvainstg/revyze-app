import * as admin from "firebase-admin";

// Initialize Firebase Admin
// Note: This script assumes it's run in an environment with default credentials
// or you can set GOOGLE_APPLICATION_CREDENTIALS environment variable
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const createSampleCampaign = async () => {
  console.log("Initializing sample campaign...");

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
    ), // 30 days from now
    frequencyCapDays: 14,
    emailFollowUpHours: 120,
    attributionWindowDays: 30,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: "system_init",
    updatedAt: admin.firestore.Timestamp.now(),
  };

  try {
    const docRef = await db.collection("feedback_campaigns").add(campaignData);
    console.log(`Successfully created sample campaign with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating sample campaign:", error);
    throw error;
  }
};

// Run the function
createSampleCampaign()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
