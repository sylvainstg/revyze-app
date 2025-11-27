// PDF utility functions

/**
 * Fetches a PDF from Firebase Storage via Cloud Function proxy
 * This bypasses CORS issues by routing through our backend
 */
export const getPDFObjectURL = async (fileUrl: string): Promise<string> => {
    console.log('[PDF Utils] Original URL:', fileUrl);

    try {
        // Check if it's a Firebase Storage URL
        if (!fileUrl.includes('firebasestorage.googleapis.com') && !fileUrl.includes('firebasestorage.app')) {
            console.log('[PDF Utils] Not a Firebase Storage URL, returning as-is');
            return fileUrl;
        }

        // Extract the path from the Firebase Storage URL
        // Pattern: /o/{path}?alt=media or /o/{path}?alt=media&token=...
        const url = new URL(fileUrl);
        const pathMatch = url.pathname.match(/\/o\/(.+)$/);

        if (!pathMatch) {
            console.log('[PDF Utils] Could not extract path from URL, returning as-is');
            return fileUrl;
        }

        // The path is already URL-encoded in the pathname
        const encodedPath = pathMatch[1];
        console.log('[PDF Utils] Extracted encoded path:', encodedPath);

        // Use Cloud Function proxy instead of direct Firebase Storage access
        // Pass the already-encoded path directly
        const proxyURL = `https://us-central1-dsng-app.cloudfunctions.net/getPDF?path=${encodedPath}`;
        console.log('[PDF Utils] Proxy URL:', proxyURL);

        return proxyURL;
    } catch (error) {
        console.error('[PDF Utils] Error creating PDF proxy URL:', error);
        // Fallback to original URL
        return fileUrl;
    }
};

/**
 * Revoke an object URL to free up memory
 */
export const revokePDFObjectURL = (url: string) => {
    // No-op for proxy URLs (they're not blob URLs)
    if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
};
