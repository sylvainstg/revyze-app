import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as sgMail from "@sendgrid/mail";

// Reuse API key setup
const API_KEY = functions.config().sendgrid?.key || process.env.SENDGRID_API_KEY;
if (API_KEY) sgMail.setApiKey(API_KEY);

export const sendDigestEmails = async (frequency: 'daily' | 'weekly') => {
    const db = admin.firestore();
    const queueRef = db.collection("notification_queue");

    // Logic:
    // 1. Get all pending notifications
    // 2. Group by user
    // 3. For each user, check if they are due for a digest (based on last sent or frequency)
    // 4. Generate email content
    // 5. Send email
    // 6. Mark queue items as processed (or delete)

    // Note: For a scalable solution, we should query by status='pending' and maybe paginate.
    // Assuming low volume for now.

    const snapshot = await queueRef.where("status", "==", "pending").get();

    if (snapshot.empty) {
        console.log("No pending notifications for digest.");
        return;
    }

    const updatesByUser: Record<string, any[]> = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const userId = data.userId;
        if (!updatesByUser[userId]) {
            updatesByUser[userId] = [];
        }
        updatesByUser[userId].push({ id: doc.id, ...data });
    });

    const userIds = Object.keys(updatesByUser);

    for (const userId of userIds) {
        try {
            // Check user preferences again to be sure (and get frequency)
            // But we already filtered by queueing? No, we queued based on prefs.
            // But we need to know IF it's time to send.

            const userDoc = await db.collection("users").doc(userId).get();
            if (!userDoc.exists) continue;

            const userData = userDoc.data();
            const prefs = userData?.notificationPreferences?.mentions;

            // Simple check: if frequency matches arg, send.
            if (prefs !== frequency) continue;

            // Generate content
            const notifications = updatesByUser[userId];
            const recipientEmail = notifications[0].email; // Assuming all same

            await sendDigestEmail(recipientEmail, frequency, notifications);

            // Mark as processed
            const batch = db.batch();
            notifications.forEach(n => {
                const ref = queueRef.doc(n.id);
                batch.update(ref, { status: "processed", processedAt: admin.firestore.FieldValue.serverTimestamp() });
            });
            await batch.commit();

        } catch (error) {
            console.error(`Error sending digest to user ${userId}:`, error);
        }
    }
};

const sendDigestEmail = async (email: string, frequency: string, notifications: any[]) => {
    const title = `Your ${frequency === 'daily' ? 'Daily' : 'Weekly'} Digest`;

    const itemsHtml = notifications.map(n => `
        <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
            <p style="margin: 0; color: #334155;">
                <strong>${n.author}</strong> ${n.subType === 'reply' ? 'replied' : 'mentioned you'} in <strong>${n.projectName}</strong>
            </p>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">
                "${n.content}"
            </p>
            <a href="https://dsng-app.web.app/?project=${n.projectId}" style="display: inline-block; margin-top: 5px; color: #667eea; text-decoration: none; font-size: 13px;">
                View
            </a>
        </div>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #f8fafc; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #1e293b; margin-top: 0;">${title}</h1>
        <p style="color: #475569;">Here is what you missed:</p>
        
        <div style="margin-top: 20px;">
            ${itemsHtml}
        </div>
        
        <p style="margin-top: 30px; color: #94a3b8; font-size: 12px; text-align: center;">
            Sent by Revyze
        </p>
    </div>
</body>
</html>
    `;

    const msg: any = {
        to: email,
        from: { email: "info+revyze@dictadoc.app", name: "Revyze" },
        subject: title,
        html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`Sent ${frequency} digest to ${email}`);
};
