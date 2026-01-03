import { Timestamp } from "firebase/firestore";

export type CampaignType = "nps" | "csat" | "free_text" | "multiple_choice";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type SegmentType = "power_users" | "at_risk_pros" | "new_users" | "all";
export type ConversionType =
  | "upgrade"
  | "project_created"
  | "invite_sent"
  | "retention";

export interface CampaignVariant {
  id: string;
  question: string;
  choices?: string[]; // For multiple_choice type
  weight: number; // 0-100, total across variants should be 100
}

export interface FeedbackCampaign {
  id: string;
  name: string;
  description: string;
  question: string;
  type: CampaignType;
  choices?: string[]; // For multiple_choice (if no variants)
  segmentType: SegmentType;
  status: CampaignStatus;

  // A/B Testing
  variants?: CampaignVariant[];

  // Timing
  activeFrom: Timestamp | Date;
  activeUntil: Timestamp | Date;
  frequencyCapDays: number; // Default 14
  emailFollowUpHours: number; // Default 120 (5 days)

  // Attribution
  attributionWindowDays: number; // Days to track conversions (default 30)

  // Metadata
  createdAt: Timestamp | Date;
  createdBy: string;
  updatedAt: Timestamp | Date;
}

export interface CampaignConversion {
  type: ConversionType;
  timestamp: Timestamp | Date;
  value?: number; // Revenue if applicable
  metadata?: any;
}

export interface CampaignAttribution {
  id: string;
  campaignId: string;
  userId: string;

  // Response
  shownAt: Timestamp | Date;
  answeredAt?: Timestamp | Date;
  answer?: any;
  variantId?: string; // For A/B testing

  // Attribution
  conversions: CampaignConversion[];
  totalValue: number; // Calculated attribution value

  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface CampaignAnalytics {
  campaignId: string;

  // Overall metrics
  impressions: number;
  responses: number;
  responseRate: number; // responses / impressions
  dismissals: number;

  // Email metrics
  emailsSent: number;
  emailsClicked: number;
  emailClickRate: number;

  // Attribution
  totalConversions: number;
  totalAttributedValue: number;
  averageValuePerResponse: number;

  // A/B Testing (if variants exist)
  variantPerformance?: Array<{
    variantId: string;
    impressions: number;
    responses: number;
    responseRate: number;
    averageValue: number;
  }>;

  // Time-based
  averageTimeToAnswer?: number; // seconds

  updatedAt: Timestamp | Date;
}

export interface FeedbackAnswer {
  campaignId: string;
  variantId?: string;
  answer: any;
  timestamp: number;
}

// For Remote Config delivery
export interface RemoteConfigCampaign {
  id: string;
  question: string;
  type: CampaignType;
  choices?: string[];
  variant?: {
    id: string;
    question: string;
    choices?: string[];
  };
}
