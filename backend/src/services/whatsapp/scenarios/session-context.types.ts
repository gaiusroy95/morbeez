import type { DosageItem, StructuredAdvisory } from '../../ai/types.js';

/** JSON stored on conversation_sessions.context */
export interface DiagnosisPending {
  imageCount: number;
  lastSessionId?: string;
  lastAdvisorySummary?: string;
  dosageItems?: DosageItem[];
  technicalOnly?: boolean;
}

export interface SessionContext {
  diagnosis?: DiagnosisPending;
  chimbDrainage?: 'yes' | 'no' | 'unsure';
  activeMenu?: string;
  lastImageHash?: string;
  activeCropType?: string;
  activePlotLabel?: string;
  /** Symptoms text saved while farmer picks a plot (Scenario 29) */
  pendingSymptomsText?: string;
  /** Checkout retry after payment failed (Scenario 36) */
  pendingCheckoutSessionId?: string;
  pendingRazorpayOrderId?: string;
  /** Cultivation follow-ups (30–31) */
  pendingCultivationPrompt?: 'application' | 'result';
  pendingResultActivityId?: string;
  lastAdvisorySessionId?: string;
  /** Crop selection fallback after image when AI cannot infer crop */
  pendingCropSelection?: boolean;
  /** Minimal onboarding after language selection */
  onboardingStep?: 'pincode' | 'acreage' | 'crop' | 'custom_crop' | 'planting_date';
  onboardingAcreageBucket?: '0_1' | '2_5' | '5_plus';
  /** Set true after acre → plot → planting date flow completes */
  onboardingComplete?: boolean;
  /** Auto recommendation follow-up engine */
  pendingRecommendationRecordId?: string;
  pendingRecommendationFollowUp?: 'application' | 'outcome' | 'compliance';
  /** Assessment playbook router (insect / weed / compatibility, etc.) */
  lastPlaybookCategory?: string;
  /** ROI tracker (farmers add only; telecaller edits in CRM) */
  roiPendingEntryType?: string;
  roiPendingEntryDate?: string;
  roiPendingAmount?: number;
  roiAwaitingCommentsChoice?: boolean;
  roiAwaitingCommentsText?: boolean;
  /** Full advisory held until soil report is confirmed or uploaded */
  pendingNutrientAdvisory?: {
    sessionId: string;
    advisory: StructuredAdvisory;
    productTitles?: string[];
  };
  /** WhatsApp manual soil lab entry (macro → micro) */
  soilLabStep?: 'macro' | 'micro' | 'soil_type';
  soilLabDraft?: Record<string, unknown>;
  soilLabBlockId?: string;
  /** Farmer Experience Learning — correction after AI diagnosis */
  farmerFeedbackId?: string;
  farmerFeedbackStep?: 'diagnosis' | 'experience_years' | 'experience' | 'product' | 'outcome';
  /** Photo uploaded at start of diagnosis intake (kept after intake completes). */
  pendingDiagnosisImagePath?: string;
  pendingDiagnosisImageMime?: string;
  /** Multiple photos batched when farmer sends several images at once. */
  pendingDiagnosisImageBatch?: Array<{
    path: string;
    mime: string;
    hash: string;
    messageId?: string;
  }>;
  /** Latest Ginger SOP v3 case snapshot (persisted on ai_advisory_sessions.metadata too). */
  gingerSopCase?: import('../../../domain/ginger-sop/types.js').GingerSopCase;
  maiosCase?: import('../../../domain/case/types.js').MaiosCase;
  /** AI-planned follow-up before Crop Doctor (one question at a time, no hardcoded bank). */
  diagnosisIntake?: {
    initialSymptoms: string;
    questions: Array<{
      id: string;
      kind: 'yes_no' | 'multiple_choice' | 'photo';
      text: string;
      choices: Array<{ id: string; labelEn: string; labelMl: string }>;
      purpose?: string;
      libraryId?: string;
      fromExpertLibrary?: boolean;
    }>;
    currentIndex: number;
    answers: Record<string, string>;
    questionTexts: Record<string, string>;
    questionKinds: Record<string, 'yes_no' | 'multiple_choice' | 'photo'>;
    questionChoices: Record<string, Array<{ id: string; labelEn: string; labelMl: string }>>;
    questionsAsked: number;
    maxQuestions: number;
    pendingSavedQuestions?: Array<{
      id: string;
      kind: 'yes_no' | 'multiple_choice' | 'photo';
      text: string;
      choices: Array<{ id: string; labelEn: string; labelMl: string }>;
      purpose?: string;
      libraryId?: string;
      fromExpertLibrary?: boolean;
    }>;
    similarCases: Array<{ issueLabel: string; score: number; reuseCaseId?: string }>;
    bestIssueLabel?: string;
    matchConfidence?: number;
    totalVerifiedCases?: number;
    confidenceBand?: 'high' | 'medium' | 'low';
    pendingPhoto?: boolean;
    evidenceMode?: boolean;
  };
  /** After Crop Doctor when confidence is below review threshold — AI-planned clarification before final reply. */
  postDiagnosisIntake?: {
    sessionId: string;
    cropType: string;
    advisorySnapshot: {
      probableIssue: string;
      confidence: number;
      uncertain?: boolean;
      imageObservations?: string[];
      stressAnalysis?: string[];
      differentialDiagnosis?: Array<{ label: string; reason: string; probability?: number }>;
      rejectedHypotheses?: string[];
    };
    questions: Array<{
      id: string;
      kind: 'yes_no' | 'multiple_choice' | 'photo';
      text: string;
      choices: Array<{ id: string; labelEn: string; labelMl: string }>;
      purpose?: string;
    }>;
    currentIndex: number;
    answers: Record<string, string>;
    questionTexts: Record<string, string>;
    questionKinds: Record<string, 'yes_no' | 'multiple_choice' | 'photo'>;
    questionChoices: Record<string, Array<{ id: string; labelEn: string; labelMl: string }>>;
    questionsAsked: number;
    maxQuestions: number;
  };
  /** Stored until post-diagnosis Q&A completes (then farmer gets full advisory). */
  pendingDiagnosisDelivery?: {
    sessionId: string;
    escalated: boolean;
    reused: boolean;
    confidence: number;
    plotLabel?: string;
  };
}
