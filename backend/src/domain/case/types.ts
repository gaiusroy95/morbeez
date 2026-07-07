/** MAIOS v12 — universal crop intelligence case model */

export const MAIOS_VERSION = '12.0' as const;

export type MaiosTriageLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type MaiosChannel = 'whatsapp' | 'api' | 'web' | 'field_visit' | 'telecaller';
export type EvidenceTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export type MaiosRoute =
  | 'auto_recommend'
  | 'agronomist_review'
  | 'telecaller_validate'
  | 'collect_evidence'
  | 'field_visit'
  | 'emergency_callback';

export type MaiosGateId =
  | 'G0_identity'
  | 'G1_evidence'
  | 'G2_triage'
  | 'G3_confidence'
  | 'G4_soil'
  | 'G5_recovery';

export type MaiosModuleKey =
  | 'geo'
  | 'photo'
  | 'canopy'
  | 'field'
  | 'root'
  | 'soil'
  | 'water'
  | 'history'
  | 'weather'
  | 'regional'
  | 'lab';

export type MaiosRiskTag =
  | 'HIGH_PH_RISK'
  | 'LOW_PH_RISK'
  | 'HIGH_EC_RISK'
  | 'WATERLOG_RISK'
  | 'HEAT_STRESS'
  | 'WATER_STRESS'
  | 'FUNGAL_PRESSURE'
  | 'LOW_LIGHT_RISK'
  | 'NUTRIENT_DEFICIENCY_RISK'
  | 'ROOT_STRESS_RISK'
  | 'RESISTANCE_RISK';

export type MaiosGateDecision = {
  gate: MaiosGateId;
  passed: boolean;
  action?: MaiosRoute;
  reason: string;
};

export type MaiosPhotoEvidence = {
  slot: string;
  status: 'missing' | 'captured' | 'rejected';
  qualityScore: number;
  storagePath?: string;
  messageId?: string;
};

export type MaiosHypothesis = {
  label: string;
  probability: number;
  source: 'ai' | 'fusion' | 'reuse' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
};

export type MaiosModuleScore = {
  module: MaiosModuleKey;
  weight: number;
  score: number;
  completeness: number;
  source: 'computed' | 'ai' | 'human' | 'missing';
};

export type MaiosWeatherStress = {
  heatStress: number;
  waterStress: number;
  diseasePressure: number;
};

export type MaiosCaseIdentity = {
  farmerId: string;
  blockId?: string | null;
  cropType: string;
  cropPackId?: string | null;
  variety?: string | null;
  acreage?: number | null;
  plantingDate?: string | null;
  dap?: number | null;
  stage?: string | null;
  complete: boolean;
  missingFields: string[];
};

export type MaiosFieldMetrics = {
  plantHeightCm?: number | null;
  shootsPerHill?: number | null;
  leavesPerShoot?: number | null;
  shootDiameterMm?: number | null;
  spad?: number | null;
  sampleCount?: number;
};

export type MaiosCanopyAudit = {
  bedFloorVisibilityScore?: number | null;
  weedPressureScore?: number | null;
  canopyClosurePct?: number | null;
  dapExpectedClosurePct?: number | null;
  canopyGapPct?: number | null;
  auditComplete: boolean;
};

export type MaiosWaterReading = {
  irrigationPh?: number | null;
  irrigationEc?: number | null;
  source: 'field_visit' | 'metadata' | 'lab' | 'missing';
};

export type MaiosInputHistoryEntry = {
  appliedAt: string;
  activityType: string;
  products: string[];
  dosageNotes?: string | null;
};

export type MaiosInputHistorySummary = {
  days: number;
  entries: MaiosInputHistoryEntry[];
  sprayCount: number;
  fertigationCount: number;
  warnings: string[];
  hasRecentActivity: boolean;
};

export type MaiosLabReport = {
  type: 'soil' | 'water' | 'leaf' | 'pathogen';
  reportedAt: string;
  metrics: Record<string, unknown>;
  source: string;
};

export type MaiosGroundRemote = {
  geoPhotoCount?: number;
  stressFlags?: Array<{ type: string; score: number; capturedAt?: string }>;
  satelliteNdvi?: number | null;
  ndviSource?: 'block_stress' | 'weather_snapshot' | 'unavailable';
};

export type MaiosCausalLink = {
  cause: string;
  effect: string;
  confidence?: number;
};

export type MaiosOutcome = {
  day: number;
  status: 'improved' | 'same' | 'worse';
  at: string;
};

export type MaiosPredictiveRisk = {
  disease: number;
  pest: number;
  nutrient: number;
  irrigation: number;
  weather: number;
};

export type MaiosSupplySignals = {
  stockStatus?: 'in_stock' | 'low' | 'out_of_stock';
  substitutes?: string[];
  leadTimeDays?: number | null;
};

export type MaiosCase = {
  maiosVersion: typeof MAIOS_VERSION;
  sopVersion: string;
  channel: MaiosChannel;
  sessionId?: string;
  identity: MaiosCaseIdentity;
  triage: { level: MaiosTriageLevel; reason: string };
  riskTags: MaiosRiskTag[];
  evidence: {
    photos: MaiosPhotoEvidence[];
    completenessPct: number;
    eqs: number;
    tier: EvidenceTier;
  };
  weatherStress: MaiosWeatherStress;
  diagnostics: {
    hypotheses: MaiosHypothesis[];
    primary?: string;
    secondary?: string;
    moduleScores: MaiosModuleScore[];
    modelConfidence: number;
    fusedConfidence: number;
    modelAgreement?: number;
    causalChain?: MaiosCausalLink[];
    explanation?: string;
    rejectedHypotheses?: string[];
    temporalComparison?: string;
  };
  gates: MaiosGateDecision[];
  route: MaiosRoute;
  recoveryDaysEstimate?: number | null;
  createdAt: string;
  fieldMetrics?: MaiosFieldMetrics;
  canopyAudit?: MaiosCanopyAudit;
  waterReading?: MaiosWaterReading;
  inputHistory?: MaiosInputHistorySummary;
  labReports?: MaiosLabReport[];
  groundRemote?: MaiosGroundRemote;
  outcomes?: MaiosOutcome[];
  resistanceScore?: number | null;
  resistanceClasses?: string[];
  executionVerification?: { score: number; checks: string[] };
  failureType?: 'ai_failure' | 'agronomist_failure' | 'farmer_failure' | 'product_failure' | null;
  predictiveRisk?: MaiosPredictiveRisk;
  supplySignals?: MaiosSupplySignals;
  regionalClusterId?: string | null;
  /** v17 Bayesian reasoning layer — additive; does not replace v12 diagnostics when shadowMode is on. */
  reasoning?: import('../maios-reasoning/types.js').MaiosReasoningSnapshot;
};

export type MaiosBuildInput = {
  farmerId: string;
  blockId?: string | null;
  cropType: string;
  channel: MaiosChannel;
  sessionId?: string;
  symptomsText?: string;
  photoCount?: number;
  photoStoragePaths?: string[];
  photoCaptions?: string[];
  hasSoilReport?: boolean;
  hasFieldInvestigation?: boolean;
  intakeMatchConfidence?: number;
  contextPack?: {
    soilPh?: number;
    soilEc?: number;
    weatherRiskScore?: number;
    heavyRainLikely?: boolean;
    highHeatLikely?: boolean;
    highHumidityLikely?: boolean;
    drainageRisk?: 'low' | 'moderate' | 'high';
    dap?: number;
  };
  advisory?: {
    probableIssue: string;
    confidence: number;
    severity?: 'mild' | 'moderate' | 'severe';
    uncertain?: boolean;
    escalationRecommended?: boolean;
    differentialDiagnosis?: Array<{ label: string; reason: string; probability?: number }>;
    causalChain?: MaiosCausalLink[];
    explanation?: string;
    rejectedHypotheses?: string[];
    recommendedProductTags?: string[];
  };
  plantIdConfidence?: number;
  fieldMetrics?: MaiosFieldMetrics;
  canopyAudit?: MaiosCanopyAudit;
  waterReading?: MaiosWaterReading;
  inputHistory?: MaiosInputHistorySummary;
  labReports?: MaiosLabReport[];
  visitFindingId?: string | null;
  farmerAnswers?: Array<{ questionId?: string; questionText: string; answer: string }>;
  visionObservations?: Array<{ feature: string; value: string; confidence: number }>;
};
