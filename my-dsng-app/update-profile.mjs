import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync("./functions/service-account.json", "utf8"),
);

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
    console.log("✅ Profile updated successfully!");
    console.log("Name changed to: Sylvain St-Germain");
  } catch (error) {
    console.error("Error updating profile:", error);
  }
  process.exit();
}

updateProfile();
