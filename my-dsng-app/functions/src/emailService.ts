import * as functions from "firebase-functions";
import * as sgMail from "@sendgrid/mail";

const API_KEY = process.env.SENDGRID_API_KEY || "SG.placeholder";
const TEMPLATE_ID = "d-27bd08911ce24952a3d93b5dc7d3bdea";

sgMail.setApiKey(API_KEY);

export const sendInvitationEmail = functions.https.onCall(async (data: any, context) => {
    // Log the raw incoming data for debugging
    console.log("Incoming data:", JSON.stringify(data));
    console.log("Context auth:", context.auth ? "authenticated" : "not authenticated");

    // Ensure user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    // Validate data structure
    if (!data || typeof data !== 'object') {
        console.error("Invalid data structure:", data);
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Data must be an object"
        );
    }

    const { email, projectName, url, inviterName } = data;

    // Log extracted values
    console.log("Extracted values:", { email, projectName, url, inviterName });

    if (!email || !url) {
        console.error("Missing required fields. Email:", email, "URL:", url);
        throw new functions.https.HttpsError(
            "invalid-argument",
            `Missing required fields. email: ${!!email}, url: ${!!url}`
        );
    }

    const msg = {
        to: email,
        from: {
            email: "info@dictadoc.app",
            name: "DesignSync"
        },
        templateId: TEMPLATE_ID,
        dynamic_template_data: {
            projectName,
            url,
            inviterName,
            subject: `${inviterName} invited you to collaborate on ${projectName}`
        },
    };

    try {
        console.log("Attempting to send email via SendGrid...");
        await sgMail.send(msg);
        console.log("Email sent successfully to:", email);
        return { success: true };
    } catch (error: any) {
        console.error("Error sending email:", error);
        if (error.response) {
            console.error(error.response.body);
        }
        throw new functions.https.HttpsError("internal", "Error sending email", error.message);
    }
});
