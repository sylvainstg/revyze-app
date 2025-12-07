import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

interface User {
    loginCount?: number;
    projectCount?: number;
    shareCountGuest?: number;
    shareCountPro?: number;
    engagementScore?: number;
    isAdmin?: boolean;
}

const USERS_COLLECTION = 'users';
const ACTIVITY_COLLECTION = 'user_activity';

/**
 * Cloud Function to update a user's engagement score
 * Can be called by the user themselves or triggered by events
 */
export const updateEngagementScore = functions.https.onCall(async (data, context) => {
    // User must be authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;

    try {
        // 1. Fetch User Profile for historical counts
        const userRef = db.collection(USERS_COLLECTION).doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const userData = userSnap.data() as User;

        // Base score from User Profile counters (Historical Data)
        let score = 0;
        const loginPoints = (userData.loginCount || 0) * 2;
        const projectPoints = (userData.projectCount || 0) * 10;
        const sharePoints = ((userData.shareCountGuest || 0) + (userData.shareCountPro || 0)) * 20;

        score += loginPoints;
        score += projectPoints;
        score += sharePoints;

        console.log(`[Engagement] User ${userId}:`, {
            loginCount: userData.loginCount,
            loginPoints,
            projectCount: userData.projectCount,
            projectPoints,
            shareCount: (userData.shareCountGuest || 0) + (userData.shareCountPro || 0),
            sharePoints,
            baseScore: score
        });

        // 2. Fetch recent activity for granular events NOT in profile
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const activitySnapshot = await db.collection(ACTIVITY_COLLECTION)
            .where('userId', '==', userId)
            .where('timestamp', '>=', startDate.getTime())
            .get();

        const uniqueCollaborators = new Set<string>();
        let activityPoints = 0;

        activitySnapshot.forEach(doc => {
            const data = doc.data();
            const event = data.eventName;

            // Only count events that are NOT already tracked in User Profile counters
            if (event === 'comment') {
                score += 5;
                activityPoints += 5;
            } else if (event === 'upload_version') {
                score += 10;
                activityPoints += 10;
            } else if (event === 'feedback_campaign_answered') {
                score += 15;
                activityPoints += 15;
            }

            // Track collaborators
            if (data.metadata && data.metadata.collaboratorId) {
                uniqueCollaborators.add(data.metadata.collaboratorId);
            }
        });

        console.log(`[Engagement] Activity points: ${activityPoints}, Total raw score: ${score}`);

        // Normalize (assuming max raw score of 300 for a power user)
        const MAX_RAW_SCORE = 300;
        const finalScore = Math.min(100, Math.round((score / MAX_RAW_SCORE) * 100));

        console.log(`[Engagement] Final score: ${finalScore} (${score}/${MAX_RAW_SCORE})`);

        // Update User Doc
        await userRef.update({
            engagementScore: finalScore,
            lifetime_collaborators: uniqueCollaborators.size,
            lastEngagementCalc: Date.now()
        });

        return {
            success: true,
            engagementScore: finalScore,
            breakdown: {
                loginPoints,
                projectPoints,
                sharePoints,
                activityPoints,
                totalRawScore: score
            }
        };
    } catch (error: any) {
        console.error('Error updating engagement score:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to update engagement score');
    }
});

/**
 * Admin function to recalculate all user engagement scores
 */
export const recalculateAllEngagementScores = functions.https.onCall(async (data, context) => {
    // Verify admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userDoc = await db.collection(USERS_COLLECTION).doc(context.auth.uid).get();
    const userData = userDoc.data();

    if (!userData?.isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can recalculate all scores');
    }

    try {
        const usersSnapshot = await db.collection(USERS_COLLECTION).get();
        const updatePromises: Promise<any>[] = [];

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data() as User;

            // Calculate score (same logic as above)
            let score = 0;
            score += (userData.loginCount || 0) * 2;
            score += (userData.projectCount || 0) * 10;
            score += ((userData.shareCountGuest || 0) + (userData.shareCountPro || 0)) * 20;

            // Fetch recent activity
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 90);

            const activitySnapshot = await db.collection(ACTIVITY_COLLECTION)
                .where('userId', '==', userId)
                .where('timestamp', '>=', startDate.getTime())
                .get();

            const uniqueCollaborators = new Set<string>();

            activitySnapshot.forEach(doc => {
                const data = doc.data();
                const event = data.eventName;

                if (event === 'comment') score += 5;
                else if (event === 'upload_version') score += 10;
                else if (event === 'feedback_campaign_answered') score += 15;

                if (data.metadata && data.metadata.collaboratorId) {
                    uniqueCollaborators.add(data.metadata.collaboratorId);
                }
            });

            const MAX_RAW_SCORE = 300;
            const finalScore = Math.min(100, Math.round((score / MAX_RAW_SCORE) * 100));

            updatePromises.push(
                userDoc.ref.update({
                    engagementScore: finalScore,
                    lifetime_collaborators: uniqueCollaborators.size,
                    lastEngagementCalc: Date.now()
                })
            );
        }

        await Promise.all(updatePromises);

        return {
            success: true,
            usersUpdated: usersSnapshot.size
        };
    } catch (error: any) {
        console.error('Error recalculating all scores:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to recalculate scores');
    }
});
