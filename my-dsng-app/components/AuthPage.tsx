import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { UserRole, User } from '../types';
import { Layout, ArrowLeft, Shield, AlertCircle, Cloud } from 'lucide-react';
import * as authService from '../services/authService';
import { applyReferralCode } from '../services/referralService';

interface AuthPageProps {
  onAuthSuccess: (user: User, isNewUser: boolean) => void;
  onBack: () => void;
  initialMode?: 'login' | 'register';
  inviterName?: string;
  projectName?: string;
  inviteRole?: 'guest' | 'pro';
  inviteeName?: string;
  inviteeEmail?: string;
  referralCode?: string;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess, onBack, initialMode = 'register', inviterName, projectName, inviteRole, inviteeName, inviteeEmail, referralCode }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  // Determine initial role based on invite
  const initialRole = inviteRole === 'pro' ? UserRole.DESIGNER : UserRole.HOMEOWNER;
  const [role, setRole] = useState<UserRole>(initialRole);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const [formData, setFormData] = useState({
    name: inviteeName || '',
    email: inviteeEmail || '',
    password: ''
  });

  // ... (handlers) ...

  const handleForgotPassword = async () => {
    // ... (existing code)
    if (!formData.email) {
      setError("Please enter your email address first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await authService.resetPassword(formData.email);
    setIsLoading(false);

    if (result.success) {
      setResetSent(true);
      setError(null);
    } else {
      setError(result.message || "Failed to send reset email.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    // ... (existing code)
    e.preventDefault();
    setError(null);
    setResetSent(false);

    // Client-side validation
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        // LOGIN LOGIC
        const result = await authService.loginUser(formData.email, formData.password);
        if (result.success && result.user) {
          onAuthSuccess(result.user, false);
        } else {
          setError(result.message || "Login failed");
          setIsLoading(false);
        }
      } else {
        // REGISTER LOGIC
        // Determine plan based on invite role
        let plan: 'free' | 'pro' = 'free';
        let subscriptionStatus: 'active' | 'trialing' | undefined = 'active';

        if (inviteRole === 'pro') {
          plan = 'pro';
          subscriptionStatus = 'trialing'; // Pro invitees get trial status
        }

        const result = await authService.registerUser(
          formData.name || formData.email, // Use provided name or email
          formData.email,
          formData.password,
          role,
          plan,
          subscriptionStatus
        );

        if (result.success && result.user) {
          // Apply referral code if present
          if (referralCode) {
            try {
              await applyReferralCode(referralCode);
              console.log('Referral code applied successfully');
            } catch (error) {
              console.error('Failed to apply referral code:', error);
              // Don't block registration if referral fails
            }
          }

          onAuthSuccess(result.user, true);
        } else {
          setError(result.message || "Registration failed");
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-100/50 blur-3xl"></div>
        <div className="absolute top-[20%] -left-[10%] w-[30%] h-[30%] rounded-full bg-purple-100/50 blur-3xl"></div>
      </div>

      <div className="absolute top-6 left-6 z-10">
        <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 z-10 border border-slate-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
          </div>

          {inviteeName && !isLogin ? (
            <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100 animate-in fade-in zoom-in-95 duration-300">
              <h1 className="text-2xl font-bold text-indigo-900 mb-2">
                Hi {inviteeName}! 👋
              </h1>
              <p className="text-indigo-700 text-sm leading-relaxed">
                <span className="font-semibold">{inviterName}</span> has invited you to collaborate on <span className="font-semibold">{projectName}</span>.
              </p>
              <div className="mt-4 pt-4 border-t border-indigo-100 text-xs font-medium text-indigo-600 uppercase tracking-wide">
                Create your account to join them
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isLogin ? 'Welcome back' : 'Create Account'}
              </h1>
              <p className="text-slate-500 mt-2 text-sm">
                {isLogin ? 'Access your cloud projects.' :
                  (inviterName && projectName) ? (
                    <span className="block mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-900">
                      <span className="font-semibold">{inviterName}</span> invited you to join <span className="font-semibold">{projectName}</span>
                      {inviteRole && <span> as a <span className="font-bold uppercase">{inviteRole === 'pro' ? 'Professional' : 'Guest'}</span></span>}.
                      <span className="block mt-1 text-xs text-indigo-700">Create your account below to get started.</span>
                    </span>
                  ) : 'Create a secure environment for your designs.'}
              </p>
            </>
          )}
        </div>

        {!isLogin && !inviteRole && (
          <div className="grid grid-cols-2 gap-3 mb-6 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setRole(UserRole.HOMEOWNER)}
              className={`text-sm font-medium py-2 rounded-md transition-all ${role === UserRole.HOMEOWNER ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Homeowner
            </button>
            <button
              type="button"
              onClick={() => setRole(UserRole.DESIGNER)}
              className={`text-sm font-medium py-2 rounded-md transition-all ${role === UserRole.DESIGNER ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Professional
            </button>
          </div>
        )}

        <div className="space-y-4">

          {/* Info Box explaining the mode */}
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-100 p-3 rounded-lg border border-slate-200">
            <Cloud className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 mb-0.5">Secure Cloud Storage</p>
              <p>Your account and projects are stored securely in the cloud. Log in from any device to access them.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />

            {isLogin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {error && (
              <div className="text-red-500 text-sm flex items-center gap-2 bg-red-50 p-2 rounded border border-red-100">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {resetSent && (
              <div className="text-green-600 text-sm flex items-center gap-2 bg-green-50 p-2 rounded border border-green-100">
                <AlertCircle className="w-4 h-4" />
                Password reset email sent! Check your inbox.
              </div>
            )}

            <Button type="submit" className="w-full mt-2" size="lg" isLoading={isLoading}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center space-y-4">
          <p className="text-sm text-slate-600">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setResetSent(false);
                setFormData({ name: '', email: '', password: '' });
              }}
              className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};