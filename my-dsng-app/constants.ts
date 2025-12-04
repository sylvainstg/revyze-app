import { PricingPlan, UserRole } from './types';

export const DEFAULT_CATEGORY = 'Architectural';

export const STANDARD_CATEGORIES = [
  'Architectural',
  'Structural',
  'Electrical',
  'Plumbing',
  'Mechanical',
  'Landscaping',
  'Interior',
  'Other'
];

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


// Plan metadata (everything except pricing, which comes from Stripe)
export const PLAN_METADATA = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    stripeProductId: null, // Free plan has no Stripe product
    limits: {
      totalProjects: 10,
      ownedProjects: 1,
      storageMB: 50,
      collaborators: 0,
      aiAnalysis: 5
    },
    features: ['1 Project', '50MB Storage', 'Community Support', '5 AI Analyses/mo']
    // price will be added at runtime from Stripe (always $0 for free)
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For professional designers',
    stripeProductId: 'pro_plan', // Maps to Stripe product
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
    features: ['Unlimited Projects', '10GB Storage', 'Unlimited Collaborators', 'Unlimited AI Analysis', 'Priority Support']
    // price will be added at runtime from Stripe
  },
  business: {
    id: 'business',
    name: 'Corporate',
    description: 'For teams and agencies',
    stripeProductId: 'corporate_plan', // Maps to Stripe product
    limits: {
      totalProjects: Infinity,
      ownedProjects: Infinity,
      storageMB: 102400, // 100GB
      collaborators: Infinity,
      aiAnalysis: Infinity
    },
    features: ['Everything in Pro', '100GB Storage', 'Dedicated Support', 'SSO (Coming Soon)', 'Audit Logs']
    // price will be added at runtime from Stripe
  }
};

// For backward compatibility, export PLANS as PLAN_METADATA
// This will be removed once all components are updated
export const PLANS = PLAN_METADATA;


export const PLAN_LIMITS = {
  free: PLAN_METADATA.free.limits,
  pro: PLAN_METADATA.pro.limits,
  business: PLAN_METADATA.business.limits
};

// Get effective limits based on plan and subscription status
export const getEffectiveLimits = (plan: 'free' | 'pro' | 'business', subscriptionStatus?: string) => {
  if (plan === 'pro' && subscriptionStatus === 'trialing') {
    return PLAN_METADATA.pro.trialLimits;
  }
  return PLAN_LIMITS[plan];
};

export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';
export const GEMINI_MODEL_PRO = 'gemini-3-pro-preview';


// Helper function to derive checkout pricing from PLAN_METADATA
// NOTE: This will be deprecated once we fetch pricing from Stripe at runtime
export const getPricingPlansForCheckout = (): PricingPlan[] => {
  return [
    {
      id: PLAN_METADATA.free.id,
      name: 'Starter',
      price: '$0', // Hardcoded for now, will be replaced with Stripe pricing
      period: 'forever',
      targetRole: UserRole.HOMEOWNER,
      features: PLAN_METADATA.free.features
    },
    {
      id: PLAN_METADATA.pro.id,
      name: 'Pro Subscription',
      price: '$10', // Hardcoded for now, will be replaced with Stripe pricing
      period: '/month',
      targetRole: UserRole.DESIGNER,
      popular: true,
      features: PLAN_METADATA.pro.features
    }
  ];
};