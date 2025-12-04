// PDF utility functions

// Cache to store loaded PDF object URLs
const pdfCache = new Map<string, string>();

/**
 * Fetches a PDF from Firebase Storage via Cloud Function proxy
 * This bypasses CORS issues by routing through our backend
 * Caches the result as a Blob URL for instant subsequent access
 */
export const getPDFObjectURL = async (fileUrl: string): Promise<string> => {
    // Check cache first
    if (pdfCache.has(fileUrl)) {
        console.log('[PDF Utils] Returning cached PDF URL for:', fileUrl);
        return pdfCache.get(fileUrl)!;
    }

    console.log('[PDF Utils] Loading new PDF from:', fileUrl);

    try {
        let fetchUrl = fileUrl;

        // Check if it's a Firebase Storage URL that needs proxying
        if (fileUrl.includes('firebasestorage.googleapis.com') || fileUrl.includes('firebasestorage.app')) {
            // Extract the path from the Firebase Storage URL
            // Pattern: /o/{path}?alt=media or /o/{path}?alt=media&token=...
            const url = new URL(fileUrl);
            const pathMatch = url.pathname.match(/\/o\/(.+)$/);

            if (pathMatch) {
                // The path is already URL-encoded in the pathname
                const encodedPath = pathMatch[1];
                // Use Cloud Function proxy
                fetchUrl = `https://us-central1-dsng-app.cloudfunctions.net/getPDF?path=${encodedPath}`;
                console.log('[PDF Utils] Using proxy URL:', fetchUrl);
            }
        }

        // Fetch the PDF as a blob
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        // Cache the object URL
        pdfCache.set(fileUrl, objectUrl);
        console.log('[PDF Utils] PDF cached successfully');

        return objectUrl;
    } catch (error) {
        console.error('[PDF Utils] Error loading PDF:', error);
        // Fallback to original URL if fetch fails (might work if CORS isn't an issue for this specific URL)
        return fileUrl;
    }
};

/**
 * Revoke an object URL to free up memory
 * NOTE: We intentionally DO NOT revoke cached URLs to keep them available for quick switching
 */
export const revokePDFObjectURL = (url: string) => {
    // Only revoke if it's NOT in our cache (e.g. temporary URLs)
    // We iterate values to check if this URL is in our cache
    for (const cachedUrl of pdfCache.values()) {
        if (cachedUrl === url) return;
    }

    if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
};

/**
 * Optional: Clear the entire cache if memory usage becomes a concern
 */
export const clearPDFCache = () => {
    for (const url of pdfCache.values()) {
        URL.revokeObjectURL(url);
    }
    pdfCache.clear();
    console.log('[PDF Utils] PDF cache cleared');
};
