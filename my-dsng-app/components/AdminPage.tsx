import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { getAllUsers, updateAdminStatus } from '../services/storageService';
import { fetchUserPaymentHistory, PaymentRecord } from '../services/paymentService';
import { useAdmin } from '../contexts/AdminContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Shield, Search, Filter, Trash2, ArrowLeft, BarChart3, Users, Eye, UserPlus, Check, AlertCircle, Calendar, CreditCard, Receipt, Gift } from 'lucide-react';
import { FeatureVoteAnalytics } from './FeatureVoteAnalytics';
import { ReferralManagement } from './ReferralManagement';
import { getUserActivity, ActivityLog } from '../services/analyticsService';
import { EngagementDashboard } from './EngagementDashboard';

const formatEventName = (name: string) => {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

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

    // Activity Logs State
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // Engagement Dashboard State
    const [showEngagementDashboard, setShowEngagementDashboard] = useState(false);

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

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = filterRole === 'all' ||
            (filterRole === 'admin' && user.isAdmin) ||
            (filterRole === 'pro' && (user.plan === 'pro' || user.plan === 'business')) ||
            (filterRole === 'guest' && (!user.plan || user.plan === 'free'));

        return matchesSearch && matchesRole;
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
                                onClick={() => setShowEngagementDashboard(true)}
                                icon={<BarChart3 className="w-4 h-4" />}
                            >
                                Engagement
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setShowReferralManagement(true)}
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

            <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

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
                            {((stats.pro / stats.total) * 100).toFixed(1)}% conversion rate
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
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading users...</td></tr>
                                        ) : sortedUsers.length === 0 ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">No users found matching your filters.</td></tr>
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
                                            style={{ height: `${(data.users / stats.total) * 100}%` }}
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

            {/* Engagement Dashboard Modal */}
            {showEngagementDashboard && (
                <div className="fixed inset-0 z-50 bg-white overflow-auto">
                    <EngagementDashboard onBack={() => setShowEngagementDashboard(false)} />
                </div>
            )}
        </div >
    );
};
