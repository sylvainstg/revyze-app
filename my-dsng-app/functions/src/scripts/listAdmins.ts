import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const listAdmins = async () => {
    console.log('Listing admin users...');

    try {
        const snapshot = await db.collection('users').where('isAdmin', '==', true).get();
        if (snapshot.empty) {
            console.log('No admin users found.');
            return;
        }

        console.log(`Found ${snapshot.size} admin users:`);
        snapshot.forEach(doc => {
            console.log(`- ID: ${doc.id}`);
            console.log(`  Name: ${doc.data().name || 'N/A'}`);
            console.log(`  Email: ${doc.data().email || 'N/A'}`);
            console.log('---');
        });
    } catch (error) {
        console.error('Error listing admins:', error);
    }
};

listAdmins()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
