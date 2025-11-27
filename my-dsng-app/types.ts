export enum UserRole {
  HOMEOWNER = 'Homeowner',
  DESIGNER = 'Designer'
}

export type ViewState = 'landing' | 'auth' | 'checkout' | 'dashboard' | 'workspace' | 'pricing' | 'thank-you';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan?: 'free' | 'pro' | 'business';
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing';
  isAdmin?: boolean;
}

export interface CommentReply {
  id: string;
  text: string;
  author: UserRole;
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
  replies?: CommentReply[];
}

export interface ProjectVersion {
  id: string;
  versionNumber: number;
  fileUrl: string; // Data URL or Object URL
  fileName: string;
  uploadedBy: UserRole;
  timestamp: number;
  comments: Comment[];
}

export interface ShareSettings {
  enabled: boolean;
  accessLevel: 'view' | 'comment';
  shareToken: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  ownerId: string;
  ownerEmail: string;
  collaborators: string[];
  versions: ProjectVersion[];
  currentVersionId: string;
  createdAt: number;
  lastModified: number;
  shareSettings?: ShareSettings;
  thumbnailUrl?: string; // Captured image URL for project thumbnail
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