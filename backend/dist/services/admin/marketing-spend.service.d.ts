export declare const marketingSpendService: {
    getMonthTotal(monthYear: string): Promise<number>;
    listByMonth(monthYear: string): Promise<any[]>;
    addEntry(input: {
        monthYear: string;
        channel: string;
        amountInr: number;
        notes?: string;
        recordedBy?: string;
    }): Promise<any>;
};
//# sourceMappingURL=marketing-spend.service.d.ts.map