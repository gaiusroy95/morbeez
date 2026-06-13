export const ISSUE_CATEGORIES = [
  'disease',
  'pest',
  'nutrient_deficiency',
  'water_stress',
  'weed',
  'other',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const BLOCK_HEALTH_LEVELS = ['good', 'average', 'need_assistance'] as const;
export type BlockHealthLevel = (typeof BLOCK_HEALTH_LEVELS)[number];

export const CROP_PERFORMANCE_LEVELS = [
  'above_expectation',
  'as_expected',
  'below_expectation',
] as const;
export type CropPerformanceLevel = (typeof CROP_PERFORMANCE_LEVELS)[number];

export const SOIL_MOISTURE_LEVELS = ['dry', 'optimal', 'wet', 'waterlogged'] as const;
export type SoilMoistureLevel = (typeof SOIL_MOISTURE_LEVELS)[number];

export const ISSUE_STATUSES = ['open', 'monitoring', 'resolved'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const RECORD_SEVERITIES = ['low', 'medium', 'high'] as const;
export type RecordSeverity = (typeof RECORD_SEVERITIES)[number];

export const RECOMMENDATION_TYPES = [
  'disease_management',
  'pest_management',
  'nutrient_management',
  'irrigation',
  'soil_amendment',
  'monitoring',
  'other',
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_PRIORITIES = ['normal', 'high', 'critical'] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export const FIELD_REC_STATUSES = ['open', 'monitoring', 'completed', 'escalated'] as const;
export type FieldRecStatus = (typeof FIELD_REC_STATUSES)[number];

export const RECOMMENDATION_FOLLOWED = ['yes', 'partially', 'no', 'not_applicable'] as const;
export type RecommendationFollowed = (typeof RECOMMENDATION_FOLLOWED)[number];

export const VISIT_FOLLOWUP_OUTCOMES = [
  'improved',
  'no_change',
  'worsened',
  'not_reviewed',
] as const;
export type VisitFollowupOutcome = (typeof VISIT_FOLLOWUP_OUTCOMES)[number];

export type MeasurementTemplate = {
  id: string;
  cropType: string;
  measurementKey: string;
  labelEn: string;
  labelMl: string | null;
  unit: string | null;
  inputType: string;
  options: unknown[];
  required: boolean;
  sortOrder: number;
};

export type IssueMasterRow = {
  id: string;
  category: IssueCategory;
  issueName: string;
  conceptCode: string | null;
  cropType: string | null;
};

export type StructuredVisitIssueInput = {
  category: IssueCategory;
  issueMasterId?: string;
  issueName: string;
  severity: RecordSeverity;
  observation?: string;
  status?: IssueStatus;
  photos?: Array<{ filename: string; mimeType: string; dataBase64: string }>;
  recommendations?: Array<{
    recommendationType?: RecommendationType;
    priority?: RecommendationPriority;
    text: string;
    reviewAfterDays?: number;
    reviewDate?: string;
    status?: FieldRecStatus;
  }>;
};

export type StructuredFieldVisitPayload = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  leadId?: string;
  visitedAt?: string;
  blockAssessment?: {
    blockHealth: BlockHealthLevel;
    cropPerformance: CropPerformanceLevel;
    soilMoisture: SoilMoistureLevel;
  };
  measurements?: Array<{ key: string; value: string; unit?: string }>;
  issues: StructuredVisitIssueInput[];
  followUps?: Array<{
    recommendationId: string;
    followed: RecommendationFollowed;
    outcome: VisitFollowupOutcome;
    notes?: string;
  }>;
  latitude?: number;
  longitude?: number;
};

export type FarmerNoteRow = {
  id: string;
  noteText: string;
  authorEmail: string | null;
  createdAt: string;
};

export type FollowUpBundle = {
  tasks: Array<Record<string, unknown>>;
  recommendationFollowUps: Array<Record<string, unknown>>;
  callbacks: Array<Record<string, unknown>>;
};
