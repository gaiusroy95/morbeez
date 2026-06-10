export type RecommendationProduct = {
  title: string;
  quantity?: number;
  variantId?: string | null;
  shopifyHandle?: string | null;
};

export type FarmerRecommendation = {
  id: string;
  kind: 'technical' | 'product';
  title: string;
  blockName: string | null;
  cropName: string;
  dateLabel: string;
  bullets: string[];
  dosage: string | null;
  waterRequirement: string | null;
  applicationTiming: string | null;
  followUpDate: string | null;
  expectedRecoveryDays: number | null;
  applicationMethod: string | null;
  status: string;
  products: RecommendationProduct[];
  appliedAt: string | null;
};

export type RecommendationDetail = FarmerRecommendation & {
  applicationSteps: string[];
  recoveryTimeline: string | null;
};
