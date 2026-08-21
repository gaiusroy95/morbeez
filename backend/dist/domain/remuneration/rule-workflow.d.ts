export declare const RULE_STATUSES: readonly ["draft", "submitted", "approved", "scheduled", "active", "expired"];
export type RuleStatus = (typeof RULE_STATUSES)[number];
export declare const RULE_TYPES: readonly ["partner_kpi_factor", "agronomist_sales_slab", "settlement_80_20", "eligible_sale", "farmer_introduction", "partner_kpi_weights", "agronomist_kpi", "qualified_case", "diagnosis_qa"];
export type RuleType = (typeof RULE_TYPES)[number];
export declare function canTransition(from: string, to: string): boolean;
export declare function assertTransition(from: string, to: string): void;
export declare function isMutableStatus(status: string): boolean;
export declare function shouldActivateNow(effectiveFrom: string, asOf?: Date): boolean;
export declare function previousMonth(asOf?: Date): string;
export declare function monthKey(asOf?: Date): string;
export declare function monthLastDay(month: string): Date;
export declare function monthRange(month: string): {
    start: Date;
    end: Date;
    startIso: string;
    endIso: string;
};
//# sourceMappingURL=rule-workflow.d.ts.map