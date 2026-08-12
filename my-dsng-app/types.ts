export enum UserRole {
  HOMEOWNER = "Homeowner",
  DESIGNER = "Designer",
}

export type ViewState =
  | "landing"
  | "auth"
  | "checkout"
  | "dashboard"
  | "workspace"
  | "pricing"
  | "thank-you"
  | "admin"
  | "onboarding"
  | "cemetery";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan?: "free" | "pro" | "business";
  subscriptionStatus?: "active" | "canceled" | "past_due" | "trialing";
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
  // Display preferences
  lengthSystem?: LengthSystem; // "metric" | "imperial", default "metric"
  // Notifications
  notificationPreferences?: {
    mentions: "instant" | "daily" | "weekly" | "none";
    projectUpdates: "instant" | "daily" | "weekly" | "none";
  };
  digestSettings?: {
    timezone: string;
    dailyTime: string; // e.g., "09:00"
    weeklyDay: number; // 0 = Sunday, 1 = Monday, etc.
  };
  targetedCampaignId?: string; // Manually assigned campaign
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
export type CommentAudience = "guest-owner" | "pro-owner" | "public";

// Project-specific role (different from UserRole)
export type ProjectRole = "owner" | "guest" | "professional";

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
  type: "image" | "text" | "link";
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

// --- Furniture Layer ---

export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft";
export type LengthSystem = "metric" | "imperial";

// Project-wide scale calibration. Furniture is stored in cm; this is how we
// convert cm to/from page-percent at render time.
export interface ProjectScale {
  // cm per pixel on the rendered PDF page at native (scale=1) render.
  // Derived from two-click calibration assuming isotropic scaling.
  cmPerPx: number;
  // Page natural pixel dims at calibration time (scale=1). Used to convert
  // cm <-> page-percent without depending on current zoom.
  pageWidthPx: number;
  pageHeightPx: number;
  // The two reference points the user clicked, kept for re-calibration UX.
  calibrationLine: {
    pointA: { x: number; y: number }; // page-percent
    pointB: { x: number; y: number }; // page-percent
    pageNumber: number;
  };
  // What the user typed during calibration (source of truth for display).
  calibratedDistance: number;
  calibratedUnit: LengthUnit;
  calibratedAt: number;
  calibratedBy: string; // user id
}

export type FurnitureSource = "library" | "upload" | "url" | "search";

export interface FurnitureItem {
  id: string;
  pageNumber: number;
  // Center position of the item in cm, measured from the page top-left.
  // Center (not corner) so rotation pivots intuitively.
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  rotation: number; // degrees, 0–360, clockwise
  zIndex: number;

  source: FurnitureSource;
  // Always a Firebase Storage URL once persisted (we never hotlink).
  imageUrl: string;
  thumbnailUrl?: string;

  label?: string;
  note?: string;
  category?: string;
  libraryItemId?: string; // if source === "library"
  searchQuery?: string; // if source === "search"
  attribution?: { source: string; pageUrl?: string };
  backgroundRemoved?: boolean;

  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

// --- Wall Change Layer ---
// Ad-hoc wall changes a Designer draws on top of a plan version to
// communicate to the GC. Scoped per ProjectVersion, same as FurnitureItem,
// so switching versions naturally switches the change layer too.

export interface WallItem {
  id: string;
  pageNumber: number;
  // Endpoints in cm, measured from the page top-left.
  x1Cm: number;
  y1Cm: number;
  x2Cm: number;
  y2Cm: number;
  thicknessCm: number;
  zIndex: number;

  label?: string;
  note?: string;

  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

// A white-out rectangle used to mask obsolete plan content under a wall
// change, so the reader isn't confused by overlapping old/new geometry.
// Same center/size/rotation shape as FurnitureItem so it reuses
// cmToPagePercent and the existing drag/resize/rotate math as-is.
export interface MaskItem {
  id: string;
  pageNumber: number;
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  rotation: number; // degrees, 0–360, clockwise
  zIndex: number;

  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

// A canned architectural symbol (door, and later window/others) placed on
// top of a wall change. Kept as a single type with a `kind` discriminator
// rather than one interface per symbol so adding new canned elements later
// is just a new `kind` value, not a new component/interface.
export type CannedElementKind = "door";

export interface ElementItem {
  id: string;
  pageNumber: number;
  kind: CannedElementKind;
  // Center, in cm, measured from the page top-left.
  xCm: number;
  yCm: number;
  widthCm: number; // opening width — the only resizable dimension
  thicknessCm: number; // matches the wall it sits in
  rotation: number; // degrees, 0–360, clockwise
  flipX: boolean; // mirrors which side the hinge is on
  flipY: boolean; // mirrors which side of the wall the symbol swings into
  zIndex: number;

  label?: string;
  note?: string;

  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
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
  furnitureItems?: FurnitureItem[];
  wallItems?: WallItem[];
  maskItems?: MaskItem[];
  elementItems?: ElementItem[];
}

export interface ShareSettings {
  enabled: boolean;
  accessLevel: "view" | "comment";
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
  scale?: ProjectScale; // Calibrated real-world scale for furniture placement
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
export type FeatureId =
  | "ai-summary"
  | "advanced-collaboration"
  | "version-comparison";

export type VoteInterest = "not-interested" | "interested" | "very-interested";

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
export type ReferralStatus = "pending" | "converted" | "expired";

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

export type TransactionType = "earned" | "redeemed" | "expired";

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
