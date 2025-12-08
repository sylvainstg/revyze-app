import { useEffect, useState, useRef } from 'react';
import { RemoteConfigCampaign } from '../types/campaign';
import { getActiveFeedback, submitFeedbackAnswer } from '../services/feedbackService';

const DISMISS_STORAGE_KEY = 'revyze_feedback_dismissals';
const DISMISS_DURATION_DAYS = 14;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface UseFeedbackResult {
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

export const useFeedback = (enabled: boolean): UseFeedbackResult => {
    const [campaign, setCampaign] = useState<RemoteConfigCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const pollRef = useRef<number | undefined>(undefined);

    const fetchActive = async () => {
        if (!enabled) {
            setCampaign(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const active = await getActiveFeedback();

            if (!active) {
                setCampaign(null);
                return;
            }

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
            console.error('Failed to fetch feedback campaign', error);
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
        const dismissed = loadDismissals();
        dismissed[campaign.id] = Date.now();
        saveDismissals(dismissed);
        setCampaign(null);
    };

    const submit = async (answer: any) => {
        if (!campaign) return;
        const payload = (answer && typeof answer === 'object' && 'answer' in answer)
            ? (answer as any).answer
            : answer;
        await submitFeedbackAnswer(campaign.id, payload);
        setCampaign(null);
    };

    return { campaign, loading, dismiss, submit };
};
