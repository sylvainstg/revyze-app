import React, { useState } from 'react';
import { X, MessageCircle, Star } from 'lucide-react';
import { RemoteConfigCampaign, FeedbackAnswer } from '../types/campaign';
import { Button } from './ui/Button';

interface FeedbackModalProps {
    campaign: RemoteConfigCampaign;
    onSubmit: (answer: FeedbackAnswer) => Promise<void>;
    onDismiss: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ campaign, onSubmit, onDismiss }) => {
    const [answer, setAnswer] = useState<any>('');
    const [submitting, setSubmitting] = useState(false);
    const [showThankYou, setShowThankYou] = useState(false);

    const handleSubmit = async () => {
        if (!answer || (campaign.type === 'free_text' && !answer.trim())) {
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit({
                campaignId: campaign.id,
                variantId: campaign.variant?.id,
                answer,
                timestamp: Date.now()
            });

            setShowThankYou(true);
            setTimeout(() => {
                onDismiss();
            }, 2000);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (showThankYou) {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Thank you!</h3>
                    <p className="text-slate-600">Your feedback helps us improve Revyze.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white relative">
                    <button
                        onClick={onDismiss}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold">Quick Feedback</h2>
                    </div>
                    <p className="text-white/90 text-sm">Help us improve your experience</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-slate-900 font-medium mb-4">{campaign.question}</p>

                    {/* NPS Score */}
                    {campaign.type === 'nps' && (
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs text-slate-500 mb-2">
                                <span>Not likely</span>
                                <span>Very likely</span>
                            </div>
                            <div className="grid grid-cols-11 gap-1">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                                    <button
                                        key={score}
                                        onClick={() => setAnswer(score)}
                                        className={`h-12 rounded-lg border-2 font-semibold transition-all ${answer === score
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg scale-105'
                                                : 'border-slate-200 hover:border-indigo-300 text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        {score}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CSAT (1-5 stars) */}
                    {campaign.type === 'csat' && (
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => setAnswer(rating)}
                                    className="group"
                                >
                                    <Star
                                        className={`w-10 h-10 transition-all ${answer >= rating
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-slate-300 group-hover:text-yellow-200'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Multiple Choice */}
                    {campaign.type === 'multiple_choice' && campaign.choices && (
                        <div className="space-y-2">
                            {campaign.choices.map((choice, index) => (
                                <button
                                    key={index}
                                    onClick={() => setAnswer(choice)}
                                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${answer === choice
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                            : 'border-slate-200 hover:border-indigo-300 text-slate-700'
                                        }`}
                                >
                                    {choice}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Free Text */}
                    {campaign.type === 'free_text' && (
                        <textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Share your thoughts..."
                            className="w-full p-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            rows={4}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={onDismiss}
                        className="flex-1"
                        disabled={submitting}
                    >
                        Not now
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="flex-1"
                        disabled={!answer || submitting}
                    >
                        {submitting ? 'Submitting...' : 'Submit'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
