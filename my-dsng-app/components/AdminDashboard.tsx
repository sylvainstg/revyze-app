import React, { useState, useEffect } from 'react';
import { User, UserRole, ProjectRole } from '../types';
import { getAllUsers, updateAdminStatus } from '../services/storageService';
import { useAdmin } from '../contexts/AdminContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { X, Shield, Users, Eye, UserPlus, Trash2, Check, AlertCircle } from 'lucide-react';

interface AdminDashboardProps {
    onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminEmail, setAdminEmail] = useState('');
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const { impersonatedRole, setImpersonatedRole } = useAdmin();

    const [error, setError] = useState<string | null>(null);

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

    const stats = {
        total: users.length,
        pro: users.filter(u => u.plan === 'pro' || u.plan === 'business').length,
        admins: users.filter(u => u.isAdmin).length,
        designers: users.filter(u => u.role === UserRole.DESIGNER).length,
        homeowners: users.filter(u => u.role === UserRole.HOMEOWNER).length
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Shield className="w-6 h-6 text-indigo-600" />
                            System Administration
                        </h3>
                        <p className="text-sm text-slate-500">Manage users and system settings</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    {/* Impersonation Controls */}
                    <section className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                        <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Role Impersonation
                        </h4>
                        <p className="text-sm text-indigo-700 mb-4">
                            View the application as if you were a different role. This affects comment visibility and project access.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant={impersonatedRole === null ? 'primary' : 'secondary'}
                                onClick={() => setImpersonatedRole(null)}
                                size="sm"
                            >
                                Default (Owner)
                            </Button>
                            <Button
                                variant={impersonatedRole === 'guest' ? 'primary' : 'secondary'}
                                onClick={() => setImpersonatedRole('guest')}
                                size="sm"
                            >
                                View as Guest
                            </Button>
                            <Button
                                variant={impersonatedRole === 'professional' ? 'primary' : 'secondary'}
                                onClick={() => setImpersonatedRole('professional')}
                                size="sm"
                            >
                                View as Pro
                            </Button>
                        </div>
                        {impersonatedRole && (
                            <div className="mt-3 text-xs text-indigo-600 font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                You are currently viewing as {impersonatedRole}. Some admin features may be hidden in the main UI.
                            </div>
                        )}
                    </section>

                    {/* Stats */}
                    <section>
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4" /> System Stats
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                                <div className="text-xs text-slate-500 uppercase font-medium">Total Users</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-2xl font-bold text-purple-600">{stats.pro}</div>
                                <div className="text-xs text-slate-500 uppercase font-medium">Subscribers</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-2xl font-bold text-indigo-600">{stats.admins}</div>
                                <div className="text-xs text-slate-500 uppercase font-medium">Admins</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-2xl font-bold text-slate-700">{stats.designers}</div>
                                <div className="text-xs text-slate-500 uppercase font-medium">Designers</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-2xl font-bold text-slate-700">{stats.homeowners}</div>
                                <div className="text-xs text-slate-500 uppercase font-medium">Homeowners</div>
                            </div>
                        </div>
                    </section>

                    {/* Manage Admins */}
                    <section>
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Manage Admins
                        </h4>

                        <form onSubmit={handleAddAdmin} className="flex gap-2 mb-6 max-w-md">
                            <Input
                                placeholder="Enter user email to make admin"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                className="flex-1"
                            />
                            <Button type="submit" icon={<UserPlus className="w-4 h-4" />}>Add</Button>
                        </form>

                        {message && (
                            <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {message.text}
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">Role</th>
                                        <th className="px-4 py-3">Plan</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={4} className="p-4 text-center text-slate-500">Loading users...</td></tr>
                                    ) : users.filter(u => u.isAdmin).map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{user.name}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </td>
                                            <td className="px-4 py-3 capitalize">{user.role}</td>
                                            <td className="px-4 py-3 capitalize">{user.plan || 'Free'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleRemoveAdmin(user.email)}
                                                    className="text-slate-400 hover:text-red-600 transition-colors"
                                                    title="Remove Admin Access"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* All Users List (Optional, maybe collapsible) */}
                    <section>
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4" /> All Users
                        </h4>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-96 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">Role</th>
                                        <th className="px-4 py-3">Plan</th>
                                        <th className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={4} className="p-4 text-center text-slate-500">Loading users...</td></tr>
                                    ) : users.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{user.name}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </td>
                                            <td className="px-4 py-3 capitalize">{user.role}</td>
                                            <td className="px-4 py-3 capitalize">{user.plan || 'Free'}</td>
                                            <td className="px-4 py-3 capitalize">
                                                {user.isAdmin && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 mr-2">Admin</span>}
                                                {user.subscriptionStatus && <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{user.subscriptionStatus}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};
