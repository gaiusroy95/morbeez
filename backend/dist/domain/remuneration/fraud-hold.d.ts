export declare const FRAUD_FLAG_TYPES: readonly ["duplicate_claim", "gps_missing", "fake_visit", "fake_km", "introduction_fraud", "order_fraud", "manual"];
export type FraudFlagType = (typeof FRAUD_FLAG_TYPES)[number];
export declare const FRAUD_FLAG_STATUSES: readonly ["open", "confirmed", "cleared"];
export type FraudFlagStatus = (typeof FRAUD_FLAG_STATUSES)[number];
export declare function blocksPayout(status: string): boolean;
export declare function payoutHoldFromFlags(flags: Array<{
    status: string;
}>): {
    hold: boolean;
    openCount: number;
    confirmedCount: number;
};
//# sourceMappingURL=fraud-hold.d.ts.map