
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createCheckoutSession, createPortalSession, initializeStripeProducts, getPaymentHistory, getSubscriptionPlans } from "./stripeService";
import { sendVersionUpdateEmail } from "./emailService";
import {
    getOrCreateReferralCode,
    applyReferralCode,
    getUserReferralStats,
    redeemTokensForFeature,
    processReferralConversion,
    getReferrerInfo,
    REFERRAL_CONSTANTS
} from "./referralService";
import { getPDF } from "./pdfProxy";
import Stripe from "stripe";

admin.initializeApp();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export const createStripeCheckout = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    const priceId = data.priceId;
    const url = await createCheckoutSession(context.auth.uid, priceId);
    return { url };
});

export const createStripePortalSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    try {
        const url = await createPortalSession(context.auth.uid);
        return { url };
    } catch (error: any) {
        console.error("Error creating portal session:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const getUserPaymentHistory = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    // Check if requester is admin
    const callerUid = context.auth.uid;
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.data()?.isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Must be an admin to view payment history.");
    }

    const targetUid = data.uid;
    if (!targetUid) {
        throw new functions.https.HttpsError("invalid-argument", "Target UID is required.");
    }

    try {
        const history = await getPaymentHistory(targetUid);
        return { history };
    } catch (error: any) {
        console.error("Error fetching payment history:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const getSubscriptionPlansFunction = functions.region('us-central1').https.onCall(async (data, context) => {
    try {
        const plans = await getSubscriptionPlans();
        return { plans };
    } catch (error: any) {
        console.error("Error getting subscription plans:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ========== REFERRAL PROGRAM FUNCTIONS ==========

/**
 * Get or create a referral code for the authenticated user
 */
export const getUserReferralCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    try {
        const referralCode = await getOrCreateReferralCode(context.auth.uid);
        return { referralCode };
    } catch (error: any) {
        console.error("Error getting referral code:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Apply a referral code during signup
 */
export const applyReferralCodeFunction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const { referralCode } = data;
    if (!referralCode) {
        throw new functions.https.HttpsError("invalid-argument", "Referral code is required.");
    }

    try {
        const result = await applyReferralCode(context.auth.uid, referralCode);
        if (!result.success) {
            throw new functions.https.HttpsError("failed-precondition", result.message);
        }
        return result;
    } catch (error: any) {
        console.error("Error applying referral code:", error);
        if (error.code) throw error; // Re-throw HttpsError
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Get referral statistics for the authenticated user
 */
export const getReferralStatsFunction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    try {
        const stats = await getUserReferralStats(context.auth.uid);
        return stats;
    } catch (error: any) {
        console.error("Error getting referral stats:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Redeem tokens for a premium feature
 */
export const redeemTokens = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const { featureId } = data;
    if (!featureId) {
        throw new functions.https.HttpsError("invalid-argument", "Feature ID is required.");
    }

    try {
        const result = await redeemTokensForFeature(context.auth.uid, featureId);
        if (!result.success) {
            throw new functions.https.HttpsError("failed-precondition", result.message);
        }
        return result;
    } catch (error: any) {
        console.error("Error redeeming tokens:", error);
        if (error.code) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Admin: Get all referral data
 */
export const getAdminReferralData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    // Check if requester is admin
    const callerDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
    if (!callerDoc.data()?.isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Must be an admin.");
    }

    try {
        const referralsSnapshot = await admin.firestore().collection("referrals").get();
        const referrals = referralsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const transactionsSnapshot = await admin.firestore()
            .collection("transactions")
            .orderBy("timestamp", "desc")
            .limit(100)
            .get();
        const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { referrals, transactions, constants: REFERRAL_CONSTANTS };
    } catch (error: any) {
        console.error("Error getting admin referral data:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Admin: Update feature costs
 */
export const updateFeatureCost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    // Check if requester is admin
    const callerDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
    if (!callerDoc.data()?.isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Must be an admin.");
    }

    const { featureId, featureName, description, tokenCost, enabled } = data;
    if (!featureId || tokenCost === undefined) {
        throw new functions.https.HttpsError("invalid-argument", "Feature ID and token cost are required.");
    }

    try {
        const featureRef = admin.firestore().collection("featureCosts").doc(featureId);
        const featureDoc = await featureRef.get();

        const featureData = {
            featureName: featureName || featureId,
            description: description || "",
            tokenCost: Number(tokenCost),
            enabled: enabled !== undefined ? enabled : true,
            updatedAt: Date.now(),
        };

        if (featureDoc.exists) {
            await featureRef.update(featureData);
        } else {
            await featureRef.set({
                ...featureData,
                id: featureId,
                createdAt: Date.now(),
            });
        }

        return { success: true, message: "Feature cost updated successfully" };
    } catch (error: any) {
        console.error("Error updating feature cost:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Get all feature costs (public endpoint)
 */

export const getFeatureCosts = functions.region('us-central1').https.onCall(async (data, context) => {
    try {
        const featuresSnapshot = await admin.firestore().collection("featureCosts").get();
        const features = featuresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { features };
    } catch (error: any) {
        console.error("Error getting feature costs:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Get referrer information by referral code (public endpoint for landing page)
 */
export const getReferrerInfoFunction = functions.region('us-central1').https.onCall(async (data, context) => {
    const { referralCode } = data;
    if (!referralCode) {
        throw new functions.https.HttpsError("invalid-argument", "Referral code is required.");
    }

    try {
        const result = await getReferrerInfo(referralCode);
        return result;
    } catch (error: any) {
        console.error("Error getting referrer info:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ========== STRIPE WEBHOOK ==========

export const initStripe = functions.https.onRequest(async (req, res) => {
    await initializeStripeProducts();
    res.send("Stripe products initialized.");
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig as string, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message} `);
        res.status(400).send(`Webhook Error: ${err.message} `);
        return;
    }

    // Handle the event
    switch (event.type) {
        case "checkout.session.completed":
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.metadata && session.metadata.firebaseUID) {
                const uid = session.metadata.firebaseUID;
                const customerId = session.customer as string;
                console.log(`Processing checkout session for user: ${uid}, customer: ${customerId} `);

                try {
                    await admin.firestore().collection("users").doc(uid).update({
                        plan: "pro", // Defaulting to pro for now, logic should be more robust
                        subscriptionStatus: "active",
                        stripeCustomerId: customerId
                    });
                    console.log(`Successfully updated user ${uid} to plan: pro`);

                    // Process referral conversion if user was referred
                    await processReferralConversion(uid);
                } catch (error) {
                    console.error(`Failed to update user ${uid}: `, error);
                }
            } else {
                console.warn("Checkout session missing firebaseUID metadata");
            }
            break;
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`Subscription status: ${subscription.status} `);
            // Handle subscription changes (cancellation, etc.)
            // We need to find the user by customer ID or metadata
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }


    res.json({ received: true });
});

// ========== PROJECT TRIGGERS ==========

export const onProjectUpdated = functions.firestore
    .document("projects/{projectId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Check if a new version was added
        const beforeVersions = before.versions || [];
        const afterVersions = after.versions || [];

        if (afterVersions.length > beforeVersions.length) {
            const newVersion = afterVersions[afterVersions.length - 1];
            const projectId = context.params.projectId;
            const projectName = after.name;
            const uploaderEmail = newVersion.uploaderEmail;

            console.log(`New version detected for project ${projectId}. Version: ${newVersion.versionNumber}`);

            // Get uploader name
            let uploaderName = uploaderEmail || "A collaborator";
            if (uploaderEmail) {
                try {
                    const userSnapshot = await admin.firestore().collection("users").where("email", "==", uploaderEmail).limit(1).get();
                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        if (userData.name) {
                            uploaderName = userData.name;
                        }
                    }
                } catch (e) {
                    console.error("Error fetching uploader name:", e);
                }
            }

            // Get all collaborators + owner
            const recipients = new Set<string>();
            if (after.ownerEmail) recipients.add(after.ownerEmail);
            if (after.collaborators && Array.isArray(after.collaborators)) {
                after.collaborators.forEach((email: string) => recipients.add(email));
            }

            // Remove uploader from recipients
            if (uploaderEmail) {
                recipients.delete(uploaderEmail);
            }

            // Send emails
            const emailPromises: Promise<any>[] = [];
            recipients.forEach(email => {
                emailPromises.push(
                    sendVersionUpdateEmail(
                        email,
                        projectName,
                        newVersion.versionNumber,
                        uploaderName,
                        `https://revyze.app/?project=${projectId}` // Assuming this is the URL structure
                    )
                );
            });

            await Promise.all(emailPromises);
            console.log(`Sent ${emailPromises.length} version update emails.`);
        }
    });

// Export PDF proxy function
export { getPDF };

// Export Email service
export * from "./emailService";
export * from "./pricingService";

// Admin function to fix category assignment for a specific project version
export const fixProjectVersionCategory = functions.https.onCall(async (data, context) => {
    // Only allow authenticated admin users
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const { projectName, newCategory } = data;

    if (!projectName || !newCategory) {
        throw new functions.https.HttpsError("invalid-argument", "projectName and newCategory are required");
    }

    try {
        const db = admin.firestore();

        // Query for the project by name
        const projectsSnapshot = await db.collection('projects')
            .where('name', '==', projectName)
            .limit(1)
            .get();

        if (projectsSnapshot.empty) {
            throw new functions.https.HttpsError("not-found", `Project "${projectName}" not found`);
        }

        const projectDoc = projectsSnapshot.docs[0];
        const projectData = projectDoc.data();

        if (!projectData.versions || projectData.versions.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", "No versions found in project");
        }

        // Sort versions by timestamp to find the latest
        const sortedVersions = [...projectData.versions].sort((a: any, b: any) => b.timestamp - a.timestamp);
        const latestVersion = sortedVersions[0];

        // Calculate the next category version number for the new category
        const categoryVersions = projectData.versions.filter((v: any) => v.category === newCategory);
        const nextCategoryVersion = categoryVersions.length + 1;

        // Update the latest version's category
        const updatedVersions = projectData.versions.map((v: any) => {
            if (v.id === latestVersion.id) {
                return {
                    ...v,
                    category: newCategory,
                    categoryVersionNumber: nextCategoryVersion
                };
            }
            return v;
        });

        // Update the project
        await projectDoc.ref.update({
            versions: updatedVersions,
            activeCategory: newCategory,
            lastModified: Date.now()
        });

        return {
            success: true,
            message: `Successfully updated version "${latestVersion.fileName}" to category "${newCategory}"`,
            versionDetails: {
                fileName: latestVersion.fileName,
                oldCategory: latestVersion.category || 'Main Plans',
                newCategory: newCategory,
                categoryVersionNumber: nextCategoryVersion
            }
        };

    } catch (error: any) {
        console.error("Error fixing category:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// One-time HTTP function to fix category (no auth required for this admin task)
export const fixCategoryHttp = functions.https.onRequest(async (req, res) => {
    try {
        const db = admin.firestore();

        // Get category from request body or query parameter
        const newCategory = req.body?.newCategory || req.query?.newCategory || 'Electrique';

        console.log('Searching for project "Maison à Irlande"...');
        console.log('Target category:', newCategory);

        // Query for the project by name
        const projectsSnapshot = await db.collection('projects')
            .where('name', '==', 'Maison à Irlande')
            .limit(1)
            .get();

        if (projectsSnapshot.empty) {
            res.status(404).send('Project "Maison à Irlande" not found');
            return;
        }

        const projectDoc = projectsSnapshot.docs[0];
        const projectData = projectDoc.data();

        if (!projectData.versions || projectData.versions.length === 0) {
            res.status(400).send('No versions found in project');
            return;
        }

        // Sort versions by timestamp to find the latest
        const sortedVersions = [...projectData.versions].sort((a: any, b: any) => b.timestamp - a.timestamp);
        const latestVersion = sortedVersions[0];

        // Check if already in target category
        if (latestVersion.category === newCategory) {
            res.send({
                success: true,
                message: `Version is already in "${newCategory}" category`,
                version: latestVersion.fileName
            });
            return;
        }

        // Calculate the next category version number for target category
        const categoryVersions = projectData.versions.filter((v: any) => v.category === newCategory);
        const nextCategoryVersion = categoryVersions.length + 1;

        // Update the latest version's category
        const updatedVersions = projectData.versions.map((v: any) => {
            if (v.id === latestVersion.id) {
                return {
                    ...v,
                    category: newCategory,
                    categoryVersionNumber: nextCategoryVersion
                };
            }
            return v;
        });

        // Update the project
        await projectDoc.ref.update({
            versions: updatedVersions,
            activeCategory: newCategory,
            lastModified: Date.now()
        });

        res.send({
            success: true,
            message: `Successfully updated version "${latestVersion.fileName}" to category "${newCategory}"`,
            details: {
                fileName: latestVersion.fileName,
                oldCategory: latestVersion.category || 'Main Plans',
                newCategory: newCategory,
                categoryVersionNumber: nextCategoryVersion
            }
        });

    } catch (error: any) {
        console.error("Error fixing category:", error);
        res.status(500).send({ error: error.message });
    }
});

// ========== CAMPAIGN MANAGER FUNCTIONS ==========

// Email follow-up functions
export { onCampaignShown, processEmailFollowUps } from './campaigns/emailFollowUp';

// Campaign CRUD API
export {
    createCampaign,
    listCampaigns,
    updateCampaign,
    getCampaignAnalyticsEndpoint,
    getSegmentStats,
    initSampleCampaign,
    listSampleCampaigns,
    listSampleAdmins,
    getUserCampaignHistory
} from './campaigns/api';

// Engagement Score Functions
export { updateEngagementScore, recalculateAllEngagementScores } from './engagement/engagementScore';
