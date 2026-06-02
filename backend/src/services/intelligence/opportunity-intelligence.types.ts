/** Weight caps for farmer opportunity score (sum = 100). */
export const FARMER_OPPORTUNITY_WEIGHTS = {
  engagement: 20,
  trust: 15,
  acreSize: 15,
  acrePotential: 20,
  relationship: 10,
  advisoryCooperation: 10,
  cropValue: 5,
  referralInfluence: 5,
} as const;

/** Weight caps for employee performance score (sum = 100). */
export const EMPLOYEE_PERFORMANCE_WEIGHTS = {
  engagementGrowth: 20,
  relationshipQuality: 20,
  retentionQuality: 15,
  trustBuilding: 15,
  delayedConversion: 10,
  farmerReactivation: 10,
  knowledgeContribution: 5,
  farmerSatisfaction: 5,
} as const;

export type ScoreFactor = {
  code: string;
  label: string;
  delta?: number;
  evidence?: Record<string, unknown>;
};

export type FarmerScoreComponents = {
  engagement: number;
  trust: number;
  acreSize: number;
  acrePotential: number;
  relationship: number;
  advisoryCooperation: number;
  cropValue: number;
  referralInfluence: number;
};

export type EmployeeScoreComponents = {
  engagementGrowth: number;
  relationshipQuality: number;
  retentionQuality: number;
  trustBuilding: number;
  delayedConversion: number;
  farmerReactivation: number;
  knowledgeContribution: number;
  farmerSatisfaction: number;
};

export const OPPORTUNITY_ENGINE_VERSION = 'v1';
