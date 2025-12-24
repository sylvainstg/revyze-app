import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Clock, Mail, Calendar } from 'lucide-react';

interface Props {
    user: User;
    onChange: (prefs: User['notificationPreferences'], digest: User['digestSettings']) => void;
}

export const NotificationSettings: React.FC<Props> = ({ user, onChange }) => {
    const [preferences, setPreferences] = useState(user.notificationPreferences || {
        mentions: 'instant',
        projectUpdates: 'daily'
    });

    const [digest, setDigest] = useState(user.digestSettings || {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dailyTime: '09:00',
        weeklyDay: 1
    });

    useEffect(() => {
        onChange(preferences, digest);
    }, [preferences, digest]);

    const togglePreference = (key: keyof typeof preferences, value: string) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email Notifications
                </h3>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="text-sm font-medium text-slate-700 block mb-2">Mentions (@tags)</label>
                        <div className="flex gap-2">
                            {['instant', 'daily', 'weekly', 'none'].map((option) => (
                                <button
                                    key={option}
                                    onClick={() => togglePreference('mentions', option)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${preferences.mentions === option
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            When someone tags you in a comment.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="text-sm font-medium text-slate-700 block mb-2">Project Updates</label>
                        <div className="flex gap-2">
                            {['instant', 'daily', 'weekly', 'none'].map((option) => (
                                <button
                                    key={option}
                                    onClick={() => togglePreference('projectUpdates', option)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${preferences.projectUpdates === option
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            New versions and major changes.
                        </p>
                    </div>
                </div>
            </div>

            {(preferences.mentions === 'daily' || preferences.mentions === 'weekly' ||
                preferences.projectUpdates === 'daily' || preferences.projectUpdates === 'weekly') && (
                    <div className="pt-4 border-t border-slate-100">
                        <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Digest Settings
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Daily Digest Time</label>
                                <input
                                    type="time"
                                    value={digest.dailyTime}
                                    onChange={(e) => setDigest(prev => ({ ...prev, dailyTime: e.target.value }))}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Weekly Digest Day</label>
                                <select
                                    value={digest.weeklyDay}
                                    onChange={(e) => setDigest(prev => ({ ...prev, weeklyDay: parseInt(e.target.value) }))}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                                >
                                    <option value={0}>Sunday</option>
                                    <option value={1}>Monday</option>
                                    <option value={2}>Tuesday</option>
                                    <option value={3}>Wednesday</option>
                                    <option value={4}>Thursday</option>
                                    <option value={5}>Friday</option>
                                    <option value={6}>Saturday</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-700 mb-1">Timezone</label>
                                <select
                                    value={digest.timezone}
                                    onChange={(e) => setDigest(prev => ({ ...prev, timezone: e.target.value }))}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                                >
                                    {[
                                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                                        'UTC',
                                        'America/New_York',
                                        'America/Los_Angeles',
                                        'Europe/London',
                                        'Europe/Paris',
                                        'Asia/Tokyo'
                                    ].filter((v, i, a) => a.indexOf(v) === i).map(tz => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};
