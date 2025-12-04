import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Gift, Check, Sparkles, Users, Zap, FolderOpen } from 'lucide-react';
import { functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

interface Props {
    referralCode?: string;
    inviterName?: string;
    projectName?: string;
    inviteRole?: 'guest' | 'pro';
    onGetStarted: () => void;
}

export const WelcomeLandingPage: React.FC<Props> = ({
    referralCode,
    inviterName,
    projectName,
    inviteRole,
    onGetStarted
}) => {
    const [displayName, setDisplayName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Determine the type of invitation
    const isProjectInvite = !!inviterName || !!projectName;
    const isReferral = !!referralCode && !isProjectInvite;

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                if (isReferral && referralCode) {
                    // Fetch referrer name for referral invites
                    const getReferrerInfo = httpsCallable(functions, 'getReferrerInfoFunction');
                    const result = await getReferrerInfo({ referralCode });
                    const data = result.data as { success: boolean; referrerName?: string };

                    if (data.success && data.referrerName) {
                        setDisplayName(data.referrerName);
                    } else {
                        setDisplayName('a friend');
                    }
                } else if (isProjectInvite && inviterName) {
                    // Use provided inviter name for project invites
                    setDisplayName(inviterName);
                } else {
                    setDisplayName('someone');
                }
            } catch (error) {
                console.error('Error fetching info:', error);
                setDisplayName(isProjectInvite ? (inviterName || 'someone') : 'a friend');
            } finally {
                setLoading(false);
            }
        };

        fetchInfo();
    }, [referralCode, inviterName, isReferral, isProjectInvite]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // Customize message based on invitation type
    const getBadgeText = () => {
        if (isProjectInvite && projectName) return 'Project Invitation';
        if (isProjectInvite) return 'Collaboration Invite';
        return 'Special Invitation';
    };

    const getBadgeIcon = () => {
        if (isProjectInvite && projectName) return <FolderOpen className="w-4 h-4" />;
        return <Gift className="w-4 h-4" />;
    };

    const getSubheadline = () => {
        if (isProjectInvite && projectName) {
            return (
                <>
                    <span className="font-semibold text-indigo-600">{displayName}</span> invited you to collaborate on{' '}
                    <span className="font-semibold text-indigo-600">{projectName}</span>
                </>
            );
        }
        return (
            <>
                <span className="font-semibold text-indigo-600">{displayName}</span> thinks you'll love Revyze
            </>
        );
    };

    const getTrialMessage = () => {
        if (inviteRole === 'pro') {
            return 'Start your Pro trial • Full access included';
        }
        return 'No credit card required • Free trial included';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Badge */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6">
                        {getBadgeIcon()}
                        {getBadgeText()}
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4">
                        You've Been Invited! 🎉
                    </h1>

                    <p className="text-xl text-slate-600 mb-8">
                        {getSubheadline()}
                    </p>
                </div>

                {/* Value Proposition */}
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">
                        Collaborate on Design Projects Like Never Before
                    </h2>

                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">AI-Powered Feedback</h3>
                            <p className="text-sm text-slate-600">Get instant AI analysis on your design comments</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-purple-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">Real-Time Collaboration</h3>
                            <p className="text-sm text-slate-600">Work together with clients and team members</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">Version Control</h3>
                            <p className="text-sm text-slate-600">Track changes and manage design iterations</p>
                        </div>
                    </div>

                    {/* Benefits List */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-8">
                        <h3 className="font-bold text-slate-900 mb-4">What You Get:</h3>
                        <div className="space-y-3">
                            {[
                                'Upload and share design files instantly',
                                'Pin comments directly on designs',
                                'Invite clients and collaborators',
                                'AI-powered design analysis',
                                'Professional project management',
                                inviteRole === 'pro' ? 'Full Pro features trial' : 'Start with a free trial'
                            ].map((benefit, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-slate-700">{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="text-center">
                        <Button
                            onClick={onGetStarted}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg px-12 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all border-none"
                        >
                            {isProjectInvite && projectName ? 'Join Project' : 'Get Started Free'}
                        </Button>
                        <p className="text-sm text-slate-500 mt-4">
                            {getTrialMessage()}
                        </p>
                    </div>
                </div>

                {/* Social Proof */}
                <div className="text-center text-slate-600">
                    <p className="text-sm">
                        Join thousands of designers and homeowners collaborating on Revyze
                    </p>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
                    <p>© 2024 Revyze. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

// Keep the old name as an alias for backward compatibility
export const ReferralLandingPage = WelcomeLandingPage;
