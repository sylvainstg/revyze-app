import { db } from '../firebaseConfig';
import { collection, doc, getDocs, setDoc, query, where, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import { User, UserRole } from '../types';

export interface DailyAnalyticsStats {
    date: string; // YYYY-MM-DD
    timestamp: number;
    dau: number;
    wau: number;
    mau: number;
    new_projects: number;
    new_comments: number;
    new_invites: number;
    total_comments: number;
    active_users_by_role: {
        homeowner: number;
        pro: number;
        guest: number;
    };
    engagement_actions: {
        login: number;
        create_project: number;
        upload_version: number;
        comment: number;
        invite: number;
        share: number;
    };
}

const ANALYTICS_COLLECTION = 'analytics_daily_stats';
const USERS_COLLECTION = 'users';
const ACTIVITY_COLLECTION = 'user_activity';

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

/**
 * Aggregates daily stats from user_activity logs.
 * Note: In a production environment, this should be a scheduled Cloud Function.
 * For this implementation, we'll run it on-demand from the client.
 */
export const aggregateDailyStats = async (date: Date): Promise<DailyAnalyticsStats> => {
    const dateString = formatDate(date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Fetch activity logs for the day
    const q = query(
        collection(db, ACTIVITY_COLLECTION),
        where('timestamp', '>=', startOfDay.getTime()),
        where('timestamp', '<=', endOfDay.getTime())
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => doc.data());

    // 2. Calculate Metrics
    const uniqueUsers = new Set<string>();
    const actions = {
        login: 0,
        create_project: 0,
        upload_version: 0,
        comment: 0,
        invite: 0,
        share: 0
    };

    logs.forEach(log => {
        uniqueUsers.add(log.userId);
        if (actions.hasOwnProperty(log.eventName)) {
            actions[log.eventName as keyof typeof actions]++;
        }
    });

    // 3. Fetch active users details to segment by role
    // This is expensive if many users, but okay for MVP/Admin
    const activeUsersByRole = { homeowner: 0, pro: 0, guest: 0 };

    // We can't easily query "users where ID in [list]" if list is huge.
    // For MVP, we'll just approximate or fetch all users if < 1000.
    // Or better, rely on the log metadata if we stored role there (we did for login!).
    // Let's try to use log metadata first.

    logs.forEach(log => {
        if (log.metadata && log.metadata.role) {
            // This works for login events
            const role = log.metadata.role;
            if (role === 'homeowner') activeUsersByRole.homeowner++;
            else if (role === 'designer' || role === 'architect') activeUsersByRole.pro++;
            else activeUsersByRole.guest++;
        }
    });

    // If we rely only on login events for role counts, it might be inaccurate for users who didn't login today but acted.
    // But for DAU, they must have acted. 
    // Let's refine: We need unique users per role.
    const uniqueUserRoles = new Map<string, string>();
    logs.forEach(log => {
        if (log.metadata && log.metadata.role) {
            uniqueUserRoles.set(log.userId, log.metadata.role);
        }
    });

    // Recalculate based on unique users
    const finalActiveRoles = { homeowner: 0, pro: 0, guest: 0 };
    uniqueUserRoles.forEach((role) => {
        if (role === UserRole.HOMEOWNER) finalActiveRoles.homeowner++;
        else if (role === UserRole.DESIGNER || role === 'architect') finalActiveRoles.pro++; // Assuming 'architect' maps to pro
        else finalActiveRoles.guest++;
    });


    const stats: DailyAnalyticsStats = {
        date: dateString,
        timestamp: startOfDay.getTime(),
        dau: uniqueUsers.size,
        wau: 0, // Calculated separately or rolling
        mau: 0, // Calculated separately or rolling
        new_projects: actions.create_project,
        new_comments: actions.comment,
        new_invites: actions.invite,
        total_comments: actions.comment, // Daily total
        active_users_by_role: finalActiveRoles,
        engagement_actions: actions
    };

    // 4. Save to Firestore
    await setDoc(doc(db, ANALYTICS_COLLECTION, dateString), stats);

    return stats;
};

/**
 * Calculates Engagement Score for a user and updates their profile.
 * Formula: (Logins * 1) + (View * 0.5) + (Comment * 5) + (Upload * 10) + (Invite * 20)
 */
export const updateUserEngagementScore = async (userId: string) => {
    // 1. Fetch User Profile for historical counts
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return 0;

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

    // 2. Fetch recent activity for granular events NOT in profile (Comments, Uploads, Campaign Answers)
    // We look at the last 90 days for these "active" metrics to keep the score somewhat fresh
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const q = query(
        collection(db, ACTIVITY_COLLECTION),
        where('userId', '==', userId),
        where('timestamp', '>=', startDate.getTime())
    );

    const snapshot = await getDocs(q);
    const uniqueCollaborators = new Set<string>();
    let activityPoints = 0;

    snapshot.forEach(doc => {
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

        // Note: We skip 'login', 'create_project', 'invite_user' here because they are covered by 
        // loginCount, projectCount, and shareCount in the profile.

        // Track collaborators
        if (data.metadata && data.metadata.collaboratorId) {
            uniqueCollaborators.add(data.metadata.collaboratorId);
        }
    });

    console.log(`[Engagement] Activity points: ${activityPoints}, Total raw score: ${score}`);

    // Normalize (assuming max raw score of 300 for a power user)
    // We cap it at 100 for the UI
    const MAX_RAW_SCORE = 300;  // Reduced from 1000 to 300
    const finalScore = Math.min(100, Math.round((score / MAX_RAW_SCORE) * 100));

    console.log(`[Engagement] Final score: ${finalScore} (${score}/${MAX_RAW_SCORE})`);

    // Update User Doc
    await setDoc(userRef, {
        engagementScore: finalScore,
        lifetime_collaborators: uniqueCollaborators.size,
        lastEngagementCalc: Date.now()
    }, { merge: true });

    return finalScore;
};

/**
 * Recalculates engagement scores for ALL users.
 * Useful for backfilling or fixing data.
 */
export const recalculateAllUserScores = async () => {
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const promises = usersSnap.docs.map(doc => updateUserEngagementScore(doc.id));
    await Promise.all(promises);
    return usersSnap.size;
};

/**
 * Fetches daily stats for a date range
 */
export const getAnalyticsStats = async (days: number): Promise<DailyAnalyticsStats[]> => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Firestore IDs are YYYY-MM-DD, so we can range query on ID if we want, 
    // or just query by timestamp field if we added one.
    // Let's query by timestamp field in the stats doc.
    const q = query(
        collection(db, ANALYTICS_COLLECTION),
        where('timestamp', '>=', startDate.getTime())
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as DailyAnalyticsStats).sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Generates Mock Data for the dashboard (since we have no history)
 */
export const generateMockAnalyticsData = async (days: number = 90) => {
    const batch = writeBatch(db);
    const today = new Date();

    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = formatDate(date);

        // Generate somewhat realistic random data with a trend
        const trendFactor = 1 + ((days - i) / days) * 0.5; // Growth over time
        const baseDAU = 50 + Math.random() * 20;

        const stats: DailyAnalyticsStats = {
            date: dateString,
            timestamp: date.getTime(),
            dau: Math.round(baseDAU * trendFactor),
            wau: Math.round(baseDAU * trendFactor * 3.5),
            mau: Math.round(baseDAU * trendFactor * 12),
            new_projects: Math.round((2 + Math.random() * 5) * trendFactor),
            new_comments: Math.round((10 + Math.random() * 30) * trendFactor),
            new_invites: Math.round((1 + Math.random() * 5) * trendFactor),
            total_comments: Math.round((10 + Math.random() * 30) * trendFactor),
            active_users_by_role: {
                homeowner: Math.round(baseDAU * 0.6 * trendFactor),
                pro: Math.round(baseDAU * 0.3 * trendFactor),
                guest: Math.round(baseDAU * 0.1 * trendFactor),
            },
            engagement_actions: {
                login: Math.round(baseDAU * trendFactor),
                create_project: Math.round((2 + Math.random() * 5) * trendFactor),
                upload_version: Math.round((1 + Math.random() * 3) * trendFactor),
                comment: Math.round((10 + Math.random() * 30) * trendFactor),
                invite: Math.round((1 + Math.random() * 5) * trendFactor),
                share: Math.round((1 + Math.random() * 5) * trendFactor),
            }
        };

        const docRef = doc(db, ANALYTICS_COLLECTION, dateString);
        batch.set(docRef, stats);
    }

    await batch.commit();
    console.log(`Generated mock analytics data for ${days} days.`);
};
