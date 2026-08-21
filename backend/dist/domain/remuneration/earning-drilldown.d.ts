export type MonthBucket = {
    month: string;
    earned: number;
    held: number;
    due: number;
    paid: number;
};
export declare function lastNMonths(n: number, asOf?: Date): string[];
export declare function emptyBuckets(months: string[]): MonthBucket[];
export declare function addToBucket(buckets: MonthBucket[], month: string, field: keyof Omit<MonthBucket, 'month'>, amount: number): void;
//# sourceMappingURL=earning-drilldown.d.ts.map