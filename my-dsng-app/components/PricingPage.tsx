import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { createCheckoutSession } from "../services/paymentService";
import { User } from "../types";

interface PricingPageProps {
  enrichedPlans: any | null;
  pricingLoading: boolean;
  user?: User | null;
  onBack: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({
  enrichedPlans,
  pricingLoading,
  user,
  onBack,
}) => {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );

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

  // Build plans array - show free plan immediately, paid plans when loaded
  const plans = enrichedPlans
    ? [
        {
          ...enrichedPlans.free,
          monthlyPrice: enrichedPlans.free.price?.monthly || "$0",
          yearlyPrice: enrichedPlans.free.price?.yearly || "$0",
          period: "/mo",
          current: user?.plan === "free" || (user && !user.plan),
          priceId: null,
        },
        {
          ...enrichedPlans.pro,
          monthlyPrice: enrichedPlans.pro.price?.monthly || "$10",
          yearlyPrice: enrichedPlans.pro.price?.yearly || "$100",
          period: billingCycle === "monthly" ? "/mo" : "/yr",
          current: user?.plan === "pro",
          priceId: enrichedPlans.pro.priceIds?.[billingCycle] || null,
          isLoading: pricingLoading,
        },
        {
          ...enrichedPlans.business,
          monthlyPrice: enrichedPlans.business.price?.monthly || "$50",
          yearlyPrice: enrichedPlans.business.price?.yearly || "$500",
          period: billingCycle === "monthly" ? "/mo" : "/yr",
          current: user?.plan === "business",
          priceId: enrichedPlans.business.priceIds?.[billingCycle] || null,
          isLoading: pricingLoading,
        },
      ]
    : null;

  // If no plans are available at all (e.g., initial load and no enrichedPlans yet), show a general loading state
  if (!plans) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Loading pricing...
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-xl p-8 animate-pulse"
              >
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-6"></div>
                <div className="h-10 bg-slate-200 rounded w-1/3 mb-6"></div>
                <div className="space-y-3 mb-8">
                  <div className="h-4 bg-slate-200 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded"></div>
                </div>
                <div className="h-10 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
          <button
            onClick={onBack}
            className="mt-4 text-indigo-600 hover:text-indigo-500 font-medium"
          >
            &larr; Back to Dashboard
          </button>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3 bg-slate-100 rounded-full p-1 w-fit mx-auto">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingCycle === "yearly"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl shadow-xl flex flex-col p-8 ${
                plan.current ? "ring-2 ring-indigo-600" : ""
              }`}
            >
              {plan.current && (
                <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Current Plan
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  {plan.name}
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900">
                  {billingCycle === "monthly"
                    ? plan.monthlyPrice
                    : plan.yearlyPrice}
                </span>
                <span className="text-slate-500 font-medium">
                  {plan.period}
                </span>
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
                onClick={() => {
                  if (!user) {
                    // If no user, redirect to login/signup
                    onBack();
                  } else if (plan.id === "free") {
                    // Free plan - no Stripe checkout needed, just go back to dashboard
                    onBack();
                  } else if (plan.priceId) {
                    // Paid plans - create Stripe checkout session
                    handleUpgrade(plan.priceId);
                  }
                }}
                disabled={plan.current || loadingPriceId !== null}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${
                  plan.current
                    ? "bg-slate-100 text-slate-400 cursor-default"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {loadingPriceId && loadingPriceId === plan.priceId ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : plan.current ? (
                  "Current Plan"
                ) : plan.id === "free" ? (
                  user ? (
                    "Already on Free Plan"
                  ) : (
                    "Get Started Free"
                  )
                ) : (
                  "Upgrade"
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
