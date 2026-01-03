import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const listAllCampaigns = async () => {
  console.log("Listing all campaigns...");

  try {
    const snapshot = await db.collection("feedback_campaigns").get();
    console.log(`Found ${snapshot.size} campaigns.`);

    snapshot.forEach((doc) => {
      console.log(`- ID: ${doc.id}`);
      console.log(`  Name: ${doc.data().name}`);
      console.log(`  Status: ${doc.data().status}`);
      console.log("---");
    });
  } catch (error) {
    console.error("Error listing campaigns:", error);
  }
};

listAllCampaigns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
