/** ₹400 product wallet: consume from purchases, restore on return, never pay leftover as cash. */
export declare function round2(n: number): number;
export declare function productRewardBalance(maxInr: number, usedInr: number): number;
export declare function consumeProductReward(input: {
    maxInr: number;
    usedInr: number;
    purchaseInr: number;
}): {
    consumeInr: number;
    usedInr: number;
    balanceInr: number;
};
export declare function restoreProductReward(input: {
    maxInr: number;
    usedInr: number;
    restoreInr: number;
}): {
    restoreInr: number;
    usedInr: number;
    balanceInr: number;
};
//# sourceMappingURL=product-reward.d.ts.map