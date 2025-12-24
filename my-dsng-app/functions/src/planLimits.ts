import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// Default limits (fallback if Firestore is empty)
const DEFAULT_LIMITS = {
    free: {
        totalProjects: 10,
        ownedProjects: 1,
        storageMB: 50,
        collaborators: 0,
        aiAnalysis: 5,
    },
    pro: {
        totalProjects: -1, // -1 represents Infinity for storage
        ownedProjects: -1,
        storageMB: 10240, // 10GB
        collaborators: -1,
        aiAnalysis: -1,
    },
    business: {
        totalProjects: -1,
        ownedProjects: -1,
        storageMB: 102400, // 100GB
        collaborators: -1,
        aiAnalysis: -1,
    },
};

/**
 * Get plan limits for all plans
 * Returns limits from Firestore or defaults if not set
 */
export const getPlanLimits = functions.https.onCall(async (data, context) => {
    try {
        const limitsSnapshot = await db.collection("plan_limits").get();

        // Initialize with default limits (deep copy)
        const limits: any = JSON.parse(JSON.stringify(DEFAULT_LIMITS));

        // Override with any plan limits found in Firestore
        limitsSnapshot.forEach((doc) => {
            if (limits[doc.id]) {
                limits[doc.id] = { ...limits[doc.id], ...doc.data() };
            }
        });

        return { limits, source: limitsSnapshot.empty ? "defaults" : "firestore" };
    } catch (error: any) {
        console.error("Error fetching plan limits:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to fetch plan limits"
        );
    }
});

/**
 * Update plan limits (admin only)
 */
export const updatePlanLimits = functions.https.onCall(
    async (data, context) => {
        // Check authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated"
            );
        }

        // Check if user is admin
        const userDoc = await db
            .collection("users")
            .doc(context.auth.uid)
            .get();
        const userData = userDoc.data();

        if (!userData?.isAdmin) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "Only admins can update plan limits"
            );
        }

        const { planId, limits } = data;

        // Validate planId
        if (!["free", "pro", "business"].includes(planId)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid plan ID"
            );
        }

        // Validate limits structure
        const requiredFields = [
            "totalProjects",
            "ownedProjects",
            "storageMB",
            "collaborators",
            "aiAnalysis",
        ];
        for (const field of requiredFields) {
            if (typeof limits[field] !== "number") {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    `Missing or invalid field: ${field}`
                );
            }
        }

        try {
            // Update or create the plan limits
            await db.collection("plan_limits").doc(planId).set(limits);

            console.log(`Updated plan limits for ${planId}:`, limits);

            return {
                success: true,
                planId,
                limits,
            };
        } catch (error: any) {
            console.error("Error updating plan limits:", error);
            throw new functions.https.HttpsError(
                "internal",
                "Failed to update plan limits"
            );
        }
    }
);

/**
 * Initialize plan limits with defaults (one-time setup)
 */
export const initializePlanLimits = functions.https.onCall(
    async (data, context) => {
        // Check authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated"
            );
        }

        // Check if user is admin
        const userDoc = await db
            .collection("users")
            .doc(context.auth.uid)
            .get();
        const userData = userDoc.data();

        if (!userData?.isAdmin) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "Only admins can initialize plan limits"
            );
        }

        try {
            const batch = db.batch();

            for (const [planId, limits] of Object.entries(DEFAULT_LIMITS)) {
                const docRef = db.collection("plan_limits").doc(planId);
                batch.set(docRef, limits);
            }

            await batch.commit();

            console.log("Initialized plan limits with defaults");

            return {
                success: true,
                message: "Plan limits initialized successfully",
            };
        } catch (error: any) {
            console.error("Error initializing plan limits:", error);
            throw new functions.https.HttpsError(
                "internal",
                "Failed to initialize plan limits"
            );
        }
    }
);
