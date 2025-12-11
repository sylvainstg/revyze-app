import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

const ANALYTICS_COLLECTION = "analytics_daily_stats";
const ACTIVITY_COLLECTION = "user_activity";
const USERS_COLLECTION = "users";

type RoleBuckets = {
    homeowner: number;
    pro: number;
    guest: number;
};

type ActionBuckets = {
    login: number;
    create_project: number;
    upload_version: number;
    comment: number;
    invite: number;
    share: number;
};

const formatDate = (date: Date) => date.toISOString().split("T")[0];

const getDayBounds = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const mapEventToAction = (eventName: string): keyof ActionBuckets | null => {
    switch (eventName) {
        case "login":
            return "login";
        case "create_project":
            return "create_project";
        case "upload_version":
            return "upload_version";
        case "comment":
            return "comment";
        case "invite":
        case "invite_user":
            return "invite";
        case "share":
        case "share_project":
            return "share";
        default:
            return null;
    }
};

const reduceRole = (role?: string): keyof RoleBuckets => {
    if (!role) return "guest";
    const normalized = role.toLowerCase();
    if (normalized.includes("designer") || normalized.includes("architect")) return "pro";
    if (normalized.includes("homeowner")) return "homeowner";
    return "guest";
};

const getUniqueUsersInRange = async (start: number, end: number) => {
    const snapshot = await db.collection(ACTIVITY_COLLECTION)
        .where("timestamp", ">=", start)
        .where("timestamp", "<=", end)
        .get();

    const uniqueUsers = new Set<string>();
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
            uniqueUsers.add(data.userId);
        }
    });
    return uniqueUsers;
};

export const computeDailyStats = async (targetDate: Date) => {
    const { start, end } = getDayBounds(targetDate);
    const dateString = formatDate(start);

    const activitySnap = await db.collection(ACTIVITY_COLLECTION)
        .where("timestamp", ">=", start.getTime())
        .where("timestamp", "<=", end.getTime())
        .get();

    const actions: ActionBuckets = {
        login: 0,
        create_project: 0,
        upload_version: 0,
        comment: 0,
        invite: 0,
        share: 0
    };

    const uniqueUsers = new Set<string>();
    const userRoles = new Map<string, keyof RoleBuckets>();

    activitySnap.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
            uniqueUsers.add(data.userId);
            if (data.metadata?.role) {
                userRoles.set(data.userId, reduceRole(data.metadata.role));
            }
        }
        const mapped = mapEventToAction(data.eventName);
        if (mapped) {
            actions[mapped] += 1;
        }
    });

    // Backfill roles from user profiles when not present in metadata
    const userIdsNeedingRole = Array.from(uniqueUsers).filter(uid => !userRoles.has(uid));
    if (userIdsNeedingRole.length > 0) {
        const refs = userIdsNeedingRole.map(uid => db.collection(USERS_COLLECTION).doc(uid));
        const roleDocs = await db.getAll(...refs);
        roleDocs.forEach(snap => {
            if (snap.exists) {
                const data = snap.data();
                if (data?.role) {
                    userRoles.set(snap.id, reduceRole(data.role));
                }
            }
        });
    }

    const roleBuckets: RoleBuckets = { homeowner: 0, pro: 0, guest: 0 };
    userRoles.forEach(role => {
        roleBuckets[role] += 1;
    });

    // WAU / MAU windows anchored on the same day
    const wauStart = new Date(start);
    wauStart.setDate(wauStart.getDate() - 6);
    const mauStart = new Date(start);
    mauStart.setDate(mauStart.getDate() - 29);

    const [wauUsers, mauUsers] = await Promise.all([
        getUniqueUsersInRange(wauStart.getTime(), end.getTime()),
        getUniqueUsersInRange(mauStart.getTime(), end.getTime())
    ]);

    const stats = {
        date: dateString,
        timestamp: start.getTime(),
        dau: uniqueUsers.size,
        wau: wauUsers.size,
        mau: mauUsers.size,
        new_projects: actions.create_project,
        new_comments: actions.comment,
        new_invites: actions.invite,
        total_comments: actions.comment,
        active_users_by_role: roleBuckets,
        engagement_actions: actions
    };

    await db.collection(ANALYTICS_COLLECTION).doc(dateString).set(stats, { merge: true });
    return stats;
};

export const generateDailyAnalyticsSnapshot = functions.pubsub
    .schedule("0 2 * * *")
    .timeZone("UTC")
    .onRun(async () => {
        // Run for the previous day to avoid partial data
        const target = new Date();
        target.setDate(target.getDate() - 1);
        await computeDailyStats(target);
        return null;
    });

export const rebuildAnalyticsDaily = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }

    const caller = await db.collection(USERS_COLLECTION).doc(context.auth.uid).get();
    if (!caller.exists || !caller.data()?.isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only.");
    }

    const days = Number(data?.days) || 30;
    const results = [];
    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        results.push(computeDailyStats(date));
    }

    const computed = await Promise.all(results);
    return { success: true, daysComputed: computed.length };
});
