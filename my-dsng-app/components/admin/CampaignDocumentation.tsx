import React from 'react';
import { Info, Users, Clock, Shield, UserCheck, Zap } from 'lucide-react';

export const CampaignDocumentation: React.FC = () => {
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
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span className="font-semibold text-slate-900">Power Users</span>
                                <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">power_users</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">Highly engaged users on paid plans.</p>
                            <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                                <li>Plan: <strong>Pro</strong> or <strong>Business</strong></li>
                                <li>Engagement Score: <strong>≥ 70</strong></li>
                            </ul>
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
