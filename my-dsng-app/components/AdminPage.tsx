import React, { useState, useEffect, Suspense } from 'react';
import { User, UserRole } from '../types';
import { getAllUsers, updateAdminStatus } from '../services/storageService';
import { fetchUserPaymentHistory, PaymentRecord } from '../services/paymentService';
import { useAdmin } from '../contexts/AdminContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Shield, Search, Trash2, ArrowLeft, BarChart3, Users, Eye, UserPlus, Check, AlertCircle, Calendar, CreditCard, Receipt, Gift, Megaphone, RefreshCw, Activity, Zap } from 'lucide-react';
import { FeatureVoteAnalytics } from './FeatureVoteAnalytics';
import { ReferralManagement } from './ReferralManagement';
import { getUserActivity, ActivityLog } from '../services/analyticsService';
import { EngagementDashboard } from './EngagementDashboard';
import { CampaignManager } from './admin/CampaignManager';
import { CampaignDocumentation } from './admin/CampaignDocumentation';
import { PlanLimitsEditor } from './admin/PlanLimitsEditor';
import { getAnalyticsStats } from '../services/analyticsAggregationService';
import { getAdminReferralData } from '../services/referralService';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../firebaseConfig';

const ReferralDashboardLazy = React.lazy(() => import('./ReferralDashboard').then(module => ({ default: module.ReferralDashboard })));

const formatEventName = (name: string) => {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const REBUILD_ANALYTICS_ENDPOINT = `${import.meta.env.VITE_FUNCTIONS_BASE_URL || 'https://us-central1-dsng-app.cloudfunctions.net'}/rebuildAnalyticsDailyHttp`;

type AdminTab = 'users' | 'engagement' | 'referrals' | 'plan-limits';

interface AdminPageProps {
    onBack: () => void;
    currentUser: User;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBack, currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminEmail, setAdminEmail] = useState('');
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [filterPlan, setFilterPlan] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [minLogins, setMinLogins] = useState<string>('');
    const [minProjects, setMinProjects] = useState<string>('');
    const [minEngagement, setMinEngagement] = useState<string>('');
    const [activeTab, setActiveTab] = useState<AdminTab>('users');

    const { impersonatedRole, setImpersonatedRole } = useAdmin();
    const [error, setError] = useState<string | null>(null);

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' } | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Payment History State
    const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
    const [isPaymentHistoryLoading, setIsPaymentHistoryLoading] = useState(false);
    const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
    const [paymentHistoryUser, setPaymentHistoryUser] = useState<User | null>(null);
    const [showReferralManagement, setShowReferralManagement] = useState(false);
    const [showCampaignManager, setShowCampaignManager] = useState(false);

    // Activity Logs State
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // Engagement Dashboard State
    const [showEngagementDashboard, setShowEngagementDashboard] = useState(false);
    const [engagementLoading, setEngagementLoading] = useState(false);
    const [engagementKpis, setEngagementKpis] = useState<{ mau: number; dau: number; stickiness: number; liveness: number; spark: { date: string; dau: number; }[] } | null>(null);
    const [recalcEngagementLoading, setRecalcEngagementLoading] = useState(false);
    const [rebuildDailyLoading, setRebuildDailyLoading] = useState(false);
    const [engagementMessage, setEngagementMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [campaignsSummary, setCampaignsSummary] = useState<{ id: string; name: string; responses: number; impressions: number; }[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);

    // Referral summary
    const [referralLoading, setReferralLoading] = useState(false);
    const [referralSummary, setReferralSummary] = useState<{
        totalTokens: number;
        redeemedTokens: number;
        pendingReferrals: number;
        totalReferrals: number;
        recentTransactions: Array<{ id: string; description: string; amount: number; type: string; timestamp: number; }>;
    } | null>(null);

    const tabs: { id: AdminTab; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { id: 'users', label: 'Users', description: 'Directory & permissions', icon: Users },
        { id: 'engagement', label: 'Engagement & Campaigns', description: 'Analytics and outreach', icon: BarChart3 },
        { id: 'referrals', label: 'Referrals', description: 'Rewards & token settings', icon: Gift },
        { id: 'plan-limits', label: 'Plan Limits', description: 'Subscription caps & quotas', icon: Shield },
    ];

    useEffect(() => {
        if (selectedUser) {
            fetchUserActivity(selectedUser.id);
        } else {
            setActivityLogs([]);
        }
    }, [selectedUser]);

    const fetchUserActivity = async (userId: string) => {
        setLoadingActivity(true);
        try {
            const logs = await getUserActivity(userId);
            setActivityLogs(logs);
        } catch (error) {
            console.error("Failed to fetch activity logs:", error);
        } finally {
            setLoadingActivity(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!currentUser?.isAdmin) return;
        if (activeTab === 'engagement') {
            loadEngagementKpis();
            loadCampaignSummary();
        } else if (activeTab === 'referrals') {
            loadReferralSummary();
        }
    }, [activeTab, currentUser]);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const allUsers = await getAllUsers();
            if (allUsers.length === 0) {
                setError("No users found. Ensure you have admin permissions.");
            }
            setUsers(allUsers);
        } catch (e) {
            console.error("Failed to fetch users:", e);
            setError("Failed to load users. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminEmail) return;

        const success = await updateAdminStatus(adminEmail, true);
        if (success) {
            setMessage({ text: `${adminEmail} is now an admin`, type: 'success' });
            setAdminEmail('');
            fetchUsers();
        } else {
            setMessage({ text: `Failed to make ${adminEmail} an admin. User may not exist.`, type: 'error' });
        }
    };

    const handleRemoveAdmin = async (email: string) => {
        if (confirm(`Remove admin privileges from ${email}?`)) {
            const success = await updateAdminStatus(email, false);
            if (success) {
                setMessage({ text: `${email} is no longer an admin`, type: 'success' });
                fetchUsers();
            } else {
                setMessage({ text: 'Failed to remove admin privileges', type: 'error' });
            }
        }
    };

    const handleViewPaymentHistory = async (user: User) => {
        setPaymentHistoryUser(user);
        setShowPaymentHistoryModal(true);
        setIsPaymentHistoryLoading(true);
        setPaymentHistory([]); // Clear previous history
        try {
            const history = await fetchUserPaymentHistory(user.id);
            setPaymentHistory(history);
        } catch (error) {
            console.error("Failed to fetch payment history", error);
        } finally {
            setIsPaymentHistoryLoading(false);
        }
    };

    const stats = {
        total: users.length,
        pro: users.filter(u => u.plan === 'pro' || u.plan === 'business').length,
        admins: users.filter(u => u.isAdmin).length,
        designers: users.filter(u => u.role === UserRole.DESIGNER).length,
        homeowners: users.filter(u => u.role === UserRole.HOMEOWNER).length,
        activeThisMonth: users.filter(u => {
            // Mock engagement metric - in real app would use lastLoginAt
            return true;
        }).length
    };

    const conversionRate = stats.total > 0 ? ((stats.pro / stats.total) * 100).toFixed(1) : '0.0';

    const loadEngagementKpis = async () => {
        setEngagementLoading(true);
        setEngagementMessage(null);
        try {
            const data = await getAnalyticsStats(28);
            if (!data || data.length === 0) {
                setEngagementKpis(null);
                return;
            }
            const ordered = [...data].sort((a, b) => a.timestamp - b.timestamp);
            const latest = ordered[ordered.length - 1];
            const mau = latest.mau || 0;
            const dau = latest.dau || latest.engagement_actions?.login || 0;
            const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;
            const liveness = Math.min(100, Math.round(((latest.new_projects || 0) + (latest.new_comments || 0) + (latest.new_invites || 0)) * 1.5));
            const spark = ordered.slice(-14).map(s => ({
                date: s.date.slice(5),
                dau: s.dau ?? s.engagement_actions?.login ?? 0
            }));
            setEngagementKpis({ mau, dau, stickiness, liveness, spark });
        } catch (err) {
            console.error('Failed to load engagement KPIs', err);
            setEngagementKpis(null);
        } finally {
            setEngagementLoading(false);
        }
    };

    const handleRecalculateEngagement = async () => {
        setRecalcEngagementLoading(true);
        setEngagementMessage(null);
        try {
            console.log('[Admin] Recalculate engagement triggered');
            const callable = httpsCallable(functions, 'recalculateAllEngagementScores');
            const result = await callable({});
            const updated = (result?.data as any)?.usersUpdated;
            console.log('[Admin] Engagement recalculation result:', result?.data);
            setEngagementMessage({
                text: updated ? `Recalculated engagement for ${updated} users.` : 'Engagement scores recalculated.',
                type: 'success'
            });
            await fetchUsers();
            await loadEngagementKpis();
        } catch (error: any) {
            console.error('Failed to recalculate engagement scores', error);
            setEngagementMessage({
                text: error?.message || 'Failed to recalculate engagement scores.',
                type: 'error'
            });
        } finally {
            setRecalcEngagementLoading(false);
        }
    };

    const handleRebuildDailyAnalytics = async () => {
        setRebuildDailyLoading(true);
        setEngagementMessage(null);
        try {
            console.log('[Admin] Rebuild daily analytics triggered');
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                throw new Error('You need to be signed in to rebuild analytics.');
            }

            const response = await fetch(REBUILD_ANALYTICS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ days: 90 })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'Failed to rebuild daily analytics.');
            }

            const days = payload?.daysComputed;
            console.log('[Admin] Rebuild daily analytics result:', payload);
            setEngagementMessage({
                text: days
                    ? `Rebuilt ${days} days of daily analytics.`
                    : 'Daily analytics rebuilt (no days reported). Check logs to verify writes.',
                type: 'success'
            });
            await loadEngagementKpis();
        } catch (error: any) {
            console.error('Failed to rebuild daily analytics', error);
            setEngagementMessage({
                text: error?.message || 'Failed to rebuild daily analytics.',
                type: 'error'
            });
        } finally {
            setRebuildDailyLoading(false);
        }
    };

    const loadCampaignSummary = async () => {
        setLoadingCampaigns(true);
        try {
            const listCampaigns = httpsCallable(functions, 'listCampaigns');
            const res = await listCampaigns({});
            const data = res.data as any;
            const items = (data?.campaigns || []).map((c: any) => ({
                id: c.id,
                name: c.name || 'Untitled',
                responses: c.analytics?.responses || 0,
                impressions: c.analytics?.impressions || 0
            }));
            setCampaignsSummary(items.slice(0, 5));
        } catch (err) {
            console.error('Failed to load campaigns summary', err);
            setCampaignsSummary([]);
        } finally {
            setLoadingCampaigns(false);
        }
    };

    const loadReferralSummary = async () => {
        setReferralLoading(true);
        try {
            const data = await getAdminReferralData();
            const referrals = data?.referrals || [];
            const transactions = data?.transactions || [];

            const totalTokens = transactions
                .filter((t: any) => t.type === 'earned')
                .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

            const redeemedTokens = transactions
                .filter((t: any) => t.type === 'redeemed')
                .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

            const pendingReferrals = referrals.filter((r: any) => r.status === 'pending').length;
            const totalReferrals = referrals.length;

            const recentTransactions = transactions.slice(0, 5).map((t: any) => ({
                id: t.id,
                description: t.description,
                amount: t.amount,
                type: t.type,
                timestamp: t.timestamp
            }));

            setReferralSummary({
                totalTokens,
                redeemedTokens,
                pendingReferrals,
                totalReferrals,
                recentTransactions
            });
        } catch (err) {
            console.error('Failed to load referral summary', err);
            setReferralSummary(null);
        } finally {
            setReferralLoading(false);
        }
    };

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = filterRole === 'all' ||
            (filterRole === 'admin' && user.isAdmin) ||
            (filterRole === 'pro' && (user.plan === 'pro' || user.plan === 'business')) ||
            (filterRole === 'guest' && (!user.plan || user.plan === 'free'));

        const matchesPlan = filterPlan === 'all' || (user.plan || 'free') === filterPlan;
        const matchesStatus = filterStatus === 'all' || (user.subscriptionStatus || 'none') === filterStatus;
        const meetsLogins = minLogins ? (user.loginCount || 0) >= Number(minLogins) : true;
        const meetsProjects = minProjects ? (user.projectCount || 0) >= Number(minProjects) : true;
        const meetsEngagement = minEngagement ? (user.engagementScore || 0) >= Number(minEngagement) : true;

        return matchesSearch && matchesRole && matchesPlan && matchesStatus && meetsLogins && meetsProjects && meetsEngagement;
    });

    const handleSort = (key: keyof User) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = [...filteredUsers].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        // Handle undefined values
        const valA = a[key] ?? 0; // Default to 0 for numbers
        const valB = b[key] ?? 0;

        if (valA < valB) {
            return direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Calculate growth (mock data for visualization structure)
    const growthData = [
        { month: 'Jan', users: Math.floor(stats.total * 0.2) },
        { month: 'Feb', users: Math.floor(stats.total * 0.35) },
        { month: 'Mar', users: Math.floor(stats.total * 0.5) },
        { month: 'Apr', users: Math.floor(stats.total * 0.7) },
        { month: 'May', users: stats.total },
    ];
    const maxSparkDau = engagementKpis?.spark?.length ? Math.max(...engagementKpis.spark.map(s => s.dau || 1)) : 1;

    return (
        !currentUser.isAdmin ? (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 max-w-md w-full text-center space-y-3">
                    <div className="mx-auto w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">!</div>
                    <h2 className="text-lg font-bold text-slate-900">Admin access required</h2>
                    <p className="text-sm text-slate-600">You need admin permissions to view this area.</p>
                    <Button variant="secondary" onClick={onBack}>Go back</Button>
                </div>
            </div>
        ) : (
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
                                    <div className="p-2 bg-indigo-100 rounded-lg">
                                        <Shield className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold text-slate-900">System Administration</h1>
                                        <p className="text-xs text-slate-500">Overview and User Management</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setActiveTab('engagement')}
                                    icon={<BarChart3 className="w-4 h-4" />}
                                >
                                    Engagement
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setActiveTab('referrals')}
                                    icon={<Gift className="w-4 h-4" />}
                                >
                                    Referral Program
                                </Button>
                                <div className="text-sm text-slate-600">
                                    Logged in as <span className="font-semibold">{currentUser.name}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-start gap-3 rounded-lg px-4 py-3 border transition ${isActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'border-transparent hover:bg-slate-50 text-slate-600'
                                            }`}
                                    >
                                        <div className={`${isActive ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-500'} p-2 rounded-lg`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-semibold">{tab.label}</div>
                                            <div className="text-xs text-slate-500">{tab.description}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                    {activeTab === 'users' && (
                        <>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    {error}
                                </div>
                            )}

                            {/* Top Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Users</h3>
                                        <Users className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
                                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                        <ArrowLeft className="w-3 h-3 rotate-90" /> +12% this month
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Subscribers</h3>
                                        <Shield className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-slate-900">{stats.pro}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {conversionRate}% conversion rate
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Admins</h3>
                                        <Shield className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-slate-900">{stats.admins}</div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Engagement</h3>
                                        <BarChart3 className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-slate-900">High</div>
                                    <div className="text-xs text-slate-500 mt-1">Based on recent activity</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                                {/* Left Column: User Management */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <h3 className="text-lg font-bold text-slate-900">User Directory</h3>

                                            <div className="flex flex-col gap-3 w-full">
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <div className="relative flex-1 sm:flex-initial">
                                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search users..."
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                                                        />
                                                    </div>
                                                    <select
                                                        value={filterRole}
                                                        onChange={(e) => setFilterRole(e.target.value)}
                                                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    >
                                                        <option value="all">All Roles</option>
                                                        <option value="admin">Admins</option>
                                                        <option value="pro">Pros</option>
                                                        <option value="guest">Guests</option>
                                                    </select>
                                                    <select
                                                        value={filterPlan}
                                                        onChange={(e) => setFilterPlan(e.target.value)}
                                                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    >
                                                        <option value="all">All Plans</option>
                                                        <option value="free">Free</option>
                                                        <option value="pro">Pro</option>
                                                        <option value="business">Business</option>
                                                    </select>
                                                    <select
                                                        value={filterStatus}
                                                        onChange={(e) => setFilterStatus(e.target.value)}
                                                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    >
                                                        <option value="all">All Status</option>
                                                        <option value="active">Active</option>
                                                        <option value="past_due">Past Due</option>
                                                        <option value="canceled">Canceled</option>
                                                        <option value="trialing">Trialing</option>
                                                        <option value="none">None</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={minLogins}
                                                        onChange={(e) => setMinLogins(e.target.value)}
                                                        placeholder="Min logins"
                                                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    />
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={minProjects}
                                                        onChange={(e) => setMinProjects(e.target.value)}
                                                        placeholder="Min projects"
                                                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    />
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={minEngagement}
                                                        onChange={(e) => setMinEngagement(e.target.value)}
                                                        placeholder="Min engagement"
                                                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                                    <tr>
                                                        <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('name')}>User</th>
                                                        <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('role')}>Role</th>
                                                        <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('plan')}>Plan</th>
                                                        <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('subscriptionStatus')}>Status</th>
                                                        <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('loginCount')}>Logins</th>
                                                        <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('projectCount')}>Projects</th>
                                                        <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('engagementScore' as keyof User)}>Engagement</th>
                                                        <th className="px-6 py-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {loading ? (
                                                        <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading users...</td></tr>
                                                    ) : sortedUsers.length === 0 ? (
                                                        <tr><td colSpan={8} className="p-8 text-center text-slate-500">No users found matching your filters.</td></tr>
                                                    ) : sortedUsers.map(user => (
                                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedUser(user)}>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${user.role === UserRole.DESIGNER ? 'bg-purple-600' : 'bg-blue-600'}`}>
                                                                        {user.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-medium text-slate-900">{user.name}</div>
                                                                        <div className="text-xs text-slate-500">{user.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 capitalize">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === UserRole.DESIGNER ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                                    {user.role}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 capitalize text-slate-600">{user.plan || 'Free'}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                                                                    user.subscriptionStatus === 'past_due' ? 'bg-red-100 text-red-800' :
                                                                        user.subscriptionStatus === 'canceled' ? 'bg-slate-100 text-slate-800' :
                                                                            'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                    {user.subscriptionStatus || 'None'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-600">{user.loginCount || 0}</td>
                                                            <td className="px-6 py-4 text-slate-600">{user.projectCount || 0}</td>
                                                            <td className="px-6 py-4 text-slate-600">{typeof user.engagementScore === 'number' ? user.engagementScore : '—'}</td>
                                                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleViewPaymentHistory(user);
                                                                        }}
                                                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                                        title="View Payment History"
                                                                    >
                                                                        <Receipt className="w-4 h-4" />
                                                                    </button>
                                                                    {user.isAdmin ? (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleRemoveAdmin(user.email);
                                                                            }}
                                                                            className="text-slate-400 hover:text-red-600 transition-colors"
                                                                            title="Remove Admin Access"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setAdminEmail(user.email);
                                                                            }}
                                                                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                                            title="Make Admin"
                                                                        >
                                                                            <Shield className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Admin Tools */}
                                <div className="space-y-6">

                                    {/* Role Impersonation */}
                                    <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                                        <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Eye className="w-4 h-4" /> Role Impersonation
                                        </h4>
                                        <p className="text-sm text-indigo-700 mb-4">
                                            View the application as if you were a different role. This affects comment visibility and project access.
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            <Button
                                                variant={impersonatedRole === null ? 'primary' : 'secondary'}
                                                onClick={() => setImpersonatedRole(null)}
                                                size="sm"
                                                className="w-full justify-start"
                                            >
                                                Default (Owner)
                                            </Button>
                                            <Button
                                                variant={impersonatedRole === 'guest' ? 'primary' : 'secondary'}
                                                onClick={() => setImpersonatedRole('guest')}
                                                size="sm"
                                                className="w-full justify-start"
                                            >
                                                View as Guest
                                            </Button>
                                            <Button
                                                variant={impersonatedRole === 'professional' ? 'primary' : 'secondary'}
                                                onClick={() => setImpersonatedRole('professional')}
                                                size="sm"
                                                className="w-full justify-start"
                                            >
                                                View as Pro
                                            </Button>
                                        </div>
                                        {impersonatedRole && (
                                            <div className="mt-4 p-3 bg-white/50 rounded-lg text-xs text-indigo-800 font-medium flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <div>
                                                    You are currently viewing as <strong>{impersonatedRole}</strong>.
                                                    <br />
                                                    Navigate back to Dashboard to see the effect.
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Add Admin */}
                                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Shield className="w-4 h-4" /> Add New Admin
                                        </h4>
                                        <form onSubmit={handleAddAdmin} className="space-y-3">
                                            <Input
                                                placeholder="Enter user email"
                                                value={adminEmail}
                                                onChange={(e) => setAdminEmail(e.target.value)}
                                            />
                                            <Button type="submit" className="w-full" icon={<UserPlus className="w-4 h-4" />}>
                                                Grant Admin Access
                                            </Button>
                                        </form>
                                        {message && (
                                            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                {message.text}
                                            </div>
                                        )}
                                    </div>

                                    {/* Growth Chart (Visual Only) */}
                                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> User Growth
                                        </h4>
                                        <div className="h-40 flex items-end justify-between gap-2 px-2">
                                            {growthData.map((data, i) => (
                                                <div key={i} className="flex flex-col items-center gap-2 w-full">
                                                    <div
                                                        className="w-full bg-indigo-100 hover:bg-indigo-200 transition-colors rounded-t-sm relative group"
                                                        style={{ height: `${stats.total > 0 ? (data.users / stats.total) * 100 : 0}%` }}
                                                    >
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {data.users}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{data.month}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'engagement' && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Engagement & Campaigns</h3>
                                        <p className="text-sm text-slate-600 mt-1">
                                            Monitor usage trends and launch targeted outreach when metrics soften.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="secondary"
                                            onClick={handleRecalculateEngagement}
                                            icon={<RefreshCw className={`w-4 h-4 ${recalcEngagementLoading ? 'animate-spin' : ''}`} />}
                                            disabled={recalcEngagementLoading}
                                        >
                                            {recalcEngagementLoading ? 'Recalculating…' : 'Recalculate Engagement'}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={handleRebuildDailyAnalytics}
                                            icon={<Activity className={`w-4 h-4 ${rebuildDailyLoading ? 'animate-spin' : ''}`} />}
                                            disabled={rebuildDailyLoading}
                                        >
                                            {rebuildDailyLoading ? 'Rebuilding Daily Stats…' : 'Rebuild Daily Analytics'}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => setShowCampaignManager(true)}
                                            icon={<Megaphone className="w-4 h-4" />}
                                        >
                                            Campaign Manager
                                        </Button>
                                        <Button
                                            onClick={() => setShowEngagementDashboard(true)}
                                            icon={<BarChart3 className="w-4 h-4" />}
                                        >
                                            Open Dashboard
                                        </Button>
                                    </div>
                                </div>
                                {engagementMessage && (
                                    <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${engagementMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                        {engagementMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        <span>{engagementMessage.text}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                        <div className="text-xs text-slate-500">MAU</div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {engagementLoading ? '—' : (engagementKpis?.mau?.toLocaleString() || '—')}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Monthly active users</p>
                                    </div>
                                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                        <div className="text-xs text-slate-500">DAU</div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {engagementLoading ? '—' : (engagementKpis?.dau?.toLocaleString() || '—')}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Daily active users</p>
                                    </div>
                                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                        <div className="text-xs text-slate-500">Stickiness</div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {engagementLoading ? '—' : `${engagementKpis?.stickiness ?? 0}%`}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">DAU / MAU</p>
                                    </div>
                                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                        <div className="text-xs text-slate-500">Liveness</div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {engagementLoading ? '—' : `${engagementKpis?.liveness ?? 0}%`}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Recent activity velocity</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2 p-4 rounded-lg border border-slate-200 bg-white">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">Activity trend</div>
                                                <p className="text-xs text-slate-500">Last 14 days DAU</p>
                                            </div>
                                            {engagementLoading && <div className="text-xs text-slate-400">Loading…</div>}
                                        </div>
                                        <div className="flex items-end gap-2 h-32">
                                            {(engagementKpis?.spark || []).map(point => (
                                                <div key={point.date} className="flex-1 flex flex-col items-center">
                                                    <div
                                                        className="w-full rounded-t bg-indigo-200"
                                                        style={{ height: `${engagementKpis && engagementKpis.dau > 0 ? Math.max(8, (point.dau / maxSparkDau) * 100) : 10}%`, minHeight: '8px' }}
                                                    ></div>
                                                    <span className="text-[10px] text-slate-400 mt-1">{point.date}</span>
                                                </div>
                                            ))}
                                            {!engagementKpis && !engagementLoading && (
                                                <div className="text-sm text-slate-500">No analytics yet. Open dashboard to generate mock data.</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">Active campaigns</div>
                                                <p className="text-xs text-slate-500">Top 5 by recency</p>
                                            </div>
                                            {loadingCampaigns && <span className="text-[10px] text-slate-400">Loading…</span>}
                                        </div>
                                        <div className="space-y-2">
                                            {campaignsSummary.length === 0 && !loadingCampaigns && (
                                                <div className="text-sm text-slate-500">No campaigns found.</div>
                                            )}
                                            {campaignsSummary.map(c => (
                                                <div key={c.id} className="p-3 rounded border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium text-slate-900 text-sm">{c.name}</div>
                                                        <div className="text-xs text-slate-600 mt-1">Responses: {c.responses} • Impressions: {c.impressions}</div>
                                                    </div>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        className="h-8 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                                        title="Test Trigger (Bypass Locks)"
                                                        icon={<Zap className="w-3 h-3" />}
                                                        onClick={() => {
                                                            const url = new URL(window.location.href);
                                                            url.searchParams.set('DEBUG_ENGAGEMENT', '1');
                                                            url.searchParams.set('FORCE_CAMPAIGN_ID', c.id);
                                                            window.open(url.toString(), '_blank');
                                                        }}
                                                    >
                                                        Test Trigger
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <CampaignDocumentation />
                        </div>
                    )}

                    {activeTab === 'referrals' && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-3">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Referrals</h3>
                                        <p className="text-sm text-slate-600">Track the live program and adjust rewards or feature costs.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            onClick={() => setShowReferralManagement(true)}
                                            icon={<Gift className="w-4 h-4" />}
                                        >
                                            Manage Program
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500">
                                    The dashboard below shows what members see, while the manager updates token rules.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="text-xs text-slate-500">Total tokens issued</div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        {referralLoading ? '—' : referralSummary?.totalTokens ?? 0}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="text-xs text-slate-500">Tokens redeemed</div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        {referralLoading ? '—' : referralSummary?.redeemedTokens ?? 0}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="text-xs text-slate-500">Pending referrals</div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        {referralLoading ? '—' : referralSummary?.pendingReferrals ?? 0}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="text-xs text-slate-500">Total referrals</div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        {referralLoading ? '—' : referralSummary?.totalReferrals ?? 0}
                                    </div>
                                </div>
                            </div>

                            {referralSummary && referralSummary.recentTransactions.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-semibold text-slate-900">Recent transactions</div>
                                        {referralLoading && <span className="text-[10px] text-slate-400">Loading…</span>}
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {referralSummary.recentTransactions.map((t) => (
                                            <div key={t.id} className="py-2 flex items-center justify-between text-sm">
                                                <div>
                                                    <div className="font-medium text-slate-900">{t.description || t.type}</div>
                                                    <div className="text-xs text-slate-500">{new Date(t.timestamp).toLocaleDateString()}</div>
                                                </div>
                                                <div className={`font-semibold ${t.type === 'redeemed' ? 'text-red-600' : 'text-green-600'}`}>
                                                    {t.type === 'redeemed' ? '-' : '+'}{t.amount}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Suspense fallback={<div className="text-sm text-slate-500">Loading referral data…</div>}>
                                <ReferralDashboardLazy currentUser={currentUser} />
                            </Suspense>
                        </div>
                    )}

                    {/* Plan Limits Tab */}
                    {activeTab === 'plan-limits' && (
                        <div className="p-6">
                            <PlanLimitsEditor />
                        </div>
                    )}
                </main>



                {/* User Detail Modal */}
                {
                    selectedUser && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-900">User Details</h2>
                                    <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600">
                                        <ArrowLeft className="w-5 h-5 rotate-180" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${selectedUser.role === UserRole.DESIGNER ? 'bg-purple-600' : 'bg-blue-600'}`}>
                                            {selectedUser.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">{selectedUser.name}</h3>
                                            <p className="text-slate-500">{selectedUser.email}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600 capitalize">{selectedUser.role}</span>
                                                <span className="px-2 py-0.5 bg-indigo-100 rounded text-xs font-medium text-indigo-600 capitalize">{selectedUser.plan || 'Free'}</span>
                                                {selectedUser.isAdmin && <span className="px-2 py-0.5 bg-purple-100 rounded text-xs font-medium text-purple-600">Admin</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-slate-900">{selectedUser.loginCount || 0}</div>
                                            <div className="text-xs text-slate-500">Logins</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-slate-900">{selectedUser.projectCount || 0}</div>
                                            <div className="text-xs text-slate-500">Projects</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-slate-900">{selectedUser.shareCountGuest || 0}</div>
                                            <div className="text-xs text-slate-500">Guest Shares</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-slate-900">{selectedUser.shareCountPro || 0}</div>
                                            <div className="text-xs text-slate-500">Pro Shares</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-slate-900 mb-2">Last Activity</h4>
                                        <p className="text-sm text-slate-600">
                                            {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}
                                        </p>
                                    </div>



                                    <div>
                                        <h4 className="font-semibold text-slate-900 mb-2">Activity Timeline</h4>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-60 overflow-y-auto">
                                            {loadingActivity ? (
                                                <div className="flex justify-center py-4">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                                </div>
                                            ) : activityLogs.length === 0 ? (
                                                <p className="text-sm text-slate-500 text-center py-2">No recent activity recorded.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {activityLogs.map((log) => (
                                                        <div key={log.id} className="flex gap-3 text-sm">
                                                            <div className="flex-shrink-0 mt-1">
                                                                <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                                                            </div>
                                                            <div>
                                                                <p className="text-slate-900 font-medium">
                                                                    {formatEventName(log.eventName)}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {new Date(log.timestamp).toLocaleString()}
                                                                </p>
                                                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                                    <div className="mt-1 text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                                                        {JSON.stringify(log.metadata, null, 2)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Placeholder for Network Graph */}
                                    <div>
                                        <h4 className="font-semibold text-slate-900 mb-2">Network Size</h4>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <p className="text-sm text-slate-600 mb-2">
                                                This user has collaborated with <strong>{/* Mock */} 5</strong> unique people.
                                            </p>
                                            {/* Visual representation could go here */}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-slate-100">
                                        <Button variant="secondary" onClick={() => setSelectedUser(null)}>Close</Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    )}

                {/* Analytics Modal */}
                {
                    showAnalytics && (
                        <FeatureVoteAnalytics
                            featureId="ai-summary"
                            onClose={() => setShowAnalytics(false)}
                        />
                    )
                }

                {/* Payment History Modal */}
                {showPaymentHistoryModal && paymentHistoryUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-indigo-600" />
                                    Payment History for {paymentHistoryUser.name}
                                </h3>
                                <button
                                    onClick={() => setShowPaymentHistoryModal(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 max-h-[60vh] overflow-y-auto">
                                {isPaymentHistoryLoading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : paymentHistory.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500">
                                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No payment history found.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {paymentHistory.map((payment) => (
                                            <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                                                <div>
                                                    <div className="font-medium text-slate-900">
                                                        {(payment.amount / 100).toLocaleString('en-US', { style: 'currency', currency: payment.currency.toUpperCase() })}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {new Date(payment.created * 1000).toLocaleDateString()} at {new Date(payment.created * 1000).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${payment.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                                                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                        {payment.status}
                                                    </span>
                                                    {payment.receipt_url && (
                                                        <a
                                                            href={payment.receipt_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                                                        >
                                                            Receipt
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <Button variant="secondary" onClick={() => setShowPaymentHistoryModal(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Referral Management Modal */}
                {showReferralManagement && (
                    <div className="fixed inset-0 z-50 bg-white overflow-auto">
                        <ReferralManagement onClose={() => setShowReferralManagement(false)} />
                    </div>
                )}

                {/* Campaign Manager Modal */}
                {showCampaignManager && (
                    <div className="fixed inset-0 z-50 bg-white overflow-auto">
                        <CampaignManager onBack={() => setShowCampaignManager(false)} />
                    </div>
                )}

                {/* Engagement Dashboard Modal */}
                {showEngagementDashboard && (
                    <div className="fixed inset-0 z-50 bg-white overflow-auto">
                        <EngagementDashboard onBack={() => setShowEngagementDashboard(false)} />
                    </div>
                )}
            </div >
        )
    );
};
