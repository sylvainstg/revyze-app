import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { randomUUID } from "crypto";

const PROJECTS_COLLECTION = "projects";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB cap
const FETCH_TIMEOUT_MS = 15000;

const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

interface ProjectDoc {
  ownerId?: string;
  collaborators?: string[];
}

const verifyProjectMember = async (
  projectId: string,
  userId: string,
  userEmail: string | undefined,
) => {
  const snap = await admin
    .firestore()
    .collection(PROJECTS_COLLECTION)
    .doc(projectId)
    .get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Project not found.");
  }
  const p = snap.data() as ProjectDoc;
  const isOwner = p.ownerId === userId;
  const isCollab =
    !!userEmail &&
    Array.isArray(p.collaborators) &&
    p.collaborators.map((c) => c.toLowerCase()).includes(userEmail.toLowerCase());
  if (!isOwner && !isCollab) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Not a member of this project.",
    );
  }
};

const fetchWithCap = async (url: string): Promise<{ buffer: Buffer; contentType: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "DSNG-FurnitureFetch/1.0" },
    });
    if (!resp.ok) {
      throw new functions.https.HttpsError(
        "unavailable",
        `Source returned ${resp.status}.`,
      );
    }
    const contentType = (resp.headers.get("content-type") || "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "URL is not an image.",
      );
    }
    const declared = parseInt(resp.headers.get("content-length") || "0", 10);
    if (declared && declared > MAX_BYTES) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Image exceeds 8MB.",
      );
    }
    const arrayBuf = await resp.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Image exceeds 8MB.",
      );
    }
    return { buffer: Buffer.from(arrayBuf), contentType };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    if (e?.name === "AbortError") {
      throw new functions.https.HttpsError("deadline-exceeded", "Fetch timed out.");
    }
    console.error("Image fetch failed:", e);
    throw new functions.https.HttpsError("unavailable", "Could not fetch image.");
  } finally {
    clearTimeout(timer);
  }
};

export const fetchAndStoreFurnitureImage = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to import images.",
      );
    }
    const sourceUrl = (data?.url || "").toString().trim();
    const projectId = (data?.projectId || "").toString().trim();
    const attributionSource = (data?.attributionSource || "").toString().trim();
    const attributionPageUrl = (data?.attributionPageUrl || "").toString().trim();

    if (!sourceUrl || !projectId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "url and projectId are required.",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new functions.https.HttpsError("invalid-argument", "Invalid URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new functions.https.HttpsError("invalid-argument", "Unsupported protocol.");
    }

    await verifyProjectMember(
      projectId,
      context.auth.uid,
      context.auth.token?.email,
    );

    const { buffer, contentType } = await fetchWithCap(sourceUrl);
    const ext = EXT_FOR_MIME[contentType] || "bin";
    const objectId = randomUUID();
    const storagePath = `projects/${projectId}/furniture/${objectId}.${ext}`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const downloadToken = randomUUID();
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          sourceUrl,
          attributionSource,
          attributionPageUrl,
          fetchedBy: context.auth.uid,
        },
      },
      resumable: false,
    });

    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent(storagePath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return {
      storageUrl: downloadUrl,
      storagePath,
      contentType,
      size: buffer.length,
      attribution: {
        source: attributionSource || parsed.hostname,
        pageUrl: attributionPageUrl || sourceUrl,
      },
    };
  },
);
