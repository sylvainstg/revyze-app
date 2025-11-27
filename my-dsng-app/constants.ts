import { PricingPlan, UserRole } from './types';

export const APP_NAME = "DesignSync AI";
// Limit file size to 6MB
export const MAX_FILE_SIZE_MB = 6;

// Storage Keys for "Local Database"
export const STORAGE_KEYS = {
  CURRENT_SESSION: 'designsync_session', // Who is logged in right now
  USERS_DB: 'designsync_db_users',       // Table of all registered users
  PROJECTS_DB: 'designsync_db_projects'  // Table of all projects
};

// Google SSO Configuration
// Leave this empty to use "Private Offline Mode". 
// Real Google Auth requires a verified domain (not a sandbox/blob URL).
export const GOOGLE_CLIENT_ID = '';

// PDF Worker version matching react-pdf v9.1.1 (which uses pdfjs-dist v4.4.168)
export const PDF_WORKER_URL = `https://aistudiocdn.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

export const SAMPLE_PROJECT_ID = 'sample-project';

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    limits: {
      totalProjects: 10,
      ownedProjects: 1,
      storageMB: 50,
      collaborators: 0,
      aiAnalysis: 5
    },
    features: ['1 Project', '50MB Storage', 'Community Support', '5 AI Analyses/mo'],
    price: { monthly: '$0', yearly: '$0' }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For professional designers',
    limits: {
      totalProjects: Infinity,
      ownedProjects: Infinity,
      storageMB: 10240, // 10GB
      collaborators: Infinity,
      aiAnalysis: Infinity
    },
    trialLimits: {
      totalProjects: Infinity,
      ownedProjects: Infinity,
      storageMB: 10240, // 10GB
      collaborators: 0, // Trial users cannot invite
      aiAnalysis: Infinity
    },
    features: ['Unlimited Projects', '10GB Storage', 'Unlimited Collaborators', 'Unlimited AI Analysis', 'Priority Support'],
    price: { monthly: '$15', yearly: '$150' }
  },
  business: {
    id: 'business',
    name: 'Corporate',
    description: 'For teams and agencies',
    limits: {
      totalProjects: Infinity,
      ownedProjects: Infinity,
      storageMB: 102400, // 100GB
      collaborators: Infinity,
      aiAnalysis: Infinity
    },
    features: ['Everything in Pro', '100GB Storage', 'Dedicated Support', 'SSO (Coming Soon)', 'Audit Logs'],
    price: { monthly: '$50', yearly: '$500' }
  }
};

export const PLAN_LIMITS = {
  free: PLANS.free.limits,
  pro: PLANS.pro.limits,
  business: PLANS.business.limits
};

// Get effective limits based on plan and subscription status
export const getEffectiveLimits = (plan: 'free' | 'pro' | 'business', subscriptionStatus?: string) => {
  if (plan === 'pro' && subscriptionStatus === 'trialing') {
    return PLANS.pro.trialLimits;
  }
  return PLAN_LIMITS[plan];
};

export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';
export const GEMINI_MODEL_PRO = 'gemini-3-pro-preview';

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Starter',
    price: '$0',
    period: 'forever',
    targetRole: UserRole.HOMEOWNER,
    features: [
      '1 Owned Project',
      'Up to 10 Total Projects',
      'Unlimited Comments',
      'Basic Collaboration',
      'Standard Support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Subscription',
    price: '$10',
    period: '/month',
    targetRole: UserRole.DESIGNER,
    popular: true,
    features: [
      'Unlimited Projects',
      'AI Design Analysis',
      'AI Feedback Summaries',
      'Version History',
      'Priority Support'
    ]
  }
];