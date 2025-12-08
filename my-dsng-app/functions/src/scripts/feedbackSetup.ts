import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const main = async () => {
    console.log('Backfilling feedback fields and ensuring sample campaign exists...');

    const users = await db.collection('users').get();
    const userUpdates = users.docs.map(async (doc) => {
        const data = doc.data();
        if (typeof data.lastFeedbackRequestedAt === 'undefined') {
            await doc.ref.update({ lastFeedbackRequestedAt: null });
        }
    });
    await Promise.all(userUpdates);
    console.log(`Updated ${userUpdates.length} users with lastFeedbackRequestedAt`);

    const now = admin.firestore.Timestamp.now();
    const sampleName = 'Early adopter pulse';
    const existing = await db.collection('feedback_campaigns')
        .where('name', '==', sampleName)
        .limit(1)
        .get();

    if (existing.empty) {
        const sampleCampaign = {
            name: sampleName,
            question: 'What is the one thing we should improve next?',
            type: 'free_text',
            status: 'active',
            activeFrom: now,
            activeUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
            frequencyCapDays: 14,
            emailFallbackAfterHours: 120,
            segmentQuery: {
                field: 'plan',
                op: '==',
                value: 'pro'
            },
            createdAt: now,
            createdBy: 'system_script',
            updatedAt: now
        };

        await db.collection('feedback_campaigns').add(sampleCampaign);
        console.log('Created sample campaign for pro/business users');
    } else {
        console.log('Sample campaign already exists, skipping');
    }

    // Seed "Giving Up Almost" campaign for near-churn explorers
    const givingUpName = 'Giving Up Almost';
    const existsGivingUp = await db.collection('feedback_campaigns')
        .where('name', '==', givingUpName)
        .limit(1)
        .get();

    if (existsGivingUp.empty) {
        await db.collection('feedback_campaigns').add({
            name: givingUpName,
            question: 'What almost made you give up already?',
            type: 'free_text',
            status: 'active',
            activeFrom: now,
            activeUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
            frequencyCapDays: 7,
            emailFallbackAfterHours: 72,
            segmentQuery: {
                field: 'segment',
                op: '==',
                value: 'giving_up_almost'
            },
            anonymous: false,
            createdAt: now,
            createdBy: 'system_script',
            updatedAt: now
        });
        console.log('Seeded Giving Up Almost campaign');
    } else {
        console.log('Giving Up Almost campaign already exists, skipping');
    }
};

main()
    .then(() => {
        console.log('Feedback setup completed');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Feedback setup failed', err);
        process.exit(1);
    });
