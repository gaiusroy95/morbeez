export const ATTRIBUTION_TYPES = [
  'first_engagement',
  'relationship_owner',
  'telecaller_assigned',
  'advisory',
  'conversion_assist',
  'reactivation',
] as const;

export type AttributionType = (typeof ATTRIBUTION_TYPES)[number];

export const ATTRIBUTION_EMPLOYEE_ROLES = [
  'telecaller',
  'agronomist',
  'operations',
  'manager',
  'admin',
  'system',
] as const;

export type AttributionEmployeeRole = (typeof ATTRIBUTION_EMPLOYEE_ROLES)[number];

/** Default weights by attribution type (product rules — see PHASE0-ATTRIBUTION-RULES.md). */
export const DEFAULT_ATTRIBUTION_WEIGHTS: Record<AttributionType, number> = {
  first_engagement: 0.35,
  relationship_owner: 0.25,
  telecaller_assigned: 0.2,
  advisory: 0.4,
  conversion_assist: 0.3,
  reactivation: 0.25,
};

export type UpsertAttributionInput = {
  farmerId: string;
  employeeProfileId: string;
  attributionType: AttributionType;
  employeeRole: AttributionEmployeeRole;
  weight?: number;
  touchAt?: string;
  metadata?: Record<string, unknown>;
};

export type EmployeeFarmerAttributionRow = {
  id: string;
  farmerId: string;
  employeeProfileId: string;
  attributionType: AttributionType;
  employeeRole: AttributionEmployeeRole;
  weight: number;
  firstTouchAt: string;
  lastTouchAt: string;
  touchCount: number;
  active: boolean;
};
