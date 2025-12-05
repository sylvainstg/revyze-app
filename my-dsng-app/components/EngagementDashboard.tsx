import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart
} from 'recharts';
import { ArrowUp, ArrowDown, Users, Activity, Zap, Layers, Filter, Download, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { getAnalyticsStats, generateMockAnalyticsData, DailyAnalyticsStats } from '../services/analyticsAggregationService';

interface EngagementDashboardProps {
    onBack: () => void;
}

export const EngagementDashboard: React.FC<EngagementDashboardProps> = ({ onBack }) => {
    const [dateRange, setDateRange] = useState<'7d' | '28d' | '90d'>('28d');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DailyAnalyticsStats[]>([]);
    const [summary, setSummary] = useState({
        mau: 0,
        dau: 0,
        stickiness: 0,
        liveness: 0,
        engagementScore: 0
    });

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const days = dateRange === '7d' ? 7 : dateRange === '28d' ? 28 : 90;
            const stats = await getAnalyticsStats(days);
            setData(stats);

            // Calculate Summary Metrics
            if (stats.length > 0) {
                // MAU (Simulated as sum of unique DAUs is not perfect, but max DAU * multiplier or just last record's MAU if we had it)
                // Since our mock data has MAU, we use the latest record
                const latest = stats[stats.length - 1];
                const avgDau = stats.reduce((acc, curr) => acc + curr.dau, 0) / stats.length;

                setSummary({
                    mau: latest.mau,
                    dau: Math.round(avgDau),
                    stickiness: Math.round((avgDau / latest.mau) * 100),
                    liveness: 42, // Mocked for now as we don't have project-level liveness in daily stats yet
                    engagementScore: 68 // Mocked average
                });
            }
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateData = async () => {
        setLoading(true);
        await generateMockAnalyticsData(90);
        await fetchData();
    };

    // Prepare Chart Data
    const chartData = data.map(d => ({
        date: d.date.slice(5), // MM-DD
        NewProjects: d.new_projects,
        NewComments: d.new_comments,
        NewInvites: d.new_invites,
        ActivePros: d.active_users_by_role.pro,
        TotalUsers: d.mau // Proxy for total growth
    }));

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
                                ← Back
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Engagement Overview</h1>
                                <p className="text-xs text-slate-500">Platform health & user behavior</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" onClick={handleGenerateData} title="Generate Mock Data">
                                <RefreshCw className="w-4 h-4 text-slate-400" />
                            </Button>

                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button
                                    onClick={() => setDateRange('7d')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${dateRange === '7d' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    7 Days
                                </button>
                                <button
                                    onClick={() => setDateRange('28d')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${dateRange === '28d' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    28 Days
                                </button>
                                <button
                                    onClick={() => setDateRange('90d')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${dateRange === '90d' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    90 Days
                                </button>
                            </div>
                            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}>
                                Export
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-20">
                        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No Analytics Data Available</h3>
                        <p className="text-slate-500 mb-6">Generate mock data to see the dashboard in action.</p>
                        <Button onClick={handleGenerateData}>Generate Mock Data</Button>
                    </div>
                ) : (
                    <>
                        {/* Section B: Scorecards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500 font-medium mb-1">Active Users (MAU)</div>
                                <div className="text-3xl font-bold text-slate-900">{summary.mau.toLocaleString()}</div>
                                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                    <ArrowUp className="w-3 h-3" /> 12% vs last period
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500 font-medium mb-1">Stickiness (DAU/MAU)</div>
                                <div className="text-3xl font-bold text-slate-900">{summary.stickiness}%</div>
                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                                    Stable
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500 font-medium mb-1">Project Liveness</div>
                                <div className="text-3xl font-bold text-slate-900">{summary.liveness}%</div>
                                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                    <ArrowUp className="w-3 h-3" /> 5% vs last period
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500 font-medium mb-1">Avg Engagement Score</div>
                                <div className="text-3xl font-bold text-indigo-600">{summary.engagementScore}/100</div>
                                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                    <ArrowUp className="w-3 h-3" /> +2 pts
                                </div>
                            </div>
                        </div>

                        {/* Section C: Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Activity Volume</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend />
                                            <Line type="monotone" dataKey="NewProjects" name="New Projects" stroke="#6366f1" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="NewComments" name="New Comments" stroke="#10b981" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="NewInvites" name="Invites" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-4">User Growth vs Active Pros</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend />
                                            <Area type="monotone" dataKey="TotalUsers" name="Total Users" stackId="1" stroke="#94a3b8" fill="#f1f5f9" />
                                            <Area type="monotone" dataKey="ActivePros" name="Active Pros" stackId="2" stroke="#8b5cf6" fill="#ddd6fe" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Section D: Heatmap (Mocked Visual) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Role-Based Engagement Matrix (Last 7 Days)</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-3">Role Segment</th>
                                            <th className="px-6 py-3">% Active</th>
                                            <th className="px-6 py-3">Avg Projects</th>
                                            <th className="px-6 py-3">Avg Comments</th>
                                            <th className="px-6 py-3">Avg Invites</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="px-6 py-4 font-medium text-slate-900">Free Homeowner</td>
                                            <td className="px-6 py-4"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">24%</span></td>
                                            <td className="px-6 py-4">0.8</td>
                                            <td className="px-6 py-4">1.2</td>
                                            <td className="px-6 py-4">0.5</td>
                                        </tr>
                                        <tr>
                                            <td className="px-6 py-4 font-medium text-slate-900">Pro Homeowner</td>
                                            <td className="px-6 py-4"><span className="bg-green-100 text-green-800 px-2 py-1 rounded">68%</span></td>
                                            <td className="px-6 py-4">3.5</td>
                                            <td className="px-6 py-4">8.4</td>
                                            <td className="px-6 py-4">2.1</td>
                                        </tr>
                                        <tr>
                                            <td className="px-6 py-4 font-medium text-slate-900">Designer/Pro</td>
                                            <td className="px-6 py-4"><span className="bg-green-100 text-green-800 px-2 py-1 rounded">52%</span></td>
                                            <td className="px-6 py-4">5.2</td>
                                            <td className="px-6 py-4">12.5</td>
                                            <td className="px-6 py-4">4.0</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Section E: Funnel (Mocked Visual) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Homeowner Activation Funnel</h3>
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-8 px-4">
                                <div className="flex-1 text-center relative w-full">
                                    <div className="text-2xl font-bold text-slate-900">100%</div>
                                    <div className="text-sm text-slate-500">Sign Up</div>
                                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-slate-200 transform -translate-y-1/2"></div>
                                </div>
                                <div className="flex-1 text-center relative w-full">
                                    <div className="text-2xl font-bold text-slate-900">65%</div>
                                    <div className="text-sm text-slate-500">Upload PDF</div>
                                    <div className="text-xs text-red-500 mt-1">-35% drop</div>
                                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-slate-200 transform -translate-y-1/2"></div>
                                </div>
                                <div className="flex-1 text-center relative w-full">
                                    <div className="text-2xl font-bold text-slate-900">42%</div>
                                    <div className="text-sm text-slate-500">Invite Pro</div>
                                    <div className="text-xs text-red-500 mt-1">-23% drop</div>
                                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-slate-200 transform -translate-y-1/2"></div>
                                </div>
                                <div className="flex-1 text-center relative w-full">
                                    <div className="text-2xl font-bold text-slate-900">28%</div>
                                    <div className="text-sm text-slate-500">Receive Feedback</div>
                                    <div className="text-xs text-red-500 mt-1">-14% drop</div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};
