const admin = require('firebase-admin');
const serviceAccount = require('./my-dsng-app/serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixCategory() {
    try {
        // Query for the project "Maison à Irlande"
        const projectsSnapshot = await db.collection('projects')
            .where('name', '==', 'Maison à Irlande')
            .get();

        if (projectsSnapshot.empty) {
            console.log('Project "Maison à Irlande" not found');
            return;
        }

        const projectDoc = projectsSnapshot.docs[0];
        const projectData = projectDoc.data();

        console.log('Found project:', projectData.name);
        console.log('Number of versions:', projectData.versions?.length || 0);

        if (!projectData.versions || projectData.versions.length === 0) {
            console.log('No versions found in project');
            return;
        }

        // Sort versions by timestamp to find the latest
        const sortedVersions = [...projectData.versions].sort((a, b) => b.timestamp - a.timestamp);
        const latestVersion = sortedVersions[0];

        console.log('\nLatest version:');
        console.log('- File:', latestVersion.fileName);
        console.log('- Current category:', latestVersion.category || 'Main Plans');
        console.log('- Version number:', latestVersion.versionNumber);
        console.log('- Timestamp:', new Date(latestVersion.timestamp).toISOString());

        // Update the latest version's category to "Electrique"
        const updatedVersions = projectData.versions.map(v => {
            if (v.id === latestVersion.id) {
                return {
                    ...v,
                    category: 'Electrique',
                    categoryVersionNumber: 1 // First version in Electrique category
                };
            }
            return v;
        });

        // Update the project
        await projectDoc.ref.update({
            versions: updatedVersions,
            activeCategory: 'Electrique',
            lastModified: Date.now()
        });

        console.log('\n✅ Successfully updated latest version to "Electrique" category');
        console.log('Updated version:', latestVersion.fileName);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

fixCategory();
