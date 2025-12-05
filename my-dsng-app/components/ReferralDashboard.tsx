import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getUserReferralCode, getReferralStats } from '../services/referralService';
import { Button } from './ui/Button';
import { Gift, Copy, Check, Share2, Users, Coins } from 'lucide-react';

interface Props {
    currentUser: User;
}

export const ReferralDashboard: React.FC<Props> = ({ currentUser }) => {
    const [referralCode, setReferralCode] = useState<string>('');
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadReferralData();
    }, []);

    const loadReferralData = async () => {
        setLoading(true);
        try {
            const code = await getUserReferralCode();
            setReferralCode(code);

            const referralStats = await getReferralStats();
            setStats(referralStats);
        } catch (error) {
            console.error('Error loading referral data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getReferralLink = () => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/?ref=${referralCode}`;
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(getReferralLink());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const handleShare = async () => {
        const link = getReferralLink();
        const text = `Join me on DesignSync! Use my referral link to get started: ${link}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join DesignSync',
                    text: text,
                    url: link,
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            // Fallback: copy to clipboard
            handleCopyLink();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                    <Gift className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Referral Program</h2>
                </div>
                <p className="text-sm text-indigo-100">
                    Earn 100 tokens for every friend who subscribes to a paid plan!
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                        <Coins className="w-4 h-4 text-green-600" />
                        <div className="text-xs text-slate-500">Tokens</div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                        {stats?.tokenBalance || 0}
                    </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-600" />
                        <div className="text-xs text-slate-500">Referrals</div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                        {stats?.totalReferrals || 0}
                    </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                        <Gift className="w-4 h-4 text-purple-600" />
                        <div className="text-xs text-slate-500">Pending</div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                        {stats?.pendingReferrals || 0}
                    </div>
                </div>
            </div>

            {/* Referral Link */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-2">Your Referral Link</h3>

                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={getReferralLink()}
                        readOnly
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-slate-700 font-mono text-xs"
                    />
                    <Button onClick={handleCopyLink} size="sm" icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button onClick={handleShare} size="sm" variant="secondary" icon={<Share2 className="w-4 h-4" />}>
                        Share
                    </Button>
                </div>

                <div className="bg-indigo-50 rounded p-3 border border-indigo-100">
                    <p className="text-xs text-indigo-900">
                        <strong>Code:</strong> <span className="font-mono font-bold">{referralCode}</span>
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                        Share this link. When friends subscribe to a paid plan, you earn 100 tokens!
                    </p>
                </div>
            </div>

            {/* How It Works - Compact Version */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-3">How It Works</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex gap-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                        <div>
                            <div className="text-sm font-medium text-slate-900">Share link</div>
                            <div className="text-xs text-slate-600">Send to friends</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                        <div>
                            <div className="text-sm font-medium text-slate-900">They sign up</div>
                            <div className="text-xs text-slate-600">Using your link</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                        <div>
                            <div className="text-sm font-medium text-slate-900">They subscribe</div>
                            <div className="text-xs text-slate-600">You earn 100 tokens</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                        <div>
                            <div className="text-sm font-medium text-slate-900">Redeem tokens</div>
                            <div className="text-xs text-slate-600">Unlock features</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity - Only if exists */}
            {stats?.recentTransactions && stats.recentTransactions.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">Recent Activity</h3>
                    <div className="space-y-2">
                        {stats.recentTransactions.slice(0, 3).map((transaction: any) => (
                            <div key={transaction.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
                                <div>
                                    <div className="font-medium text-slate-900">{transaction.description}</div>
                                    <div className="text-slate-500">
                                        {new Date(transaction.timestamp).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className={`font-bold ${transaction.type === 'earned' ? 'text-green-600' : 'text-red-600'}`}>
                                    {transaction.type === 'earned' ? '+' : '-'}{Math.abs(transaction.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
