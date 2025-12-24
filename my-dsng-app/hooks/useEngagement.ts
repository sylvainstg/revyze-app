import { useState, useEffect, useRef } from 'react';
import { RemoteConfigCampaign, FeedbackAnswer } from '../types/campaign';
import { getActiveFeedback, submitFeedbackAnswer } from '../services/feedbackService';

const DISMISS_STORAGE_KEY = 'revyze_feedback_dismissals';
const DEBUG_STORAGE_KEY = 'revyze_debug_engagement';
const FORCE_ID_STORAGE_KEY = 'revyze_force_campaign_id';
const DISMISS_DURATION_DAYS = 14;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface UseEngagementResult {
    campaign: RemoteConfigCampaign | null;
    loading: boolean;
    dismiss: () => void;
    submit: (answer: any) => Promise<void>;
}

const loadDismissals = (): Record<string, number> => {
    try {
        const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const saveDismissals = (map: Record<string, number>) => {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(map));
};

export const useEngagement = (enabled: boolean): UseEngagementResult => {
    const [campaign, setCampaign] = useState<RemoteConfigCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const pollRef = useRef<number | undefined>(undefined);

    // Get debug parameters from URL
    const searchParams = new URLSearchParams(window.location.search);
    const urlDebug = searchParams.get('DEBUG_ENGAGEMENT');
    const urlForceId = searchParams.get('FORCE_CAMPAIGN_ID');

    // Sync to session storage if present in URL
    if (urlDebug === '1') sessionStorage.setItem(DEBUG_STORAGE_KEY, '1');
    if (urlForceId) sessionStorage.setItem(FORCE_ID_STORAGE_KEY, urlForceId);

    // Derive final values (URL takes precedence, then session)
    const debugMode = urlDebug === '1' || sessionStorage.getItem(DEBUG_STORAGE_KEY) === '1';
    const forceCampaignId = urlForceId || sessionStorage.getItem(FORCE_ID_STORAGE_KEY);

    const fetchActive = async () => {
        if (!enabled) {
            // Must wait for auth
            if (debugMode) console.log('[Engagement DEBUG] Not enabled (waiting for auth).');
            return;
        }

        try {
            setLoading(true);

            if (debugMode) console.log(`[Engagement DEBUG] Fetching active campaign. ForceID: ${forceCampaignId || 'none'}`);

            // If forced, we pass it to the backend to bypass filters
            const active = await getActiveFeedback(forceCampaignId || undefined);

            console.log('[Engagement DEBUG] Backend returned:', active);

            if (!active) {
                if (debugMode) console.log('[Engagement DEBUG] No active campaign returned.');
                setCampaign(null);
                return;
            }

            // --- Debug Overrides ---
            if (debugMode) {
                console.log('[Engagement DEBUG] Bypassing frequency caps and dismissals for:', active.id);
                setCampaign(active);
                return;
            }

            if (forceCampaignId && active.id !== forceCampaignId) {
                console.log(`[Engagement DEBUG] Forcing campaign ${forceCampaignId}, but got ${active.id}. Filtering out.`);
                setCampaign(null);
                return;
            }

            // --- Normal Logic ---
            const dismissed = loadDismissals();
            const dismissedAt = dismissed[active.id];
            if (dismissedAt) {
                const cutoff = Date.now() - DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000;
                if (dismissedAt > cutoff) {
                    setCampaign(null);
                    return;
                }
            }

            setCampaign(active);
        } catch (error) {
            console.error('Failed to fetch engagement campaign', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActive();
        pollRef.current = window.setInterval(fetchActive, POLL_INTERVAL_MS);
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, [enabled]);

    const dismiss = () => {
        if (!campaign) return;

        if (!debugMode) {
            const dismissed = loadDismissals();
            dismissed[campaign.id] = Date.now();
            saveDismissals(dismissed);
        } else {
            console.log('[Engagement DEBUG] Suppressing dismissal persistence.');
        }

        setCampaign(null);
    };

    const submit = async (answer: any) => {
        if (!campaign) return;

        // Extract answer string/value if it's wrapped in a FeedbackAnswer object
        const payload = (answer && typeof answer === 'object' && 'answer' in answer)
            ? (answer as any).answer
            : answer;

        await submitFeedbackAnswer(campaign.id, payload);
        setCampaign(null);
    };

    return { campaign, loading, dismiss, submit };
};
