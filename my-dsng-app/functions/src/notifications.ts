import * as admin from "firebase-admin";
import { sendMentionEmail } from "./emailService";

// Helper interfaces matching frontend types (simplified)
interface Comment {
  id: string;
  text: string;
  author: string;
  authorName?: string;
  timestamp: number;
  mentions?: string[];
  replies?: CommentReply[];
}

interface CommentReply {
  id: string;
  text: string;
  author: string;
  authorName?: string;
  timestamp: number;
  mentions?: string[];
}

interface ProjectVersion {
  id: string;
  comments: Comment[];
}

export const processNewMentions = async (
  before: any,
  after: any,
  projectId: string,
) => {
  const beforeVersions = (before.versions || []) as ProjectVersion[];
  const afterVersions = (after.versions || []) as ProjectVersion[];

  // Find changed or new versions
  for (const afterVer of afterVersions) {
    const beforeVer = beforeVersions.find((v) => v.id === afterVer.id);
    const beforeComments = beforeVer ? beforeVer.comments : [];
    const afterComments = afterVer.comments;

    // Check for new comments
    const newComments = afterComments.filter(
      (c) => !beforeComments.find((bc) => bc.id === c.id),
    );

    // Check for new replies in existing comments
    const existingComments = afterComments.filter((c) =>
      beforeComments.find((bc) => bc.id === c.id),
    );

    // Process new comments
    for (const comment of newComments) {
      if (comment.mentions && comment.mentions.length > 0) {
        await handleMentions(
          comment.mentions,
          comment,
          after.name,
          projectId,
          "comment",
        );
      }
    }

    // Process new replies
    for (const comment of existingComments) {
      const beforeComment = beforeComments.find((bc) => bc.id === comment.id);
      if (!beforeComment) continue;

      const beforeReplies = beforeComment.replies || [];
      const afterReplies = comment.replies || [];

      const newReplies = afterReplies.filter(
        (r) => !beforeReplies.find((br) => br.id === r.id),
      );

      for (const reply of newReplies) {
        if (reply.mentions && reply.mentions.length > 0) {
          // Pass comment text as context or the reply text? The reply text.
          // Maybe pass the parent comment text as context.
          await handleMentions(
            reply.mentions,
            reply,
            after.name,
            projectId,
            "reply",
            comment.text,
          );
        }
      }
    }
  }
};

const handleMentions = async (
  mentionedEmails: string[],
  item: Comment | CommentReply,
  projectName: string,
  projectId: string,
  type: "comment" | "reply",
  contextText?: string,
) => {
  const db = admin.firestore();

  for (const email of mentionedEmails) {
    if (!email) continue;

    try {
      // 1. Find user by email to check preferences
      const userSnap = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      let shouldNotify = true; // Default to notify if no user/prefs found (safe fallback)
      let userId: string | null = null;
      // let userName: string = email; // Unused

      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        userId = userDoc.id;
        // userName = userData.name || email; // Unused

        // Check preferences
        const prefs = userData.notificationPreferences?.mentions;
        if (prefs === "none") {
          shouldNotify = false;
        } else if (prefs === "daily" || prefs === "weekly") {
          shouldNotify = false;
          // TODO: Queue for digest
          await queueForDigest(
            userId,
            email,
            type,
            item,
            projectName,
            projectId,
          );
        }
        // if 'instant' or undefined, we notify
      }

      if (shouldNotify) {
        await sendMentionEmail(
          email,
          item.authorName || item.author,
          projectName,
          item.text,
          `https://dsng-app.web.app/?project=${projectId}`, // Deep link could be improved to point to comment
          type,
          contextText,
        );
        console.log(`Sent mention email to ${email}`);
      }
    } catch (error) {
      console.error(`Error processing mention for ${email}:`, error);
    }
  }
};

const queueForDigest = async (
  userId: string,
  email: string,
  type: "comment" | "reply",
  item: Comment | CommentReply,
  projectName: string,
  projectId: string,
) => {
  // Add to notification_queue collection
  try {
    await admin
      .firestore()
      .collection("notification_queue")
      .add({
        userId,
        email,
        type: "mention",
        subType: type,
        content: item.text,
        author: item.authorName || item.author,
        projectName,
        projectId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });
    console.log(`Queued mention for digest: ${email}`);
  } catch (e) {
    console.error("Error queuing digest:", e);
  }
};
