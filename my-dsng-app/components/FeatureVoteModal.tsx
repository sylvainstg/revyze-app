import React, { useState } from 'react';
import { X, Sparkles, Star, TrendingUp, Users, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { FeatureId, VoteInterest, User } from '../types';
import * as featureVoteService from '../services/featureVoteService';

interface FeatureVoteModalProps {
    featureId: FeatureId;
    user: User;
    onClose: () => void;
    onVoteSubmitted?: () => void;
}

export const FeatureVoteModal: React.FC<FeatureVoteModalProps> = ({
    featureId,
    user,
    onClose,
    onVoteSubmitted
}) => {
    const [interest, setInterest] = useState<VoteInterest | null>(null);
    const [valueRating, setValueRating] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const featureInfo = {
        'ai-summary': {
            title: 'AI Design Summary',
            description: 'Get instant AI-powered summaries of design feedback and comments',
            benefits: [
                'Automatic summary of all project feedback',
                'Identifies key themes and priorities',
                'Saves hours of reading through comments',
                'Highlights critical issues requiring attention'
            ],
            icon: Sparkles
        },
        'advanced-collaboration': {
            title: 'Advanced Collaboration',
            description: 'Real-time collaboration with live cursors and presence',
            benefits: [
                'See who\'s viewing in real-time',
                'Live cursor tracking',
                'Instant notification of new comments',
                'Team activity dashboard'
            ],
            icon: Users
        },
        'version-comparison': {
            title: 'Version Comparison',
            description: 'Side-by-side comparison of different design versions',
            benefits: [
                'Visual diff between versions',
                'Track changes over time',
                'Compare comment threads',
                'Export comparison reports'
            ],
            icon: TrendingUp
        }
    };

    const feature = featureInfo[featureId];
    const Icon = feature.icon;

    const handleSubmit = async () => {
        if (!interest || valueRating === 0) return;

        setIsSubmitting(true);
        const success = await featureVoteService.submitFeatureVote(
            user.id,
            featureId,
            interest,
            valueRating,
            user.role,
            user.email
        );

        setIsSubmitting(false);

        if (success) {
            setSubmitted(true);
            if (onVoteSubmitted) onVoteSubmitted();
            setTimeout(() => onClose(), 2000);
        }
    };

    if (submitted) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h3>
                    <p className="text-slate-600">
                        Your feedback helps us build features that matter most to you.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-start">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-100 rounded-xl">
                            <Icon className="w-8 h-8 text-indigo-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-2xl font-bold text-slate-900">{feature.title}</h2>
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                                    Coming Soon
                                </span>
                            </div>
                            <p className="text-slate-600">{feature.description}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Benefits */}
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">What You'll Get:</h3>
                        <div className="space-y-3">
                            {feature.benefits.map((benefit, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <Zap className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                                    <span className="text-slate-700">{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Interest Level */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">How interested are you?</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setInterest('not-interested')}
                                className={`p-4 rounded-xl border-2 transition-all ${interest === 'not-interested'
                                        ? 'border-slate-400 bg-slate-50 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-1">😐</div>
                                    <div className="text-sm font-medium text-slate-700">Not Really</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setInterest('interested')}
                                className={`p-4 rounded-xl border-2 transition-all ${interest === 'interested'
                                        ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-1">🙂</div>
                                    <div className="text-sm font-medium text-slate-700">Interested</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setInterest('very-interested')}
                                className={`p-4 rounded-xl border-2 transition-all ${interest === 'very-interested'
                                        ? 'border-green-400 bg-green-50 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-1">🤩</div>
                                    <div className="text-sm font-medium text-slate-700">Very Interested!</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Value Rating */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">
                            How valuable would this be for your workflow?
                        </h3>
                        <div className="flex items-center gap-2 justify-center">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => setValueRating(rating)}
                                    className="p-2 transition-transform hover:scale-110"
                                >
                                    <Star
                                        className={`w-10 h-10 ${rating <= valueRating
                                                ? 'text-amber-400 fill-amber-400'
                                                : 'text-slate-300'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        {valueRating > 0 && (
                            <p className="text-center text-sm text-slate-600 mt-2">
                                {valueRating === 1 && 'Not very valuable'}
                                {valueRating === 2 && 'Somewhat valuable'}
                                {valueRating === 3 && 'Moderately valuable'}
                                {valueRating === 4 && 'Very valuable'}
                                {valueRating === 5 && 'Extremely valuable!'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>
                        Maybe Later
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!interest || valueRating === 0 || isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
