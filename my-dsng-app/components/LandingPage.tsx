import React, { useState } from 'react';
import { Button } from './ui/Button';
import { UserRole } from '../types';
import { CheckCircle, ArrowRight, Layout, Users, ShieldCheck, Sparkles, Menu, X } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">How it Works</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Pricing</a>
              <div className="flex items-center gap-4 ml-4">
                <button onClick={onLogin} className="text-sm font-semibold text-slate-900 hover:text-indigo-600">Log in</button>
                <Button onClick={onGetStarted} size="sm">Get Started</Button>
              </div>
            </div>

            <div className="md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-600">
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/50 via-white to-white -z-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wide mb-6">
            <Sparkles className="w-3 h-3" />
            Now with Gemini 2.5 AI Analysis
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-tight">
            Harmonize Your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Home Design Process</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop the email chaos. Revyze connects homeowners and designers on one intelligent platform where feedback is visual, contextual, and crystal clear.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={onGetStarted} size="lg" className="w-full sm:w-auto shadow-lg shadow-indigo-500/20">
              Start Your Project
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>

          {/* Hero Image / Mockup */}
          <div className="mt-20 relative mx-auto max-w-5xl rounded-xl bg-slate-900/5 p-2 ring-1 ring-inset ring-slate-900/10 lg:rounded-2xl lg:p-4">
            <div className="rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/5 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop"
                alt="App Interface Mockup"
                className="w-full h-auto opacity-90"
              />
              <div className="absolute bottom-10 left-10 right-10 bg-white/95 backdrop-blur p-6 rounded-lg shadow-xl border border-slate-100 max-w-lg mx-auto hidden md:block">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">D</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Designer</p>
                    <p className="text-slate-600 text-sm mt-1">"I've updated the kitchen layout based on your request. Check the island dimensions."</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Revyze?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">We bridge the gap between technical drawings and living spaces.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <CheckCircle className="w-6 h-6 text-indigo-600" />,
                title: "Contextual Feedback",
                description: "Pin comments directly on the floor plan. No more 'top left corner' confusion."
              },
              {
                icon: <Users className="w-6 h-6 text-purple-600" />,
                title: "Seamless Collaboration",
                description: "Invite designers, contractors, and family members to review the same version."
              },
              {
                icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
                title: "Version Control",
                description: "Keep track of every revision. Never build from an outdated PDF again."
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-indigo-50 rounded-3xl p-10 relative">
              <div className="text-indigo-200 absolute top-6 left-6 text-6xl font-serif">"</div>
              <p className="relative z-10 text-lg text-indigo-900 font-medium italic mb-6">
                "Before Revyze, I spent hours deciphering email threads. Now, my clients pin exactly what they want changed. It's saved me 10 hours a week."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-200 rounded-full"></div>
                <div>
                  <p className="font-bold text-indigo-900">Sarah Jenkins</p>
                  <p className="text-sm text-indigo-700">Interior Architect</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-3xl p-10 relative">
              <div className="text-slate-200 absolute top-6 left-6 text-6xl font-serif">"</div>
              <p className="relative z-10 text-lg text-slate-800 font-medium italic mb-6">
                "I felt overwhelmed by the blueprints. The AI explanation feature helped me understand what I was looking at so I could give real feedback."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div>
                  <p className="font-bold text-slate-900">Mark Thompson</p>
                  <p className="text-sm text-slate-600">Homeowner</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
            </div>
            <div className="flex gap-8 text-sm">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="mt-4 md:mt-0 text-sm text-slate-500">
              © 2025 Revyze. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};