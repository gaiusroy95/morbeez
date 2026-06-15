export const ISSUE_CATEGORIES = [
  'disease',
  'pest',
  'nutrient_deficiency',
  'nutrient_toxicity',
  'water_stress',
  'environmental_stress',
  'soil_problem',
  'growth_issue',
  'chemical_injury',
  'mechanical_damage',
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

export const AGRONOMIST_REVIEW_ACTIONS = [
  'approve_ai',
  'correct_ai',
  'partial_match',
  'escalate_urgent',
] as const;
export type AgronomistReviewAction = (typeof AGRONOMIST_REVIEW_ACTIONS)[number];

export const VISIT_AI_ANSWER_TYPES = ['yes_no_unknown', 'text', 'number'] as const;
export type VisitAiAnswerType = (typeof VISIT_AI_ANSWER_TYPES)[number];

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

export type VisitAiHypothesis = {
  id?: string;
  label: string;
  confidence: number;
  rationale?: string;
  selected?: boolean;
  imagePrediction?: string;
  imageConfidence?: number;
};

export type VisitAiQuestion = {
  id: string;
  questionText: string;
  answerType: VisitAiAnswerType;
  answer?: string;
};

export type VisitAgronomistReview = {
  action: AgronomistReviewAction;
  finalDiagnosis?: string;
  finalRecommendation?: string;
  modificationReason?: string;
  agronomistConfidence?: number;
  yieldRisk?: string;
};

export type VisitPhotoInput = {
  filename: string;
  mimeType: string;
  dataBase64: string;
  photoType?: string;
};

export type StructuredVisitIssueInput = {
  category: IssueCategory;
  issueMasterId?: string;
  issueName: string;
  severity: RecordSeverity;
  observation?: string;
  status?: IssueStatus;
  photos?: VisitPhotoInput[];
  aiCaseId?: string;
  agronomistReview?: VisitAgronomistReview;
  finalDiagnosis?: string;
  finalRecommendation?: string;
  reviewAfterDays?: number;
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
  visitPhotos?: VisitPhotoInput[];
  issues: StructuredVisitIssueInput[];
  followUps?: Array<{
    recommendationId: string;
    followed: RecommendationFollowed;
    outcome: VisitFollowupOutcome;
    notes?: string;
  }>;
  latitude?: number;
  longitude?: number;
  sendVisitSummary?: boolean;
};

export type VisitAiContextPack = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  cropType: string;
  dap: number | null;
  stage: string | null;
  blockAssessment?: {
    blockHealth: BlockHealthLevel;
    cropPerformance: CropPerformanceLevel;
    soilMoisture: SoilMoistureLevel;
  };
  measurements: Array<{ key: string; value: string; unit?: string }>;
  soilTestSummary: Record<string, unknown> | null;
  weatherSnapshot: Record<string, unknown> | null;
  gps: { latitude: number; longitude: number } | null;
};

export type VisitImageSignal = {
  label: string;
  confidence: number;
};

export type VisitSimilarCase = {
  issueLabel: string;
  score: number;
  confidence: number;
  outcome?: string | null;
};

export type VisitAnalyzeResponse = {
  aiCaseId: string;
  hypotheses: VisitAiHypothesis[];
  confidenceAction: 'auto_send' | 'employee_review' | 'escalate';
  skipFollowUpOptional: boolean;
  imageSignal: VisitImageSignal | null;
  similarCases: VisitSimilarCase[];
};

export type VisitAiCaseDetail = {
  id: string;
  category: string;
  issueName: string;
  finalDiagnosis: string | null;
  finalConfidence: number | null;
  confidenceAction: string | null;
  status: string;
  metadata: Record<string, unknown>;
  hypotheses: VisitAiHypothesis[];
  questions: VisitAiQuestion[];
  recommendations: Array<{
    aiText: string;
    humanText: string | null;
    reviewAction: string | null;
    reviewAfterDays: number | null;
  }>;
  fieldFindingId: string | null;
  visitedAt: string | null;
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
