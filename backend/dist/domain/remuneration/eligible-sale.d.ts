export type EligibleSaleStatus = 'pending_payment' | 'pending_delivery' | 'pending_return_window' | 'eligible' | 'excluded';
export type EligibleSaleFacts = {
    paid: boolean;
    omsStatus: string | null;
    deliveredAt: string | null;
    cancelled: boolean;
    returned: boolean;
    refunded: boolean;
    fraud: boolean;
    excluded: boolean;
    excludedReason?: string | null;
    returnWindowDays: number;
    now?: Date;
};
export declare function addCalendarDaysIso(fromIso: string, days: number): string;
export declare function evaluateEligibleSale(facts: EligibleSaleFacts): {
    status: EligibleSaleStatus;
    reason: string | null;
    eligibleAt: string | null;
};
//# sourceMappingURL=eligible-sale.d.ts.map