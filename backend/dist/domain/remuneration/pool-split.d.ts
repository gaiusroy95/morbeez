export type PoolSplit = {
    poolPct: number;
    agronomistMaxPct: number;
    partnerMaxPct: number;
};
export declare function resolvePoolSplit(input: {
    poolPct: number;
    agronomistMaxPct?: number | null;
    partnerMaxPct?: number | null;
}): PoolSplit;
export declare function validatePoolSplit(split: PoolSplit): void;
//# sourceMappingURL=pool-split.d.ts.map