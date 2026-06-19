/** Morbeez AI Crop Doctor SOP v3.0 — ginger case model */
export declare const GINGER_SOP_VERSION: "3.0";
export type GingerTriageLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type GingerSopChannel = 'whatsapp' | 'api' | 'web' | 'field_visit' | 'telecaller';
export type GingerPhotoSlotId = 'field_wide' | 'affected_zone' | 'healthy_zone' | 'canopy_top' | 'canopy_side' | 'bed_bottom' | 'new_leaf_close' | 'old_leaf_close' | 'leaf_underside' | 'root_photo' | 'rhizome_outside' | 'rhizome_cut';
export type GingerRiskTag = 'HIGH_PH_RISK' | 'LOW_PH_RISK' | 'HIGH_EC_RISK' | 'WATERLOG_RISK' | 'HEAT_STRESS' | 'WATER_STRESS' | 'FUNGAL_PRESSURE' | 'LOW_LIGHT_RISK' | 'NUTRIENT_DEFICIENCY_RISK' | 'ROOT_STRESS_RISK';
export type GingerModuleKey = 'geo' | 'photo' | 'canopy' | 'field' | 'root' | 'soil' | 'water' | 'history' | 'weather';
export type GingerSopRoute = 'auto_recommend' | 'agronomist_review' | 'telecaller_validate' | 'collect_evidence' | 'field_visit' | 'emergency_callback';
export type GingerGateId = 'G0_identity' | 'G1_evidence' | 'G2_triage' | 'G3_confidence' | 'G4_soil' | 'G5_recovery';
export type GingerGateDecision = {
    gate: GingerGateId;
    passed: boolean;
    action?: GingerSopRoute;
    reason: string;
};
export type GingerPhotoEvidence = {
    slot: GingerPhotoSlotId;
    status: 'missing' | 'captured' | 'rejected';
    qualityScore: number;
    storagePath?: string;
    messageId?: string;
};
export type GingerHypothesis = {
    label: string;
    probability: number;
    source: 'ai' | 'fusion' | 'reuse';
};
export type GingerModuleScore = {
    module: GingerModuleKey;
    weight: number;
    score: number;
    completeness: number;
    source: 'computed' | 'ai' | 'human' | 'missing';
};
export type GingerWeatherStress = {
    heatStress: number;
    waterStress: number;
    diseasePressure: number;
};
export type GingerCaseIdentity = {
    farmerId: string;
    blockId?: string | null;
    cropType: string;
    variety?: string | null;
    acreage?: number | null;
    plantingDate?: string | null;
    dap?: number | null;
    complete: boolean;
    missingFields: string[];
};
export type GingerSopCase = {
    sopVersion: typeof GINGER_SOP_VERSION;
    channel: GingerSopChannel;
    sessionId?: string;
    identity: GingerCaseIdentity;
    triage: {
        level: GingerTriageLevel;
        reason: string;
    };
    riskTags: GingerRiskTag[];
    evidence: {
        photos: GingerPhotoEvidence[];
        completenessPct: number;
        tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
    };
    weatherStress: GingerWeatherStress;
    diagnostics: {
        hypotheses: GingerHypothesis[];
        primary?: string;
        secondary?: string;
        moduleScores: GingerModuleScore[];
        modelConfidence: number;
        fusedConfidence: number;
    };
    gates: GingerGateDecision[];
    route: GingerSopRoute;
    recoveryDaysEstimate?: number | null;
    createdAt: string;
    /** Phase B — field visit / measurement data */
    fieldMetrics?: GingerFieldMetrics;
    canopyAudit?: GingerCanopyAudit;
    waterReading?: GingerWaterReading;
    inputHistory?: GingerInputHistorySummary;
};
export type GingerFieldMetrics = {
    plantHeightCm?: number | null;
    shootsPerHill?: number | null;
    leavesPerShoot?: number | null;
    shootDiameterMm?: number | null;
    spad?: number | null;
    sampleCount?: number;
};
export type GingerCanopyAudit = {
    bedFloorVisibilityScore?: number | null;
    weedPressureScore?: number | null;
    canopyClosurePct?: number | null;
    dapExpectedClosurePct?: number | null;
    canopyGapPct?: number | null;
    auditComplete: boolean;
};
export type GingerWaterReading = {
    irrigationPh?: number | null;
    irrigationEc?: number | null;
    source: 'field_visit' | 'metadata' | 'missing';
};
export type GingerInputHistoryEntry = {
    appliedAt: string;
    activityType: string;
    products: string[];
    dosageNotes?: string | null;
};
export type GingerInputHistorySummary = {
    days: number;
    entries: GingerInputHistoryEntry[];
    sprayCount: number;
    fertigationCount: number;
    warnings: string[];
    hasRecentActivity: boolean;
};
export type GingerSopBuildInput = {
    farmerId: string;
    blockId?: string | null;
    cropType: string;
    channel: GingerSopChannel;
    sessionId?: string;
    symptomsText?: string;
    photoCount?: number;
    photoStoragePaths?: string[];
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
        differentialDiagnosis?: Array<{
            label: string;
            reason: string;
            probability?: number;
        }>;
    };
    plantIdConfidence?: number;
    /** Phase B — pre-loaded field context (optional; otherwise loaded from DB) */
    fieldMetrics?: GingerFieldMetrics;
    canopyAudit?: GingerCanopyAudit;
    waterReading?: GingerWaterReading;
    inputHistory?: GingerInputHistorySummary;
    visitFindingId?: string | null;
};
//# sourceMappingURL=types.d.ts.map