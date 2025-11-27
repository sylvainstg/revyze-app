import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Users, Star, ThumbsUp } from 'lucide-react';
import { FeatureId } from '../types';
import * as featureVoteService from '../services/featureVoteService';
import { FeatureVoteStats } from '../services/featureVoteService';

interface FeatureVoteAnalyticsProps {
    featureId: FeatureId;
    onClose: () => void;
}

export const FeatureVoteAnalytics: React.FC<FeatureVoteAnalyticsProps> = ({
    featureId,
    onClose
}) => {
    const [stats, setStats] = useState<FeatureVoteStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            setLoading(true);
            const data = await featureVoteService.getFeatureVoteStats(featureId);
            setStats(data);
            setLoading(false);
        };
        loadStats();
    }, [featureId]);

    const featureTitles: Record<FeatureId, string> = {
        'ai-summary': 'AI Design Summary',
        'advanced-collaboration': 'Advanced Collaboration',
        'version-comparison': 'Version Comparison'
    };

    if (loading || !stats) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 text-center">
                    <p className="text-slate-600">Loading analytics...</p>
                </div>
            </div>
        );
    }

    const interestPercentages = {
        'not-interested': stats.totalVotes > 0 ? Math.round((stats.interestCounts['not-interested'] / stats.totalVotes) * 100) : 0,
        'interested': stats.totalVotes > 0 ? Math.round((stats.interestCounts['interested'] / stats.totalVotes) * 100) : 0,
        'very-interested': stats.totalVotes > 0 ? Math.round((stats.interestCounts['very-interested'] / stats.totalVotes) * 100) : 0
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{featureTitles[featureId]}</h2>
                        <p className="text-slate-600 mt-1">Feature Vote Analytics</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-indigo-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm font-medium text-indigo-900">Total Votes</span>
                            </div>
                            <div className="text-2xl font-bold text-indigo-600">{stats.totalVotes}</div>
                        </div>

                        <div className="p-4 bg-green-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <ThumbsUp className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-green-900">Very Interested</span>
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                                {stats.interestCounts['very-interested']} ({interestPercentages['very-interested']}%)
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-900">Interested</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                                {stats.interestCounts['interested']} ({interestPercentages['interested']}%)
                            </div>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <Star className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-medium text-amber-900">Avg Value</span>
                            </div>
                            <div className="text-2xl font-bold text-amber-600">
                                {stats.averageValueRating.toFixed(1)}/5
                            </div>
                        </div>
                    </div>

                    {/* Interest Level Breakdown */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">Interest Level Distribution</h3>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-700">Very Interested 🤩</span>
                                    <span className="font-medium text-slate-900">
                                        {stats.interestCounts['very-interested']} votes ({interestPercentages['very-interested']}%)
                                    </span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500"
                                        style={{ width: `${interestPercentages['very-interested']}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-700">Interested 🙂</span>
                                    <span className="font-medium text-slate-900">
                                        {stats.interestCounts['interested']} votes ({interestPercentages['interested']}%)
                                    </span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500"
                                        style={{ width: `${interestPercentages['interested']}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-700">Not Interested 😐</span>
                                    <span className="font-medium text-slate-900">
                                        {stats.interestCounts['not-interested']} votes ({interestPercentages['not-interested']}%)
                                    </span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-slate-400"
                                        style={{ width: `${interestPercentages['not-interested']}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Role Breakdown */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">Breakdown by User Role</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {Object.entries(stats.roleBreakdown).map(([role, count]) => (
                                <div key={role} className="p-4 bg-slate-50 rounded-lg">
                                    <div className="text-sm text-slate-600 capitalize mb-1">{role}</div>
                                    <div className="text-xl font-bold text-slate-900">{count}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Votes */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">
                            Recent Votes ({stats.votes.length})
                        </h3>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {stats.votes
                                .sort((a, b) => b.timestamp - a.timestamp)
                                .slice(0, 20)
                                .map((vote) => (
                                    <div key={vote.id} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm font-medium text-slate-700 capitalize">{vote.userRole}</div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(vote.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm">
                                                {vote.interest === 'very-interested' && '🤩 Very Interested'}
                                                {vote.interest === 'interested' && '🙂 Interested'}
                                                {vote.interest === 'not-interested' && '😐 Not Interested'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                <span className="text-sm font-medium text-slate-700">{vote.valueRating}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
