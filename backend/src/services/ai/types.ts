/** Structured AI advisory response — provider-agnostic */

export type AdvisoryLanguage = 'en' | 'ml' | 'ta' | 'kn' | 'hi';

export interface NutrientDeficiencyItem {
  nutrient: string;
  likelihood: 'low' | 'medium' | 'high';
  signs: string;
}

export interface TreatmentItem {
  action: string;
  productType?: string;
  timing?: string;
}

export interface DosageItem {
  product: string;
  rate: string;
  method: string;
  frequency?: string;
}

export type AdvisorySeverity = 'mild' | 'moderate' | 'severe';

export interface DifferentialDiagnosisItem {
  label: string;
  reason: string;
  /** 0–1 probability estimate (SOP v3 top-5 differential) */
  probability?: number;
}

export type DiagnosisRankRole = 'primary' | 'contributing' | 'disease_watch' | 'alternative';

export interface DiagnosisRankItem {
  label: string;
  probability: number;
  role: DiagnosisRankRole;
  stars: number;
}

export interface CostEstimateItem {
  item: string;
  note: string;
}

export interface StructuredAdvisory {
  probableIssue: string;
  confidence: number;
  uncertain: boolean;
  nutrientDeficiency: NutrientDeficiencyItem[];
  stressAnalysis: string[];
  treatments: TreatmentItem[];
  dosageGuidance: DosageItem[];
  precautions: string[];
  escalationRecommended: boolean;
  escalationReason?: string;
  farmerSummaryEn: string;
  farmerSummaryMl: string;
  recommendedProductTags: string[];
  /** Systematic photo / field observations */
  imageObservations?: string[];
  severity?: AdvisorySeverity;
  differentialDiagnosis?: DifferentialDiagnosisItem[];
  causalChain?: Array<{ cause: string; effect: string; confidence?: number }>;
  explanation?: string;
  rejectedHypotheses?: string[];
  sprayTiming?: string;
  rootCorrection?: string;
  agronomistAssessment?: string;
  morbeezDataUsed?: string[];
  costEstimate?: CostEstimateItem[];
  /** Farmer-facing headline after Bayesian + treatment alignment (v17 presentation). */
  diagnosisHeadline?: string;
  diagnosisRanked?: DiagnosisRankItem[];
  diseaseWatchNote?: string;
  treatmentAlignmentNote?: string;
  contributingFactor?: string;
  recoveryOutlook?: 'excellent' | 'good' | 'moderate' | 'poor';
  recoveryReason?: string;
  monitorAdvice?: string;
  lastFertilizer?: string;
  lastFertilizerDate?: string;
  lastFertilizerDaysAgo?: string;
  lastFoliarSpray?: string;
  lastFoliarSprayDate?: string;
  lastFoliarSprayDaysAgo?: string;
  lastDrench?: string;
  lastDrenchDate?: string;
  lastDrenchDaysAgo?: string;
  previousDisease?: string;
  previousRecommendation?: string;
  previousDiagnosisStatus?: string;
  /** Full MORBEEZ CROP DOCTOR farmer report (WhatsApp / farmer surfaces). */
  farmerReport?: string;
  /** Agronomist-only technical appendix (Bayesian scores, etc.). */
  technicalReport?: string;
}

export interface PlantIdHealthResult {
  diseases?: Array<{ name: string; probability: number }>;
  suggestions?: Array<{ name: string; probability: number }>;
  isHealthy?: boolean;
  raw: Record<string, unknown>;
}

export interface DiagnoseInput {
  farmerId: string;
  phone?: string;
  cropType: string;
  cropStage?: string;
  language: AdvisoryLanguage;
  symptomsText?: string;
  voiceTranscript?: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** Supabase storage path in advisory-images (set when farmer photo is persisted). */
  imageStoragePath?: string;
  /** All photos from a batched WhatsApp upload (primary image is imageBase64 / imageStoragePath). */
  diagnosisImages?: Array<{
    imageBase64?: string;
    imageMimeType: string;
    imageStoragePath?: string;
  }>;
  channel: 'api' | 'whatsapp' | 'web' | 'telecaller';
  /** WhatsApp pipeline: minimal history string (low token cost) */
  compactHistory?: string;
  /** Environmental + regional context (weather, season, nearby cases) */
  contextPack?: Record<string, unknown>;
  /** Pre-formatted environmental block for the model prompt */
  environmentalContext?: string;
  /** Full Morbeez field intelligence block (soil, fusion, expert cases) */
  morbeezFieldContext?: string;
  /** Active farm block for soil/weather context */
  activePlotId?: string | null;
  /** Farmer follow-up Q&A — when set, skip reuse cache and require model to honor answers */
  fieldInvestigation?: string;
  /** Hint from similar cases + intake reasoning */
  issueLabelHint?: string;
  skipReuseCache?: boolean;
  /** Follow-up Q&A from WhatsApp intake — stored for learning loop on approval */
  investigationPattern?: {
    initialSymptoms: string;
    issueLabel: string;
    qa: Array<{ question: string; answer: string; kind?: string }>;
  };
  /** Ginger SOP v3 — photo count for evidence scoring */
  gingerSopPhotoCount?: number;
  gingerSopPhotoPaths?: string[];
  gingerSopIntakeConfidence?: number;
  gingerSopHasSoilReport?: boolean;
  /** MAIOS v12 aliases */
  maiosPhotoCount?: number;
  maiosPhotoPaths?: string[];
  maiosIntakeConfidence?: number;
  maiosHasSoilReport?: boolean;
}

export interface DiagnoseResult {
  sessionId: string;
  advisory: StructuredAdvisory;
  productRecommendations: ProductRecommendation[];
  escalated: boolean;
  escalationId?: string;
  /** Merged GPT + Plant.id confidence score */
  confidence?: number;
  /** Scenario 38 — served from advisory_reuse_cases without OpenAI */
  reused?: boolean;
  /** Ginger SOP v3 case snapshot when crop is ginger */
  gingerSopCase?: import('../../domain/ginger-sop/types.js').GingerSopCase;
  /** MAIOS v12 universal case */
  maiosCase?: import('../../domain/case/types.js').MaiosCase;
}

export interface ProductRecommendation {
  shopifyProductHandle?: string;
  productTitle: string;
  reason: string;
  dosageSchedule?: Record<string, string>;
  priority: number;
  comboKitId?: string;
}
