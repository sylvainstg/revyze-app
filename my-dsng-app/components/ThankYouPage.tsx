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
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center relative overflow-hidden">
                {/* Decorative background elements */}
                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${isPro ? 'from-indigo-500 via-purple-500 to-pink-500' : 'from-slate-400 to-slate-600'}`} />

                <div className="mb-6 relative">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    {isPro && (
                        <>
                            <Sparkles className="w-6 h-6 text-amber-400 absolute top-0 right-1/3 animate-bounce" />
                            <Sparkles className="w-4 h-4 text-purple-400 absolute bottom-0 left-1/3 animate-bounce delay-100" />
                        </>
                    )}
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
    );
};
