const admin = require("firebase-admin");
const serviceAccount = require("./functions/service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function updateProfile() {
  try {
    // Find user by email
    const usersRef = db.collection("users");
    const snapshot = await usersRef
      .where("email", "==", "sylvainstg@gmail.com")
      .get();

    if (snapshot.empty) {
      console.log("User not found");
      return;
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({ name: "Sylvain St-Germain" });
    console.log("Profile updated successfully!");
    console.log("Name changed to: Sylvain St-Germain");
  } catch (error) {
    console.error("Error updating profile:", error);
  }
  process.exit();
}

updateProfile();
