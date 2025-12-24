import React, { useState, useEffect, useMemo } from 'react';
import {
    MessageSquare,
    BarChart3,
    Settings,
    Users,
    Plus,
    Trash2,
    X,
    Play,
    Pause,
    MoreHorizontal,
    Edit,
    Save,
    Search,
    ArrowUp,
    ArrowDown,
    Zap
} from 'lucide-react';
import { Button } from '../ui/Button';
import { FeedbackCampaign, CampaignAnalytics } from '../../types/campaign';
import { functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

interface CampaignManagerProps {
    onBack: () => void;
}

const getSegmentLabel = (campaign: any): string => {
    // Prefer explicit fields from the document
    const explicit = campaign.segmentType || campaign?.segmentQuery?.value || campaign?.segment || campaign?.segmentName;
    if (explicit) return explicit;

    // Known campaign fallbacks by name/question so legacy docs still show meaningful segment
    const name = (campaign.name || campaign.title || campaign.question || '').toLowerCase();
    if (name.includes('giving up almost')) return 'giving_up_almost';

    return '—';
};

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
    const [segmentLoading, setSegmentLoading] = useState<Record<string, boolean>>({});
    const [segmentUsers, setSegmentUsers] = useState<Record<string, { total: number; users: Array<{ id: string; name?: string; email?: string; plan?: string }> }>>({});

    const loadCampaignAnalytics = async () => {
        try {
            // Fetch all users to calculate segment distribution
            const { collection, getDocs } = await import('firebase/firestore');
            const { db } = await import('../../firebaseConfig');

            const usersSnap = await getDocs(collection(db, 'users'));
            const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Calculate segment distribution
            const segments = ['giving_up_almost', 'power_users', 'at_risk_pros', 'returning_inactive_users', 'new_users'];
            const segmentCounts: Record<string, number> = {};

            users.forEach((user: any) => {
                const score = user.engagementScore || 0;
                const plan = user.plan || 'free';
                const accountAge = Date.now() - (user.createdAt || Date.now());
                const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
                const loginCount = user.loginCount || 0;
                const lastLogin = user.lastLogin || 0;
                const lastSessionDuration = user.lastSessionDuration || 0;
                const totalActions = (user.projectCount || 0) + (user.commentCount || 0) + (user.shareCountGuest || 0) + (user.shareCountPro || 0);
                const slowReturn = lastLogin > 0 ? (Date.now() - lastLogin) > 2 * 24 * 60 * 60 * 1000 : false;
                const shortSession = lastSessionDuration > 0 ? lastSessionDuration < 3 * 60 * 1000 : false;

                if (
                    plan === 'free' &&
                    loginCount >= 2 &&
                    daysSinceCreation <= 30 &&
                    (slowReturn || shortSession) &&
                    totalActions >= 2
                ) {
                    segmentCounts['giving_up_almost'] = (segmentCounts['giving_up_almost'] || 0) + 1;
                } else if (score >= 70 && plan !== 'free') {
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
                    name: campaign.name || campaign.title || campaign.question || 'Untitled',
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

    const fetchSegmentUsers = async (segment: string) => {
        setSegmentLoading(prev => ({ ...prev, [segment]: true }));
        try {
            const getSegmentStats = httpsCallable(functions, 'getSegmentStats');
            const res = await getSegmentStats({ segmentType: segment, limit: 50 });
            const data = res.data as any;
            setSegmentUsers(prev => ({
                ...prev,
                [segment]: {
                    total: data?.totalCount || 0,
                    users: data?.sampleUsers || []
                }
            }));
        } catch (err) {
            console.error('Error fetching segment users', err);
            setSegmentUsers(prev => ({ ...prev, [segment]: { total: 0, users: [] } }));
        } finally {
            setSegmentLoading(prev => ({ ...prev, [segment]: false }));
        }
    };

    // ... earlier code ...

    const [viewAnswersId, setViewAnswersId] = useState<string | null>(null);
    const [answers, setAnswers] = useState<any[]>([]);
    const [answersLoading, setAnswersLoading] = useState(false);

    // Sort & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

    const handleViewResponses = async (campaignId: string) => {
        setViewAnswersId(campaignId);
        setAnswersLoading(true);
        setAnswers([]);
        setSearchTerm('');
        setSortConfig({ key: 'timestamp', direction: 'desc' });

        try {
            const { getFeedbackAnswers } = await import('../../services/feedbackService');
            const data = await getFeedbackAnswers(campaignId);
            setAnswers(data.answers || []);
        } catch (error) {
            console.error('Failed to load answers', error);
            alert('Failed to load answers');
        } finally {
            setAnswersLoading(false);
        }
    };

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const filteredAnswers = useMemo(() => {
        let result = [...answers];

        // Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(a => {
                const name = a.user?.name?.toLowerCase() || '';
                const email = a.user?.email?.toLowerCase() || '';
                const answerText = typeof a.answer === 'string' ? a.answer.toLowerCase() : JSON.stringify(a.answer).toLowerCase();
                return name.includes(lowerTerm) || email.includes(lowerTerm) || answerText.includes(lowerTerm);
            });
        }

        // Sort
        result.sort((a, b) => {
            let valA, valB;

            switch (sortConfig.key) {
                case 'user':
                    valA = a.user?.name || 'Anonymous';
                    valB = b.user?.name || 'Anonymous';
                    break;
                case 'answer':
                    valA = typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer);
                    valB = typeof b.answer === 'string' ? b.answer : JSON.stringify(b.answer);
                    break;
                case 'timestamp':
                default:
                    valA = a.timestamp || 0;
                    valB = b.timestamp || 0;
                    break;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [answers, searchTerm, sortConfig]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ... Header ... */}

            {/* ... Main Content ... */}
            <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* ... Analytics ... */}

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : error ? (
                    // ... error state ...
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 mb-6">
                        <div className="flex-1">
                            <p className="font-medium">Failed to load campaigns</p>
                            <p className="text-sm">{error}</p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={fetchCampaigns}>Retry</Button>
                    </div>
                ) : campaigns.length === 0 ? (
                    // ... empty state ...
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
                                            {/* ... Campaign info ... */}
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold text-slate-900">{campaign.name || campaign.title || campaign.question || 'Untitled'}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${campaign.status === 'active' ? 'bg-green-100 text-green-800' : campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' : campaign.status === 'completed' ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-600'} `}>
                                                    {campaign.status}
                                                </span>
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium capitalize">
                                                    {campaign.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-3">{campaign.question}</p>
                                            <div className="flex gap-4 text-xs text-slate-500">
                                                <span>Segment: <strong className="text-slate-700">{getSegmentLabel(campaign)}</strong></span>
                                                <span>Frequency: <strong className="text-slate-700">{campaign.frequencyCapDays ?? '—'}d</strong></span>
                                                <span>Email Follow-up: <strong className="text-slate-700">{(campaign as any).emailFollowUpHours ?? (campaign as any).emailFallbackAfterHours ?? '—'}h</strong></span>
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
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                icon={<Users className="w-4 h-4" />}
                                                onClick={() => handleViewResponses(campaign.id)}
                                            >
                                                Responses
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                                title="Test Trigger (Bypass Locks)"
                                                icon={<Zap className="w-3 h-3" />}
                                                onClick={() => {
                                                    const url = new URL(window.location.href);
                                                    url.searchParams.set('DEBUG_ENGAGEMENT', '1');
                                                    url.searchParams.set('FORCE_CAMPAIGN_ID', campaign.id);
                                                    window.open(url.toString(), '_blank');
                                                }}
                                            >
                                                Test
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Analytics */}
                                    {campaign.analytics && (
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-100">
                                            <div>
                                                <div className="text-2xl font-bold text-slate-900">{campaign.analytics.impressions || 0}</div>
                                                <div className="text-xs text-slate-500">Impressions</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-slate-900">{campaign.analytics.responses || 0}</div>
                                                <div className="text-xs text-slate-500">Responses</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-green-600">{campaign.analytics.responseRate || 0}%</div>
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

            {/* Create Campaign Modal */}
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

            {/* View Responses Modal */}
            {viewAnswersId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Campaign Responses</h2>
                                <p className="text-sm text-slate-500">
                                    {answersLoading ? 'Loading responses...' : `${filteredAnswers.length} response(s) found`}
                                </p>
                            </div>

                            {/* Search Input */}
                            <div className="flex-1 max-w-md">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search user, email, or answer..."
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button variant="ghost" size="sm" onClick={() => setViewAnswersId(null)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {answersLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : filteredAnswers.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    {searchTerm ? 'No matches found.' : 'No responses recorded for this campaign yet.'}
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th
                                                className="px-4 py-3 rounded-tl-lg cursor-pointer hover:bg-slate-100 transition-colors group"
                                                onClick={() => handleSort('user')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    User
                                                    {sortConfig.key === 'user' && (
                                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group"
                                                onClick={() => handleSort('answer')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Answer
                                                    {sortConfig.key === 'answer' && (
                                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-4 py-3">Context</th>
                                            <th
                                                className="px-4 py-3 rounded-tr-lg text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                                                onClick={() => handleSort('timestamp')}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Time
                                                    {sortConfig.key === 'timestamp' && (
                                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredAnswers.map((ans) => (
                                            <tr key={ans.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    {ans.user ? (
                                                        <div>
                                                            <div className="font-medium text-slate-900">{ans.user.name}</div>
                                                            <div className="text-xs text-slate-500">{ans.user.email}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Anonymous</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-800">
                                                    {typeof ans.answer === 'object' ? JSON.stringify(ans.answer) : String(ans.answer)}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500">
                                                    {ans.segmentData ? (
                                                        <div className="space-y-0.5">
                                                            <div>Score: {ans.segmentData.engagementScore ?? '—'}</div>
                                                            <div>Plan: {ans.segmentData.plan ?? '—'}</div>
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                                                    {ans.timestamp ? new Date(ans.timestamp).toLocaleString() : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                            <Button variant="secondary" onClick={() => setViewAnswersId(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
