import React, { useState } from 'react';
import { UserRole } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Check, Lock, CreditCard, Loader2 } from 'lucide-react';
import { PRICING_PLANS } from '../constants';

interface CheckoutPageProps {
  userRole: UserRole;
  onSuccess: (planId: string) => void;
  onBack: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ userRole, onSuccess, onBack }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [step, setStep] = useState<'plans' | 'payment'>('plans');
  const [isProcessing, setIsProcessing] = useState(false);

  // Use hardcoded pricing from constants
  const plans = PRICING_PLANS;

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const handlePlanSelect = (id: string) => {
    setSelectedPlanId(id);
  };

  const handleContinue = () => {
    if (!selectedPlanId) return;

    // If plan is Free ($0), skip payment and complete immediately
    if (selectedPlan?.price === '$0') {
      onSuccess(selectedPlanId);
    } else {
      setStep('payment');
    }
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess(selectedPlanId);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src="/revyze-logo.png" alt="Revyze" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            {step === 'plans' ? 'Select a Plan' : 'Secure Checkout'}
          </h1>
          <p className="text-slate-600 mt-2">
            {step === 'plans'
              ? `Choose the option that best fits your needs.`
              : `Complete your subscription for the ${selectedPlan?.name} plan.`}
          </p>
        </div>

        {step === 'plans' ? (
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-sm p-8 border-2 cursor-pointer transition-all hover:shadow-lg ${selectedPlanId === plan.id ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-transparent hover:border-indigo-200'}`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                  {plan.period && <span className="text-slate-500 ml-1 text-sm">{plan.period}</span>}
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className={`w-full h-2 rounded-full bg-slate-100 overflow-hidden ${selectedPlanId === plan.id ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="h-full bg-indigo-600 w-full animate-pulse"></div>
                </div>

                {/* Plan selection indicator */}
                <div className="mt-6 w-full">
                  <Button
                    variant={selectedPlanId === plan.id ? 'primary' : 'secondary'}
                    className="w-full pointer-events-none"
                  >
                    {selectedPlanId === plan.id ? 'Selected' : 'Select'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <p className="text-slate-400 text-sm">Total due today</p>
                <p className="text-2xl font-bold">{selectedPlan?.price}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{selectedPlan?.name}</p>
                <button onClick={() => setStep('plans')} className="text-xs text-indigo-300 hover:text-white underline">Change plan</button>
              </div>
            </div>
            <div className="p-8">
              <form onSubmit={handlePayment} className="space-y-4">
                <Input label="Cardholder Name" placeholder="Name on card" required />
                <Input label="Card Number" placeholder="0000 0000 0000 0000" icon={<CreditCard />} required />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Expiry Date" placeholder="MM/YY" required />
                  <Input label="CVC" placeholder="123" required />
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 my-4">
                  <Lock className="w-3 h-3" />
                  Payments are secure and encrypted.
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setStep('plans')} className="flex-1">
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" isLoading={isProcessing}>
                    Pay {selectedPlan?.price}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {step === 'plans' && (
          <div className="mt-8 flex justify-center gap-4">
            <Button variant="ghost" onClick={onBack}>Cancel</Button>
            <Button
              disabled={!selectedPlanId}
              onClick={handleContinue}
              size="lg"
              className="w-48"
            >
              {selectedPlan?.price === '$0' ? 'Complete Setup' : 'Continue'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};