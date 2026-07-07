/** Scientific management plan — agronomic actions only (no product SKUs). */
export type ScientificManagementPlan = {
  diagnosisLabel: string;
  objectives: string[];
  ipm: string[];
  cultural: string[];
  nutrition: string[];
  biological: string[];
  chemical: Array<{ activeIngredientClass: string; notes: string }>;
  monitoring: string[];
};

export type SafetyRule = {
  id: string;
  check: 'crop_stage' | 'weather' | 'compatibility' | 'phi_rei' | 'resistance';
  condition: string;
  rejectReason: string;
};

export type SafetyValidationResult = {
  status: 'PASS' | 'REJECT';
  checks: Array<{ ruleId: string; passed: boolean; reason: string }>;
  rejectReasons: string[];
};

export type DiagnosisFinalReport = {
  version: '17.0';
  diagnosis: string | null;
  confidence: number;
  decision: 'LOCK' | 'CONTINUE';
  evidence: Array<{ label: string; source: string; reliability: number }>;
  explanation: {
    supporting: string[];
    rejected: string[];
    missing: string[];
  };
  management: ScientificManagementPlan | null;
  safety: SafetyValidationResult | null;
  nextStep: string | null;
  farmerSummary: string;
  agronomistSummary: string;
};

export type DiseaseManagementRule = {
  diseaseLabel: string;
  objectives: string[];
  ipm: string[];
  cultural: string[];
  nutrition: string[];
  biological: string[];
  chemical: Array<{ activeIngredientClass: string; notes: string }>;
  monitoring: string[];
};
