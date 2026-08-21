export declare const partnerKpiService: {
    computeMonthlySnapshot(partnerId: string, periodStart: Date, periodEnd: Date): Promise<any>;
    recomputeAllForMonth(month: string): Promise<any[]>;
    maybePromoteTier(partnerId: string): Promise<string | null>;
};
//# sourceMappingURL=partner-kpi.service.d.ts.map