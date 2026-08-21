export type SettlementRule = {
    firstPct: number;
    holdPct: number;
    firstDelayMonths: number;
    holdDelayMonths: number;
};
export declare const DEFAULT_SETTLEMENT_RULE: SettlementRule;
export declare function addCalendarMonths(yearMonth: string, months: number): string;
export declare function splitSettlement(grossInr: number, earningMonth: string, rule?: SettlementRule): Array<{
    tranche: 'eighty' | 'twenty';
    amountInr: number;
    payableOn: string;
}>;
//# sourceMappingURL=settlement-split.d.ts.map