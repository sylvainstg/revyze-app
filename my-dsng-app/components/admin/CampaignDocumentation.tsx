import React, { useState } from 'react';
import { Info, Users, Clock, Shield, UserCheck, Zap } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';

export const CampaignDocumentation: React.FC = () => {
    const [segmentLoading, setSegmentLoading] = useState<Record<string, boolean>>({});
    const [segmentUsers, setSegmentUsers] = useState<Record<string, { totalCount: number; sample: Array<{ id: string; name?: string; email?: string; plan?: string }> }>>({});
    const fetchSegment = async (segment: string, limit: number = 50) => {
        setSegmentLoading(prev => ({ ...prev, [segment]: true }));
        try {
            const getSegmentStatsFunc = httpsCallable(functions, 'getSegmentStats');
            const result = await getSegmentStatsFunc({ segmentType: segment, limit });
            const data = result.data as any;
            setSegmentUsers(prev => ({
                ...prev,
                [segment]: {
                    totalCount: data.totalCount || 0,
                    sample: data.sampleUsers || []
                }
            }));
        } catch (err) {
            console.error('Failed to fetch segment stats', err);
            setSegmentUsers(prev => ({ ...prev, [segment]: { totalCount: 0, sample: [] } }));
        } finally {
            setSegmentLoading(prev => ({ ...prev, [segment]: false }));
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Info className="w-5 h-5 text-indigo-600" />
                    Campaign Triggers & Conditions
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                    Reference guide for targeting specific user segments with campaigns.
                </p>
            </div>

            <div className="p-6 space-y-8">
                {/* Segments */}
                <section>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" /> User Segments
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-indigo-500" />
                                <span className="font-semibold text-slate-900">Giving Up Almost</span>
                                <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">segment: giving_up_almost</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">
                                New-ish free users on their 2nd+ session who poked around but returned slowly or had a very short last session.
                            </p>
                            <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                                <li>Account age: ≤ 30 days</li>
                                <li>Plan: free, loginCount ≥ 2</li>
                                <li>Short last session (&lt; 3m) OR return after &gt; 2 days</li>
                                <li>Some engagement: ≥2 actions (project/comment/share/pan/zoom)</li>
                            </ul>
                            <div className="flex items-center gap-3 mt-3">
                                <button
                                    onClick={() => fetchSegment('giving_up_almost', 50)}
                                    className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100"
                                    disabled={segmentLoading['giving_up_almost']}
                                >
                                    {segmentLoading['giving_up_almost'] ? 'Loading…' : 'View users'}
                                </button>
                                {segmentUsers['giving_up_almost'] && (
                                    <span className="text-[11px] text-slate-500">
                                        {segmentUsers['giving_up_almost'].totalCount} users
                                    </span>
                                )}
                            </div>
                            {segmentUsers['giving_up_almost'] && (
                                <div className="mt-2 bg-white border border-slate-200 rounded p-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>Total:</span>
                                        <span className="font-semibold">{segmentUsers['giving_up_almost'].totalCount}</span>
                                    </div>
                                    {segmentUsers['giving_up_almost'].sample.length > 0 && (
                                        <ul className="mt-1 max-h-32 overflow-y-auto space-y-1">
                                            {segmentUsers['giving_up_almost'].sample.map((u) => (
                                                <li key={u.id} className="flex justify-between">
                                                    <span>{u.name || u.email}</span>
                                                    <span className="text-slate-400">{u.plan}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span className="font-semibold text-slate-900">Power Users</span>
                                <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">power_users</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">Highly engaged users on paid plans.</p>
                            <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                                <li>Plan: <strong>Pro</strong> or <strong>Business</strong></li>
                                <li>Engagement Score: <strong>≥ 70</strong></li>
                            </ul>
                            <div className="flex items-center gap-3 mt-3">
                                <button
                                    onClick={() => fetchSegment('power_users', 50)}
                                    className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100"
                                    disabled={segmentLoading['power_users']}
                                >
                                    {segmentLoading['power_users'] ? 'Loading…' : 'View users'}
                                </button>
                                {segmentUsers['power_users'] && (
                                    <span className="text-[11px] text-slate-500">
                                        {segmentUsers['power_users'].totalCount} users
                                    </span>
                                )}
                            </div>
                            {segmentUsers['power_users'] && (
                                <div className="mt-2 bg-white border border-slate-200 rounded p-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>Total:</span>
                                        <span className="font-semibold">{segmentUsers['power_users'].totalCount}</span>
                                    </div>
                                    {segmentUsers['power_users'].sample.length > 0 && (
                                        <ul className="mt-1 max-h-32 overflow-y-auto space-y-1">
                                            {segmentUsers['power_users'].sample.map((u) => (
                                                <li key={u.id} className="flex justify-between">
                                                    <span>{u.name || u.email}</span>
                                                    <span className="text-slate-400">{u.plan}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-red-500" />
                                <span className="font-semibold text-slate-900">At-Risk Pros</span>
                                <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">at_risk_pros</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">Paid users showing signs of churn.</p>
                            <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                                <li>Plan: <strong>Pro</strong> or <strong>Business</strong></li>
                                <li><strong>OR</strong> Inactive &gt; 30 days</li>
                                <li><strong>OR</strong> Engagement Score &lt; 40</li>
                            </ul>
                            <div className="flex items-center gap-3 mt-3">
                                <button
                                    onClick={() => fetchSegment('at_risk_pros', 50)}
                                    className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100"
                                    disabled={segmentLoading['at_risk_pros']}
                                >
                                    {segmentLoading['at_risk_pros'] ? 'Loading…' : 'View users'}
                                </button>
                                {segmentUsers['at_risk_pros'] && (
                                    <span className="text-[11px] text-slate-500">
                                        {segmentUsers['at_risk_pros'].totalCount} users
                                    </span>
                                )}
                            </div>
                            {segmentUsers['at_risk_pros'] && (
                                <div className="mt-2 bg-white border border-slate-200 rounded p-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>Total:</span>
                                        <span className="font-semibold">{segmentUsers['at_risk_pros'].totalCount}</span>
                                    </div>
                                    {segmentUsers['at_risk_pros'].sample.length > 0 && (
                                        <ul className="mt-1 max-h-32 overflow-y-auto space-y-1">
                                            {segmentUsers['at_risk_pros'].sample.map((u) => (
                                                <li key={u.id} className="flex justify-between">
                                                    <span>{u.name || u.email}</span>
                                                    <span className="text-slate-400">{u.plan}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 mb-2">
                                <UserCheck className="w-4 h-4 text-green-500" />
                                <span className="font-semibold text-slate-900">New Users</span>
                                <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">new_users</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">Recently signed up users who haven't started yet.</p>
                            <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                                <li>Account Age: <strong>≤ 7 days</strong></li>
                                <li>Project Count: <strong>0</strong></li>
                            </ul>
                            <div className="flex items-center gap-3 mt-3">
                                <button
                                    onClick={() => fetchSegment('new_users', 50)}
                                    className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100"
                                    disabled={segmentLoading['new_users']}
                                >
                                    {segmentLoading['new_users'] ? 'Loading…' : 'View users'}
                                </button>
                                {segmentUsers['new_users'] && (
                                    <span className="text-[11px] text-slate-500">
                                        {segmentUsers['new_users'].totalCount} users
                                    </span>
                                )}
                            </div>
                            {segmentUsers['new_users'] && (
                                <div className="mt-2 bg-white border border-slate-200 rounded p-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>Total:</span>
                                        <span className="font-semibold">{segmentUsers['new_users'].totalCount}</span>
                                    </div>
                                    {segmentUsers['new_users'].sample.length > 0 && (
                                        <ul className="mt-1 max-h-32 overflow-y-auto space-y-1">
                                            {segmentUsers['new_users'].sample.map((u) => (
                                                <li key={u.id} className="flex justify-between">
                                                    <span>{u.name || u.email}</span>
                                                    <span className="text-slate-400">{u.plan}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-blue-500" />
                                <span className="font-semibold text-slate-900">Returning Inactive</span>
                                <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">returning_inactive_users</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">Users logging in after a long absence.</p>
                            <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                                <li>Current Session: <strong>Active now</strong> (&lt; 24h)</li>
                                <li>Previous Login: <strong>&gt; 30 days ago</strong></li>
                            </ul>
                            <div className="flex items-center gap-3 mt-3">
                                <button
                                    onClick={() => fetchSegment('returning_inactive_users', 50)}
                                    className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100"
                                    disabled={segmentLoading['returning_inactive_users']}
                                >
                                    {segmentLoading['returning_inactive_users'] ? 'Loading…' : 'View users'}
                                </button>
                                {segmentUsers['returning_inactive_users'] && (
                                    <span className="text-[11px] text-slate-500">
                                        {segmentUsers['returning_inactive_users'].totalCount} users
                                    </span>
                                )}
                            </div>
                            {segmentUsers['returning_inactive_users'] && (
                                <div className="mt-2 bg-white border border-slate-200 rounded p-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>Total:</span>
                                        <span className="font-semibold">{segmentUsers['returning_inactive_users'].totalCount}</span>
                                    </div>
                                    {segmentUsers['returning_inactive_users'].sample.length > 0 && (
                                        <ul className="mt-1 max-h-32 overflow-y-auto space-y-1">
                                            {segmentUsers['returning_inactive_users'].sample.map((u) => (
                                                <li key={u.id} className="flex justify-between">
                                                    <span>{u.name || u.email}</span>
                                                    <span className="text-slate-400">{u.plan}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Triggers & Rules */}
                <section>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Triggers & Rules
                    </h4>
                    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Condition</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3">Default Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                <tr>
                                    <td className="px-4 py-3 font-medium text-slate-900">Frequency Cap</td>
                                    <td className="px-4 py-3 text-slate-600">Minimum days between showing the same campaign to a user.</td>
                                    <td className="px-4 py-3 font-mono text-xs">7 days</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-medium text-slate-900">Dismissal Cooldown</td>
                                    <td className="px-4 py-3 text-slate-600">If a user dismisses a campaign, how long before showing it again.</td>
                                    <td className="px-4 py-3 font-mono text-xs">14 days</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-medium text-slate-900">Global Cooldown</td>
                                    <td className="px-4 py-3 text-slate-600">Minimum time between ANY campaigns to prevent fatigue.</td>
                                    <td className="px-4 py-3 font-mono text-xs">1 day</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-medium text-slate-900">Priority</td>
                                    <td className="px-4 py-3 text-slate-600">If multiple campaigns match, which one is shown first.</td>
                                    <td className="px-4 py-3 font-mono text-xs">Based on creation date (Newest first)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};
