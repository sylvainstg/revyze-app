const admin = require('firebase-admin');
const serviceAccount = require('./my-dsng-app/serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function debugProject() {
    try {
        // Fetch all projects to find the one with the issue
        // We'll list projects and their categories/settings
        const projectsSnapshot = await db.collection('projects').get();

        if (projectsSnapshot.empty) {
            console.log('No projects found');
            return;
        }

        console.log(`Found ${projectsSnapshot.size} projects.\n`);

        projectsSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Project: ${data.name} (ID: ${doc.id})`);
            console.log(`Active Category: ${data.activeCategory}`);

            // List categories from versions
            const categories = new Set();
            if (data.versions) {
                data.versions.forEach(v => {
                    if (v.category) categories.add(v.category);
                });
            }
            console.log('Categories found in versions:', Array.from(categories));

            // Check categorySettings
            if (data.categorySettings) {
                console.log('Category Settings:', JSON.stringify(data.categorySettings, null, 2));
            } else {
                console.log('Category Settings: undefined');
            }
            console.log('-----------------------------------');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

debugProject();
