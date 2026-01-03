import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDjOjvxQPVqRLPpBvnYTdTLkFTMFqJXTXQ",
  authDomain: "dsng-app.firebaseapp.com",
  projectId: "dsng-app",
  storageBucket: "dsng-app.firebasestorage.app",
  messagingSenderId: "1013698084867",
  appId: "1:1013698084867:web:a6b2a5a1c8f9e8c8e8c8c8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

async function fixCategory() {
  try {
    // You need to sign in with your credentials
    console.log("Please provide your credentials to authenticate:");
    console.log("Email: (enter your email)");
    console.log("Password: (enter your password)");
    console.log(
      "\nFor security, please edit this script and add your credentials temporarily.\n",
    );

    // TEMPORARILY add your credentials here:
    const email = "YOUR_EMAIL_HERE";
    const password = "YOUR_PASSWORD_HERE";

    if (email === "YOUR_EMAIL_HERE" || password === "YOUR_PASSWORD_HERE") {
      console.error(
        "❌ Please edit the script and add your email and password",
      );
      process.exit(1);
    }

    console.log("🔐 Authenticating...");
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Authenticated successfully\n");

    console.log("🔄 Calling Cloud Function to fix category...");
    const fixProjectVersionCategory = httpsCallable(
      functions,
      "fixProjectVersionCategory",
    );

    const result = await fixProjectVersionCategory({
      projectName: "Maison à Irlande",
      newCategory: "Electrique",
    });

    console.log("\n✅ Success!");
    console.log(result.data);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.code) {
      console.error("Error code:", error.code);
    }
    if (error.details) {
      console.error("Details:", error.details);
    }
  } finally {
    process.exit(0);
  }
}

fixCategory();
