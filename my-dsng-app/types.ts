export enum UserRole {
  HOMEOWNER = 'Homeowner',
  DESIGNER = 'Designer'
}

export type ViewState = 'landing' | 'auth' | 'checkout' | 'dashboard' | 'workspace' | 'pricing' | 'thank-you' | 'admin' | 'onboarding' | 'cemetery';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan?: 'free' | 'pro' | 'business';
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripeCustomerId?: string;
  isAdmin?: boolean;
  // Engagement Metrics
  loginCount?: number;
  lastLogin?: number;
  previousLogin?: number; // Timestamp of the login before the current one
  shareCountGuest?: number;
  shareCountPro?: number;
  projectCount?: number;
  commentCount?: number;
  engagementScore?: number; // 0-100 score
  createdAt?: number; // Account creation timestamp
  lastSessionDuration?: number; // ms
  // Referral Program
  referralCode?: string;
  referredBy?: string;
  tokenBalance?: number;
  totalReferrals?: number;
  hasCompletedOnboarding?: boolean;
  // Notifications
  notificationPreferences?: {
    mentions: 'instant' | 'daily' | 'weekly' | 'none';
    projectUpdates: 'instant' | 'daily' | 'weekly' | 'none';
  };
  digestSettings?: {
    timezone: string;
    dailyTime: string; // e.g., "09:00"
    weeklyDay: number; // 0 = Sunday, 1 = Monday, etc.
  };
}

export interface CommentReply {
  id: string;
  text: string;
  author: UserRole;
  authorName?: string;
  mentions?: string[]; // Array of User IDs mentioned in this reply
  timestamp: number;
}

// Comment audience determines who can see it
export type CommentAudience = 'guest-owner' | 'pro-owner' | 'public';

// Project-specific role (different from UserRole)
export type ProjectRole = 'owner' | 'guest' | 'professional';

export interface Comment {
  id: string;
  x: number; // Percentage relative to page width
  y: number; // Percentage relative to page height
  pageNumber: number; // The page this comment belongs to
  text: string;
  author: UserRole;
  authorName?: string; // For guests: their name, for logged-in: email
  audience: CommentAudience; // Who can see this comment
  pushedFromGuestComment?: string; // If this was pushed from a guest comment, store original ID
  timestamp: number;
  aiAnalysis?: string; // Optional AI analysis of the pinned area
  resolved: boolean;
  deleted?: boolean; // Soft delete flag
  mentions?: string[]; // Array of User IDs mentioned in this comment
  replies?: CommentReply[];
}

export interface MoodBoardElement {
  id: string;
  type: 'image' | 'text' | 'link';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // URL for image/link, or text for bubble
  title?: string; // Optional title for links
  ownerId: string;
  ownerName: string;
  timestamp: number;
}


export interface ProjectVersion {
  id: string;
  versionNumber: number; // Global version number across all categories
  name?: string;
  category: string; // Document category: 'Structural', 'Electrical', 'Plumbing', etc.
  categoryVersionNumber: number; // Version number within this category
  fileUrl: string; // Data URL or Object URL
  fileName: string;
  uploadedBy: UserRole;
  uploaderEmail?: string;
  timestamp: number;
  comments: Comment[];
  moodBoardElements?: MoodBoardElement[];
}

export interface ShareSettings {
  enabled: boolean;
  accessLevel: 'view' | 'comment';
  shareToken: string;
}

export interface CategorySettings {
  defaultPage?: number;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  collaborators: string[];
  versions: ProjectVersion[];
  currentVersionId: string;
  activeCategory?: string; // Currently selected document category
  categorySettings?: Record<string, CategorySettings>; // Settings per category
  zoomLevel?: number; // User's preferred zoom level for this project (default 1.0)
  createdAt: number;
  lastModified: number;
  shareSettings?: ShareSettings;
  thumbnailUrl?: string; // Captured image URL for project thumbnail
  deletedAt?: number; // Timestamp when project was soft-deleted
  deletedBy?: string; // User ID who deleted the project
}

// Gemini API related types
export interface AIAnalysisRequest {
  imageData: string; // Base64 image of the specific cropped area
  prompt?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period?: string;
  features: string[];
  targetRole: UserRole;
  popular?: boolean;
}

// Feature Voting
export type FeatureId = 'ai-summary' | 'advanced-collaboration' | 'version-comparison';

export type VoteInterest = 'not-interested' | 'interested' | 'very-interested';

export interface FeatureVote {
  id: string;
  userId: string;
  featureId: FeatureId;
  interest: VoteInterest;
  valueRating: number; // 1-5
  timestamp: number;
  userRole: UserRole;
  userEmail?: string;
}

// Referral and Fidelity Program Types
export type ReferralStatus = 'pending' | 'converted' | 'expired';

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referralCode: string;
  status: ReferralStatus;
  createdAt: number;
  convertedAt?: number;
  rewardAmount?: number;
  expiresAt: number;
}

export type TransactionType = 'earned' | 'redeemed' | 'expired';

export interface RewardTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  timestamp: number;
  relatedReferralId?: string;
  relatedFeatureId?: string;
}

export interface FeatureCost {
  id: string;
  featureName: string;
  description: string;
  tokenCost: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  pendingReferrals: number;
  convertedReferrals: number;
  expiredReferrals: number;
  tokenBalance: number;
  lifetimeEarnings: number;
  recentTransactions: RewardTransaction[];
}

export interface ReferralConstants {
  tokensPerReferral: number;
  referralExpirationDays: number;
  minimumRedemption: number;
}
