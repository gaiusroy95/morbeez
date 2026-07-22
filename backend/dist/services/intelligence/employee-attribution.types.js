export const ATTRIBUTION_TYPES = [
    'first_engagement',
    'relationship_owner',
    'telecaller_assigned',
    'advisory',
    'conversion_assist',
    'reactivation',
];
export const ATTRIBUTION_EMPLOYEE_ROLES = [
    'telecaller',
    'agronomist',
    'operations',
    'manager',
    'admin',
    'system',
];
/** Default weights by attribution type (product rules — see PHASE0-ATTRIBUTION-RULES.md). */
export const DEFAULT_ATTRIBUTION_WEIGHTS = {
    first_engagement: 0.35,
    relationship_owner: 0.25,
    telecaller_assigned: 0.2,
    advisory: 0.4,
    conversion_assist: 0.3,
    reactivation: 0.25,
};
//# sourceMappingURL=employee-attribution.types.js.map