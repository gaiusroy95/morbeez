export declare const ATTRIBUTION_TYPES: readonly ["first_engagement", "relationship_owner", "telecaller_assigned", "advisory", "conversion_assist", "reactivation"];
export type AttributionType = (typeof ATTRIBUTION_TYPES)[number];
export declare const ATTRIBUTION_EMPLOYEE_ROLES: readonly ["telecaller", "agronomist", "operations", "manager", "admin", "system"];
export type AttributionEmployeeRole = (typeof ATTRIBUTION_EMPLOYEE_ROLES)[number];
/** Default weights by attribution type (product rules — see PHASE0-ATTRIBUTION-RULES.md). */
export declare const DEFAULT_ATTRIBUTION_WEIGHTS: Record<AttributionType, number>;
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
//# sourceMappingURL=employee-attribution.types.d.ts.map