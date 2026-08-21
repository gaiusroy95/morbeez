export type AgronomistEventType = 'field_visit' | 'km_allowance' | 'recommendation_success' | 'escalation_resolved' | 'retention' | 'sales_incentive' | 'sales_adjustment';
export type AgronomistCompSnapshot = {
    incentiveEnabled: boolean;
    fieldVisitBonus: number;
    recommendationSuccessBonus: number;
    escalationBonus: number;
    farmerRetentionBonus: number;
    kmAllowanceEnabled: boolean;
    ratePerKm: number;
};
export declare function amountForEvent(type: AgronomistEventType, comp: AgronomistCompSnapshot, extra?: {
    km?: number;
}): number;
export declare function periodMonth(at?: Date): string;
//# sourceMappingURL=agronomist-pay.d.ts.map