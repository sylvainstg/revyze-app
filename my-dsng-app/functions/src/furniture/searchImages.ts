import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

// Google Custom Search Image API proxy. Caches results in Firestore by query
// for 30 days to stretch the 100/day free tier.
//
// Setup:
//   1. Create a Programmable Search Engine at https://programmablesearchengine.google.com
//      with "Search the entire web" + Image search ON. Copy the Search engine ID (cx).
//   2. Get an API key from Google Cloud Console (enable "Custom Search API").
//   3. Set in Functions config:
//        firebase functions:config:set google_cse.key="YOUR_KEY" google_cse.cx="YOUR_CX"
//      Or as env vars: GOOGLE_CSE_KEY, GOOGLE_CSE_CX.

const CACHE_COLLECTION = "furniture_search_cache";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESULTS_PER_QUERY = 10;

interface SearchHit {
  thumbUrl: string;
  fullUrl: string;
  sourceUrl: string;
  title: string;
}

const hashQuery = (query: string): string =>
  crypto.createHash("sha256").update(query.toLowerCase().trim()).digest("hex");

const getCseCredentials = () => {
  const cfg = functions.config();
  const key = process.env.GOOGLE_CSE_KEY || cfg.google_cse?.key;
  const cx = process.env.GOOGLE_CSE_CX || cfg.google_cse?.cx;
  return { key, cx };
};

export const searchFurnitureImages = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to search.",
      );
    }
    const query = (data?.query || "").toString().trim();
    if (!query || query.length < 2) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Query must be at least 2 characters.",
      );
    }

    const { key, cx } = getCseCredentials();
    if (!key || !cx) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Image search is not configured. Contact support.",
      );
    }

    const db = admin.firestore();
    const cacheKey = hashQuery(query);
    const cacheRef = db.collection(CACHE_COLLECTION).doc(cacheKey);

    // Try cache first.
    const cached = await cacheRef.get();
    if (cached.exists) {
      const c = cached.data() as { hits: SearchHit[]; cachedAt: number };
      if (Date.now() - c.cachedAt < CACHE_TTL_MS) {
        return { hits: c.hits, cached: true };
      }
    }

    // Live call to Google Custom Search.
    const params = new URLSearchParams({
      key,
      cx,
      q: query,
      searchType: "image",
      num: String(RESULTS_PER_QUERY),
      safe: "active",
      imgType: "photo",
    });
    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

    let json: any;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        const text = await resp.text();
        console.error("CSE error:", resp.status, text);
        throw new functions.https.HttpsError(
          "internal",
          "Image search failed. Try a different query.",
        );
      }
      json = await resp.json();
    } catch (e: any) {
      if (e instanceof functions.https.HttpsError) throw e;
      console.error("CSE fetch failed:", e);
      throw new functions.https.HttpsError("internal", "Image search failed.");
    }

    const hits: SearchHit[] = (json.items || [])
      .map((item: any) => ({
        thumbUrl: item.image?.thumbnailLink || item.link,
        fullUrl: item.link,
        sourceUrl: item.image?.contextLink || "",
        title: item.title || "",
      }))
      .filter((h: SearchHit) => h.thumbUrl && h.fullUrl);

    await cacheRef.set({
      query,
      hits,
      cachedAt: Date.now(),
      hitCount: hits.length,
    });

    return { hits, cached: false };
  },
);
