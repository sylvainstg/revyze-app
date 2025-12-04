import React, { useState } from 'react';
import { Button } from './ui/Button';
import { UserRole } from '../types';
import { CheckCircle, ArrowRight, Layout, Users, ShieldCheck, Sparkles, Menu, X, MessageSquare, Share2, FileText, UserPlus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LandingPageProps {
  enrichedPlans: any | null;
  pricingLoading: boolean;
  onGetStarted: () => void;
  onLogin: () => void;
  onPricingClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ enrichedPlans, pricingLoading, onGetStarted, onLogin, onPricingClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'client' | 'pro'>('client');
  const { t } = useTranslation();

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
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">{t('nav.features')}</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">{t('nav.how_it_works')}</a>
              <button onClick={onPricingClick} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">{t('nav.pricing')}</button>
              <div className="flex items-center gap-4 ml-4">
                <LanguageSwitcher />
                <button onClick={onLogin} className="text-sm font-semibold text-slate-900 hover:text-indigo-600">{t('nav.login')}</button>
                <Button onClick={onGetStarted} size="sm">{t('nav.get_started')}</Button>
              </div>
            </div>

            <div className="md:hidden flex items-center gap-4">
              <LanguageSwitcher />
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
            {t('hero.new_feature')}
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-tight">
            {t('hero.title_prefix')} <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{t('hero.title_suffix')}</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={onGetStarted} size="lg" className="w-full sm:w-auto shadow-lg shadow-indigo-500/20">
              {t('hero.cta')}
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

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">{t('how_it_works.title')}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t('how_it_works.subtitle')}</p>

            {/* Toggle */}
            <div className="mt-8 inline-flex bg-slate-100 p-1 rounded-full">
              <button
                onClick={() => setActiveTab('client')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'client'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {t('how_it_works.client_led')}
              </button>
              <button
                onClick={() => setActiveTab('pro')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'pro'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {t('how_it_works.pro_led')}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Visual Side */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100 to-purple-100 rounded-3xl transform rotate-3"></div>
              <div className="relative bg-white border border-slate-100 rounded-3xl shadow-xl p-8 min-h-[400px] flex flex-col justify-center">
                {activeTab === 'client' ? (
                  <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{t('how_it_works.client.upload_title')}</h4>
                        <p className="text-sm text-slate-600 mt-1">{t('how_it_works.client.upload_desc')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{t('how_it_works.client.comment_title')}</h4>
                        <p className="text-sm text-slate-600 mt-1">{t('how_it_works.client.comment_desc')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{t('how_it_works.client.share_title')}</h4>
                        <p className="text-sm text-slate-600 mt-1">{t('how_it_works.client.share_desc')}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{t('how_it_works.pro.invite_title')}</h4>
                        <p className="text-sm text-slate-600 mt-1">{t('how_it_works.pro.invite_desc')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{t('how_it_works.pro.collab_title')}</h4>
                        <p className="text-sm text-slate-600 mt-1">{t('how_it_works.pro.collab_desc')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{t('how_it_works.pro.resolve_title')}</h4>
                        <p className="text-sm text-slate-600 mt-1">{t('how_it_works.pro.resolve_desc')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Content Side */}
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                {activeTab === 'client' ? t('how_it_works.client.section_title') : t('how_it_works.pro.section_title')}
              </h3>
              <div className="space-y-8">
                {activeTab === 'client' ? (
                  <>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">{t('how_it_works.client.step1_title')}</h4>
                      <p className="text-slate-600 leading-relaxed">
                        {t('how_it_works.client.step1_desc')}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">{t('how_it_works.client.step2_title')}</h4>
                      <p className="text-slate-600 leading-relaxed">
                        {t('how_it_works.client.step2_desc')}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">{t('how_it_works.pro.step1_title')}</h4>
                      <p className="text-slate-600 leading-relaxed">
                        {t('how_it_works.pro.step1_desc')}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">{t('how_it_works.pro.step2_title')}</h4>
                      <p className="text-slate-600 leading-relaxed">
                        {t('how_it_works.pro.step2_desc')}
                      </p>
                    </div>
                  </>
                )}
                <Button onClick={onGetStarted} variant="outline" className="mt-4">
                  {activeTab === 'client' ? t('how_it_works.client.cta') : t('how_it_works.pro.cta')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">{t('features.title')}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t('features.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <CheckCircle className="w-6 h-6 text-indigo-600" />,
                title: t('features.f1_title'),
                description: t('features.f1_desc')
              },
              {
                icon: <Users className="w-6 h-6 text-purple-600" />,
                title: t('features.f2_title'),
                description: t('features.f2_desc')
              },
              {
                icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
                title: t('features.f3_title'),
                description: t('features.f3_desc')
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

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Choose the plan that fits your needs. Start free, upgrade anytime.</p>
          </div>

          {pricingLoading || !enrichedPlans ? (
            // Loading skeleton
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border-2 border-slate-200 p-8 animate-pulse">
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
          ) : (
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Free Plan */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 hover:border-indigo-200 hover:shadow-lg transition-all">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{enrichedPlans.free.name}</h3>
                <p className="text-slate-600 text-sm mb-6">{enrichedPlans.free.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">{enrichedPlans.free.price?.monthly || '$0'}</span>
                  <span className="text-slate-500 ml-2">forever</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {enrichedPlans.free.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={onGetStarted} variant="outline" className="w-full">Get Started Free</Button>
              </div>

              {/* Pro Plan */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 text-white relative transform scale-105 shadow-2xl">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-slate-900 text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                  Most Popular
                </div>
                <h3 className="text-xl font-bold mb-2">{enrichedPlans.pro.name}</h3>
                <p className="text-indigo-100 text-sm mb-6">{enrichedPlans.pro.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">{enrichedPlans.pro.price?.monthly || '...'}</span>
                  <span className="text-indigo-100 ml-2">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {enrichedPlans.pro.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-white">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={onPricingClick} className="w-full bg-white text-indigo-600 hover:bg-indigo-50">Start Pro Trial</Button>
              </div>

              {/* Corporate Plan */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 hover:border-indigo-200 hover:shadow-lg transition-all">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{enrichedPlans.business.name}</h3>
                <p className="text-slate-600 text-sm mb-6">{enrichedPlans.business.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">{enrichedPlans.business.price?.monthly || '...'}</span>
                  <span className="text-slate-500 ml-2">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {enrichedPlans.business.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={onPricingClick} variant="outline" className="w-full">Contact Sales</Button>
              </div>
            </div>
          )}
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