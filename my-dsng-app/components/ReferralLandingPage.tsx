import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Gift, Check, Sparkles, Users, Zap } from 'lucide-react';
import { functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

interface Props {
    referralCode: string;
    onGetStarted: () => void;
}

export const ReferralLandingPage: React.FC<Props> = ({ referralCode, onGetStarted }) => {
    const [referrerName, setReferrerName] = useState<string>('a friend');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReferrerInfo = async () => {
            try {
                const getReferrerInfo = httpsCallable(functions, 'getReferrerInfoFunction');
                const result = await getReferrerInfo({ referralCode });
                const data = result.data as { success: boolean; referrerName?: string };

                if (data.success && data.referrerName) {
                    setReferrerName(data.referrerName);
                }
            } catch (error) {
                console.error('Error fetching referrer info:', error);
                // Keep default "a friend" if fetch fails
            } finally {
                setLoading(false);
            }
        };

        fetchReferrerInfo();
    }, [referralCode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

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
                {/* Referral Badge */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6">
                        <Gift className="w-4 h-4" />
                        Special Invitation
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4">
                        You've Been Invited! 🎉
                    </h1>

                    <p className="text-xl text-slate-600 mb-8">
                        <span className="font-semibold text-indigo-600">{referrerName}</span> thinks you'll love Revyze
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
                                'Start with a free trial'
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
                            Get Started Free
                        </Button>
                        <p className="text-sm text-slate-500 mt-4">
                            No credit card required • Free trial included
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
