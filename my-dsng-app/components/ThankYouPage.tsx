import React from 'react';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { PLANS } from '../constants';

interface ThankYouPageProps {
    onGoToDashboard: () => void;
    plan?: 'free' | 'pro' | 'business';
}

export const ThankYouPage: React.FC<ThankYouPageProps> = ({ onGoToDashboard, plan = 'free' }) => {
    const isPro = plan === 'pro' || plan === 'business';
    const currentPlanFeatures = isPro ? PLANS.pro.features : PLANS.free.features;

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* Gradient Header */}
                <div className="h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>

                {/* Logo */}
                <div className="flex justify-center pt-8 pb-4">
                    <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
                </div>

                <div className="p-12 text-center">
                    {/* Success Icon */}
                    <div className="relative inline-block mb-8">
                        <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
                        <div className="relative bg-green-100 rounded-full p-6">
                            <CheckCircle className="w-16 h-16 text-green-600" />
                        </div>
                        <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-500 animate-pulse" />
                        <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-purple-500 animate-pulse" style={{ animationDelay: '0.5s' }} />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">You're all set!</h1>
                    <p className="text-slate-600 mb-8">
                        {isPro ? (
                            <>
                                Thank you for upgrading to <span className="font-bold text-indigo-600">Pro</span>.
                                You now have access to unlimited projects and AI analysis.
                            </>
                        ) : (
                            <>
                                You have successfully subscribed to the <span className="font-bold text-slate-700">Free Plan</span>.
                                You can start creating projects right away.
                            </>
                        )}
                    </p>

                    <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left border border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">What's included:</h3>
                        <ul className="space-y-2">
                            {currentPlanFeatures.map((feature, index) => (
                                <li key={index} className="flex items-center text-sm text-slate-700">
                                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <Button
                        onClick={onGoToDashboard}
                        className={`w-full justify-center py-3 text-lg border-none shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 ${isPro ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                    >
                        Go to Dashboard
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
