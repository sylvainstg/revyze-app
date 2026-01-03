// Direct admin script to fix category - runs in Functions environment
// This script uses the Firebase Admin SDK which has full privileges

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "dsng-app",
  });
}

const db = admin.firestore();

async function fixCategory() {
  try {
    console.log('🔍 Searching for project "Maison à Irlande"...\n');

    // Query for the project by name
    const projectsSnapshot = await db
      .collection("projects")
      .where("name", "==", "Maison à Irlande")
      .limit(1)
      .get();

    if (projectsSnapshot.empty) {
      console.log('❌ Project "Maison à Irlande" not found');
      return;
    }

    const projectDoc = projectsSnapshot.docs[0];
    const projectData = projectDoc.data();

    console.log("✅ Found project:", projectData.name);
    console.log("   Project ID:", projectDoc.id);
    console.log("   Number of versions:", projectData.versions?.length || 0);

    if (!projectData.versions || projectData.versions.length === 0) {
      console.log("\n❌ No versions found in project");
      return;
    }

    // Sort versions by timestamp to find the latest
    const sortedVersions = [...projectData.versions].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    const latestVersion = sortedVersions[0];

    console.log("\n📄 Latest version details:");
    console.log("   File:", latestVersion.fileName);
    console.log("   Current category:", latestVersion.category || "Main Plans");
    console.log("   Version number:", latestVersion.versionNumber);
    console.log(
      "   Category version:",
      latestVersion.categoryVersionNumber || "N/A",
    );
    console.log(
      "   Uploaded:",
      new Date(latestVersion.timestamp).toLocaleString(),
    );

    // Check if already in Electrique category
    if (latestVersion.category === "Electrique") {
      console.log('\n✅ Version is already in "Electrique" category');
      return;
    }

    // Calculate the next category version number for Electrique
    const electricVersions = projectData.versions.filter(
      (v) => v.category === "Electrique",
    );
    const nextElectricVersion = electricVersions.length + 1;

    console.log('\n🔄 Updating category to "Electrique"...');
    console.log("   New category version number:", nextElectricVersion);

    // Update the latest version's category to "Electrique"
    const updatedVersions = projectData.versions.map((v) => {
      if (v.id === latestVersion.id) {
        return {
          ...v,
          category: "Electrique",
          categoryVersionNumber: nextElectricVersion,
        };
      }
      return v;
    });

    // Update the project
    await projectDoc.ref.update({
      versions: updatedVersions,
      activeCategory: "Electrique",
      lastModified: Date.now(),
    });

    console.log("\n✅ Successfully updated!");
    console.log("   Version:", latestVersion.fileName);
    console.log("   Old category:", latestVersion.category || "Main Plans");
    console.log("   New category: Electrique");
    console.log("   Category version:", nextElectricVersion);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  }
}

// Export for Cloud Functions
exports.runFix = functions.https.onRequest(async (req, res) => {
  console.log("Running category fix...");
  await fixCategory();
  res.send("Fix completed - check logs for details");
});

// Allow running directly with node
if (require.main === module) {
  fixCategory()
    .then(() => {
      console.log("\n✅ Script completed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Script failed:", err);
      process.exit(1);
    });
}
