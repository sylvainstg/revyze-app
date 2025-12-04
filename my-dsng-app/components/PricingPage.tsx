import React, { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { createCheckoutSession } from '../services/paymentService';
import { User } from '../types';
import { PLANS } from '../constants';
import { functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

interface PricingPageProps {
    user: User;
    onBack: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ user, onBack }) => {
    const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [priceIds, setPriceIds] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const getSubscriptionPlans = httpsCallable(functions, 'getSubscriptionPlansFunction');
                const result = await getSubscriptionPlans();
                const data = result.data as { plans: { id: string; priceId: string }[] };

                const prices: { [key: string]: string } = {};
                data.plans.forEach(plan => {
                    prices[plan.id] = plan.priceId;
                });
                setPriceIds(prices);
            } catch (error) {
                console.error("Error fetching plans:", error);
            }
        };

        fetchPlans();
    }, []);

    const handleUpgrade = async (priceId: string) => {
        setLoadingPriceId(priceId);
        const url = await createCheckoutSession(priceId);
        if (url) {
            window.location.href = url;
        } else {
            alert("Failed to start checkout. Please try again.");
            setLoadingPriceId(null);
        }
    };

    const plans = [
        {
            ...PLANS.free,
            monthlyPrice: PLANS.free.price.monthly,
            yearlyPrice: PLANS.free.price.yearly,
            period: '/mo',
            current: user.plan === 'free' || !user.plan,
            priceId: null
        },
        {
            ...PLANS.pro,
            monthlyPrice: PLANS.pro.price.monthly,
            yearlyPrice: PLANS.pro.price.yearly,
            period: billingCycle === 'monthly' ? '/mo' : '/yr',
            current: user.plan === 'pro',
            priceId: priceIds['pro_plan']
        },
        {
            ...PLANS.business,
            monthlyPrice: PLANS.business.price.monthly,
            yearlyPrice: PLANS.business.price.yearly,
            period: billingCycle === 'monthly' ? '/mo' : '/yr',
            current: user.plan === 'business',
            priceId: priceIds['corporate_plan']
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                        Simple, transparent pricing
                    </h2>
                    <p className="mt-4 text-xl text-slate-600">
                        Choose the plan that fits your needs.
                    </p>
                    <button onClick={onBack} className="mt-4 text-indigo-600 hover:text-indigo-500 font-medium">
                        &larr; Back to Dashboard
                    </button>

                    {/* Billing Cycle Toggle */}
                    <div className="mt-8 flex items-center justify-center gap-3 bg-slate-100 rounded-full p-1 w-fit mx-auto">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-6 py-2 rounded-full font-medium transition-all ${billingCycle === 'monthly'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            className={`px-6 py-2 rounded-full font-medium transition-all ${billingCycle === 'yearly'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Yearly
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Save 17%</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative bg-white rounded-2xl shadow-xl flex flex-col p-8 ${plan.current ? 'ring-2 ring-indigo-600' : ''
                                }`}
                        >
                            {plan.current && (
                                <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                                    Current Plan
                                </div>
                            )}

                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                                <p className="text-slate-500 text-sm mt-1">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-4xl font-extrabold text-slate-900">
                                    {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                                </span>
                                <span className="text-slate-500 font-medium">{plan.period}</span>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start">
                                        <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                                        <span className="text-slate-600 text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => plan.priceId && handleUpgrade(plan.priceId)}
                                disabled={plan.current || !plan.priceId || !!loadingPriceId}
                                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${plan.current
                                    ? 'bg-slate-100 text-slate-400 cursor-default'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                            >
                                {loadingPriceId === plan.priceId ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : plan.current ? (
                                    'Current Plan'
                                ) : (
                                    'Upgrade'
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
