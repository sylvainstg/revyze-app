import * as functions from "firebase-functions";
import * as sgMail from "@sendgrid/mail";

const API_KEY = functions.config().sendgrid?.key || process.env.SENDGRID_API_KEY;

if (API_KEY) {
    sgMail.setApiKey(API_KEY);
} else {
    console.warn("SendGrid API Key is missing!");
}

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

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Revyze</h1>
                            <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px;">Design Collaboration Platform</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">You've been invited!</h2>
                            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                                <strong>${inviterName}</strong> has invited you to collaborate on the project <strong>${projectName}</strong>.
                            </p>
                            <p style="margin: 0 0 30px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                                Click the button below to access the design and start collaborating!
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="${url}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                                            Access the Design
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                                Or copy and paste this link into your browser:<br>
                                <a href="${url}" style="color: #667eea; word-break: break-all;">${url}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center; line-height: 1.6;">
                                This invitation was sent by Revyze on behalf of ${inviterName}.<br>
                                If you have any questions, please contact your collaborator.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const msg: any = {
        personalizations: [
            {
                to: [{ email: email }],
                subject: `${inviterName} invited you to collaborate on ${projectName}`,
            }
        ],
        from: {
            email: "info+revyze@dictadoc.app",
            name: "Revyze"
        },
        content: [
            {
                type: "text/html",
                value: htmlContent
            }
        ],
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

export const sendVersionUpdateEmail = async (
    email: string,
    projectName: string,
    versionNumber: number,
    uploaderName: string,
    url: string
) => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Revyze</h1>
                            <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px;">Design Collaboration Platform</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">New Version Uploaded</h2>
                            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                                <strong>${uploaderName}</strong> has uploaded <strong>Version ${versionNumber}</strong> of <strong>${projectName}</strong>.
                            </p>
                            <p style="margin: 0 0 30px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                                Click the button below to view the latest changes.
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="${url}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                                            View Version ${versionNumber}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                                Or copy and paste this link into your browser:<br>
                                <a href="${url}" style="color: #667eea; word-break: break-all;">${url}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center; line-height: 1.6;">
                                This notification was sent by Revyze.<br>
                                You are receiving this because you are a collaborator on this project.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const msg: any = {
        personalizations: [
            {
                to: [{ email: email }],
                subject: `New version uploaded: ${projectName} (v${versionNumber})`,
            }
        ],
        from: {
            email: "info+revyze@dictadoc.app",
            name: "Revyze"
        },
        content: [
            {
                type: "text/html",
                value: htmlContent
            }
        ],
    };

    try {
        console.log(`Sending version update email to ${email} for project ${projectName} v${versionNumber}`);
        await sgMail.send(msg);
        console.log("Email sent successfully");
        return { success: true };
    } catch (error: any) {
        console.error("Error sending email:", error);
        if (error.response) {
            console.error(error.response.body);
        }
        // Don't throw here, just log error so other emails can still be sent if called in loop
        return { success: false, error: error.message };
    }
};
