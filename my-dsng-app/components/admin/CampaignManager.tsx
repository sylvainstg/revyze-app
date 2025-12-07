import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { ArrowLeft, Plus, BarChart3, Play, Pause, Trash2 } from 'lucide-react';
import { FeedbackCampaign, CampaignAnalytics } from '../../types/campaign';
import { functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

interface CampaignManagerProps {
    onBack: () => void;
}

export const CampaignManager: React.FC<CampaignManagerProps> = ({ onBack }) => {
    const [campaigns, setCampaigns] = useState<(FeedbackCampaign & { analytics?: CampaignAnalytics })[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        setError(null);
        try {
            const listCampaignsFunc = httpsCallable(functions, 'listCampaigns');
            const result = await listCampaignsFunc({});
            const data = result.data as { campaigns: any[] };
            setCampaigns(data.campaigns || []);
        } catch (err: any) {
            console.error('Error fetching campaigns:', err);
            setError(err.message || 'Failed to fetch campaigns');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (campaignId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';

        try {
            const updateCampaignFunc = httpsCallable(functions, 'updateCampaign');
            await updateCampaignFunc({ id: campaignId, status: newStatus });
            await fetchCampaigns();
        } catch (error) {
            console.error('Error updating campaign:', error);
            alert('Failed to update campaign status');
        }
    };

    const [segmentStats, setSegmentStats] = useState<Record<string, any>>({});
    const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [analyticsData, setAnalyticsData] = useState<{
        segmentDistribution: Array<{ segment: string; count: number; percentage: number }>;
        campaignPerformance: Array<{
            campaignId: string;
            name: string;
            shown: number;
            dismissed: number;
            answered: number;
            dismissRate: number;
            answerRate: number;
        }>;
    } | null>(null);

    const handleCheckAudience = async (campaignId: string, segmentType: string) => {
        setLoadingStats(prev => ({ ...prev, [campaignId]: true }));
        try {
            const getSegmentStatsFunc = httpsCallable(functions, 'getSegmentStats');
            const result = await getSegmentStatsFunc({ segmentType });
            setSegmentStats(prev => ({ ...prev, [campaignId]: result.data }));
        } catch (error) {
            console.error('Error fetching segment stats:', error);
            alert('Failed to fetch audience stats');
        } finally {
            setLoadingStats(prev => ({ ...prev, [campaignId]: false }));
        }
    };

    const loadCampaignAnalytics = async () => {
        try {
            // Fetch all users to calculate segment distribution
            const { collection, getDocs } = await import('firebase/firestore');
            const { db } = await import('../../firebaseConfig');

            const usersSnap = await getDocs(collection(db, 'users'));
            const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Calculate segment distribution
            const segments = ['power_users', 'at_risk_pros', 'returning_inactive_users', 'new_users'];
            const segmentCounts: Record<string, number> = {};

            users.forEach((user: any) => {
                const score = user.engagementScore || 0;
                const plan = user.plan || 'free';
                const accountAge = Date.now() - (user.createdAt || Date.now());
                const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

                if (score >= 70 && plan !== 'free') {
                    segmentCounts['power_users'] = (segmentCounts['power_users'] || 0) + 1;
                } else if (plan !== 'free' && score < 40) {
                    segmentCounts['at_risk_pros'] = (segmentCounts['at_risk_pros'] || 0) + 1;
                } else if (daysSinceCreation <= 7 && (user.projectCount || 0) === 0) {
                    segmentCounts['new_users'] = (segmentCounts['new_users'] || 0) + 1;
                } else {
                    const lastLogin = user.lastLogin || 0;
                    const previousLogin = user.previousLogin || 0;
                    const recentlyActive = Date.now() - lastLogin < 24 * 60 * 60 * 1000;
                    const wasInactive = lastLogin - previousLogin > 30 * 24 * 60 * 60 * 1000;
                    if (recentlyActive && wasInactive) {
                        segmentCounts['returning_inactive_users'] = (segmentCounts['returning_inactive_users'] || 0) + 1;
                    }
                }
            });

            const totalUsers = users.length;
            const segmentDistribution = segments.map(segment => ({
                segment,
                count: segmentCounts[segment] || 0,
                percentage: totalUsers > 0 ? Math.round(((segmentCounts[segment] || 0) / totalUsers) * 100) : 0
            }));

            // Fetch campaign attribution data
            const attributionsSnap = await getDocs(collection(db, 'campaign_attribution'));
            const attributions = attributionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Calculate campaign performance
            const campaignPerformance = campaigns.map(campaign => {
                const campaignAttributions = attributions.filter((a: any) => a.campaignId === campaign.id);
                const shown = campaignAttributions.length;
                const dismissed = campaignAttributions.filter((a: any) => a.status === 'dismissed').length;
                const answered = campaignAttributions.filter((a: any) => a.status === 'answered').length;

                return {
                    campaignId: campaign.id,
                    name: campaign.title || 'Untitled',
                    shown,
                    dismissed,
                    answered,
                    dismissRate: shown > 0 ? Math.round((dismissed / shown) * 100) : 0,
                    answerRate: shown > 0 ? Math.round((answered / shown) * 100) : 0
                };
            });

            setAnalyticsData({
                segmentDistribution,
                campaignPerformance
            });
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <BarChart3 className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-slate-900">Campaign Manager</h1>
                                    <p className="text-xs text-slate-500">Feedback & Engagement Campaigns</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowAnalytics(!showAnalytics);
                                    if (!showAnalytics && !analyticsData) {
                                        loadCampaignAnalytics();
                                    }
                                }}
                                icon={<BarChart3 className="w-4 h-4" />}
                            >
                                {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
                            </Button>
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                icon={<Plus className="w-4 h-4" />}
                            >
                                New Campaign
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Analytics Section */}
                {showAnalytics && analyticsData && (
                    <div className="mb-8 space-y-6">
                        {/* Segment Distribution */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900">User Segment Distribution</h3>
                                <p className="text-sm text-slate-500 mt-1">Current breakdown of users by engagement segment</p>
                            </div>

                            {/* Segment Definitions Info Box */}
                            <div className="bg-blue-50 border-b border-blue-100 p-4">
                                <details className="group">
                                    <summary className="cursor-pointer text-sm font-medium text-blue-900 flex items-center gap-2">
                                        <span>ℹ️ Segment Definitions & Triggers</span>
                                        <span className="text-xs text-blue-600 group-open:hidden">(click to expand)</span>
                                    </summary>
                                    <div className="mt-4 space-y-3 text-sm text-blue-900">
                                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                                            <div className="font-semibold text-blue-900 mb-1">🚀 Power Users</div>
                                            <div className="text-blue-800 text-xs">
                                                <strong>Criteria:</strong> Engagement Score ≥ 70 AND Paid Plan (Pro/Business)<br />
                                                <strong>Trigger:</strong> High engagement + active subscription<br />
                                                <strong>Campaign Goal:</strong> Retention, upsell features, gather feedback
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                                            <div className="font-semibold text-amber-900 mb-1">⚠️ At-Risk Pros</div>
                                            <div className="text-amber-800 text-xs">
                                                <strong>Criteria:</strong> Paid Plan AND (Inactive &gt; 30 days OR Engagement Score &lt; 40)<br />
                                                <strong>Trigger:</strong> Paying customer showing low engagement<br />
                                                <strong>Campaign Goal:</strong> Re-engagement, support offers, prevent churn
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                                            <div className="font-semibold text-green-900 mb-1">👋 Returning Inactive Users</div>
                                            <div className="text-green-800 text-xs">
                                                <strong>Criteria:</strong> Recently Active (&lt; 1 day) AND Previous Login &gt; 30 days ago<br />
                                                <strong>Trigger:</strong> User returns after long absence<br />
                                                <strong>Campaign Goal:</strong> Welcome back, show what's new, re-onboard
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                                            <div className="font-semibold text-purple-900 mb-1">🆕 New Users</div>
                                            <div className="text-purple-800 text-xs">
                                                <strong>Criteria:</strong> Account Age ≤ 7 days AND No Projects Created<br />
                                                <strong>Trigger:</strong> Fresh signup, hasn't started using platform<br />
                                                <strong>Campaign Goal:</strong> Onboarding, first project creation, activation
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-3">
                                            <div className="font-semibold text-slate-700 mb-2 text-xs">📋 Cooldown Rules</div>
                                            <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                                                <li><strong>Frequency Cap:</strong> Same campaign shown max once per 7 days</li>
                                                <li><strong>Dismissal Cooldown:</strong> If dismissed, wait 14 days before reshowing</li>
                                                <li><strong>Global Cooldown:</strong> Minimum 1 day between ANY campaigns</li>
                                            </ul>
                                        </div>
                                    </div>
                                </details>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-3 text-left">Segment</th>
                                            <th className="px-6 py-3 text-right">User Count</th>
                                            <th className="px-6 py-3 text-right">Percentage</th>
                                            <th className="px-6 py-3 text-left">Visual</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {analyticsData.segmentDistribution.map(seg => (
                                            <tr key={seg.segment} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    {seg.segment.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-600">{seg.count}</td>
                                                <td className="px-6 py-4 text-right text-slate-600">{seg.percentage}%</td>
                                                <td className="px-6 py-4">
                                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                                        <div
                                                            className="bg-indigo-600 h-2 rounded-full"
                                                            style={{ width: `${seg.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Campaign Performance */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900">Campaign Performance</h3>
                                <p className="text-sm text-slate-500 mt-1">Show, dismiss, and answer rates for each campaign</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-3 text-left">Campaign</th>
                                            <th className="px-6 py-3 text-right">Shown</th>
                                            <th className="px-6 py-3 text-right">Dismissed</th>
                                            <th className="px-6 py-3 text-right">Answered</th>
                                            <th className="px-6 py-3 text-right">Dismiss Rate</th>
                                            <th className="px-6 py-3 text-right">Answer Rate</th>
                                            <th className="px-6 py-3 text-center">Health</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {analyticsData.campaignPerformance.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                                    No campaign data yet. Campaigns will show stats once users interact with them.
                                                </td>
                                            </tr>
                                        ) : (
                                            analyticsData.campaignPerformance.map(perf => (
                                                <tr key={perf.campaignId} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{perf.name}</td>
                                                    <td className="px-6 py-4 text-right text-slate-600">{perf.shown}</td>
                                                    <td className="px-6 py-4 text-right text-red-600">{perf.dismissed}</td>
                                                    <td className="px-6 py-4 text-right text-green-600">{perf.answered}</td>
                                                    <td className="px-6 py-4 text-right text-slate-600">{perf.dismissRate}%</td>
                                                    <td className="px-6 py-4 text-right text-slate-600">{perf.answerRate}%</td>
                                                    <td className="px-6 py-4 text-center">
                                                        {perf.shown === 0 ? (
                                                            <span className="text-slate-400 text-xs">No data</span>
                                                        ) : perf.dismissRate > 60 ? (
                                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                                                ⚠ High Dismiss
                                                            </span>
                                                        ) : perf.answerRate >= 50 ? (
                                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                                ✓ Healthy
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                                                ⚠ Monitor
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 mb-6">
                        <div className="flex-1">
                            <p className="font-medium">Failed to load campaigns</p>
                            <p className="text-sm">{error}</p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={fetchCampaigns}>Retry</Button>
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="text-center py-12">
                        <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No campaigns yet</h3>
                        <p className="text-slate-600 mb-6">Create your first feedback campaign to start collecting insights</p>
                        <Button onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
                            Create Campaign
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {campaigns.map((campaign) => (
                            <div key={campaign.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold text-slate-900">{campaign.name}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                                        campaign.status === 'completed' ? 'bg-slate-100 text-slate-800' :
                                                            'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {campaign.status}
                                                </span>
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium capitalize">
                                                    {campaign.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-3">{campaign.question}</p>
                                            <div className="flex gap-4 text-xs text-slate-500">
                                                <span>Segment: <strong className="text-slate-700">{campaign.segmentType}</strong></span>
                                                <span>Frequency: <strong className="text-slate-700">{campaign.frequencyCapDays}d</strong></span>
                                                <span>Email Follow-up: <strong className="text-slate-700">{campaign.emailFollowUpHours}h</strong></span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                                            >
                                                {campaign.status === 'active' ? (
                                                    <Pause className="w-4 h-4" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Analytics */}
                                    {campaign.analytics && (
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-100">
                                            <div>
                                                <div className="text-2xl font-bold text-slate-900">{campaign.analytics.impressions}</div>
                                                <div className="text-xs text-slate-500">Impressions</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-slate-900">{campaign.analytics.responses}</div>
                                                <div className="text-xs text-slate-500">Responses</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-green-600">{campaign.analytics.responseRate}%</div>
                                                <div className="text-xs text-slate-500">Response Rate</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-slate-900">{campaign.analytics.emailsSent}</div>
                                                <div className="text-xs text-slate-500">Emails Sent</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-purple-600">${campaign.analytics.totalAttributedValue}</div>
                                                <div className="text-xs text-slate-500">Attributed Value</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Targeting Info */}
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-slate-700">Target Audience</h4>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCheckAudience(campaign.id, campaign.segmentType)}
                                                disabled={loadingStats[campaign.id]}
                                            >
                                                {loadingStats[campaign.id] ? (
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-600"></div>
                                                ) : (
                                                    <span className="text-xs text-indigo-600">Check Audience Size</span>
                                                )}
                                            </Button>
                                        </div>

                                        {segmentStats[campaign.id] && (
                                            <div className="mt-2 bg-slate-50 rounded-lg p-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm text-slate-600">Total Users:</span>
                                                    <span className="text-sm font-bold text-slate-900">{segmentStats[campaign.id].totalCount}</span>
                                                </div>
                                                {segmentStats[campaign.id].sampleUsers.length > 0 && (
                                                    <div>
                                                        <p className="text-xs text-slate-500 mb-1">Sample Users:</p>
                                                        <ul className="space-y-1">
                                                            {segmentStats[campaign.id].sampleUsers.map((u: any) => (
                                                                <li key={u.id} className="text-xs text-slate-700 flex justify-between">
                                                                    <span>{u.name || u.email}</span>
                                                                    <span className="text-slate-400">{u.plan}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* A/B Variants */}
                                    {campaign.variants && campaign.variants.length > 0 && campaign.analytics?.variantPerformance && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-3">A/B Test Performance</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {campaign.analytics.variantPerformance.map((variant: any) => (
                                                    <div key={variant.variantId} className="bg-slate-50 rounded-lg p-3">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="text-sm font-medium text-slate-700">Variant {variant.variantId}</span>
                                                            <span className="text-sm font-bold text-green-600">{variant.responseRate.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="flex gap-4 text-xs text-slate-600">
                                                            <span>{variant.impressions} views</span>
                                                            <span>{variant.responses} responses</span>
                                                            <span>${variant.averageValue.toFixed(2)} avg</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Campaign Modal - Placeholder for now */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Campaign</h2>
                        <p className="text-slate-600 mb-6">
                            Campaign creation UI coming soon. For now, use Firestore Console to create campaigns manually.
                        </p>
                        <div className="flex justify-end">
                            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
